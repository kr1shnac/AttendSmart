/**
 * k6 Load Test Configuration
 * Shared configuration and helper functions for all scenarios
 */

// Base URL for API
export const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

// Test data - mock users and sessions
export const TEST_DATA = {
  // Admin token for creating test sessions
  adminToken: __ENV.ADMIN_TOKEN || "test-admin-token",

  // Test teacher accounts (pre-created)
  teachers: [
    { email: "teacher1@test.com", password: "Test123!" },
    { email: "teacher2@test.com", password: "Test123!" },
    { email: "teacher3@test.com", password: "Test123!" },
  ],

  // Test student accounts (pre-created)
  students: Array.from({ length: 100 }, (_, i) => ({
    usn: `TEST${String(i + 1).padStart(3, "0")}`,
    email: `student${i + 1}@test.com`,
  })),

  // Test class IDs (pre-created)
  classIds: ["class_test_001", "class_test_002", "class_test_003"],

  // Campus location for GPS verification
  campusLocation: {
    latitude: 12.9716,
    longitude: 77.5946,
  },
};

// Thresholds that must be met for test to pass
export const THRESHOLDS = {
  http_req_duration: ["p(95)<2000"], // 95% of requests under 2 seconds
  http_req_failed: ["rate<0.01"], // Error rate under 1%
  "http_req_duration{type:verification}": ["p(95)<2000"],
  "http_req_duration{type:auth}": ["p(95)<1000"],
  "http_req_duration{type:session}": ["p(95)<1500"],
  checks: ["rate>0.95"], // 95% of checks pass
};

// Custom metrics for monitoring
export function createCustomMetrics(k6) {
  return {
    verificationDuration: new k6.Trend("verification_duration"),
    decryptDuration: new k6.Trend("decrypt_duration"),
    nonceLookupDuration: new k6.Trend("nonce_lookup_duration"),
    verificationSuccess: new k6.Rate("verification_success"),
    kmsDecryptCalls: new k6.Counter("kms_decrypt_calls"),
  };
}

// Generate random face descriptor (128D array)
export function generateFaceDescriptor() {
  return Array.from({ length: 128 }, () => Math.random() * 2 - 1);
}

// Generate BLE token data
export function generateBLEToken(sessionId) {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2);
  return {
    sessionId,
    timestamp,
    nonce,
    signature: "mock-signature-" + nonce,
    rssi: -Math.floor(Math.random() * 30) - 40, // -40 to -70 dBm
  };
}

// Generate GPS data near campus
export function generateGPSData() {
  const jitter = 0.0001; // ~10 meters
  return {
    latitude:
      TEST_DATA.campusLocation.latitude + (Math.random() - 0.5) * jitter,
    longitude:
      TEST_DATA.campusLocation.longitude + (Math.random() - 0.5) * jitter,
    accuracy: Math.floor(Math.random() * 10) + 5, // 5-15 meters
    timestamp: Date.now(),
  };
}

// Generate complete verification payload
export function generateVerificationPayload(sessionId, userId) {
  return {
    sessionId,
    userId,
    biometric: {
      type: "face",
      descriptor: generateFaceDescriptor(),
      confidence: 0.85 + Math.random() * 0.15,
    },
    ble: generateBLEToken(sessionId),
    gps: generateGPSData(),
    deviceInfo: {
      platform: Math.random() > 0.5 ? "android" : "ios",
      model: "Test-Device",
      osVersion: "14.0",
    },
    timestamp: Date.now(),
  };
}

// Default request headers
export function getHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Client-Time": String(Date.now()),
    "X-Request-ID": `k6-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}`,
  };
}
