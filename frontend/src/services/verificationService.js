import gpsService from "./gpsService";
import bleService from "./bleService";
import { API_BASE_URL } from "../config/api";

class VerificationService {
  constructor() {
    this.verificationResults = {
      gps: null,
      face: null,
      ble: null,
      liveness: null,
    };
  }

  // Main verification function - runs all checks
  async verifyAttendance(sessionId) {
    console.log("🔍 Starting multi-modal verification...");

    try {
      // Run verifications in parallel for speed
      const [gpsResult, bleResult] = await Promise.all([
        this.verifyGPS(),
        this.verifyBLE(sessionId),
      ]);

      // Face verification (requires camera)
      const faceResult = await this.verifyFace();

      // Calculate overall confidence score
      const confidence = this.calculateConfidence({
        gps: gpsResult,
        face: faceResult,
        ble: bleResult,
      });

      const verificationData = {
        success: confidence >= 70, // Minimum 70% confidence required
        confidence: confidence,
        timestamp: new Date(),
        verifications: {
          gps: gpsResult,
          face: faceResult,
          ble: bleResult,
        },
        message: this.getVerificationMessage(confidence, {
          gps: gpsResult,
          face: faceResult,
          ble: bleResult,
        }),
      };

      console.log("✅ Verification complete:", verificationData);
      return verificationData;
    } catch (error) {
      console.error("❌ Verification failed:", error);
      return {
        success: false,
        confidence: 0,
        error: error.message,
        message: "Verification failed. Please try again.",
      };
    }
  }

  // GPS Verification
  async verifyGPS() {
    try {
      const result = await gpsService.verifyLocation();

      return {
        success: result.success && result.isWithinCampus,
        confidence: result.success && result.isWithinCampus ? 100 : 0,
        distance: result.distance,
        accuracy: result.accuracy,
        withinCampus: result.isWithinCampus,
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        confidence: 0,
        error: error.message,
      };
    }
  }

  // Face Recognition + Liveness Detection
  async verifyFace() {
    return new Promise((resolve) => {
      // Request camera access
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .then(async (stream) => {
          console.log("📸 Camera access granted");

          // Stop camera after verification
          stream.getTracks().forEach((track) => track.stop());

          // Call face recognition API for actual verification
          try {
            const token = localStorage.getItem("token");
            const response = await fetch(
              `${API_BASE_URL}/api/biometric/verify-face`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ streamActive: true }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              resolve({
                success: data.success,
                confidence: data.confidence || 0,
                faceDetected: data.faceDetected,
                livenessCheck: data.livenessCheck,
                message: data.message || "Face verification complete",
              });
            } else {
              resolve({
                success: false,
                confidence: 0,
                error: "Face verification failed",
                message: "Could not verify face",
              });
            }
          } catch (error) {
            console.error("Face verification error:", error);
            resolve({
              success: false,
              confidence: 0,
              error: error.message,
              message: "Face verification service unavailable",
            });
          }
        })
        .catch((error) => {
          console.error("Camera error:", error);
          resolve({
            success: false,
            confidence: 0,
            error: "Camera access denied or unavailable",
            message: "Could not access camera for face verification",
          });
        });
    });
  }

  // BLE Proximity Verification
  async verifyBLE(sessionId) {
    try {
      if (!sessionId) {
        return {
          success: false,
          confidence: 0,
          error: "No session ID provided",
        };
      }

      // Call backend API to verify BLE beacon proximity
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/api/ble/verify?sessionId=${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: data.success,
          confidence: data.confidence || 0,
          distance: data.distance,
          rssi: data.rssi,
          signalStrength: this.getSignalStrength(data.rssi || -100),
          message: data.message,
        };
      } else {
        return {
          success: false,
          confidence: 0,
          error: "BLE verification failed",
        };
      }
    } catch (error) {
      console.error("BLE verification error:", error);
      return {
        success: false,
        confidence: 0,
        error: error.message,
      };
    }
  }

  // Calculate overall confidence score
  calculateConfidence(results) {
    let totalScore = 0;
    let weights = {
      gps: 30, // 30% weight
      face: 50, // 50% weight (most important)
      ble: 20, // 20% weight
    };

    // GPS score
    if (results.gps.success) {
      totalScore += weights.gps;
    }

    // Face score
    if (results.face.success) {
      totalScore += (results.face.confidence / 100) * weights.face;
    }

    // BLE score
    if (results.ble.success) {
      totalScore += (results.ble.confidence / 100) * weights.ble;
    }

    return Math.round(totalScore);
  }

  // Get verification message
  getVerificationMessage(confidence, results) {
    if (confidence >= 90) {
      return "✅ Excellent - All verifications passed!";
    } else if (confidence >= 70) {
      return "✅ Verified - Attendance recorded";
    } else if (confidence >= 50) {
      return "⚠️ Weak verification - Please move closer to classroom";
    } else {
      const failed = [];
      if (!results.gps.success) failed.push("GPS");
      if (!results.face.success) failed.push("Face");
      if (!results.ble.success) failed.push("Proximity");

      return `❌ Verification failed: ${failed.join(", ")} check(s) failed`;
    }
  }

  // Get signal strength description
  getSignalStrength(rssi) {
    if (rssi >= -50) return "Excellent";
    if (rssi >= -60) return "Good";
    if (rssi >= -70) return "Fair";
    return "Weak";
  }

  // Reset verification results
  reset() {
    this.verificationResults = {
      gps: null,
      face: null,
      ble: null,
      liveness: null,
    };
  }
}

export default new VerificationService();
