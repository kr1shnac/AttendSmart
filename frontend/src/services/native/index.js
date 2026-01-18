/**
 * Native Services Index
 * Central export for all Capacitor-based native services
 */

export { permissionsService } from "./permissionsService";
export { bleNativeService } from "./bleNativeService";
export { gpsNativeService } from "./gpsNativeService";
export { biometricNativeService } from "./biometricNativeService";

export { qrScannerService } from "./qrScannerService";
export { iBeaconNativeService } from "./iBeaconNativeService";
export { unifiedVerificationService } from "./unifiedVerificationService";

// Default export for convenience
export { unifiedVerificationService as default } from "./unifiedVerificationService";
