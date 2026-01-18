/**
 * Attestation Middleware
 * Validates device integrity before allowing enrollment or verification
 */

const attestationService = require("../services/attestationService");

/**
 * Middleware to verify device attestation
 * Extracts attestation token from headers and validates
 */
async function verifyAttestation(req, res, next) {
  // Skip if attestation is disabled
  if (!attestationService.ATTESTATION_ENABLED) {
    return next();
  }

  const platform = req.headers["x-platform"] || req.body.platform || "web";
  const attestationToken = req.headers["x-attestation-token"];

  try {
    const result = await attestationService.verifyAttestation(
      platform,
      attestationToken
    );

    // Attach result to request for downstream use
    req.attestation = result;

    // Log the result
    if (req.user?._id) {
      attestationService.logAttestationResult(req.user._id, platform, result);
    }

    // Check if device should be blocked
    if (attestationService.shouldBlockDevice(result)) {
      return res.status(403).json({
        status: "error",
        message: "Device attestation failed",
        code: "ATTESTATION_FAILED",
        details: result.reason || "Device integrity could not be verified",
      });
    }

    next();
  } catch (error) {
    console.error("[Attestation Middleware] Error:", error.message);

    // In non-strict mode, allow through on error
    if (!attestationService.ATTESTATION_STRICT) {
      req.attestation = { valid: false, error: error.message };
      return next();
    }

    return res.status(500).json({
      status: "error",
      message: "Attestation verification error",
    });
  }
}

/**
 * Middleware for enrollment routes (stricter)
 * Requires attestation for biometric enrollment
 */
async function requireAttestationForEnrollment(req, res, next) {
  const platform = req.headers["x-platform"] || req.body.platform || "web";

  // Web platform doesn't support attestation
  if (platform === "web") {
    return next();
  }

  const attestationToken = req.headers["x-attestation-token"];

  if (!attestationToken && attestationService.ATTESTATION_STRICT) {
    return res.status(403).json({
      status: "error",
      message: "Attestation token required for enrollment",
      code: "ATTESTATION_REQUIRED",
    });
  }

  return verifyAttestation(req, res, next);
}

/**
 * Middleware that only logs attestation status (non-blocking)
 */
async function logAttestation(req, res, next) {
  const platform = req.headers["x-platform"] || "unknown";
  const attestationToken = req.headers["x-attestation-token"];

  if (attestationToken) {
    try {
      const result = await attestationService.verifyAttestation(
        platform,
        attestationToken
      );
      req.attestation = result;

      if (req.user?._id) {
        attestationService.logAttestationResult(req.user._id, platform, result);
      }
    } catch (error) {
      console.warn("[Attestation] Log-only verification error:", error.message);
    }
  }

  next();
}

module.exports = {
  verifyAttestation,
  requireAttestationForEnrollment,
  logAttestation,
};
