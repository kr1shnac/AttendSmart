/**
 * Native BLE Service - Bluetooth Low Energy Handler
 *
 * Production-grade BLE service for Capacitor apps.
 * Uses native APIs for beacon detection and classroom verification.
 *
 * Features:
 * - Native Bluetooth enable/disable prompts
 * - Low-latency beacon scanning
 * - UUID-based filtering for classroom beacons
 * - RSSI-based proximity estimation
 *
 * Requires: @capacitor-community/bluetooth-le
 *
 * @module services/nativeBLE
 * @version 1.0.0
 */

import { Capacitor } from "@capacitor/core";
import { BleClient, ScanMode } from "@capacitor-community/bluetooth-le";

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // AttendSmart beacon service UUID (customize for your beacons)
  BEACON_SERVICE_UUID: "FDA50693-A4E2-4FB1-AFCF-C6EB07647825",

  // Alternative: iBeacon UUID format
  IBEACON_UUID: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",

  // Scan timeout (ms)
  scanTimeout: 10000,

  // RSSI threshold for "nearby" (dBm)
  nearbyRssiThreshold: -70,

  // RSSI threshold for "in range" (dBm)
  inRangeRssiThreshold: -85,

  // Scan mode for Android
  scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
};

// ============================================
// STATE
// ============================================

let isInitialized = false;
let isScanning = false;
let detectedBeacons = new Map();
let beaconCallbacks = [];

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize BLE service
 * Must be called before any other BLE operations
 *
 * @returns {Promise<boolean>} Success status
 */
export const initializeBLE = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log("ℹ️ [NativeBLE] Not a native platform");
    return false;
  }

  try {
    // Initialize BLE client
    await BleClient.initialize();
    isInitialized = true;
    console.log("✅ [NativeBLE] Initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ [NativeBLE] Initialization error:", error);
    return false;
  }
};

// ============================================
// BLUETOOTH STATE
// ============================================

/**
 * Check if Bluetooth is enabled
 * @returns {Promise<boolean>} Enabled status
 */
export const isBluetoothEnabled = async () => {
  try {
    const enabled = await BleClient.isEnabled();
    console.log(`📶 [NativeBLE] Bluetooth enabled: ${enabled}`);
    return enabled;
  } catch (error) {
    console.error("❌ [NativeBLE] Check enabled error:", error);
    return false;
  }
};

/**
 * Request user to enable Bluetooth via native system dialog
 * This shows the OS-level Bluetooth enable prompt (not a web alert)
 *
 * @returns {Promise<boolean>} Whether Bluetooth is now enabled
 */
export const requestBluetoothEnable = async () => {
  try {
    // First check if already enabled
    const alreadyEnabled = await isBluetoothEnabled();
    if (alreadyEnabled) {
      return true;
    }

    // Request enable via native dialog
    // Note: This works on Android. iOS doesn't allow apps to enable BT programmatically
    await BleClient.requestDevice({
      allowDuplicates: false,
      optionalServices: [CONFIG.BEACON_SERVICE_UUID],
    }).catch(() => {
      // This will prompt the user if BT is off
    });

    // Check again after user interaction
    const nowEnabled = await isBluetoothEnabled();
    console.log(`📶 [NativeBLE] Bluetooth after request: ${nowEnabled}`);
    return nowEnabled;
  } catch (error) {
    console.error("❌ [NativeBLE] Enable request error:", error);
    return false;
  }
};

// ============================================
// SCANNING
// ============================================

/**
 * Start scanning for classroom beacons
 *
 * @param {Object} options - Scan options
 * @param {string} options.classroomUUID - Specific UUID to filter for
 * @param {number} options.timeout - Scan timeout in ms
 * @param {Function} options.onBeaconFound - Callback for each beacon found
 * @returns {Promise<void>}
 */
export const startBeaconScan = async (options = {}) => {
  if (!isInitialized) {
    throw new Error("BLE not initialized. Call initializeBLE() first.");
  }

  if (isScanning) {
    console.log("ℹ️ [NativeBLE] Already scanning");
    return;
  }

  const timeout = options.timeout || CONFIG.scanTimeout;
  const targetUUID = options.classroomUUID || CONFIG.BEACON_SERVICE_UUID;

  try {
    // Check if Bluetooth is enabled
    const enabled = await isBluetoothEnabled();
    if (!enabled) {
      const userEnabled = await requestBluetoothEnable();
      if (!userEnabled) {
        throw new Error("Bluetooth is not enabled");
      }
    }

    isScanning = true;
    detectedBeacons.clear();
    console.log(`📶 [NativeBLE] Starting scan for UUID: ${targetUUID}`);

    // Start BLE scan
    await BleClient.requestLEScan(
      {
        services: [targetUUID],
        allowDuplicates: true,
        scanMode: CONFIG.scanMode,
      },
      (result) => {
        handleScanResult(result, options.onBeaconFound);
      }
    );

    // Auto-stop after timeout
    setTimeout(async () => {
      await stopBeaconScan();
    }, timeout);
  } catch (error) {
    isScanning = false;
    console.error("❌ [NativeBLE] Scan error:", error);
    throw error;
  }
};

/**
 * Stop beacon scanning
 * @returns {Promise<void>}
 */
