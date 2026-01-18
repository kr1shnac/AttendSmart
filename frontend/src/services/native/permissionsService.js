/**
 * Permissions Service
 * Handles all native permission requests for AttendSmart
 */

import { Capacitor } from "@capacitor/core";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { Geolocation } from "@capacitor/geolocation";
import { Camera } from "@capacitor/camera";

class PermissionsService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.permissionStatus = {
      ble: false,
      location: false,
      camera: false,
    };
  }

  /**
   * Check if running on native platform
   */
  isNativePlatform() {
    return this.isNative;
  }

  /**
   * Request all permissions needed for attendance verification
   */
  async requestAllPermissions() {
    console.log("[Permissions] Requesting all permissions...");

    const results = {
      ble: false,
      location: false,
      camera: false,
      success: false,
    };

    try {
      // Request Location permissions first
      results.location = await this.requestLocationPermission();

      // Request Camera permissions
      results.camera = await this.requestCameraPermission();

      // Request BLE permissions
      results.ble = await this.requestBLEPermission();

      results.success = results.ble && results.location && results.camera;

      console.log("[Permissions] Results:", results);
      return results;
    } catch (error) {
      console.error("[Permissions] Error requesting permissions:", error);
      return results;
    }
  }

  /**
   * Request Bluetooth Low Energy permission
   */
  async requestBLEPermission() {
    if (!this.isNative) {
      console.log("[Permissions] BLE: Web platform, checking Web Bluetooth...");
      return "bluetooth" in navigator;
    }

    try {
      await BleClient.initialize();
      console.log("[Permissions] BLE: Initialized successfully");
      this.permissionStatus.ble = true;
      return true;
    } catch (error) {
      console.error("[Permissions] BLE: Failed to initialize:", error);
      return false;
    }
  }

  /**
   * Request Location/GPS permission
   */
  async requestLocationPermission() {
    try {
      const status = await Geolocation.requestPermissions();
      const granted = status.location === "granted";
      console.log("[Permissions] Location:", status.location);
      this.permissionStatus.location = granted;
      return granted;
    } catch (error) {
      console.error("[Permissions] Location: Failed:", error);
      // Fallback for web
      if (!this.isNative && "geolocation" in navigator) {
        return true;
      }
      return false;
    }
  }

  /**
   * Request Camera permission
   */
  async requestCameraPermission() {
    try {
      const status = await Camera.requestPermissions();
      const granted = status.camera === "granted";
      console.log("[Permissions] Camera:", status.camera);
      this.permissionStatus.camera = granted;
      return granted;
    } catch (error) {
      console.error("[Permissions] Camera: Failed:", error);
      return false;
    }
  }

  /**
   * Check current permission status
   */
  async checkPermissions() {
    const status = {
      ble: false,
      location: false,
      camera: false,
    };

    try {
      // Check location
      const locStatus = await Geolocation.checkPermissions();
      status.location = locStatus.location === "granted";

      // Check camera
      const camStatus = await Camera.checkPermissions();
      status.camera = camStatus.camera === "granted";

      // BLE doesn't have a check method, assume initialized = granted
      status.ble = this.permissionStatus.ble;

      return status;
    } catch (error) {
      console.error("[Permissions] Check failed:", error);
      return status;
    }
  }

  /**
   * Get human-readable permission status for UI
   */
  getStatusSummary() {
    const { ble, location, camera } = this.permissionStatus;
    const granted = [];
    const denied = [];

    if (location) granted.push("GPS");
    else denied.push("GPS");
    if (ble) granted.push("Bluetooth");
    else denied.push("Bluetooth");
    if (camera) granted.push("Camera");
    else denied.push("Camera");

    return {
      allGranted: denied.length === 0,
      granted,
      denied,
      message:
        denied.length === 0
          ? "All permissions granted"
          : `Missing permissions: ${denied.join(", ")}`,
    };
  }
}

export const permissionsService = new PermissionsService();
export default permissionsService;
