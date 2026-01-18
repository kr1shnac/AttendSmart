/**
 * iBeacon Native Service
 * Handles iBeacon broadcasting (teacher) and monitoring (student)
 * Uses capacitor-ibeacon for cross-platform iBeacon support
 *
 * @version 1.0.0
 */

import { Capacitor } from "@capacitor/core";

// Plugin registration - capacitor-ibeacon uses the Plugins object
let IBeacon = null;

class IBeaconNativeService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = false;
    this.isAdvertising = false;
    this.isMonitoring = false;

    // Current session beacon info
    this.currentBeacon = null;

    // Detected beacons cache
    this.detectedBeacons = new Map();

    // Callbacks
    this.onRegionEnterCallback = null;
    this.onRegionExitCallback = null;
    this.onBeaconRangedCallback = null;

    // Configuration
    this.config = {
      // Default UUID for AttendSmart beacons
      defaultUUID: "A7AE2EB7-1F00-4168-B99B-A749BAC1CA64",
      // Distance thresholds (meters)
      proximityThreshold: 15, // Max acceptable distance for attendance
    };
  }

  /**
   * Initialize the iBeacon plugin
   * Must be called before any other method
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("[iBeacon] Already initialized");
      return true;
    }

    if (!this.isNative) {
      console.log("[iBeacon] Not on native platform - iBeacon disabled");
      return false;
    }

    try {
      // Dynamic import to get the IBeacon plugin
      const { Plugins } = await import("@capacitor/core");

      // Check if IBeacon is registered
      if (!Plugins.IBeacon) {
        console.error("[iBeacon] Plugin not registered");
        return false;
      }

      IBeacon = Plugins.IBeacon;

      // Request authorization
      await this.requestAuthorization();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log("✅ [iBeacon] Service initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ [iBeacon] Initialization failed:", error);
      return false;
    }
  }

  /**
   * Request Bluetooth and Location authorization
   */
  async requestAuthorization() {
    if (!IBeacon) return false;

    try {
      // Request always authorization for background beacon monitoring
      await IBeacon.requestAlwaysAuthorization();
      console.log("[iBeacon] Authorization granted");
      return true;
    } catch (error) {
      console.warn("[iBeacon] Authorization request failed:", error);
      // Try when-in-use authorization as fallback
      try {
        await IBeacon.requestWhenInUseAuthorization();
        return true;
      } catch (e) {
        console.error("[iBeacon] All authorization attempts failed");
        return false;
      }
    }
  }

  /**
   * Set up iBeacon event listeners
   */
  setupEventListeners() {
    if (!IBeacon) return;

    // Region enter event
    IBeacon.addListener("enteredRegion", (response) => {
      console.log("[iBeacon] Entered region:", response.region.identifier);

      if (this.onRegionEnterCallback) {
        this.onRegionEnterCallback(response.region);
      }
    });

    // Region exit event
    IBeacon.addListener("leftRegion", (response) => {
      console.log("[iBeacon] Left region:", response.region.identifier);

      if (this.onRegionExitCallback) {
        this.onRegionExitCallback(response.region);
      }
    });

    // Beacon ranged event (for distance estimation)
    IBeacon.addListener("didRangeBeaconsInRegion", (response) => {
      if (response.beacons && response.beacons.length > 0) {
        response.beacons.forEach((beacon) => {
          const beaconInfo = {
            uuid: beacon.uuid,
            major: beacon.major,
            minor: beacon.minor,
            proximity: beacon.proximity,
            accuracy: beacon.accuracy, // Distance in meters
            rssi: beacon.rssi,
            timestamp: new Date().toISOString(),
          };

          // Store in cache
          const key = `${beacon.uuid}-${beacon.major}-${beacon.minor}`;
          this.detectedBeacons.set(key, beaconInfo);

          if (this.onBeaconRangedCallback) {
            this.onBeaconRangedCallback(beaconInfo);
          }
        });
      }
    });
  }

  // =============================================
  // TEACHER FUNCTIONS (Broadcasting)
  // =============================================

  /**
   * Start advertising as an iBeacon (Teacher's phone becomes the beacon)
   * @param {Object} options - Beacon configuration
   * @param {string} options.uuid - Beacon UUID (optional, uses default)
   * @param {number} options.major - Major value (e.g., session-specific)
   * @param {number} options.minor - Minor value (e.g., room number)
   * @param {string} options.identifier - Human-readable identifier
   */
  async startAdvertising(options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("iBeacon not initialized");
      }
    }

    if (this.isAdvertising) {
      console.log("[iBeacon] Already advertising");
      return this.currentBeacon;
    }

    const beaconConfig = {
      uuid: options.uuid || this.config.defaultUUID,
      major: options.major || 1,
      minor: options.minor || 1,
      identifier: options.identifier || "AttendSmart-Beacon",
    };

    try {
      console.log("[iBeacon] Starting advertising:", beaconConfig);

      await IBeacon.startAdvertising({
        uuid: beaconConfig.uuid,
        major: beaconConfig.major,
        minor: beaconConfig.minor,
        identifier: beaconConfig.identifier,
      });

      this.isAdvertising = true;
      this.currentBeacon = beaconConfig;

      console.log("✅ [iBeacon] Advertising started successfully");
      return beaconConfig;
    } catch (error) {
      console.error("❌ [iBeacon] Failed to start advertising:", error);
      throw error;
    }
  }

  /**
   * Stop advertising as an iBeacon
   */
  async stopAdvertising() {
    if (!this.isAdvertising) {
      console.log("[iBeacon] Not currently advertising");
      return true;
    }

    try {
      await IBeacon.stopAdvertising();

      this.isAdvertising = false;
      this.currentBeacon = null;

      console.log("✅ [iBeacon] Advertising stopped");
      return true;
    } catch (error) {
      console.error("❌ [iBeacon] Failed to stop advertising:", error);
      throw error;
    }
  }

  /**
   * Generate a unique beacon configuration for a session
   * @param {string} sessionId - Session ID from backend
   * @param {number} roomNumber - Room number (used as minor value)
   */
  generateSessionBeacon(sessionId, roomNumber = 1) {
    // Use the session ID to create a reproducible major value
    // This ensures the same session always has the same beacon config
    const major = this.hashStringToNumber(sessionId, 65535);

    return {
      uuid: this.config.defaultUUID,
      major: major,
      minor: roomNumber,
      identifier: `AttendSmart-Session-${sessionId.substring(0, 8)}`,
    };
  }

  /**
   * Hash a string to a number within a range
   */
  hashStringToNumber(str, max) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % max;
  }

  // =============================================
  // STUDENT FUNCTIONS (Monitoring/Scanning)
  // =============================================

  /**
   * Start monitoring for a specific beacon region
   * @param {Object} region - Region to monitor
   * @param {string} region.uuid - Beacon UUID
   * @param {number} region.major - Major value (optional)
   * @param {number} region.minor - Minor value (optional)
   * @param {string} region.identifier - Region identifier
   */
  async startMonitoring(region) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("iBeacon not initialized");
      }
    }

    try {
      console.log("[iBeacon] Starting monitoring for region:", region);

      await IBeacon.startMonitoringForRegion({
        uuid: region.uuid || this.config.defaultUUID,
        major: region.major,
        minor: region.minor,
        identifier: region.identifier || "AttendSmart-Region",
      });

      // Also start ranging to get distance estimates
      await IBeacon.startRangingBeaconsInRegion({
        uuid: region.uuid || this.config.defaultUUID,
        major: region.major,
        minor: region.minor,
        identifier: region.identifier || "AttendSmart-Region",
      });

      this.isMonitoring = true;
      console.log("✅ [iBeacon] Monitoring started");
      return true;
    } catch (error) {
      console.error("❌ [iBeacon] Failed to start monitoring:", error);
      throw error;
    }
  }

  /**
   * Stop monitoring for beacons
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return true;
    }

    try {
      await IBeacon.stopMonitoringForRegion({
        uuid: this.config.defaultUUID,
        identifier: "AttendSmart-Region",
      });

      await IBeacon.stopRangingBeaconsInRegion({
        uuid: this.config.defaultUUID,
        identifier: "AttendSmart-Region",
      });

      this.isMonitoring = false;
      this.detectedBeacons.clear();

      console.log("✅ [iBeacon] Monitoring stopped");
      return true;
    } catch (error) {
      console.error("❌ [iBeacon] Failed to stop monitoring:", error);
      return false;
    }
  }

  /**
   * Verify proximity to a session beacon
   * @param {Object} sessionBeacon - Expected beacon configuration
   * @param {number} maxDistance - Maximum acceptable distance (meters)
   */
  async verifyProximity(sessionBeacon, maxDistance = 15) {
    console.log("[iBeacon] Verifying proximity to beacon:", sessionBeacon);

    if (!this.isInitialized) {
      await this.initialize();
    }

    // If not on native platform, return skipped result
    if (!this.isNative) {
      return {
        verified: true,
        skipped: true,
        confidence: 100,
        message: "iBeacon not available on web - verification skipped",
      };
    }

    return new Promise(async (resolve) => {
      // Clear previous detections
      this.detectedBeacons.clear();

      // Set up callback to collect beacon data
      let beaconFound = null;

      this.onBeaconRangedCallback = (beacon) => {
        // Check if this is the beacon we're looking for
        if (
          beacon.uuid.toUpperCase() === sessionBeacon.uuid.toUpperCase() &&
          beacon.major === sessionBeacon.major &&
          beacon.minor === sessionBeacon.minor
        ) {
          beaconFound = beacon;
        }
      };

      try {
        // Start monitoring for the specific session beacon
        await this.startMonitoring({
          uuid: sessionBeacon.uuid,
          major: sessionBeacon.major,
          minor: sessionBeacon.minor,
          identifier: sessionBeacon.identifier,
        });

        // Wait for beacon detection (5 seconds)
        setTimeout(async () => {
          await this.stopMonitoring();
          this.onBeaconRangedCallback = null;

          if (beaconFound) {
            const distance = beaconFound.accuracy; // Distance in meters
            const verified = distance <= maxDistance;

            // Calculate confidence based on distance
            const confidence = verified
              ? Math.max(50, Math.min(100, 100 - (distance / maxDistance) * 50))
              : 0;

            resolve({
              verified,
              confidence: Math.round(confidence),
              distance: Math.round(distance * 100) / 100,
              rssi: beaconFound.rssi,
              proximity: beaconFound.proximity,
              message: verified
                ? `Beacon detected (${distance.toFixed(1)}m)`
                : `Beacon too far (${distance.toFixed(1)}m)`,
              beacon: beaconFound,
            });
          } else {
            resolve({
              verified: false,
              confidence: 0,
              message: "Session beacon not detected",
              beacon: null,
            });
          }
        }, 5000);
      } catch (error) {
        this.onBeaconRangedCallback = null;
        resolve({
          verified: false,
          confidence: 0,
          message: `iBeacon error: ${error.message}`,
          error,
        });
      }
    });
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Get all currently detected beacons
   */
  getDetectedBeacons() {
    return Array.from(this.detectedBeacons.values());
  }

  /**
   * Get the closest detected beacon
   */
  getClosestBeacon() {
    const beacons = this.getDetectedBeacons();
    if (beacons.length === 0) return null;

    return beacons.reduce((closest, current) =>
      current.accuracy < closest.accuracy ? current : closest
    );
  }

  /**
   * Check if iBeacon is available on this device
   */
  isAvailable() {
    return this.isNative && this.isInitialized;
  }

  /**
   * Get current advertising status
   */
  getAdvertisingStatus() {
    return {
      isAdvertising: this.isAdvertising,
      currentBeacon: this.currentBeacon,
    };
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      detectedBeacons: this.getDetectedBeacons(),
    };
  }

  /**
   * Set callback for region enter events
   */
  setOnRegionEnter(callback) {
    this.onRegionEnterCallback = callback;
  }

  /**
   * Set callback for region exit events
   */
  setOnRegionExit(callback) {
    this.onRegionExitCallback = callback;
  }

  /**
   * Set callback for beacon ranged events
   */
  setOnBeaconRanged(callback) {
    this.onBeaconRangedCallback = callback;
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    if (this.isAdvertising) {
      await this.stopAdvertising();
    }
    if (this.isMonitoring) {
      await this.stopMonitoring();
    }
    this.detectedBeacons.clear();
    this.onRegionEnterCallback = null;
    this.onRegionExitCallback = null;
    this.onBeaconRangedCallback = null;
  }
}

// Export singleton instance
export const iBeaconNativeService = new IBeaconNativeService();
export default iBeaconNativeService;
