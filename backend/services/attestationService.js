/**
 * Device Attestation Service
 * Validates device integrity using Play Integrity (Android) and DeviceCheck (iOS)
 */

const crypto = require("crypto");

// Feature flag for attestation enforcement
const ATTESTATION_ENABLED = process.env.FF_ATTESTATION === "true";
const ATTESTATION_STRICT = process.env.FF_ATTESTATION_STRICT === "true";

/**
 * Verify Android Play Integrity token
 * @param {string} token - Play Integrity token from client
 * @returns {Promise<{valid: boolean, verdict: object, appRecognized: boolean}>}
 */
async function verifyPlayIntegrity(token) {
  if (!process.env.GOOGLE_PLAY_INTEGRITY_API_KEY) {
    console.warn("[Attestation] Play Integrity API key not configured");
    return { valid: !ATTESTATION_STRICT, verdict: null, skipped: true };
  }

  try {
    const packageName =
      process.env.ANDROID_PACKAGE_NAME || "com.attendsmart.app";

    // Decode and verify the integrity token
    // In production, use Google's Play Integrity API
    const response = await fetch(
      `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GOOGLE_PLAY_INTEGRITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ integrity_token: token }),
      }
    );

    if (!response.ok) {
      throw new Error(`Play Integrity API error: ${response.status}`);
    }

    const { tokenPayloadExternal } = await response.json();

    // Check device integrity
    const deviceVerdict =
      tokenPayloadExternal.deviceIntegrity?.deviceRecognitionVerdict || [];
    const meetsDeviceIntegrity = deviceVerdict.includes(
      "MEETS_DEVICE_INTEGRITY"
    );
    const meetsBasicIntegrity = deviceVerdict.includes("MEETS_BASIC_INTEGRITY");

    // Check app integrity
    const appVerdict = tokenPayloadExternal.appIntegrity?.appRecognitionVerdict;
    const appRecognized = appVerdict === "PLAY_RECOGNIZED";

    return {
      valid:
        meetsDeviceIntegrity || (meetsBasicIntegrity && !ATTESTATION_STRICT),
      appRecognized,
      verdict: {
        device: deviceVerdict,
        app: appVerdict,
        account: tokenPayloadExternal.accountDetails?.appLicensingVerdict,
      },
    };
  } catch (error) {
    console.error(
      "[Attestation] Play Integrity verification failed:",
      error.message
    );
    return { valid: !ATTESTATION_STRICT, error: error.message };
  }
}

/**
 * Verify iOS DeviceCheck token
 * @param {string} token - DeviceCheck token from client
 * @returns {Promise<{valid: boolean, bits: boolean[]}>}
 */
async function verifyDeviceCheck(token) {
  if (!process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID) {
    console.warn("[Attestation] Apple DeviceCheck not configured");
    return { valid: !ATTESTATION_STRICT, skipped: true };
  }

  try {
    // Create JWT for Apple API authentication
    const jwt = createAppleJWT();

    const response = await fetch(
      "https://api.devicecheck.apple.com/v1/validate_device_token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_token: token,
          transaction_id: crypto.randomUUID(),
          timestamp: Date.now(),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`DeviceCheck API error: ${response.status}`);
    }

    // DeviceCheck returns 200 OK for valid devices
    return { valid: true };
  } catch (error) {
    console.error(
      "[Attestation] DeviceCheck verification failed:",
      error.message
    );
    return { valid: !ATTESTATION_STRICT, error: error.message };
  }
}

/**
 * Create Apple JWT for API authentication
 */
function createAppleJWT() {
  const jwt = require("jsonwebtoken");
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Apple private key not configured");
  }

  return jwt.sign({}, privateKey, {
    algorithm: "ES256",
    keyid: process.env.APPLE_KEY_ID,
    issuer: process.env.APPLE_TEAM_ID,
    expiresIn: "5m",
  });
}

/**
 * Verify device attestation based on platform
 * @param {string} platform - 'android' or 'ios'
 * @param {string} token - Attestation token from client
 * @returns {Promise<{valid: boolean, details: object}>}
 */
async function verifyAttestation(platform, token) {
  if (!ATTESTATION_ENABLED) {
    return { valid: true, skipped: true, reason: "Attestation disabled" };
  }

  if (!token) {
    return {
      valid: !ATTESTATION_STRICT,
      skipped: false,
      reason: "No attestation token provided",
    };
  }

  if (platform === "android") {
    return verifyPlayIntegrity(token);
  }

  if (platform === "ios") {
    return verifyDeviceCheck(token);
  }

  // Web platform - no attestation available
  return { valid: true, skipped: true, reason: "Web platform" };
}

/**
 * Check if a device should be blocked based on attestation
 * @param {object} attestationResult - Result from verifyAttestation
 * @returns {boolean} - True if device should be blocked
 */
function shouldBlockDevice(attestationResult) {
  if (!ATTESTATION_STRICT) {
    return false;
  }

  return !attestationResult.valid && !attestationResult.skipped;
}

/**
 * Log attestation result (without sensitive data)
 * @param {string} userId - User ID
 * @param {string} platform - Platform
 * @param {object} result - Attestation result
 */
function logAttestationResult(userId, platform, result) {
  const Log = require("../models/Log");

  Log.create({
    action: result.valid ? "attestation_passed" : "attestation_failed",
    user: userId,
    details: {
      platform,
      valid: result.valid,
      skipped: result.skipped,
      reason: result.reason,
      // Don't log full verdict - sensitive
    },
    ipAddress: null, // Will be set by caller
  }).catch((err) => console.error("[Attestation] Log error:", err.message));
}

module.exports = {
  verifyPlayIntegrity,
  verifyDeviceCheck,
  verifyAttestation,
  shouldBlockDevice,
  logAttestationResult,
  ATTESTATION_ENABLED,
  ATTESTATION_STRICT,
};
