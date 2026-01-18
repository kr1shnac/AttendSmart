/**
 * Clock Sync Middleware
 * Rejects requests with excessive client clock drift
 *
 * Prevents replay attacks and ensures attestation timestamps are valid
 */

const MAX_DRIFT_MS = 60 * 1000; // 60 seconds maximum drift

/**
 * Validate client timestamp header
 * Rejects if client clock is too far from server
 */
function validateClockSync(req, res, next) {
  const clientTimeHeader = req.headers["x-client-time"];

  // Skip if no client time header (graceful degradation)
  if (!clientTimeHeader) {
    // Mark as unvalidated for logging
    req.clockValidated = false;
    return next();
  }

  const clientTime = parseInt(clientTimeHeader, 10);

  if (isNaN(clientTime)) {
    return res.status(400).json({
      status: "error",
      code: "INVALID_TIMESTAMP",
      message: "Invalid X-Client-Time header format",
    });
  }

  const serverTime = Date.now();
  const drift = Math.abs(serverTime - clientTime);

  if (drift > MAX_DRIFT_MS) {
    console.warn(
      `⚠️ Clock drift detected: ${Math.round(drift / 1000)}s for user ${
        req.user?._id || "anonymous"
      }`
    );

    return res.status(400).json({
      status: "error",
      code: "CLOCK_DRIFT",
      message: "Please sync your device time and try again",
      serverTime: serverTime,
      clientTime: clientTime,
      drift: drift,
      maxAllowed: MAX_DRIFT_MS,
    });
  }

  // Mark as validated
  req.clockValidated = true;
  req.clockDrift = drift;

  next();
}

/**
 * Strict version - requires header present
 */
function requireClockSync(req, res, next) {
  const clientTimeHeader = req.headers["x-client-time"];

  if (!clientTimeHeader) {
    return res.status(400).json({
      status: "error",
      code: "TIMESTAMP_REQUIRED",
      message: "X-Client-Time header is required for this endpoint",
    });
  }

  return validateClockSync(req, res, next);
}

/**
 * Log clock drift for analytics (non-blocking)
 */
function logClockDrift(req, res, next) {
  const clientTimeHeader = req.headers["x-client-time"];

  if (clientTimeHeader) {
    const clientTime = parseInt(clientTimeHeader, 10);
    if (!isNaN(clientTime)) {
      const drift = Date.now() - clientTime;
      console.log(
        `[ClockSync] User ${req.user?._id || "anon"} drift: ${drift}ms`
      );
    }
  }

  next();
}

module.exports = {
  validateClockSync,
  requireClockSync,
  logClockDrift,
  MAX_DRIFT_MS,
};
