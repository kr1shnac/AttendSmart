/**
 * Native Location Service - Background Geofencing
 *
 * Production-grade location service for Capacitor apps.
 * Uses native APIs for reliable background location even when app is minimized.
 *
 * Features:
 * - Background location tracking
 * - Geofence entry/exit detection
 * - Local notifications on campus arrival
 * - Battery-optimized with distance filtering
 *
 * Requires: @capacitor-community/background-geolocation
 *
 * @module services/nativeLocation
 * @version 1.0.0
 */

import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { LocalNotifications } from "@capacitor/local-notifications";

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Distance filter to save battery (meters)
  distanceFilter: 10,

  // Accuracy level (high for attendance marking)
  desiredAccuracy: {
    ios: "best",
    android: "high",
  },

  // Background mode settings
  background: {
    enabled: true,
    notification: {
      title: "AttendSmart Active",
      text: "Location tracking for attendance",
    },
  },

  // Geofence default radius (meters)
  defaultGeofenceRadius: 100,

  // Minimum time between location updates (ms)
  minInterval: 5000,

  // Maximum age of cached location (ms)
  maximumAge: 10000,
};

// ============================================
// STATE
// ============================================

let watchId = null;
let backgroundPlugin = null;
let isTracking = false;
let currentGeofences = [];
let locationCallbacks = [];

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize native location service
 * Dynamically imports background geolocation plugin
 *
 * @returns {Promise<boolean>} Success status
 */
export const initializeNativeLocation = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log(
      "ℹ️ [NativeLocation] Not a native platform, using web fallback"
    );
    return false;
  }

  try {
    // Request notification permission for geofence alerts
    await LocalNotifications.requestPermissions();

    // Dynamically import background geolocation
    try {
      const { BackgroundGeolocation } = await import(
        "@capacitor-community/background-geolocation"
      );
      backgroundPlugin = BackgroundGeolocation;
      console.log("✅ [NativeLocation] Background geolocation loaded");
    } catch (importError) {
      console.warn(
        "⚠️ [NativeLocation] Background plugin not available:",
        importError.message
      );
      // Fall back to standard Capacitor geolocation
    }

    // Check permissions
    const permissions = await Geolocation.checkPermissions();
    console.log("📍 [NativeLocation] Permission status:", permissions.location);

    return true;
  } catch (error) {
    console.error("❌ [NativeLocation] Initialization error:", error);
    return false;
  }
};

// ============================================
// PERMISSIONS
// ============================================

/**
 * Request location permissions (foreground + background)
 * Must request foreground first, then background separately on Android 10+
 *
 * @returns {Promise<Object>} Permission result
 */
export const requestLocationPermissions = async () => {
  try {
    // Step 1: Request foreground (coarse + fine) location
    let result = await Geolocation.requestPermissions();
    console.log("📍 [NativeLocation] Foreground permission:", result.location);

    if (result.location !== "granted") {
      return {
        granted: false,
        foreground: result.location,
        background: "denied",
        message: "Location permission denied",
      };
    }

    // Step 2: Request background location (Android 10+ / iOS)
    // This should trigger a separate system dialog
    if (backgroundPlugin) {
      try {
        // Configure background tracking to trigger the dialog
        await backgroundPlugin.addWatcher(
          {
            backgroundMessage:
              "AttendSmart needs location access to mark attendance",
            backgroundTitle: "Location Access Required",
            requestPermissions: true,
            stale: false,
            distanceFilter: CONFIG.distanceFilter,
          },
          (location, error) => {
            // Just checking permissions, we'll remove this watcher
          }
        );
        console.log("📍 [NativeLocation] Background permission requested");
      } catch (bgError) {
        console.warn(
          "⚠️ [NativeLocation] Background permission error:",
          bgError.message
        );
      }
    }

    return {
      granted: true,
      foreground: "granted",
      background: "granted", // Assume granted if we got here
      message: "Location permissions granted",
    };
  } catch (error) {
    console.error("❌ [NativeLocation] Permission error:", error);
    return {
      granted: false,
      foreground: "denied",
      background: "denied",
      message: error.message,
    };
  }
};

// ============================================
// LOCATION TRACKING
// ============================================

/**
 * Start location tracking with background support
 *
 * @param {Function} onLocation - Callback for location updates
 * @param {Object} options - Tracking options
 * @returns {Promise<string>} Watch ID
 */
export const startLocationTracking = async (onLocation, options = {}) => {
  if (isTracking) {
    console.log("ℹ️ [NativeLocation] Already tracking");
    return watchId;
  }

  const trackingOptions = {
    distanceFilter: options.distanceFilter || CONFIG.distanceFilter,
    enableHighAccuracy: true,
    background: options.background !== false,
  };

  try {
    // Use background plugin if available
    if (backgroundPlugin && trackingOptions.background) {
      watchId = await backgroundPlugin.addWatcher(
        {
          backgroundMessage: CONFIG.background.notification.text,
          backgroundTitle: CONFIG.background.notification.title,
          requestPermissions: false,
          stale: false,
          distanceFilter: trackingOptions.distanceFilter,
        },
        (location, error) => {
          if (error) {
            console.error("❌ [NativeLocation] Background error:", error);
            return;
          }

          const formattedLocation = formatLocation(location);
          onLocation(formattedLocation);

          // Notify all registered callbacks
          locationCallbacks.forEach((cb) => cb(formattedLocation));

          // Check geofences
          checkGeofences(formattedLocation);
        }
      );
      console.log(
        `✅ [NativeLocation] Background tracking started (ID: ${watchId})`
      );
    } else {
      // Fall back to standard Capacitor geolocation
      watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: CONFIG.maximumAge,
        },
        (position, error) => {
          if (error) {
            console.error("❌ [NativeLocation] Watch error:", error);
            return;
          }

          const formattedLocation = formatLocation(position.coords);
          onLocation(formattedLocation);
          locationCallbacks.forEach((cb) => cb(formattedLocation));
          checkGeofences(formattedLocation);
        }
      );
      console.log(
        `✅ [NativeLocation] Foreground tracking started (ID: ${watchId})`
      );
    }

    isTracking = true;
    return watchId;
  } catch (error) {
    console.error("❌ [NativeLocation] Start tracking error:", error);
    throw error;
  }
};

