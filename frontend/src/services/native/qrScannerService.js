/**
 * QR Scanner Service
 * Fallback for BLE when scanning QR codes for session verification
 */

import { Capacitor } from "@capacitor/core";

let BarcodeScanner = null;

class QRScannerService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isAvailable = false;
    this.isScanning = false;
  }

  /**
   * Initialize scanner
   */
  async initialize() {
    if (!this.isNative) {
      console.warn("[QRScanner] Not available on web platform");
      return false;
    }

    try {
      const module = await import("@capacitor-community/barcode-scanner");
      BarcodeScanner = module.BarcodeScanner;
      this.isAvailable = true;
      console.log("[QRScanner] Initialized");
      return true;
    } catch (error) {
      console.error("[QRScanner] Initialization failed:", error);
      return false;
    }
  }

  /**
   * Check camera permission
   */
  async checkPermission() {
    if (!this.isAvailable || !BarcodeScanner) {
      return false;
    }

    try {
      const status = await BarcodeScanner.checkPermission({ force: true });
      return status.granted;
    } catch (error) {
      console.error("[QRScanner] Permission check failed:", error);
      return false;
    }
  }

  /**
   * Start scanning for QR code
   */
  async scan() {
    if (!this.isAvailable || !BarcodeScanner) {
      await this.initialize();
      if (!this.isAvailable) {
        throw new Error("QR Scanner not available");
      }
    }

    try {
      // Check permission
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        throw new Error("Camera permission denied");
      }

      this.isScanning = true;

      // Hide webview background for camera visibility
      await BarcodeScanner.hideBackground();

      const result = await BarcodeScanner.startScan();

      // Show background again
      await BarcodeScanner.showBackground();
      this.isScanning = false;

      if (result.hasContent) {
        console.log("[QRScanner] Scanned:", result.content);
        return this.parseQRContent(result.content);
      }

      return { success: false, message: "No content detected" };
    } catch (error) {
      console.error("[QRScanner] Scan failed:", error);
      this.isScanning = false;
      await BarcodeScanner.showBackground();
      throw error;
    }
  }

  /**
   * Parse QR content for session data
   */
  parseQRContent(content) {
    try {
      // Try parsing as JSON first
      const data = JSON.parse(content);

      return {
        success: true,
        sessionId: data.sessionId || data.id,
        sessionName: data.name,
        timestamp: data.timestamp,
        signature: data.signature,
        raw: content,
      };
    } catch {
      // If not JSON, treat as session ID
      return {
        success: true,
        sessionId: content,
        raw: content,
      };
    }
  }

  /**
   * Stop scanning
   */
  async stopScan() {
    if (!this.isScanning || !BarcodeScanner) return;

    try {
      await BarcodeScanner.stopScan();
      await BarcodeScanner.showBackground();
      this.isScanning = false;
      console.log("[QRScanner] Scan stopped");
    } catch (error) {
      console.error("[QRScanner] Stop scan error:", error);
    }
  }

  /**
   * Verify QR code for attendance
   */
  async verifySessionQR(expectedSessionId) {
    try {
      const result = await this.scan();

      if (!result.success) {
        return {
          verified: false,
          message: "Could not read QR code",
        };
      }

      const verified = result.sessionId === expectedSessionId;

      return {
        verified,
        confidence: verified ? 100 : 0,
        sessionId: result.sessionId,
        message: verified
          ? "QR code verified"
          : "QR code does not match session",
      };
    } catch (error) {
      return {
        verified: false,
        message: error.message,
        error,
      };
    }
  }
}

export const qrScannerService = new QRScannerService();
export default qrScannerService;
