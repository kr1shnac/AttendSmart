/**
 * Application Constants
 *
 * Centralized configuration values to eliminate magic numbers.
 * Import these instead of using hardcoded values in controllers.
 *
 * @module config/constants
 * @version 1.0.0
 */

module.exports = {
  // ============================================
  // GPS CONFIGURATION
  // ============================================
  GPS: {
    DEFAULT_RADIUS_METERS: 100,
    CAMPUS_RADIUS_METERS: 5000,
    HIGH_ACCURACY_TIMEOUT_MS: 10000,
    MAX_LOCATION_AGE_MS: 30000,
  },

  // ============================================
  // BLUETOOTH (BLE) CONFIGURATION
  // ============================================
  BLE: {
    MIN_RSSI_STRENGTH: -85,
    EXCELLENT_RSSI: -50,
    GOOD_RSSI: -65,
    FAIR_RSSI: -75,
    SCAN_TIMEOUT_MS: 10000,
    BEACON_PROXIMITY_THRESHOLD_METERS: 5,
  },

  // ============================================
  // BIOMETRICS CONFIGURATION
  // ============================================
  BIOMETRICS: {
    MIN_QUALITY_SCORE: 0.9,
    FACE_MATCH_THRESHOLD: 0.6,
    LIVENESS_THRESHOLD: 0.7,
    SMILE_THRESHOLD_PERCENT: 60,
    MAX_ENROLLMENT_IMAGES: 5,
    ENCODING_DIMENSIONS: 128,
  },

  // ============================================
  // QUEUE CONFIGURATION
  // ============================================
  QUEUE: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    MAX_RETRY_DELAY_MS: 30000,
    BATCH_SIZE: 500,
    CONCURRENCY: 5,
    JOB_RETENTION_HOURS: 24,
  },

  // ============================================
  // RATE LIMITING
  // ============================================
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    ATTENDANCE_MAX_PER_MINUTE: 10,
  },

  // ============================================
  // SESSION CONFIGURATION
  // ============================================
  SESSION: {
    DEFAULT_DURATION_MINUTES: 60,
    MAX_DURATION_HOURS: 8,
    EARLY_CHECKIN_BUFFER_MINUTES: 15,
    LATE_CHECKIN_GRACE_MINUTES: 10,
  },

  // ============================================
  // DEVICE LOCK
  // ============================================
  DEVICE: {
    MAX_DEVICES_PER_USER: 1,
    TRUST_DURATION_DAYS: 365,
  },

  // ============================================
  // FILE UPLOAD
  // ============================================
  UPLOAD: {
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
    MAX_IMAGE_DIMENSION: 1920,
  },

  // ============================================
  // VERIFICATION WEIGHTS
  // ============================================
  VERIFICATION_WEIGHTS: {
    FACE: 0.5,
    BLE: 0.3,
    GPS: 0.2,
  },

  // ============================================
  // HTTP STATUS CODES (for clarity)
  // ============================================
  HTTP: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    GONE: 410,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  },
};