/**
 * Stop location tracking
 * @returns {Promise<void>}
 */
export const stopLocationTracking = async () => {
  if (!isTracking || !watchId) {
    console.log("ℹ️ [NativeLocation] Not currently tracking");
    return;
  }

  try {
    if (backgroundPlugin) {
      await backgroundPlugin.removeWatcher({ id: watchId });
    } else {
      await Geolocation.clearWatch({ id: watchId });
    }

    isTracking = false;
    watchId = null;
    console.log("✅ [NativeLocation] Tracking stopped");
  } catch (error) {
    console.error("❌ [NativeLocation] Stop tracking error:", error);
  }
};

/**
 * Get current location once
 * @returns {Promise<Object>} Current location
 */
export const getCurrentLocation = async () => {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: CONFIG.maximumAge,
    });

    return formatLocation(position.coords);
  } catch (error) {
    console.error("❌ [NativeLocation] Get current location error:", error);
    throw error;
  }
};

// ============================================
// GEOFENCING
// ============================================

/**
 * Add a geofence for campus detection
 *
 * @param {Object} geofence - Geofence configuration
 * @param {string} geofence.id - Unique identifier
 * @param {number} geofence.latitude - Center latitude
 * @param {number} geofence.longitude - Center longitude
 * @param {number} geofence.radius - Radius in meters
 * @param {string} geofence.name - Display name
 * @param {Function} geofence.onEnter - Callback when entering geofence
 * @param {Function} geofence.onExit - Callback when exiting geofence
 */
export const addGeofence = (geofence) => {
  const fence = {
    id: geofence.id,
    latitude: geofence.latitude,
    longitude: geofence.longitude,
    radius: geofence.radius || CONFIG.defaultGeofenceRadius,
    name: geofence.name || "Campus",
    onEnter: geofence.onEnter,
    onExit: geofence.onExit,
    isInside: false,
  };

  // Remove existing fence with same ID
  currentGeofences = currentGeofences.filter((g) => g.id !== fence.id);
  currentGeofences.push(fence);

  console.log(
    `📍 [NativeLocation] Geofence added: ${fence.name} (${fence.radius}m)`
  );
};

/**
 * Remove a geofence
 * @param {string} geofenceId - Geofence ID to remove
 */
export const removeGeofence = (geofenceId) => {
  currentGeofences = currentGeofences.filter((g) => g.id !== geofenceId);
  console.log(`📍 [NativeLocation] Geofence removed: ${geofenceId}`);
};

/**
 * Check all geofences against current location
 * @param {Object} location - Current location
 */
const checkGeofences = async (location) => {
  for (const fence of currentGeofences) {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      fence.latitude,
      fence.longitude
    );

    const isInside = distance <= fence.radius;

    // Detect entry/exit
    if (isInside && !fence.isInside) {
      // Entered geofence
      console.log(`📍 [NativeLocation] Entered geofence: ${fence.name}`);
      fence.isInside = true;

      // Trigger local notification
      await showGeofenceNotification(fence, "enter");

      // Call callback
      if (fence.onEnter) {
        fence.onEnter({ ...location, distance, geofence: fence });
      }
    } else if (!isInside && fence.isInside) {
      // Exited geofence
      console.log(`📍 [NativeLocation] Exited geofence: ${fence.name}`);
      fence.isInside = false;

      if (fence.onExit) {
        fence.onExit({ ...location, distance, geofence: fence });
      }
    }
  }
};

/**
 * Show local notification for geofence event
 */
const showGeofenceNotification = async (fence, event) => {
  if (event === "enter") {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 100000),
          title: "📍 You are on campus!",
          body: `Tap to mark attendance at ${fence.name}`,
          actionTypeId: "MARK_ATTENDANCE",
          extra: {
            geofenceId: fence.id,
            event: "enter",
          },
        },
      ],
    });
  }
};

// ============================================
// HELPERS
// ============================================

/**
 * Format location object for consistent API
 */
const formatLocation = (coords) => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
  accuracy: coords.accuracy,
  altitude: coords.altitude,
  altitudeAccuracy: coords.altitudeAccuracy,
  heading: coords.heading,
  speed: coords.speed,
  timestamp: Date.now(),
});

/**
 * Calculate distance between two points (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Register callback for location updates
 */
export const onLocationUpdate = (callback) => {
  locationCallbacks.push(callback);
  return () => {
    locationCallbacks = locationCallbacks.filter((cb) => cb !== callback);
  };
};

/**
 * Check if currently tracking
 */
export const isLocationTracking = () => isTracking;

/**
 * Get tracking status
 */
export const getTrackingStatus = () => ({
  isTracking,
  watchId,
  geofenceCount: currentGeofences.length,
  hasBackgroundPlugin: !!backgroundPlugin,
});

// ============================================
// EXPORTS
// ============================================

export default {
  initializeNativeLocation,
  requestLocationPermissions,
  startLocationTracking,
  stopLocationTracking,
  getCurrentLocation,
  addGeofence,
  removeGeofence,
  onLocationUpdate,
  isLocationTracking,
  getTrackingStatus,
};
