/**
 * HTTP Cache Headers Middleware
 *
 * Adds proper cache control headers for different types of responses:
 * - Static assets: Long cache with ETags
 * - API responses: Short cache or no-cache
 * - Dashboard data: Short cache with revalidation
 */

/**
 * Cache policy configurations
 */
const CACHE_POLICIES = {
  // No caching - for sensitive data
  noCache: {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },

  // Private cache - for user-specific data
  private: (maxAge = 60) => ({
    "Cache-Control": `private, max-age=${maxAge}, must-revalidate`,
  }),

  // Public cache - for static/shared data
  public: (maxAge = 300) => ({
    "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${
      maxAge * 2
    }`,
  }),

  // Dashboard data - short cache with background refresh
  dashboard: {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
  },

  // Static assets - long cache
  static: {
    "Cache-Control": "public, max-age=31536000, immutable",
  },
};

/**
 * Apply no-cache headers to response
 */
const noCache = (req, res, next) => {
  Object.entries(CACHE_POLICIES.noCache).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
};

/**
 * Apply private cache headers
 * @param {number} maxAge - Cache duration in seconds
 */
const privateCache =
  (maxAge = 60) =>
  (req, res, next) => {
    Object.entries(CACHE_POLICIES.private(maxAge)).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    next();
  };

/**
 * Apply public cache headers
 * @param {number} maxAge - Cache duration in seconds
 */
const publicCache =
  (maxAge = 300) =>
  (req, res, next) => {
    Object.entries(CACHE_POLICIES.public(maxAge)).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    next();
  };

/**
 * Apply dashboard-specific cache headers
 */
const dashboardCache = (req, res, next) => {
  Object.entries(CACHE_POLICIES.dashboard).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
};

/**
 * Apply static asset cache headers
 */
const staticCache = (req, res, next) => {
  Object.entries(CACHE_POLICIES.static).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  next();
};

/**
 * Auto-detect and apply appropriate cache headers based on route
 */
const autoCacheHeaders = (req, res, next) => {
  const path = req.path.toLowerCase();

  // No cache for auth and sensitive endpoints
  if (
    path.includes("/auth") ||
    path.includes("/login") ||
    path.includes("/register") ||
    path.includes("/biometric") ||
    req.method !== "GET"
  ) {
    return noCache(req, res, next);
  }

  // Dashboard endpoints - short cache
  if (path.includes("/dashboard")) {
    return dashboardCache(req, res, next);
  }

  // Static files - long cache
  if (
    path.includes("/uploads") ||
    path.includes("/static") ||
    path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)
  ) {
    return staticCache(req, res, next);
  }

  // Default - private short cache for GET requests
  if (req.method === "GET") {
    return privateCache(60)(req, res, next);
  }

  // No cache for everything else
  return noCache(req, res, next);
};

/**
 * ETag support middleware
 * Adds ETag headers for conditional requests
 */
const etagSupport = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    // Only add ETag for successful GET responses
    if (req.method === "GET" && res.statusCode === 200 && body) {
      const crypto = require("crypto");
      const hash = crypto
        .createHash("md5")
        .update(typeof body === "string" ? body : JSON.stringify(body))
        .digest("hex");

      const etag = `"${hash}"`;
      res.setHeader("ETag", etag);

      // Check If-None-Match header
      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch === etag) {
        return res.status(304).end();
      }
    }

    return originalSend.call(this, body);
  };

  next();
};

module.exports = {
  noCache,
  privateCache,
  publicCache,
  dashboardCache,
  staticCache,
  autoCacheHeaders,
  etagSupport,
  CACHE_POLICIES,
};
