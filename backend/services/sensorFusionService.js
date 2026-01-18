/**
 * Sensor Fusion Service
 * Combines multiple verification signals with weighted scoring
 * Uses weights: Face 50%, BLE 30%, GPS 20%
 */

// Feature flag for weight version
const WEIGHT_VERSION = process.env.FF_SENSOR_WEIGHTS_VERSION || "A";

// Weight configurations
const WEIGHT_CONFIGS = {
  // Option A: Low FAR (Academic Integrity Priority)
  A: {
    face: 0.5,
    ble: 0.3,
    gps: 0.2,
  },
  // Option B: Flexible (Lower FRR)
  B: {
    face: 0.4,
    ble: 0.35,
    gps: 0.25,
  },
};

const WEIGHTS = WEIGHT_CONFIGS[WEIGHT_VERSION] || WEIGHT_CONFIGS.A;

// Thresholds
const THRESHOLDS = {
  PASS: 75, // Auto-mark present
  MARGINAL: 50, // Red flag for teacher review
  FAIL: 0, // Auto-mark absent
  FACE_MIN: 0.6, // Euclidean distance < 0.6 = match
  GPS_MAX_DISTANCE: 100, // meters
  BLE_MIN_RSSI: -85, // dBm
  FLOOR_TOLERANCE: 1, // floors
};

// Hard failure flags that override scoring
const HARD_FAILURES = ["MOCK_LOCATION", "NO_BIOMETRIC", "ATTESTATION_FAILED"];

/**
 * Calculate verification score from individual sensor results
 * @param {object} verifications - Results from each sensor
 * @returns {{score: number, flags: string[], breakdown: object}}
 */
function calculateScore(verifications) {
  let totalScore = 0;
  const flags = [];
  const breakdown = {};

  // Face verification (40%)
  if (verifications.face?.verified) {
    const faceConf = verifications.face.confidence || 0;
    const faceScore = WEIGHTS.face * faceConf;
    totalScore += faceScore;
    breakdown.face = {
      weight: WEIGHTS.face,
      confidence: faceConf,
      score: faceScore,
    };

    // Check liveness
    if (!verifications.face.livenessCheck) {
      flags.push("LIVENESS_SKIP");
    }
    if (!verifications.face.serverVerified) {
      flags.push("LIVENESS_NOT_SERVER_VERIFIED");
    }
  } else if (!verifications.fingerprint?.verified) {
    flags.push("NO_BIOMETRIC");
  }

  // Fingerprint verification (25%)
  if (verifications.fingerprint?.verified) {
    const fpScore = WEIGHTS.fingerprint * 100;
    totalScore += fpScore;
    breakdown.fingerprint = {
      weight: WEIGHTS.fingerprint,
      confidence: 100,
      score: fpScore,
    };
  }

  // BLE proximity (20%)
  if (verifications.ble?.verified) {
    const rssi = verifications.ble.rssi || -100;
    let bleConf;
    if (rssi >= -50) bleConf = 100;
    else if (rssi >= -70) bleConf = 80;
    else if (rssi >= -85) bleConf = 60;
    else bleConf = 0;

    const bleScore = WEIGHTS.ble * bleConf;
    totalScore += bleScore;
    breakdown.ble = {
      weight: WEIGHTS.ble,
      rssi,
      confidence: bleConf,
      score: bleScore,
    };

    // Check token validity (replay protection)
    if (!verifications.ble.tokenValid) {
      flags.push("BLE_UNSIGNED");
      totalScore -= 10; // Penalty
    }
  } else {
    flags.push("BLE_FAIL");
  }

  // GPS verification (10%)
  if (verifications.gps?.verified) {
    const dist = verifications.gps.distance || 999;
    let gpsConf;
    if (dist <= 10) gpsConf = 100;
    else if (dist <= 50) gpsConf = 80;
    else if (dist <= 100) gpsConf = 60;
    else gpsConf = 0;

    const gpsScore = WEIGHTS.gps * gpsConf;
    totalScore += gpsScore;
    breakdown.gps = {
      weight: WEIGHTS.gps,
      distance: dist,
      confidence: gpsConf,
      score: gpsScore,
    };

    // Mock location detection
    if (verifications.gps.mockDetected) {
      flags.push("MOCK_LOCATION");
      totalScore = 0; // Zero score for mock GPS
    }

    // Velocity anomaly
    if (verifications.gps.velocityAnomaly) {
      flags.push("GPS_VELOCITY_ANOMALY");
    }
  } else {
    flags.push("GPS_FAIL");
  }

  // Note: Barometric sensor has been removed from the verification stack

  // Attestation check
  if (
    verifications.attestation?.valid === false &&
    !verifications.attestation.skipped
  ) {
    flags.push("ATTESTATION_FAILED");
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(totalScore))),
    flags,
    breakdown,
    weightVersion: WEIGHT_VERSION,
  };
}

/**
 * Determine outcome based on score and flags
 * @param {number} score - Combined verification score
 * @param {string[]} flags - Verification flags
 * @returns {{action: string, reason: string, flags?: string[]}}
 */
function determineOutcome(score, flags) {
  // Check for hard failures (override scoring)
  for (const hardFail of HARD_FAILURES) {
    if (flags.includes(hardFail)) {
      return {
        action: "RED_FLAG",
        reason: `Hard failure: ${hardFail}`,
        flags,
        requiresTeacherAction: true,
      };
    }
  }

  // Score-based outcomes
  if (score >= THRESHOLDS.PASS) {
    if (flags.length === 0) {
      return {
        action: "AUTO_PRESENT",
        reason: "All verification checks passed",
        requiresTeacherAction: false,
      };
    }
    return {
      action: "AUTO_PRESENT",
      reason: "Passed with minor flags",
      flags,
      requiresTeacherAction: false,
    };
  }

  if (score >= THRESHOLDS.MARGINAL) {
    return {
      action: "RED_FLAG",
      reason: "Marginal verification score",
      flags,
      requiresTeacherAction: true,
    };
  }

  return {
    action: "AUTO_ABSENT",
    reason: "Verification failed - score below threshold",
    flags,
    requiresTeacherAction: false,
  };
}

/**
 * Perform full sensor fusion and return result
 * @param {object} verifications - All verification results
 * @returns {object} - Complete fusion result
 */
function performFusion(verifications) {
  const { score, flags, breakdown, weightVersion } =
    calculateScore(verifications);
  const outcome = determineOutcome(score, flags);

  return {
    score,
    flags,
    breakdown,
    weightVersion,
    outcome,
    timestamp: new Date().toISOString(),
    thresholds: THRESHOLDS,
  };
}

/**
 * Get current weight configuration
 */
function getWeights() {
  return { ...WEIGHTS, version: WEIGHT_VERSION };
}

/**
 * Get threshold configuration
 */
function getThresholds() {
  return { ...THRESHOLDS };
}

module.exports = {
  calculateScore,
  determineOutcome,
  performFusion,
  getWeights,
  getThresholds,
  WEIGHTS,
  THRESHOLDS,
  WEIGHT_VERSION,
};
