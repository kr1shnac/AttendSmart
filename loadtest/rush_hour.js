/**
 * rush_hour.js - k6 Load Test Script
 *
 * Simulates 10,000 students marking attendance in a 5-minute window.
 * Tests the queue-based attendance endpoint for production readiness.
 *
 * Run: k6 run loadtest/rush_hour.js
 *
 * @version 1.0.0
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import {
  randomString,
  randomIntBetween,
} from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "test_token_replace_me";

// Custom metrics
const successRate = new Rate("success_rate");
const queueAcceptedRate = new Rate("queue_accepted");
const responseTime = new Trend("response_time_ms");
const requestsQueued = new Counter("requests_queued");

// ============================================
// TEST OPTIONS
// ============================================

export const options = {
  // Scenario: Rush Hour - 10,000 students in 5 minutes
  scenarios: {
    rush_hour: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        // Ramp up to 500 VUs in 30 seconds
        { duration: "30s", target: 500 },
        // Ramp up to 2,000 VUs in next 30 seconds
        { duration: "30s", target: 2000 },
        // Sustain 2,000 VUs for 3 minutes
        { duration: "3m", target: 2000 },
        // Ramp down to 0 in 1 minute
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },

  // Performance thresholds
  thresholds: {
    // 95% of requests must complete in < 200ms
    http_req_duration: ["p(95)<200"],

    // 99% of requests must complete in < 500ms
    "http_req_duration{status:200}": ["p(99)<500"],

    // At least 99% success rate
    success_rate: ["rate>0.99"],

    // Queue acceptance rate should be 100%
    queue_accepted: ["rate>0.99"],

    // No more than 1% errors
    http_req_failed: ["rate<0.01"],
  },

  // Summary output
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ============================================
// HELPERS
// ============================================

/**
 * Generate a fake base64 liveness image
 * In real tests, this would be actual image data
 */
function generateDummyLivenessImage() {
  // Create a small fake JPEG-like base64 string
  // Real image would be ~50-100KB, we simulate with small data
  const fakeImageData = randomString(1000);
  return `data:image/jpeg;base64,${btoa(fakeImageData)}`;
}

/**
 * Generate GPS coordinates (campus area simulation)
 */
function generateRandomGPS() {
  // Base coordinates (example campus)
  const baseLat = 12.9716;
  const baseLng = 77.5946;

  // Random offset within ~100m radius
  const latOffset = (Math.random() - 0.5) * 0.002;
  const lngOffset = (Math.random() - 0.5) * 0.002;

  return {
    latitude: baseLat + latOffset,
    longitude: baseLng + lngOffset,
    accuracy: randomIntBetween(5, 20),
  };
}

/**
 * Generate a unique student ID for this VU
 */
function generateStudentId() {
  return `student_${__VU}_${randomString(8)}`;
}

// ============================================
// SETUP
// ============================================

export function setup() {
  console.log("🚀 Starting Rush Hour Load Test");
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Simulating: 10,000 attendance marks in 5 minutes`);

  return {
    startTime: new Date().toISOString(),
    sessionIds: [
      "session_classroom_101",
      "session_classroom_102",
      "session_classroom_103",
      "session_lab_201",
      "session_lab_202",
    ],
  };
}

// ============================================
// MAIN TEST
// ============================================

export default function (data) {
  // Pick a random session (simulating multiple active classes)
  const sessionId =
    data.sessionIds[randomIntBetween(0, data.sessionIds.length - 1)];

  // Generate test payload
  const payload = JSON.stringify({
    sessionId: sessionId,
    gps: generateRandomGPS(),
    livenessImageBase64: generateDummyLivenessImage(),
    livenessScore: Math.random() * 0.3 + 0.7, // 0.7 - 1.0
    livenessVerified: true,
    deviceId: `device_${__VU}`,
    platform: "android",
    offlineId: `offline_${Date.now()}_${randomString(6)}`,
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${AUTH_TOKEN}`,
  };

  // Make the request
  const startTime = Date.now();
  const response = http.post(
    `${BASE_URL}/api/attendance/mark-queued`,
    payload,
    {
      headers: headers,
      timeout: "10s",
    }
  );
  const duration = Date.now() - startTime;

  // Record custom metrics
  responseTime.add(duration);

  // Check response
  const passed = check(response, {
    "status is 200": (r) => r.status === 200,
    "response has success": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true || body.status === "success";
      } catch {
        return false;
      }
    },
    "queue accepted": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data?.queued === true || body.data?.jobId !== undefined;
      } catch {
        return false;
      }
    },
    "response time < 200ms": (r) => r.timings.duration < 200,
  });

  // Update metrics
  successRate.add(response.status === 200);
  queueAcceptedRate.add(passed);

  if (response.status === 200) {
    requestsQueued.add(1);
  }

  // Log errors for debugging
  if (response.status !== 200) {
    console.error(`❌ Request failed: ${response.status} - ${response.body}`);
  }

  // Small random sleep to simulate real user behavior
  sleep(randomIntBetween(1, 3));
}

// ============================================
// TEARDOWN
// ============================================

export function teardown(data) {
  console.log("");
  console.log("════════════════════════════════════════");
  console.log("🏁 Rush Hour Load Test Complete");
  console.log("════════════════════════════════════════");
  console.log(`   Started: ${data.startTime}`);
  console.log(`   Ended: ${new Date().toISOString()}`);
  console.log("");
  console.log("📊 Check the summary above for:");
  console.log("   - http_req_duration p(95) < 200ms");
  console.log("   - success_rate > 99%");
  console.log("   - requests_queued total");
  console.log("════════════════════════════════════════");
}
