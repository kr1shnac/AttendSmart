/**
 * k6 Quick Auth Test - Check what errors we get
 */

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export const options = {
  vus: 1,
  iterations: 3,
};

export default function () {
  // First try to login
  const loginRes = http.post(
    BASE_URL + "/api/auth/login",
    JSON.stringify({
      email: "student1@test.com",
      password: "Test123!",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  console.log("Login status: " + loginRes.status);
  console.log("Login body: " + loginRes.body.substring(0, 200));

  let token = null;
  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      token = body.token || (body.data && body.data.token);
      console.log("Got token: " + (token ? "yes" : "no"));
    } catch (e) {
      console.log("Parse error: " + e);
    }
  }

  // Try verification without auth
  const noAuthRes = http.post(
    BASE_URL + "/api/attendance/verify-unified",
    JSON.stringify({
      sessionId: "test",
      biometric: { type: "face", descriptor: [0.1, 0.2] },
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  console.log("No-auth verify status: " + noAuthRes.status);
  console.log("No-auth verify body: " + noAuthRes.body.substring(0, 200));

  // Try with token if we have one
  if (token) {
    const authRes = http.post(
      BASE_URL + "/api/attendance/verify-unified",
      JSON.stringify({
        sessionId: "test",
        biometric: { type: "face", descriptor: [0.1, 0.2] },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      }
    );

    console.log("Auth verify status: " + authRes.status);
    console.log("Auth verify body: " + authRes.body.substring(0, 300));
  }
}