export const stopBeaconScan = async () => {
  if (!isScanning) {
    return;
  }

  try {
    await BleClient.stopLEScan();
    isScanning = false;
    console.log("✅ [NativeBLE] Scan stopped");
  } catch (error) {
    console.error("❌ [NativeBLE] Stop scan error:", error);
  }
};

/**
 * Handle scan result and process beacon data
 */
const handleScanResult = (result, callback) => {
  const { device, rssi, localName, manufacturerData } = result;

  // Calculate estimated distance from RSSI
  const distance = estimateDistanceFromRSSI(rssi);
  const proximity = getProximityLevel(rssi);

  const beacon = {
    id: device.deviceId,
    name: localName || device.name || "Unknown Beacon",
    rssi,
    distance,
    proximity,
    timestamp: Date.now(),
    raw: result,
  };

  // Update beacon map
  detectedBeacons.set(beacon.id, beacon);

  console.log(
    `📶 [NativeBLE] Beacon: ${
      beacon.name
    } | RSSI: ${rssi}dBm | ~${distance.toFixed(1)}m | ${proximity}`
  );

  // Notify callbacks
  if (callback) {
    callback(beacon);
  }
  beaconCallbacks.forEach((cb) => cb(beacon));
};

// ============================================
// PROXIMITY CALCULATION
// ============================================

/**
 * Estimate distance from RSSI using path-loss model
 * Note: This is an approximation and varies by environment
 *
 * @param {number} rssi - Signal strength in dBm
 * @returns {number} Estimated distance in meters
 */
const estimateDistanceFromRSSI = (rssi) => {
  // Measured power at 1 meter (calibrate for your beacons)
  const txPower = -59;

  if (rssi === 0) {
    return -1; // Unknown
  }

  const ratio = (rssi * 1.0) / txPower;

  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  } else {
    // Path-loss model constants (environment-dependent)
    return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
  }
};

/**
 * Get proximity level from RSSI
 * @param {number} rssi - Signal strength in dBm
 * @returns {string} Proximity level
 */
const getProximityLevel = (rssi) => {
  if (rssi >= CONFIG.nearbyRssiThreshold) {
    return "immediate"; // < 1m
  } else if (rssi >= CONFIG.inRangeRssiThreshold) {
    return "near"; // 1-3m
  } else if (rssi >= -100) {
    return "far"; // 3-10m
  } else {
    return "unknown";
  }
};

// ============================================
// CLASSROOM VERIFICATION
// ============================================

/**
 * Verify presence in a specific classroom by beacon
 *
 * @param {string} classroomBeaconId - Expected beacon ID/UUID
 * @param {number} timeout - Scan timeout in ms
 * @returns {Promise<Object>} Verification result
 */
export const verifyClassroomPresence = async (
  classroomBeaconId,
  timeout = 5000
) => {
  return new Promise((resolve) => {
    let found = false;
    let bestBeacon = null;

    const callback = (beacon) => {
      if (beacon.id === classroomBeaconId || !classroomBeaconId) {
        if (!bestBeacon || beacon.rssi > bestBeacon.rssi) {
          bestBeacon = beacon;
        }
        found = true;
      }
    };

    // Start scan with callback
    startBeaconScan({
      timeout,
      onBeaconFound: callback,
    })
      .then(() => {
        // Wait for scan to complete
        setTimeout(() => {
          resolve({
            verified: found && bestBeacon && bestBeacon.proximity !== "unknown",
            beacon: bestBeacon,
            rssi: bestBeacon?.rssi || null,
            distance: bestBeacon?.distance || null,
            proximity: bestBeacon?.proximity || "not_found",
            allBeacons: Array.from(detectedBeacons.values()),
          });
        }, timeout + 500);
      })
      .catch((error) => {
        resolve({
          verified: false,
          error: error.message,
          proximity: "error",
        });
      });
  });
};

/**
 * Get the nearest detected beacon
 * @returns {Object|null} Nearest beacon or null
 */
export const getNearestBeacon = () => {
  if (detectedBeacons.size === 0) {
    return null;
  }

  let nearest = null;
  for (const beacon of detectedBeacons.values()) {
    if (!nearest || beacon.rssi > nearest.rssi) {
      nearest = beacon;
    }
  }
  return nearest;
};

/**
 * Get all detected beacons
 * @returns {Array} Array of beacon objects
 */
export const getDetectedBeacons = () => {
  return Array.from(detectedBeacons.values());
};

// ============================================
// CALLBACKS
// ============================================

/**
 * Register callback for beacon detection
 */
export const onBeaconDetected = (callback) => {
  beaconCallbacks.push(callback);
  return () => {
    beaconCallbacks = beaconCallbacks.filter((cb) => cb !== callback);
  };
};

// ============================================
// STATUS
// ============================================

/**
 * Get BLE service status
 */
export const getBLEStatus = async () => {
  const enabled = await isBluetoothEnabled().catch(() => false);

  return {
    initialized: isInitialized,
    enabled,
    scanning: isScanning,
    beaconCount: detectedBeacons.size,
    nearestBeacon: getNearestBeacon(),
  };
};

// ============================================
// EXPORTS
// ============================================

export default {
  initializeBLE,
  isBluetoothEnabled,
  requestBluetoothEnable,
  startBeaconScan,
  stopBeaconScan,
  verifyClassroomPresence,
  getNearestBeacon,
  getDetectedBeacons,
  onBeaconDetected,
  getBLEStatus,
  CONFIG,
};
