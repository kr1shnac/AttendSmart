/**
 * Frontend Cache Service
 *
 * Production-ready caching for React application:
 * - SessionStorage for session data (cleared on tab close)
 * - LocalStorage for persistent data (user preferences)
 * - Memory cache for fast access
 */

// Cache TTLs in milliseconds
const TTL = {
  SHORT: 30 * 1000, // 30 seconds
  DASHBOARD: 5 * 60 * 1000, // 5 minutes
  USER: 10 * 60 * 1000, // 10 minutes
  STATIC: 60 * 60 * 1000, // 1 hour
};

// Memory cache for fastest access
const memoryCache = new Map();

/**
 * Get cached data from sessionStorage
 * @param {string} key
 * @returns {any|null}
 */
export const getSessionCache = (key) => {
  try {
    const cached = sessionStorage.getItem(`cache:${key}`);
    if (!cached) return null;

    const { value, expiresAt } = JSON.parse(cached);
    if (Date.now() > expiresAt) {
      sessionStorage.removeItem(`cache:${key}`);
      return null;
    }

    return value;
  } catch (error) {
    console.warn("[Cache] Session get error:", error);
    return null;
  }
};

/**
 * Set data in sessionStorage cache
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - Time to live in ms
 */
export const setSessionCache = (key, value, ttl = TTL.DASHBOARD) => {
  try {
    const entry = {
      value,
      expiresAt: Date.now() + ttl,
    };
    sessionStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch (error) {
    console.warn("[Cache] Session set error:", error);
  }
};

/**
 * Get cached data from localStorage (persistent)
 * @param {string} key
 * @returns {any|null}
 */
export const getLocalCache = (key) => {
  try {
    const cached = localStorage.getItem(`cache:${key}`);
    if (!cached) return null;

    const { value, expiresAt } = JSON.parse(cached);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(`cache:${key}`);
      return null;
    }

    return value;
  } catch (error) {
    console.warn("[Cache] Local get error:", error);
    return null;
  }
};

/**
 * Set data in localStorage cache (persistent)
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - Time to live in ms
 */
export const setLocalCache = (key, value, ttl = TTL.USER) => {
  try {
    const entry = {
      value,
      expiresAt: Date.now() + ttl,
    };
    localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch (error) {
    console.warn("[Cache] Local set error:", error);
  }
};

/**
 * Get cached data from memory (fastest)
 * @param {string} key
 * @returns {any|null}
 */
export const getMemoryCache = (key) => {
  const cached = memoryCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return cached.value;
};

/**
 * Set data in memory cache (fastest)
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - Time to live in ms
 */
export const setMemoryCache = (key, value, ttl = TTL.SHORT) => {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
};

/**
 * Clear all cache entries (all storage types)
 */
export const clearAllCache = () => {
  // Clear memory cache
  memoryCache.clear();

  // Clear session storage cache
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith("cache:"))
    .forEach((key) => sessionStorage.removeItem(key));

  // Clear local storage cache
  Object.keys(localStorage)
    .filter((key) => key.startsWith("cache:"))
    .forEach((key) => localStorage.removeItem(key));

  console.log("[Cache] All caches cleared");
};

/**
 * Clear dashboard-related caches
 */
export const clearDashboardCache = () => {
  // Clear from memory
  for (const key of memoryCache.keys()) {
    if (key.includes("dashboard")) {
      memoryCache.delete(key);
    }
  }

  // Clear from session storage
  Object.keys(sessionStorage)
    .filter((key) => key.includes("dashboard"))
    .forEach((key) => sessionStorage.removeItem(key));

  console.log("[Cache] Dashboard cache cleared");
};

/**
 * Cache wrapper for API calls (stale-while-revalidate pattern)
 * @param {string} cacheKey - Unique cache key
 * @param {Function} fetchFn - Async function to fetch data
 * @param {Object} options - Cache options
 * @returns {Promise<{data: any, fromCache: boolean}>}
 */
export const cacheApiCall = async (cacheKey, fetchFn, options = {}) => {
  const {
    ttl = TTL.DASHBOARD,
    storage = "session", // 'session', 'local', or 'memory'
    staleWhileRevalidate = true,
  } = options;

  // Get appropriate getter/setter based on storage type
  const getCache =
    storage === "local"
      ? getLocalCache
      : storage === "memory"
      ? getMemoryCache
      : getSessionCache;

  const setCache =
    storage === "local"
      ? setLocalCache
      : storage === "memory"
      ? setMemoryCache
      : setSessionCache;

  // Check cache first
  const cachedData = getCache(cacheKey);

  if (cachedData !== null) {
    console.log(`[Cache] HIT: ${cacheKey}`);

    // If stale-while-revalidate, refresh in background
    if (staleWhileRevalidate) {
      fetchFn()
        .then((freshData) => {
          setCache(cacheKey, freshData, ttl);
          console.log(`[Cache] Background refresh: ${cacheKey}`);
        })
        .catch((err) =>
          console.warn("[Cache] Background refresh failed:", err)
        );
    }

    return { data: cachedData, fromCache: true };
  }

  console.log(`[Cache] MISS: ${cacheKey}`);

  // Fetch fresh data
  const freshData = await fetchFn();
  setCache(cacheKey, freshData, ttl);

  return { data: freshData, fromCache: false };
};

/**
 * Generate cache key for dashboard data
 * @param {string} type - 'stats', 'bubble', 'weekly', etc.
 * @param {string} userId
 * @returns {string}
 */
export const dashboardCacheKey = (type, userId = "current") => {
  return `dashboard:${type}:${userId}`;
};

/**
 * Generate cache key for user data
 * @param {string} userId
 * @param {string} type
 * @returns {string}
 */
export const userCacheKey = (userId, type = "profile") => {
  return `user:${type}:${userId}`;
};

// Export TTLs for external use
export { TTL };

// Default export
export default {
  getSessionCache,
  setSessionCache,
  getLocalCache,
  setLocalCache,
  getMemoryCache,
  setMemoryCache,
  clearAllCache,
  clearDashboardCache,
  cacheApiCall,
  dashboardCacheKey,
  userCacheKey,
  TTL,
};
