/**
 * Biometric Native Service
 * Handles fingerprint and Face ID authentication using capacitor-native-biometric
 */

import { Capacitor } from "@capacitor/core";
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";

class BiometricNativeService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isAvailable = false;
    this.biometryType = null;
  }

  /**
   * Check if biometric authentication is available
   */
  async checkAvailability() {
    if (!this.isNative) {
      console.log("[Biometric] Not on native platform");
      return {
        isAvailable: false,
        biometryType: "none",
        reason: "Web platform - biometrics require native app",
      };
    }

    try {
      const result = await NativeBiometric.isAvailable();

      this.isAvailable = result.isAvailable;
      this.biometryType = result.biometryType;

      console.log("[Biometric] Availability:", result);

      return {
        isAvailable: result.isAvailable,
        biometryType: this.getBiometryTypeName(result.biometryType),
        biometryTypeId: result.biometryType,
        errorCode: result.errorCode,
      };
    } catch (error) {
      console.error("[Biometric] Availability check failed:", error);
      return {
        isAvailable: false,
        biometryType: "none",
        error: error.message,
      };
    }
  }

  /**
   * Get human-readable biometry type name
   */
  getBiometryTypeName(type) {
    switch (type) {
      case BiometryType.TOUCH_ID:
        return "Touch ID";
      case BiometryType.FACE_ID:
        return "Face ID";
      case BiometryType.FINGERPRINT:
        return "Fingerprint";
      case BiometryType.FACE_AUTHENTICATION:
        return "Face Authentication";
      case BiometryType.IRIS_AUTHENTICATION:
        return "Iris Authentication";
      case BiometryType.MULTIPLE:
        return "Multiple Biometrics";
      default:
        return "Biometric";
    }
  }

  /**
   * Verify user identity with biometrics
   */
  async verifyIdentity(options = {}) {
    const {
      reason = "Verify your identity for attendance",
      title = "AttendSmart Verification",
      subtitle = "Biometric authentication required",
      description = "Place your finger on the sensor or look at the camera",
      negativeButtonText = "Cancel",
      maxAttempts = 3,
    } = options;

    // Check availability first
    const availability = await this.checkAvailability();
    if (!availability.isAvailable) {
      return {
        verified: false,
        method: "none",
        message: "Biometric authentication not available",
        error: availability.error || availability.reason,
      };
    }

    try {
      console.log("[Biometric] Starting verification...");

      await NativeBiometric.verifyIdentity({
        reason,
        title,
        subtitle,
        description,
        negativeButtonText,
        maxAttempts,
        useFallback: true,
      });

      console.log("[Biometric] Verification successful");

      return {
        verified: true,
        method: this.biometryType,
        methodName: this.getBiometryTypeName(this.biometryType),
        confidence: 99, // Native biometric is highly accurate
        message: "Biometric verification successful",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[Biometric] Verification failed:", error);

      return {
        verified: false,
        method: this.biometryType,
        message: this.getErrorMessage(error),
        error: error.message,
        errorCode: error.code,
      };
    }
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error) {
    const code = error.code || error.message;

    const errorMessages = {
      BIOMETRIC_AUTHENTICATION_FAILED: "Authentication failed - not recognized",
      BIOMETRIC_DISMISSED: "Authentication cancelled by user",
      BIOMETRIC_LOCKED_OUT: "Too many failed attempts - biometric locked",
      BIOMETRIC_NOT_ENROLLED: "No biometrics enrolled on device",
      BIOMETRIC_NOT_AVAILABLE: "Biometric hardware not available",
      BIOMETRIC_UNKNOWN_ERROR: "Unknown authentication error",
    };

    return errorMessages[code] || error.message || "Authentication failed";
  }

  /**
   * Store credentials securely (for future auto-login)
   */
  async storeCredentials(username, password) {
    if (!this.isNative) {
      console.warn("[Biometric] Cannot store credentials on web");
      return false;
    }

    try {
      await NativeBiometric.setCredentials({
        username,
        password,
        server: "com.attendsmart.app",
      });
      console.log("[Biometric] Credentials stored securely");
      return true;
    } catch (error) {
      console.error("[Biometric] Failed to store credentials:", error);
      return false;
    }
  }

  /**
   * Get stored credentials after biometric verification
   */
  async getCredentials() {
    if (!this.isNative) {
      return null;
    }

    try {
      // First verify identity
      const verified = await this.verifyIdentity({
        reason: "Access stored credentials",
        title: "Secure Login",
      });

      if (!verified.verified) {
        return null;
      }

      const credentials = await NativeBiometric.getCredentials({
        server: "com.attendsmart.app",
      });
      return credentials;
    } catch (error) {
      console.error("[Biometric] Failed to get credentials:", error);
      return null;
    }
  }

  /**
   * Delete stored credentials
   */
  async deleteCredentials() {
    if (!this.isNative) {
      return true;
    }

    try {
      await NativeBiometric.deleteCredentials({
        server: "com.attendsmart.app",
      });
      console.log("[Biometric] Credentials deleted");
      return true;
    } catch (error) {
      console.error("[Biometric] Failed to delete credentials:", error);
      return false;
    }
  }

  /**
   * Check if Face ID / Face Auth is specifically available
   */
  async isFaceIDAvailable() {
    const status = await this.checkAvailability();
    return (
      status.isAvailable &&
      (status.biometryTypeId === BiometryType.FACE_ID ||
        status.biometryTypeId === BiometryType.FACE_AUTHENTICATION)
    );
  }

  /**
   * Check if Fingerprint / Touch ID is specifically available
   */
  async isFingerprintAvailable() {
    const status = await this.checkAvailability();
    return (
      status.isAvailable &&
      (status.biometryTypeId === BiometryType.TOUCH_ID ||
        status.biometryTypeId === BiometryType.FINGERPRINT)
    );
  }

  /**
   * Quick check if device supports any biometric
   */
  async hasBiometrics() {
    const availability = await this.checkAvailability();
    return availability.isAvailable;
  }
}

export const biometricNativeService = new BiometricNativeService();
export default biometricNativeService;
