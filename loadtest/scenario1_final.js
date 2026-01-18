import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

const testData = new SharedArray("testData", function () {
  return [JSON.parse(open("./test-data.json"))];
});

export const options = {
  vus: 20,
  duration: "30s",
};

function generateNonce() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function () {
  const data = testData[0];
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
    { headers: headers }
  );

  // LOG EVERYTHING FOR DEBUGGING SINGLE REQUEST
  if (__ITER === 0 && __VU === 1) {
    console.log("DEBUG_RES_STATUS: " + res.status);
    console.log("DEBUG_RES_BODY: " + res.body);
  }

  check(res, {
    "status is 200": (r) => r.status === 200,
    approved: (r) => r.body && r.body.includes("AUTO_PRESENT"),
  });

  sleep(1);
}
