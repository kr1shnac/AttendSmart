/**
 * Redis Nonce Store for BLE Replay Protection
 * Stores used nonces with TTL to prevent replay attacks
 *
 * Key format: ble:nonce:{sessionId}:{deviceId}:{nonce}
 * This prevents cross-session and cross-device replay collisions
 */

const NONCE_TTL = 120; // seconds - 2× maximum clock skew + rotation window
const NONCE_PREFIX = "ble:nonce:";
const TIMESTAMP_SKEW = 15000; // ±15 seconds allowed

// In-memory fallback when Redis is not available
const memoryStore = new Map();
let memoryCleanupInterval = null;

/**
 * Get Redis client - uses existing connection or creates mock
 */
function getRedisClient() {
  if (global.redisClient && global.redisClient.isReady) {
    return global.redisClient;
  }
  return null;
}

/**
 * Build nonce key with full namespace
 */
function buildNonceKey(sessionId, deviceId, nonce) {
  const safeDeviceId = deviceId || "unknown";
  return `${NONCE_PREFIX}${sessionId}:${safeDeviceId}:${nonce}`;
}

/**
 * Check if a nonce has already been used
 */
async function isNonceUsed(sessionId, nonce, deviceId) {
  const key = buildNonceKey(sessionId, deviceId, nonce);
  const redis = getRedisClient();

  if (redis) {
    const exists = await redis.exists(key);
    return exists === 1;
  }
  return memoryStore.has(key);
}

/**
 * Mark a nonce as used (with TTL)
 */
async function markNonceUsed(sessionId, nonce, deviceId) {
  const key = buildNonceKey(sessionId, deviceId, nonce);
  const redis = getRedisClient();

  if (redis) {
    await redis.setex(key, NONCE_TTL, "1");
    return;
  }

  memoryStore.set(key, Date.now() + NONCE_TTL * 1000);
  startMemoryCleanup();
}

/**
 * Validate a complete BLE token
 */
async function validateBLEToken(
  sessionId,
  timestamp,
  nonce,
  signature,
  secret,
  deviceId
) {
  const crypto = require("./crypto");

  // 1. Check timestamp skew (±15 seconds)
  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_SKEW) {
    return {
      valid: false,
      reason: "TIMESTAMP_EXPIRED",
      details: `Token expired. Skew: ${Math.abs(now - timestamp)}ms`,
    };
  }

  // 2. Check nonce uniqueness (replay protection)
  if (await isNonceUsed(sessionId, nonce, deviceId)) {
    return {
      valid: false,
      reason: "NONCE_REPLAY",
      details: "Nonce has already been used",
    };
  }

  // 3. Verify signature
  const payload = `${sessionId}:${timestamp}:${nonce}`;
  const isValidSig = crypto.verifyBLESignature(payload, signature, secret);

  if (!isValidSig) {
    return {
      valid: false,
      reason: "INVALID_SIGNATURE",
      details: "Signature verification failed",
    };
  }

  // 4. Mark nonce as used
  await markNonceUsed(sessionId, nonce, deviceId);

  return { valid: true };
}

/**
 * Generate a new BLE token payload
 */
function generateBLEToken(sessionId, secret) {
  const crypto = require("./crypto");

  const timestamp = Date.now();
  const nonce = crypto.generateNonce();
  const payload = `${sessionId}:${timestamp}:${nonce}`;
  const signature = crypto.signBLEPayload(payload, secret);

  return {
    timestamp,
    nonce,
    signature,
    payload: `${timestamp}:${nonce}:${signature}`,
  };
}

/**
 * Clean up expired entries from memory store
 */
function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, expiry] of memoryStore.entries()) {
    if (expiry < now) {
      memoryStore.delete(key);
    }
  }

  if (memoryStore.size === 0 && memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = null;
  }
}

/**
 * Start memory cleanup interval
 */
function startMemoryCleanup() {
  if (!memoryCleanupInterval) {
    memoryCleanupInterval = setInterval(cleanupMemoryStore, 30000);
  }
}

/**
 * Clear all nonces for a session
 */
async function clearSessionNonces(sessionId) {
  const redis = getRedisClient();

  if (redis) {
    const pattern = `${NONCE_PREFIX}${sessionId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
    return;
  }

  const prefix = `${NONCE_PREFIX}${sessionId}:`;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
}

module.exports = {
  isNonceUsed,
  markNonceUsed,
  validateBLEToken,
  generateBLEToken,
  clearSessionNonces,
  buildNonceKey,
  NONCE_TTL,
  TIMESTAMP_SKEW,
};
