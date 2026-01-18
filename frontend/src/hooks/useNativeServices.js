/**
 * useNativeServices Hook
 * React hook for accessing Capacitor native services
 */

import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  unifiedVerificationService,
  permissionsService,
  biometricNativeService,
} from "../services/native";

/**
 * Hook for native services access and verification
 */
export function useNativeServices() {
  const [isNative, setIsNative] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [permissions, setPermissions] = useState(null);
  const [capabilities, setCapabilities] = useState({
    ble: false,
    gps: true,
    biometric: false,
    camera: false,
    faceDetection: false,
  });
  const [error, setError] = useState(null);

  // Check platform on mount
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Initialize all services
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      const initResult = await unifiedVerificationService.initializeAll();

      setPermissions(initResult.permissions);
      setCapabilities({
        ble: initResult.ble,
        gps: true,
        biometric: initResult.biometric,
        camera: initResult.permissions?.camera || false,
        faceDetection: initResult.faceDetection,
      });
      setIsInitialized(true);

      console.log("[useNativeServices] Initialized:", initResult);
    } catch (err) {
      console.error("[useNativeServices] Initialization error:", err);
      setError(err.message);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitialized, isInitializing]);

  // Auto-initialize on native platforms
  useEffect(() => {
    if (isNative && !isInitialized && !isInitializing) {
      initialize();
    }
  }, [isNative, isInitialized, isInitializing, initialize]);

  // Perform full verification
  const performVerification = useCallback(
    async (sessionData = {}) => {
      if (!isNative) {
        console.log(
          "[useNativeServices] Not on native platform, using web verification"
        );
        return {
          success: false,
          message: "Native verification not available on web",
          isNative: false,
        };
      }

      if (!isInitialized) {
        await initialize();
      }

      return unifiedVerificationService.performFullVerification(sessionData);
    },
    [isNative, isInitialized, initialize]
  );

  // Perform quick verification
  const performQuickVerification = useCallback(
    async (sessionData = {}) => {
      if (!isNative) {
        return { success: false, isNative: false };
      }

      if (!isInitialized) {
        await initialize();
      }

      return unifiedVerificationService.performQuickVerification(sessionData);
    },
    [isNative, isInitialized, initialize]
  );

  // Check if biometric is available
  const checkBiometric = useCallback(async () => {
    return biometricNativeService.checkAvailability();
  }, []);

  // Get platform info
  const getPlatformInfo = useCallback(() => {
    return {
      isNative,
      platform: Capacitor.getPlatform(),
      isAndroid: Capacitor.getPlatform() === "android",
      isIOS: Capacitor.getPlatform() === "ios",
      isWeb: !Capacitor.isNativePlatform(),
    };
  }, [isNative]);

  return {
    // State
    isNative,
    isInitialized,
    isInitializing,
    permissions,
    capabilities,
    error,

    // Methods
    initialize,
    performVerification,
    performQuickVerification,
    checkBiometric,
    getPlatformInfo,

    // Services (for direct access if needed)
    verificationService: unifiedVerificationService,
    permissionsService,
  };
}

export default useNativeServices;
