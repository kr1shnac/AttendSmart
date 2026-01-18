/**
 * useSensors Hook - Platform Bridge for GPS & BLE
 *
 * Unified hook that automatically selects native or web sensors
 * based on platform detection. Allows browser testing while
 * providing full native functionality on mobile.
 *
 * Usage:
 *   const { location, ble, isNative, status } = useSensors();
 *
 * @module hooks/useSensors
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";

// Native services
import nativeLocation from "../services/nativeLocation";
import nativeBLE from "../services/nativeBLE";

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // How often to refresh location in web mode (ms)
  webLocationInterval: 5000,

  // Location timeout
  locationTimeout: 10000,

  // BLE scan timeout
  bleScanTimeout: 5000,
};

// ============================================
// HOOK
// ============================================

export const useSensors = (options = {}) => {
  const isNative = Capacitor.isNativePlatform();

  // ============================================
  // STATE
  // ============================================

  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);

  const [bleStatus, setBleStatus] = useState({
    enabled: false,
    scanning: false,
    nearestBeacon: null,
  });
  const [bleError, setBleError] = useState(null);

  const [permissions, setPermissions] = useState({
    location: "unknown",
    bluetooth: "unknown",
    notifications: "unknown",
  });

  const webWatchId = useRef(null);
  const mounted = useRef(true);

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      if (isNative) {
        // Initialize native services
        await nativeLocation.initializeNativeLocation();
        await nativeBLE.initializeBLE();

        // Check initial BLE status
        const bleEnabled = await nativeBLE.isBluetoothEnabled();
        if (mounted.current) {
          setBleStatus((prev) => ({ ...prev, enabled: bleEnabled }));
        }
      }
    };

    init();

    return () => {
      mounted.current = false;
      stopLocationTracking();
    };
  }, [isNative]);

  // ============================================
  // LOCATION - NATIVE
  // ============================================

  const startNativeLocationTracking = useCallback(async () => {
    try {
      // Request permissions
      const permResult = await nativeLocation.requestLocationPermissions();

      if (!permResult.granted) {
        setLocationError("Location permission denied");
        return false;
      }

      setPermissions((prev) => ({
        ...prev,
        location: "granted",
      }));

      // Start tracking
      await nativeLocation.startLocationTracking(
        (loc) => {
          if (mounted.current) {
            setLocation(loc);
            setLocationError(null);
          }
        },
        {
          background: options.background !== false,
          distanceFilter: options.distanceFilter || 10,
        }
      );

      setIsTrackingLocation(true);
      return true;
    } catch (error) {
      console.error("Native location error:", error);
      setLocationError(error.message);
      return false;
    }
  }, [options.background, options.distanceFilter]);

  // ============================================
  // LOCATION - WEB FALLBACK
  // ============================================

  const startWebLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return false;
    }

    try {
      webWatchId.current = navigator.geolocation.watchPosition(
        (position) => {
          if (mounted.current) {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            });
            setLocationError(null);
          }
        },
        (error) => {
          if (mounted.current) {
            setLocationError(error.message);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: CONFIG.locationTimeout,
          maximumAge: 5000,
        }
      );

      setIsTrackingLocation(true);
      setPermissions((prev) => ({ ...prev, location: "granted" }));
      return true;
    } catch (error) {
      setLocationError(error.message);
      return false;
    }
  }, []);

  // ============================================
  // LOCATION - UNIFIED
  // ============================================

  const startLocationTracking = useCallback(async () => {
    if (isNative) {
      return await startNativeLocationTracking();
    } else {
      return startWebLocationTracking();
    }
  }, [isNative, startNativeLocationTracking, startWebLocationTracking]);

  const stopLocationTracking = useCallback(async () => {
    if (isNative) {
      await nativeLocation.stopLocationTracking();
    } else if (webWatchId.current !== null) {
      navigator.geolocation.clearWatch(webWatchId.current);
      webWatchId.current = null;
    }
    setIsTrackingLocation(false);
  }, [isNative]);

  const getCurrentLocation = useCallback(async () => {
    if (isNative) {
      try {
        const loc = await nativeLocation.getCurrentLocation();
        setLocation(loc);
        return loc;
      } catch (error) {
        setLocationError(error.message);
        throw error;
      }
    } else {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            };
            setLocation(loc);
            resolve(loc);
          },
          (error) => {
            setLocationError(error.message);
            reject(error);
          },
          { enableHighAccuracy: true, timeout: CONFIG.locationTimeout }
        );
      });
    }
  }, [isNative]);

  // ============================================
  // GEOFENCING
  // ============================================

  const addGeofence = useCallback(
    (geofenceConfig) => {
      if (isNative) {
        nativeLocation.addGeofence(geofenceConfig);
      } else {
        console.warn("Geofencing not available in web mode");
      }
    },
    [isNative]
  );

  const removeGeofence = useCallback(
    (geofenceId) => {
      if (isNative) {
        nativeLocation.removeGeofence(geofenceId);
      }
    },
    [isNative]
  );

  // ============================================
  // BLE - NATIVE ONLY
  // ============================================

  const startBleScan = useCallback(
    async (scanOptions = {}) => {
      if (!isNative) {
        console.warn("BLE scanning not available in web mode");
        setBleError("BLE not available in browser");
        return null;
      }

      try {
        setBleStatus((prev) => ({ ...prev, scanning: true }));
        setBleError(null);

        await nativeBLE.startBeaconScan({
          timeout: scanOptions.timeout || CONFIG.bleScanTimeout,
          classroomUUID: scanOptions.classroomUUID,
          onBeaconFound: (beacon) => {
            if (mounted.current) {
              setBleStatus((prev) => ({
                ...prev,
                nearestBeacon:
                  !prev.nearestBeacon || beacon.rssi > prev.nearestBeacon.rssi
                    ? beacon
                    : prev.nearestBeacon,
              }));
            }
            if (scanOptions.onBeaconFound) {
              scanOptions.onBeaconFound(beacon);
            }
          },
        });

        // Update status after scan timeout
        setTimeout(async () => {
          if (mounted.current) {
            const status = await nativeBLE.getBLEStatus();
            setBleStatus((prev) => ({
              ...prev,
              scanning: false,
              nearestBeacon: status.nearestBeacon,
            }));
          }
        }, (scanOptions.timeout || CONFIG.bleScanTimeout) + 500);

        return true;
      } catch (error) {
        setBleError(error.message);
        setBleStatus((prev) => ({ ...prev, scanning: false }));
        return false;
      }
    },
    [isNative]
  );

  const stopBleScan = useCallback(async () => {
    if (isNative) {
      await nativeBLE.stopBeaconScan();
      setBleStatus((prev) => ({ ...prev, scanning: false }));
    }
  }, [isNative]);

  const verifyClassroomPresence = useCallback(
    async (beaconId) => {
      if (!isNative) {
        return { verified: false, error: "BLE not available in browser" };
      }
      return await nativeBLE.verifyClassroomPresence(beaconId);
    },
    [isNative]
  );

  const requestBluetoothEnable = useCallback(async () => {
    if (!isNative) {
      return false;
    }
    const enabled = await nativeBLE.requestBluetoothEnable();
    setBleStatus((prev) => ({ ...prev, enabled }));
    return enabled;
  }, [isNative]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Platform info
    isNative,
    platform: Capacitor.getPlatform(),

    // Permissions
    permissions,

    // Location
    location: {
      data: location,
      error: locationError,
      isTracking: isTrackingLocation,
      start: startLocationTracking,
      stop: stopLocationTracking,
      getCurrent: getCurrentLocation,
      addGeofence,
      removeGeofence,
    },

    // BLE
    ble: {
      enabled: bleStatus.enabled,
      scanning: bleStatus.scanning,
      nearestBeacon: bleStatus.nearestBeacon,
      error: bleError,
      startScan: startBleScan,
      stopScan: stopBleScan,
      verifyClassroom: verifyClassroomPresence,
      requestEnable: requestBluetoothEnable,
    },

    // Status summary
    status: {
      locationReady: location !== null,
      bleReady: isNative && bleStatus.enabled,
      allReady: location !== null && (!isNative || bleStatus.enabled),
    },
  };
};

export default useSensors;
