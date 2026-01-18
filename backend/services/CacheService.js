const redisService = require("./RedisService");

/**
 * CacheService - Production-ready caching layer
 *
 * Features:
 * - Uses Redis in production, in-memory in development
 * - Automatic cache invalidation
 * - Cache-on-compute pattern
 * - Different TTLs per cache type
 */
class CacheService {
  constructor() {
    // Cache TTLs in seconds
    this.TTL = {
      DASHBOARD: 300, // 5 minutes for dashboard stats
      USER_DATA: 600, // 10 minutes for user data
      SESSION: 60, // 1 minute for active sessions
      STATIC: 3600, // 1 hour for static data
      SHORT: 30, // 30 seconds for frequently changing data
    };

    this.initialized = false;
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Initialize cache service (connect to Redis if available)
   */
  async initialize() {
    if (this.initialized) return;

    await redisService.connect();
    this.initialized = true;
    console.log("✅ CacheService initialized");
  }

  /**
   * Get cached value
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    const value = await redisService.get(key);

    if (value !== null) {
      this.stats.hits++;
      if (process.env.NODE_ENV !== "production") {
        console.log(`📦 Cache HIT: ${key}`);
      }
      return value;
    }

    this.stats.misses++;
    if (process.env.NODE_ENV !== "production") {
      console.log(`📦 Cache MISS: ${key}`);
    }
    return null;
  }

  /**
   * Set value in cache
   * @param {string} key
   * @param {any} value
   * @param {number} ttlSeconds - Default 5 minutes
   */
  async set(key, value, ttlSeconds = this.TTL.DASHBOARD) {
    await redisService.set(key, value, ttlSeconds);
  }

  /**
   * Delete cache entry
   * @param {string} key
   */
  async del(key) {
    await redisService.del(key);
  }

  /**
   * Get or compute value (cache-through pattern)
   * @param {string} key
   * @param {Function} computeFn - Async function to compute value
   * @param {number} ttlSeconds
   * @returns {Promise<any>}
   */
  async getOrCompute(key, computeFn, ttlSeconds = this.TTL.DASHBOARD) {
    // Try to get from cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Compute fresh value
    const startTime = Date.now();
    const value = await computeFn();
    const duration = Date.now() - startTime;

    // Cache the result
    await this.set(key, value, ttlSeconds);

    if (process.env.NODE_ENV !== "production") {
      console.log(`📦 Cache COMPUTED: ${key} (${duration}ms)`);
    }

    return value;
  }

  /**
   * Invalidate dashboard caches for a user
   * @param {string} userId - Optional user ID
   */
  async invalidateDashboard(userId = null) {
    if (userId) {
      await redisService.del(`dashboard:stats:${userId}`);
      await redisService.del(`dashboard:bubble:${userId}`);
    }
    await redisService.delPattern("dashboard:*");
    console.log("🗑️ Dashboard cache invalidated");
  }

  /**
   * Invalidate attendance-related caches
   */
  async invalidateAttendance() {
    await redisService.delPattern("dashboard:*");
    await redisService.delPattern("attendance:*");
    await redisService.delPattern("session:*");
    console.log("🗑️ Attendance cache invalidated");
  }

  /**
   * Invalidate user-related caches
   * @param {string} userId
   */
  async invalidateUser(userId) {
    await redisService.del(`user:${userId}`);
    await redisService.delPattern(`dashboard:*:${userId}`);
    console.log(`🗑️ User cache invalidated: ${userId}`);
  }

  /**
   * Clear all caches
   */
  async clear() {
    await redisService.delPattern("*");
    this.stats = { hits: 0, misses: 0 };
    console.log("🗑️ All caches cleared");
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate =
      total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      redis: redisService.getHealth(),
    };
  }

  /**
   * Generate cache key for dashboard
   * @param {string} type - stats, bubble, analytics
   * @param {string} userId
   * @param {Object} params - Additional params
   */
  dashboardKey(type, userId = "global", params = {}) {
    const paramStr =
      Object.keys(params).length > 0
        ? `:${Object.values(params).join(":")}`
        : "";
    return `dashboard:${type}:${userId}${paramStr}`;
  }

  /**
   * Generate cache key for user data
   * @param {string} userId
   * @param {string} type - profile, settings, etc
   */
  userKey(userId, type = "profile") {
    return `user:${type}:${userId}`;
  }

  /**
   * Generate cache key for session
   * @param {string} sessionId
   * @param {string} type
   */
  sessionKey(sessionId, type = "data") {
    return `session:${type}:${sessionId}`;
  }
}

// Export singleton instance
module.exports = new CacheService();
