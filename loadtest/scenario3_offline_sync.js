/**
 * k6 Load Test - Scenario 3: Offline Sync Storm
 *
 * Tests: 500 devices sync after network outage (1500 verifications total)
 * Validates: Queue processing, no duplicate attendance, bulk insert performance
 *
 * Run: k6 run --env BASE_URL=http://localhost:5000 scenario3_offline_sync.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import {
  BASE_URL,
  THRESHOLDS,
  generateVerificationPayload,
  getHeaders,
  TEST_DATA,
} from "./config.js";

// Custom metrics
const syncDuration = new Trend("sync_duration");
const batchProcessDuration = new Trend("batch_process_duration");
const duplicateAttendance = new Counter("duplicate_attendance_records");
const syncSuccess = new Rate("sync_success_rate");
const queuedVerifications = new Counter("queued_verifications");

// Configuration
const NUM_DEVICES = 500;
const VERIFICATIONS_PER_DEVICE = 3;
const TOTAL_VERIFICATIONS = NUM_DEVICES * VERIFICATIONS_PER_DEVICE; // 1500

export const options = {
  scenarios: {
    // Simulate offline queue: All devices come online simultaneously
    sync_storm: {
      executor: "shared-iterations",
      vus: NUM_DEVICES,
      iterations: NUM_DEVICES,
      maxDuration: "5m",
      exec: "syncOfflineQueue",
    },
  },
  thresholds: {
    ...THRESHOLDS,
    sync_duration: ["p(95)<5000"], // 5s to process device queue
    batch_process_duration: ["p(95)<3000"], // 3s per batch
    duplicate_attendance_records: ["count<10"], // < 10 duplicates
    sync_success_rate: ["rate>0.95"], // 95% success
  },
};

// Simulate syncing a device's offline queue
export function syncOfflineQueue() {
  const deviceId = `device_${__VU}`;
  const studentId = `student_offline_${__VU}`;
  const sessionId = `session_offline_${(__VU % 10) + 1}`; // 10 different sessions

  group("Offline Queue Sync", function () {
    // Login
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: `student${(__VU % 50) + 1}@test.com`,
        password: "Test123!",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    let token = "mock-token";
    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        token = body.token || body.data?.token || token;
      } catch {}
    }

    // Simulate 3 offline verifications per device
    const offlineQueue = [];
    for (let i = 0; i < VERIFICATIONS_PER_DEVICE; i++) {
      offlineQueue.push({
        ...generateVerificationPayload(sessionId, studentId),
        offlineId: `offline_${deviceId}_${i}`,
        queuedAt: Date.now() - i * 60000, // Staggered timestamps
        deviceId,
      });
      queuedVerifications.add(1);
    }

    // Sync all at once (simulate network restore)
    const syncStart = Date.now();
    const results = [];

    for (const verification of offlineQueue) {
      const batchStart = Date.now();

      const res = http.post(
        `${BASE_URL}/api/attendance/verify-unified`,
        JSON.stringify(verification),
        {
          headers: {
            ...getHeaders(token),
            "X-Offline-Sync": "true",
            "X-Offline-Id": verification.offlineId,
            "X-Queued-At": String(verification.queuedAt),
          },
          tags: { type: "offline_sync" },
        }
      );

      batchProcessDuration.add(Date.now() - batchStart);

      // Check for duplicates
      const success = check(res, {
        "sync accepted": (r) =>
          r.status === 200 || r.status === 201 || r.status === 409,
        "no server error": (r) => r.status < 500,
      });

      if (res.status === 409) {
        // 409 Conflict = duplicate, which is expected for some
        duplicateAttendance.add(1);
      }

      results.push({
        success: res.status >= 200 && res.status < 300,
        status: res.status,
      });

      // Small delay between queue items (realistic sync behavior)
      sleep(0.1);
    }

    const syncDurationMs = Date.now() - syncStart;
    syncDuration.add(syncDurationMs);

    // Calculate overall sync success
    const successCount = results.filter((r) => r.success).length;
    syncSuccess.add(successCount === VERIFICATIONS_PER_DEVICE ? 1 : 0);
  });
}

export function handleSummary(data) {
  console.log(
    "\n========== SCENARIO 3: OFFLINE SYNC STORM RESULTS ==========\n"
  );

  const queued = data.metrics.queued_verifications?.values?.count || 0;
  const syncP95 = data.metrics.sync_duration?.values?.["p(95)"] || 0;
  const batchP95 = data.metrics.batch_process_duration?.values?.["p(95)"] || 0;
  const duplicates =
    data.metrics.duplicate_attendance_records?.values?.count || 0;
  const successRate = data.metrics.sync_success_rate?.values?.rate || 0;

  console.log(`Total Queued: ${queued}`);
  console.log(`Device Sync P95: ${syncP95.toFixed(0)}ms`);
  console.log(`Batch Process P95: ${batchP95.toFixed(0)}ms`);
  console.log(`Duplicate Records: ${duplicates}`);
  console.log(`Sync Success Rate: ${(successRate * 100).toFixed(2)}%`);

  const passed = syncP95 < 5000 && duplicates < 10 && successRate > 0.95;
  console.log(`\nResult: ${passed ? "✅ PASSED" : "❌ FAILED"}`);

  if (!passed) {
    console.log("\nBottlenecks:");
    if (syncP95 >= 5000)
      console.log("- Slow sync: Check bulk insert performance");
    if (duplicates >= 10)
      console.log("- Duplicates: Check offline ID deduplication");
    if (successRate <= 0.95) console.log("- Low success: Check error handling");
  }

  return {
    "loadtest/results/scenario3_summary.json": JSON.stringify(data, null, 2),
  };
}
