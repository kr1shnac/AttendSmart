// Try to load ioredis, but fail gracefully if not installed
let Redis = null;
try {
  Redis = require("ioredis");
} catch (e) {
  console.log("ℹ️ ioredis not installed - using in-memory cache only");
}

/**
 * RedisService - Production-ready Redis client with automatic fallback
 *
 * Features:
 * - Connection pooling
 * - Automatic reconnection with exponential backoff
 * - Graceful fallback to in-memory cache
 * - JSON serialization for complex objects
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.fallbackCache = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    // If ioredis isn't installed, just use in-memory
    if (!Redis) {
      console.log("ℹ️ Redis module not available - using in-memory fallback");
      return false;
    }

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log("ℹ️ Redis URL not configured - using in-memory fallback");
      return false;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 100,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 10000,
        // Production optimizations
        keepAlive: 30000,
        family: 4,
        db: 0,
      });

      // Event handlers
      this.client.on("connect", () => {
        console.log("✅ Redis connected");
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on("error", (err) => {
        console.error("❌ Redis error:", err.message);
        this.isConnected = false;
      });

      this.client.on("close", () => {
        console.warn("⚠️ Redis connection closed");
        this.isConnected = false;
      });

      this.client.on("reconnecting", () => {
        this.reconnectAttempts++;
        console.log(
          `🔄 Redis reconnecting (attempt ${this.reconnectAttempts})...`
        );
      });

      // Attempt connection
      await this.client.connect();
      return true;
    } catch (error) {
      console.warn(
        "⚠️ Redis connection failed, using in-memory fallback:",
        error.message
      );
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      if (this.isConnected && this.client) {
        const value = await this.client.get(key);
        if (value) {
          return JSON.parse(value);
        }
        return null;
      }
    } catch (error) {
      console.warn(`⚠️ Redis GET error for ${key}:`, error.message);
    }

    // Fallback to in-memory
    const cached = this.fallbackCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    return null;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key
   * @param {any} value
   * @param {number} ttlSeconds - Time to live in seconds
   */
  async set(key, value, ttlSeconds = 300) {
    const serialized = JSON.stringify(value);

    try {
      if (this.isConnected && this.client) {
        await this.client.setex(key, ttlSeconds, serialized);
        return true;
      }
    } catch (error) {
      console.warn(`⚠️ Redis SET error for ${key}:`, error.message);
    }

    // Fallback to in-memory
    this.fallbackCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  /**
   * Delete key from cache
   * @param {string} key
   */
  async del(key) {
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
      }
    } catch (error) {
      console.warn(`⚠️ Redis DEL error for ${key}:`, error.message);
    }

    this.fallbackCache.delete(key);
  }

  /**
   * Delete all keys matching pattern
   * @param {string} pattern - e.g., "dashboard:*"
   */
  async delPattern(pattern) {
    try {
      if (this.isConnected && this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
          console.log(`🗑️ Deleted ${keys.length} keys matching ${pattern}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Redis pattern delete error:`, error.message);
    }

    // Fallback: delete matching keys from in-memory
    const regex = new RegExp(pattern.replace("*", ".*"));
    for (const key of this.fallbackCache.keys()) {
      if (regex.test(key)) {
        this.fallbackCache.delete(key);
      }
    }
  }

  /**
   * Check if key exists
   * @param {string} key
   */
  async exists(key) {
    try {
      if (this.isConnected && this.client) {
        return (await this.client.exists(key)) === 1;
      }
    } catch (error) {
      console.warn(`⚠️ Redis EXISTS error:`, error.message);
    }

    const cached = this.fallbackCache.get(key);
    return cached && cached.expiresAt > Date.now();
  }

  /**
   * Get remaining TTL for a key
   * @param {string} key
   * @returns {Promise<number>} TTL in seconds, -1 if no TTL, -2 if not found
   */
  async ttl(key) {
    try {
      if (this.isConnected && this.client) {
        return await this.client.ttl(key);
      }
    } catch (error) {
      console.warn(`⚠️ Redis TTL error:`, error.message);
    }

    const cached = this.fallbackCache.get(key);
    if (cached) {
      return Math.max(0, Math.floor((cached.expiresAt - Date.now()) / 1000));
    }
    return -2;
  }

  /**
   * Get cache health status
   */
  getHealth() {
    return {
      type: this.isConnected ? "redis" : "in-memory",
      connected: this.isConnected,
      fallbackSize: this.fallbackCache.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Gracefully disconnect
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      console.log("✅ Redis disconnected");
    }
  }
}

// Export singleton instance
module.exports = new RedisService();
