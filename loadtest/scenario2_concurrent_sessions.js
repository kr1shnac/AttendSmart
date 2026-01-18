/**
 * k6 Load Test - Scenario 2: Concurrent Sessions
 *
 * Tests: 50 simultaneous classes with 20 students each
 * Validates: MongoDB connection pool, session isolation, Redis nonce store
 *
 * Run: k6 run --env BASE_URL=http://localhost:5000 scenario2_concurrent_sessions.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter, Gauge } from "k6/metrics";
import { SharedArray } from "k6/data";
import {
  BASE_URL,
  THRESHOLDS,
  generateVerificationPayload,
  getHeaders,
  TEST_DATA,
} from "./config.js";

// Custom metrics
const sessionCreateDuration = new Trend("session_create_duration");
const verificationDuration = new Trend("verification_duration");
const concurrentSessions = new Gauge("concurrent_sessions");
const duplicateNonceErrors = new Counter("duplicate_nonce_errors");
const dbConnectionErrors = new Counter("db_connection_errors");

// Test configuration - 50 classes, 20 students per class
const NUM_SESSIONS = 50;
const STUDENTS_PER_SESSION = 20;
const TOTAL_VUS = NUM_SESSIONS * STUDENTS_PER_SESSION; // 1000 VUs

export const options = {
  scenarios: {
    // Phase 1: Teachers create sessions
    session_creation: {
      executor: "shared-iterations",
      vus: NUM_SESSIONS,
      iterations: NUM_SESSIONS,
      maxDuration: "2m",
      exec: "createSession",
      tags: { phase: "setup" },
    },
    // Phase 2: Students verify attendance
    student_verification: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: TOTAL_VUS / 2 }, // Ramp to 500
        { duration: "1m", target: TOTAL_VUS }, // Ramp to 1000
        { duration: "2m", target: TOTAL_VUS }, // Hold at 1000
        { duration: "30s", target: 0 }, // Ramp down
      ],
      startTime: "2m", // Start after session creation
      exec: "verifyAttendance",
      tags: { phase: "verification" },
    },
  },
  thresholds: {
    ...THRESHOLDS,
    session_create_duration: ["p(95)<3000"],
    duplicate_nonce_errors: ["count<10"],
    db_connection_errors: ["count<5"],
  },
};

// Shared data: Session IDs created in Phase 1
const sessionStore = {
  sessions: [],
  addSession(id, classNum) {
    this.sessions.push({ id, classNum, createdAt: Date.now() });
  },
};

// Phase 1: Create sessions (teachers)
export function createSession() {
  const classNum = __VU;
  const sessionName = `LoadTest-Class-${classNum}`;

  group("Teacher Session Creation", function () {
    // Login as teacher
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: `teacher${(classNum % 10) + 1}@test.com`,
        password: "Test123!",
      }),
      {
        headers: { "Content-Type": "application/json" },
        tags: { type: "auth" },
      }
    );

    let token = "mock-token";
    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      token = body.token || body.data?.token || token;
    }

    // Create session
    const startTime = Date.now();
    const sessionRes = http.post(
      `${BASE_URL}/api/sessions`,
      JSON.stringify({
        name: sessionName,
        classId: `class_test_${String(classNum).padStart(3, "0")}`,
        startTime: new Date().toISOString(),
        duration: 60,
        location: TEST_DATA.campusLocation,
        bleBeaconId: `beacon_${classNum}`,
      }),
      {
        headers: getHeaders(token),
        tags: { type: "session" },
      }
    );

    sessionCreateDuration.add(Date.now() - startTime);
    concurrentSessions.add(classNum);

    check(sessionRes, {
      "session created": (r) => r.status === 200 || r.status === 201,
    });

    if (sessionRes.status === 200 || sessionRes.status === 201) {
      try {
        const body = JSON.parse(sessionRes.body);
        const sessionId = body.data?.session?._id || `session_${classNum}`;
        sessionStore.addSession(sessionId, classNum);
      } catch {
        sessionStore.addSession(`session_${classNum}`, classNum);
      }
    }
  });
}

// Phase 2: Verify attendance (students)
export function verifyAttendance() {
  // Assign student to a session based on VU number
  const sessionIndex = __VU % NUM_SESSIONS;
  const sessionId =
    sessionStore.sessions[sessionIndex]?.id || `session_${sessionIndex}`;
  const studentId = `student_${__VU}_${__ITER}`;

  group("Student Verification", function () {
    // Login as student
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: `student${(__VU % 50) + 1}@test.com`,
        password: "Test123!",
      }),
      {
        headers: { "Content-Type": "application/json" },
        tags: { type: "auth" },
      }
    );

    let token = "mock-token";
    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        token = body.token || body.data?.token || token;
      } catch {}
    }

    // Generate unique nonce for this request
    const payload = generateVerificationPayload(sessionId, studentId);

    // Submit verification
    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}/api/attendance/verify-unified`,
      JSON.stringify(payload),
      {
        headers: getHeaders(token),
        tags: { type: "verification" },
      }
    );

    verificationDuration.add(Date.now() - startTime);

    // Check for specific error types
    const success = check(res, {
      "status is 2xx": (r) => r.status >= 200 && r.status < 300,
      "no nonce replay error": (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.code === "NONCE_REPLAY" || body.message?.includes("nonce")) {
            duplicateNonceErrors.add(1);
            return false;
          }
          return true;
        } catch {
          return true;
        }
      },
      "no db connection error": (r) => {
        try {
          const body = JSON.parse(r.body);
          if (
            body.message?.includes("connection") ||
            body.message?.includes("pool")
          ) {
            dbConnectionErrors.add(1);
            return false;
          }
          return true;
        } catch {
          return true;
        }
      },
    });
  });

  // Student think time
  sleep(Math.random() * 3 + 2); // 2-5 seconds
}

export function handleSummary(data) {
  console.log(
    "\n========== SCENARIO 2: CONCURRENT SESSIONS RESULTS ==========\n"
  );

  const sessionP95 =
    data.metrics.session_create_duration?.values?.["p(95)"] || 0;
  const verifyP95 = data.metrics.verification_duration?.values?.["p(95)"] || 0;
  const nonceErrors = data.metrics.duplicate_nonce_errors?.values?.count || 0;
  const dbErrors = data.metrics.db_connection_errors?.values?.count || 0;

  console.log(
    `Sessions Created: ${data.metrics.concurrent_sessions?.values?.value || 0}`
  );
  console.log(`Session Creation P95: ${sessionP95.toFixed(0)}ms`);
  console.log(`Verification P95: ${verifyP95.toFixed(0)}ms`);
  console.log(`Nonce Replay Errors: ${nonceErrors}`);
  console.log(`DB Connection Errors: ${dbErrors}`);

  const passed = verifyP95 < 2000 && nonceErrors < 10 && dbErrors < 5;
  console.log(`\nResult: ${passed ? "✅ PASSED" : "❌ FAILED"}`);

  if (!passed) {
    console.log("\nBottlenecks:");
    if (nonceErrors >= 10)
      console.log("- Nonce collisions: Check Redis nonce store");
    if (dbErrors >= 5)
      console.log("- DB pool: Increase MongoDB connection limit");
    if (verifyP95 >= 2000)
      console.log("- High latency: Check concurrent query performance");
  }

  return {
    "loadtest/results/scenario2_summary.json": JSON.stringify(data, null, 2),
  };
}
