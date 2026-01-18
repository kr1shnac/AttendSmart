/**
 * BLE Native Service
 * Handles Bluetooth Low Energy scanning for classroom proximity detection
 */

import { Capacitor } from "@capacitor/core";
import { BleClient, ScanMode } from "@capacitor-community/bluetooth-le";

class BLENativeService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = false;
    this.isScanning = false;
    this.discoveredDevices = new Map();
    this.scanCallback = null;
    this.targetBeaconUUIDs = [];

    // BLE configuration
    this.config = {
      scanDuration: 10000, // 10 seconds
      rssiThreshold: -85, // Signal strength threshold
      txPower: -59, // Calibrated TX power at 1 meter
      pathLossExponent: 2.0, // Indoor environment
    };
  }

  /**
   * Initialize BLE client
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("[BLE] Already initialized");
      return true;
    }

    try {
      if (this.isNative) {
        await BleClient.initialize();
        console.log("[BLE] Native BLE initialized");
      } else {
        // Web Bluetooth API check
        if (!navigator.bluetooth) {
          console.warn("[BLE] Web Bluetooth not supported");
          return false;
        }
        console.log("[BLE] Web Bluetooth available");
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("[BLE] Initialization failed:", error);
      return false;
    }
  }

  /**
   * Calculate distance from RSSI using path loss model
   * Distance = 10 ^ ((TxPower - RSSI) / (10 * n))
   */
  calculateDistance(rssi) {
    if (rssi >= 0) return -1; // Invalid RSSI

    const { txPower, pathLossExponent } = this.config;
    const ratio = (txPower - rssi) / (10 * pathLossExponent);
    const distance = Math.pow(10, ratio);

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get signal quality description
   */
  getSignalQuality(rssi) {
    if (rssi >= -50)
      return { quality: "excellent", color: "#00c851", strength: 100 };
    if (rssi >= -65) return { quality: "good", color: "#00c851", strength: 75 };
    if (rssi >= -75) return { quality: "fair", color: "#ffd60a", strength: 50 };
    if (rssi >= -85) return { quality: "weak", color: "#ff6b35", strength: 25 };
    return { quality: "very weak", color: "#dc2f02", strength: 10 };
  }

  /**
   * Start scanning for BLE beacons
   */
  async startScan(options = {}) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("BLE not initialized");
      }
    }

    if (this.isScanning) {
      console.log("[BLE] Already scanning");
      return;
    }

    const {
      onDeviceFound,
      onScanComplete,
      onError,
      duration = this.config.scanDuration,
      targetUUIDs = [],
    } = options;

    this.scanCallback = onDeviceFound;
    this.targetBeaconUUIDs = targetUUIDs;
    this.discoveredDevices.clear();

    console.log("[BLE] Starting scan...", { duration, targetUUIDs });

    try {
      this.isScanning = true;

      if (this.isNative) {
        // Native BLE scanning
        await BleClient.requestLEScan(
          {
            // Filter by service UUIDs if provided
            services: targetUUIDs.length > 0 ? targetUUIDs : undefined,
            allowDuplicates: true,
            scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
          },
          (result) => {
            this.handleDeviceDiscovered(result);
          }
        );

        // Auto-stop after duration
        setTimeout(async () => {
          await this.stopScan();
          if (onScanComplete) {
            onScanComplete(Array.from(this.discoveredDevices.values()));
          }
        }, duration);
      } else {
        // Web Bluetooth fallback
        await this.webBluetoothScan(options);
      }
    } catch (error) {
      console.error("[BLE] Scan error:", error);
      this.isScanning = false;
      if (onError) onError(error);
      throw error;
    }
  }

  /**
   * Handle discovered device
   */
  handleDeviceDiscovered(result) {
    const { device, rssi, localName, manufacturerData } = result;

    const deviceInfo = {
      id: device.deviceId,
      name: localName || device.name || "Unknown Device",
      rssi: rssi,
      distance: this.calculateDistance(rssi),
      signalQuality: this.getSignalQuality(rssi),
      isWithinRange: rssi >= this.config.rssiThreshold,
      timestamp: new Date().toISOString(),
      manufacturerData: manufacturerData,
    };

    // Update or add device
    this.discoveredDevices.set(device.deviceId, deviceInfo);

    console.log(
      "[BLE] Device found:",
      deviceInfo.name,
      "RSSI:",
      rssi,
      "Distance:",
      deviceInfo.distance + "m"
    );

    // Callback for real-time updates
    if (this.scanCallback) {
      this.scanCallback(deviceInfo);
    }
  }

  /**
   * Web Bluetooth scanning fallback
   */
  async webBluetoothScan(options) {
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: options.targetUUIDs || [],
      });

      console.log("[BLE] Web Bluetooth device:", device.name);

      // Web Bluetooth doesn't provide RSSI during scan
      const deviceInfo = {
        id: device.id,
        name: device.name || "Unknown Device",
        rssi: -65, // Estimated
        distance: 3, // Estimated
        signalQuality: this.getSignalQuality(-65),
        isWithinRange: true,
        timestamp: new Date().toISOString(),
      };

      this.discoveredDevices.set(device.id, deviceInfo);

      if (this.scanCallback) {
        this.scanCallback(deviceInfo);
      }

      if (options.onScanComplete) {
        options.onScanComplete([deviceInfo]);
      }
    } catch (error) {
      console.error("[BLE] Web Bluetooth scan failed:", error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Stop BLE scanning
   */
  async stopScan() {
    if (!this.isScanning) return;

    try {
      if (this.isNative) {
        await BleClient.stopLEScan();
      }
      console.log("[BLE] Scan stopped");
    } catch (error) {
      console.error("[BLE] Stop scan error:", error);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get all discovered devices
   */
  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get devices within range (for attendance verification)
   */
  getDevicesInRange() {
    return this.getDiscoveredDevices().filter((d) => d.isWithinRange);
  }

  /**
   * Find specific beacon by name or UUID
   */
  findBeacon(identifier) {
    return this.getDiscoveredDevices().find(
      (d) =>
        d.name.toLowerCase().includes(identifier.toLowerCase()) ||
        d.id === identifier
    );
  }

  /**
   * Verify proximity to a session beacon
   * Returns verification result for attendance
   */
  async verifyProximity(sessionBeaconId, requiredDistance = 15) {
    console.log("[BLE] Verifying proximity to:", sessionBeaconId);

    return new Promise((resolve) => {
      this.startScan({
        duration: 5000, // Quick 5-second scan
        onScanComplete: (devices) => {
          // Look for target beacon or any classroom beacon
          let targetBeacon = devices.find(
            (d) =>
              d.id === sessionBeaconId ||
              d.name.toLowerCase().includes(sessionBeaconId.toLowerCase()) ||
              d.name.toLowerCase().includes("classroom") ||
              d.name.toLowerCase().includes("beacon") ||
              d.name.toLowerCase().includes("attend")
          );

          // If no specific beacon found, use the closest device
          if (!targetBeacon && devices.length > 0) {
            targetBeacon = devices.reduce((closest, current) =>
              current.rssi > closest.rssi ? current : closest
            );
          }

          if (!targetBeacon) {
            resolve({
              verified: false,
              confidence: 0,
              message: "No BLE beacon found nearby",
              devices: devices,
            });
            return;
          }

          const verified =
            targetBeacon.distance <= requiredDistance &&
            targetBeacon.isWithinRange;

          const confidence = Math.max(
            0,
            Math.min(100, 100 - (targetBeacon.distance / requiredDistance) * 50)
          );

          resolve({
            verified,
            confidence: Math.round(confidence),
            distance: targetBeacon.distance,
            rssi: targetBeacon.rssi,
            signalQuality: targetBeacon.signalQuality,
            message: verified
              ? `Beacon detected (${targetBeacon.distance}m)`
              : `Beacon too far (${targetBeacon.distance}m)`,
            beacon: targetBeacon,
            devicesFound: devices.length,
          });
        },
        onError: (error) => {
          resolve({
            verified: false,
            confidence: 0,
            message: "BLE scan failed: " + error.message,
            error,
          });
        },
      });
    });
  }

  /**
   * Cleanup
   */
  async cleanup() {
    await this.stopScan();
    this.discoveredDevices.clear();
    this.isInitialized = false;
  }
}

export const bleNativeService = new BLENativeService();
export default bleNativeService;
