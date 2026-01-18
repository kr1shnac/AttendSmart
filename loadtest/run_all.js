/**
 * k6 Load Test Runner - Execute All Scenarios
 *
 * Run: k6 run run_all.js
 * Or run individually with environment variables
 */

import { exec } from "k6/x/exec";
import { sleep } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  console.log("========================================");
  console.log("AttendSmart Load Test Suite");
  console.log("========================================\n");

  console.log("To run individual scenarios:\n");
  console.log("1. Sustained Load (200 users):");
  console.log("   k6 run scenario1_sustained_load.js\n");

  console.log("2. Concurrent Sessions (50 classes):");
  console.log("   k6 run scenario2_concurrent_sessions.js\n");

  console.log("3. Offline Sync Storm (1500 verifications):");
  console.log("   k6 run scenario3_offline_sync.js\n");

  console.log("Environment variables:");
  console.log(
    "   BASE_URL     - API base URL (default: http://localhost:5000)"
  );
  console.log("   ADMIN_TOKEN  - Admin JWT token for setup");
  console.log("\n========================================");
}
