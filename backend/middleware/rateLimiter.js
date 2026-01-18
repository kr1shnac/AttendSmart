/**
 * Rate Limiter Middleware
 * Provides per-user and per-IP rate limiting for security-sensitive endpoints
 */

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map();
const CLEANUP_INTERVAL = 60000; // 1 minute

// Configuration defaults
const DEFAULT_CONFIG = {
  windowMs: 60000, // 1 minute window
  maxRequests: 10, // Max requests per window
  blockDurationMs: 300000, // 5 minute block after limit exceeded
  keyPrefix: "rl:",
};

// Cleanup expired entries periodically
let cleanupInterval = null;

function startCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of rateLimitStore.entries()) {
        if (data.windowStart + DEFAULT_CONFIG.windowMs < now && !data.blocked) {
          rateLimitStore.delete(key);
        }
        if (data.blocked && data.blockedUntil < now) {
          rateLimitStore.delete(key);
        }
      }
    }, CLEANUP_INTERVAL);
  }
}

/**
 * Get rate limit data for a key
 */
function getRateLimitData(key) {
  const now = Date.now();
  let data = rateLimitStore.get(key);

  if (!data) {
    data = { count: 0, windowStart: now, blocked: false };
    rateLimitStore.set(key, data);
  }

  // Reset window if expired
  if (data.windowStart + DEFAULT_CONFIG.windowMs < now && !data.blocked) {
    data = { count: 0, windowStart: now, blocked: false };
    rateLimitStore.set(key, data);
  }

  return data;
}

/**
 * Increment request count
 */
function incrementCount(key, maxRequests, blockDuration) {
  const data = getRateLimitData(key);

  if (data.blocked) {
    return {
      allowed: false,
      retryAfter: Math.ceil((data.blockedUntil - Date.now()) / 1000),
    };
  }

  data.count++;

  if (data.count > maxRequests) {
    data.blocked = true;
    data.blockedUntil = Date.now() + blockDuration;
    rateLimitStore.set(key, data);
    return { allowed: false, retryAfter: Math.ceil(blockDuration / 1000) };
  }

  rateLimitStore.set(key, data);
  return { allowed: true, remaining: maxRequests - data.count };
}

/**
 * Create rate limiter middleware
 * @param {object} options - Configuration options
 */
function createRateLimiter(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  startCleanup();

  return (req, res, next) => {
    // Build key from user ID or IP
    const userId = req.user?._id?.toString() || "anonymous";
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const key = `${config.keyPrefix}${userId}:${ip}`;

    const result = incrementCount(
      key,
      config.maxRequests,
      config.blockDurationMs
    );

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", config.maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining || 0);

    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfter);
      return res.status(429).json({
        status: "error",
        message: "Too many requests. Please try again later.",
        retryAfter: result.retryAfter,
      });
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for different endpoints
 */

// Strict: For enrollment and sensitive operations
const enrollmentLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 5, // 5 attempts per minute
  blockDurationMs: 600000, // 10 minute block
  keyPrefix: "rl:enroll:",
});

// Standard: For verification attempts
const verificationLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 1000, // Increased for load test
  blockDurationMs: 300000, // 5 minute block
  keyPrefix: "rl:verify:",
});

// Auth: For login attempts
const authLimiter = createRateLimiter({
  windowMs: 900000, // 15 minutes
  maxRequests: 1000, // Increased for load test
  blockDurationMs: 900000, // 15 minute block
  keyPrefix: "rl:auth:",
});

// API: General API rate limiting
const apiLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 5000, // Increased for load test
  blockDurationMs: 60000, // 1 minute block
  keyPrefix: "rl:api:",
});

/**
 * Check if a user is currently rate limited (for pre-flight checks)
 */
function isRateLimited(userId, ip, prefix = "rl:") {
  const key = `${prefix}${userId}:${ip}`;
  const data = rateLimitStore.get(key);
  return data?.blocked && data.blockedUntil > Date.now();
}

module.exports = {
  createRateLimiter,
  enrollmentLimiter,
  verificationLimiter,
  authLimiter,
  apiLimiter,
  isRateLimited,
};
