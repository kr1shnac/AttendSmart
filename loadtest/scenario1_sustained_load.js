/**
 * k6 Load Test - Scenario 1: Sustained Load (No SharedArray)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

// Custom metrics
const verificationDuration = new Trend("verification_duration");
const verificationSuccess = new Rate("verification_success");
const faceMatchSuccess = new Rate("face_match_success");
const httpErrors = new Counter("http_errors");

// Load data directly (runs once per VU)
const data = JSON.parse(open("./test-data.json"));

export const options = {
  stages: [
    { duration: "15s", target: 20 },
    { duration: "45s", target: 30 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.1"],
    verification_success: ["rate>0.85"],
  },
};

function generateNonce() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function () {
  if (!data || !data.students || data.students.length === 0) {
    sleep(1);
    return;
  }

  const student = data.students[__VU % data.students.length];
  const session = data.sessions[(__VU + __ITER) % data.sessions.length];

  const payload = {
    sessionId: session.id,
    verifications: {
      face: {
        descriptor: student.faceDescriptor,
        confidence: 0.98,
        verified: true,
        livenessCheck: true,
      },
      fingerprint: {
        verified: true,
      },
      ble: {
        verified: true,
        rssi: -55,
        nonce: generateNonce(),
        timestamp: Date.now(),
        tokenValid: true,
      },
      gps: {
        verified: true,
        latitude: 12.9716,
        longitude: 77.5946,
        distance: 5,
        accuracy: 10,
      },
    },
    platform: "android",
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + student.token,
    "X-Client-Time": String(Date.now()),
  };

  const res = http.post(
    BASE_URL + "/api/attendance/verify-unified",
    JSON.stringify(payload),
    { headers: headers, tags: { type: "verification" } }
  );

  verificationDuration.add(res.timings.duration);
  const isSuccess = res.status === 200 || res.status === 201;

  check(res, {
    "status is 200/201": (r) => r.status === 200 || r.status === 201,
    "latency < 2s": (r) => r.timings.duration < 2000,
  });

  verificationSuccess.add(isSuccess ? 1 : 0);

  if (isSuccess && res.body) {
    try {
      const body = JSON.parse(res.body);
      const action = body.data?.fusion?.outcome;
      faceMatchSuccess.add(action === "AUTO_PRESENT" ? 1 : 0);
    } catch (e) {
      faceMatchSuccess.add(0);
    }
  }

  if (res.status >= 500) httpErrors.add(1);

  sleep(1);
}

export function handleSummary(data) {
  const reqs = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const p95 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values["p(95)"]
    : 0;
  const errorRate = data.metrics.http_req_failed
    ? data.metrics.http_req_failed.values.rate
    : 0;
  const successRate = data.metrics.verification_success
    ? data.metrics.verification_success.values.rate
    : 0;
  const matchRate = data.metrics.face_match_success
    ? data.metrics.face_match_success.values.rate
    : 0;

  console.log("--------------------------------------------------");
  console.log(" SCENARIO 1 RESULT: SUSTAINED LOAD");
  console.log("--------------------------------------------------");
  console.log(" Requests:       " + reqs);
  console.log(" p95 Latency:    " + p95.toFixed(0) + " ms");
  console.log(" Error Rate:     " + (errorRate * 100).toFixed(2) + "%");
  console.log(" Success Rate:   " + (successRate * 100).toFixed(2) + "%");
  console.log(" Auto-Present:   " + (matchRate * 100).toFixed(2) + "%");
  console.log("--------------------------------------------------");

  return {};
}
