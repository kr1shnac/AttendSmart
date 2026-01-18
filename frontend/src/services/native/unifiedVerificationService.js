/**
 * Unified Verification Service
 * Combines all verification methods for multi-modal attendance
 *
 * Verification Methods:
 * - Face Detection (50%) - Primary biometric via MediaPipe
 * - GPS Geofencing (30%) - Location verification
 * - BLE Proximity (20%) - Optional classroom beacon detection
 */

import { Capacitor } from "@capacitor/core";
import { bleNativeService } from "./bleNativeService";
import { iBeaconNativeService } from "./iBeaconNativeService";
import { gpsNativeService } from "./gpsNativeService";
import { faceDetectionNativeService } from "./faceDetectionNativeService";
import { permissionsService } from "./permissionsService";

class UnifiedVerificationService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();

    // Verification weights (total = 100%)
    this.baseWeights = {
      face: 0.5, // Primary biometric
      gps: 0.3, // Location verification
      ble: 0.2, // Proximity detection (optional)
    };

    // Active weights for the current session
    this.activeWeights = { ...this.baseWeights };

    this.minimumConfidence = 70; // Minimum combined confidence to pass
    this.initStatus = null;
    this.deviceCapabilities = {
      hasFace: true, // Always assume face is possible (camera)
      hasBle: false,
      hasIBeacon: false, // iBeacon support for proximity detection
    };
  }

  /**
   * Initialize all services & Determine Device Capabilities
   */
  async initializeAll() {
    console.log("[Verification] Initializing all services...");

    const results = {
      permissions: null,
      ble: false,
      gps: true,
      faceDetection: false,
    };

    try {
      // 1. Request Permissions
      results.permissions = await permissionsService.requestAllPermissions();

      // 2. Initialize Sensors
      results.ble = await bleNativeService.initialize();
      results.faceDetection = await faceDetectionNativeService.initialize();

      // 3. Try to initialize iBeacon service (preferred for BLE proximity)
      let iBeaconAvailable = false;
      try {
        iBeaconAvailable = await iBeaconNativeService.initialize();
        console.log("[Verification] iBeacon available:", iBeaconAvailable);
      } catch (e) {
        console.log("[Verification] iBeacon not available:", e.message);
      }

      // 4. Set Capabilities State
      this.deviceCapabilities = {
        hasBle: results.ble || iBeaconAvailable,
        hasIBeacon: iBeaconAvailable,
        hasFace: results.faceDetection,
      };

      // 4. Recalculate Weights based on capabilities
      this.recalculateWeights();

      this.initStatus = results;
      console.log(
        "[Verification] Init complete. Capabilities:",
        this.deviceCapabilities
      );
      console.log("[Verification] Active Weights:", this.activeWeights);

      return results;
    } catch (error) {
      console.error("[Verification] Initialization error:", error);
      return results;
    }
  }

  /**
   * Recalculate weights based on what is available.
   * Prevents penalizing users for missing hardware.
   */
  recalculateWeights() {
    let active = { ...this.baseWeights };
    let unavailableSum = 0;

    // If BLE is not available, redistribute its weight
    if (!this.deviceCapabilities.hasBle) {
      unavailableSum += active.ble;
      active.ble = 0;
    }

    // Redistribute the unavailable weight proportionally to the others
    const availableSum = 1 - unavailableSum;
    if (availableSum > 0 && unavailableSum > 0) {
      const multiplier = 1 / availableSum;
      for (let key in active) {
        if (active[key] > 0) {
          active[key] *= multiplier;
        }
      }
    }

    this.activeWeights = active;
  }

  getInitStatus() {
    return this.initStatus;
  }

  /**
   * Perform full multi-modal verification
   * @param {Object} sessionData - Session context
   * @param {Function} onProgress - Callback (step, status, data) => void
   */
  async performFullVerification(sessionData = {}, onProgress = () => {}) {
    console.log("[Verification] Starting multi-modal verification...");

    const startTime = Date.now();
    const results = {
      success: false,
      combinedConfidence: 0,
      verifications: {},
      timestamp: new Date().toISOString(),
      duration: 0,
    };

    try {
      // 1. GPS Verification
      if (onProgress) onProgress("gps", "loading");
      try {
        if (sessionData?.location) {
          results.verifications.gps = await gpsNativeService.verifyRoomLocation(
            sessionData.location,
            sessionData.roomRadius || 30
          );
        } else {
          results.verifications.gps =
            await gpsNativeService.verifyCampusLocation();
        }
        if (onProgress)
          onProgress(
            "gps",
            results.verifications.gps.verified ? "success" : "error"
          );
      } catch (e) {
        results.verifications.gps = { verified: false, error: e.message };
        if (onProgress) onProgress("gps", "error");
      }

      // 2. BLE/iBeacon Proximity Verification
      if (
        this.deviceCapabilities.hasBle ||
        this.deviceCapabilities.hasIBeacon
      ) {
        if (onProgress) onProgress("ble", "loading");
        try {
          // Prefer iBeacon if available (more accurate for beacon detection)
          if (this.deviceCapabilities.hasIBeacon && sessionData?.beaconConfig) {
            console.log("[Verification] Using iBeacon for proximity check");
            results.verifications.ble =
              await iBeaconNativeService.verifyProximity(
                sessionData.beaconConfig,
                sessionData.maxDistance || 15
              );
          } else if (this.deviceCapabilities.hasBle) {
            // Fallback to generic BLE scanning
            console.log("[Verification] Using BLE for proximity check");
            const beaconId = sessionData?.beaconId || "classroom";
            results.verifications.ble = await bleNativeService.verifyProximity(
              beaconId,
              sessionData?.maxDistance || 15
            );
          } else {
            // iBeacon available but no beacon config provided
            results.verifications.ble = {
              verified: true,
              skipped: true,
              confidence: 100,
              message: "No beacon config provided",
            };
          }

          if (onProgress)
            onProgress(
              "ble",
              results.verifications.ble.verified ? "success" : "error"
            );
        } catch (e) {
          console.error("[Verification] BLE verification error:", e);
          results.verifications.ble = { verified: false, error: e.message };
          if (onProgress) onProgress("ble", "error");
        }
      } else {
        // BLE not available - skip with no penalty
        results.verifications.ble = {
          verified: true,
          skipped: true,
          confidence: 100,
          message: "BLE not available on this device",
        };
      }

      // 3. Face Recognition (Camera) - Primary Biometric
      if (onProgress) onProgress("biometric", "loading");
      try {
        results.verifications.face =
          await faceDetectionNativeService.verifyFace();
        if (onProgress)
          onProgress(
            "biometric",
            results.verifications.face.verified ? "success" : "error"
          );
      } catch (e) {
        results.verifications.face = { verified: false, error: e.message };
        if (onProgress) onProgress("biometric", "error");
      }

      // Calculate confidence using DYNAMIC weights
      results.combinedConfidence = this.calculateCombinedConfidence(
        results.verifications
      );
      results.success = results.combinedConfidence >= this.minimumConfidence;
      results.duration = Date.now() - startTime;

      return results;
    } catch (error) {
      console.error("[Verification] Error:", error);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Perform Quick Verification (GPS + Face only)
   */
  async performQuickVerification() {
    const results = {
      success: false,
      combinedConfidence: 0,
      verifications: {},
      timestamp: new Date().toISOString(),
      mode: "quick",
    };

    try {
      // GPS Verification
      results.verifications.gps = await gpsNativeService.verifyCampusLocation();

      // Face Recognition (always use camera-based face detection)
      results.verifications.face =
        await faceDetectionNativeService.verifyFace();

      results.combinedConfidence = this.calculateCombinedConfidence(
        results.verifications
      );
      results.success = results.combinedConfidence >= this.minimumConfidence;

      return results;
    } catch (error) {
      return { ...results, success: false, error: error.message };
    }
  }

  /**
   * Calculate score using ACTIVE (Normalized) weights
   */
  calculateCombinedConfidence(verifications) {
    let totalScore = 0;

    // Face (Primary - 50%)
    if (verifications.face?.verified && !verifications.face.skipped) {
      totalScore +=
        (verifications.face.confidence || 95) * this.activeWeights.face;
    }

    // GPS (30%)
    if (verifications.gps?.verified && !verifications.gps.skipped) {
      totalScore +=
        (verifications.gps.confidence || 100) * this.activeWeights.gps;
    }

    // BLE (Optional - 20%)
    if (verifications.ble?.verified && !verifications.ble.skipped) {
      totalScore +=
        (verifications.ble.confidence || 90) * this.activeWeights.ble;
    }

    return Math.min(Math.round(totalScore), 100);
  }

  // Helper for API formatting
  getVerificationDataForAPI(results) {
    return {
      verified: results.success,
      confidence: results.combinedConfidence,
      timestamp: results.timestamp,
      duration: results.duration,
      platform: this.isNative ? Capacitor.getPlatform() : "web",
      verifications: {
        gps: results.verifications.gps
          ? {
              verified: results.verifications.gps.verified,
              confidence: results.verifications.gps.confidence,
              distance: results.verifications.gps.distance,
              latitude: results.verifications.gps.position?.latitude,
              longitude: results.verifications.gps.position?.longitude,
            }
          : null,
        ble: results.verifications.ble
          ? {
              verified: results.verifications.ble.verified,
              confidence: results.verifications.ble.confidence,
              distance: results.verifications.ble.distance,
              beaconName: results.verifications.ble.beacon?.name,
              skipped: results.verifications.ble.skipped || false,
            }
          : null,
        face: results.verifications.face
          ? {
              verified: results.verifications.face.verified,
              confidence: results.verifications.face.confidence,
              method: "mediapipe",
            }
          : null,
      },
    };
  }
}

export const unifiedVerificationService = new UnifiedVerificationService();
export default unifiedVerificationService;
