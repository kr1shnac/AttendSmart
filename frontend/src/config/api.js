/**
 * API Configuration - Production-Grade Centralized API Settings
 *
 * This file provides a single source of truth for all API configuration.
 * All components should import from here instead of accessing process.env directly.
 *
 * Benefits:
 * - Single point of configuration
 * - Automatic fallbacks
 * - Easy environment switching
 * - Prevents undefined API URLs
 *
 * @module config/api
 * @version 1.0.0
 */

// ============================================
// API URL CONFIGURATION
// ============================================

/**
 * Base API URL with intelligent fallback chain
 * Priority: Environment variable → localhost:5000
 */
export const API_BASE_URL = (() => {
  const envUrl = process.env.REACT_APP_API_URL;

  // Log warning if environment variable is missing (development only)
  if (!envUrl && process.env.NODE_ENV === "development") {
    console.warn(
      "⚠️ REACT_APP_API_URL not set. Using fallback: http://localhost:5000\n" +
        "   Set this in your .env file for production."
    );
  }

  return envUrl || "http://localhost:5000";
})();

/**
 * Build a complete API endpoint URL
 * @param {string} path - API path (e.g., '/api/auth/login')
 * @returns {string} Full URL
 */
export const apiUrl = (path) => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

// ============================================
// TIMEOUT CONFIGURATION
// ============================================

/**
 * Request timeout settings (in milliseconds)
 * Tuned for production reliability
 */
export const TIMEOUTS = {
  /** Default API request timeout */
  DEFAULT: 30000, // 30 seconds

  /** Short timeout for health checks */
  HEALTH_CHECK: 5000, // 5 seconds

  /** Extended timeout for file uploads */
  UPLOAD: 120000, // 2 minutes

  /** Quick timeout for user-facing requests */
  FAST: 10000, // 10 seconds

  /** Socket.IO connection timeout */
  SOCKET: 60000, // 1 minute
};

// ============================================
// RETRY CONFIGURATION
// ============================================

/**
 * Retry settings for failed requests
 * Uses exponential backoff for production reliability
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  MAX_RETRIES: 3,

  /** Base delay for exponential backoff (ms) */
  BASE_DELAY: 1000,

  /** Maximum delay between retries (ms) */
  MAX_DELAY: 10000,

  /** HTTP status codes that should trigger a retry */
  RETRYABLE_STATUSES: [408, 429, 500, 502, 503, 504],

  /** Calculate delay for a given retry attempt */
  getDelay: (attempt) => {
    const delay = Math.min(
      RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt),
      RETRY_CONFIG.MAX_DELAY
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  },
};

// ============================================
// CONNECTION STATUS
// ============================================

/**
 * Connection status types
 */
export const CONNECTION_STATUS = {
  CONNECTED: "connected",
  CONNECTING: "connecting",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
};

// ============================================
// FEATURE FLAGS
// ============================================

/**
 * Feature flags for production control
 */
export const FEATURES = {
  /** Enable request logging in console */
  DEBUG_LOGGING: process.env.NODE_ENV === "development",

  /** Enable offline mode support */
  OFFLINE_MODE: true,

  /** Enable request caching */
  CACHING: true,

  /** Show connection status indicator */
  CONNECTION_INDICATOR: true,
};

// ============================================
// EXPORTS
// ============================================

export default {
  API_BASE_URL,
  apiUrl,
  TIMEOUTS,
  RETRY_CONFIG,
  CONNECTION_STATUS,
  FEATURES,
};
