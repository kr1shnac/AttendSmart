/**
 * MediaPipe Face Detector Service
 *
 * Production-grade face detection using MediaPipe Tasks Vision API
 * Provides 98-99% accuracy for face detection with keypoints
 *
 * Uses CDN loading to avoid npm package issues
 *
 * @version 1.1.0
 */

// MediaPipe classes will be loaded from CDN
let FaceDetector = null;
let FilesetResolver = null;

class MediaPipeFaceDetector {
  constructor() {
    this.faceDetector = null;
    this.isInitialized = false;
    this.detectionHistory = [];
    this.maxHistoryLength = 30; // 1 second at 30fps
    this.initPromise = null;
  }

  /**
   * Initialize MediaPipe Face Detector
   * Call this once on app load
   */
  async initialize() {
    // Prevent multiple initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return true;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log("🔄 Initializing MediaPipe Face Detector...");

      // Load MediaPipe Tasks Vision from CDN if not already loaded
      if (!window.FilesetResolver || !window.FaceDetector) {
        console.log("📦 Loading MediaPipe from CDN...");
        await this._loadMediaPipeFromCDN();
      }

      // Get references from window
      FilesetResolver = window.FilesetResolver;
      FaceDetector = window.FaceDetector;

      if (!FilesetResolver || !FaceDetector) {
        throw new Error("MediaPipe failed to load from CDN");
      }

      // Load WASM files from CDN
      const wasmFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      // Create face detector with CDN model
      this.faceDetector = await FaceDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU", // Use GPU if available, falls back to CPU
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5, // Lower threshold for better detection
        minSuppressionThreshold: 0.3,
      });

      this.isInitialized = true;
      console.log("✅ MediaPipe Face Detector initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize MediaPipe:", error);
      this.initPromise = null;
      return false;
    }
  }

  /**
   * Load MediaPipe Tasks Vision from CDN
   */
  async _loadMediaPipeFromCDN() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.FilesetResolver && window.FaceDetector) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
      script.type = "module";

      // For module scripts, we need to use import()
      const moduleScript = document.createElement("script");
      moduleScript.type = "module";
      moduleScript.textContent = `
        import { FilesetResolver, FaceDetector } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
        window.FilesetResolver = FilesetResolver;
        window.FaceDetector = FaceDetector;
        window.dispatchEvent(new Event('mediapipe-loaded'));
      `;

      const handleLoad = () => {
        console.log("✅ MediaPipe CDN script loaded");
        resolve();
      };

      const handleError = (error) => {
        console.error("❌ MediaPipe CDN script failed to load:", error);
        reject(new Error("Failed to load MediaPipe from CDN"));
      };

      window.addEventListener("mediapipe-loaded", handleLoad, { once: true });

      // Timeout fallback
      setTimeout(() => {
        if (!window.FilesetResolver) {
          handleError(new Error("MediaPipe load timeout"));
        }
      }, 10000);

      document.head.appendChild(moduleScript);
    });
  }

  /**
   * Detect faces in video frame
   * Returns: { success, detections, faceCount, timestamp }
   */
  detectFaces(videoElement) {
    if (!this.isInitialized || !this.faceDetector) {
      console.warn("Face detector not initialized");
      return {
        success: false,
        detections: [],
        faceCount: 0,
        error: "Face detector not initialized",
      };
    }

    try {
      const startTime = performance.now();
      const results = this.faceDetector.detectForVideo(videoElement, startTime);

      // Process detections
      const detections = [];
      if (results.detections && results.detections.length > 0) {
        for (const detection of results.detections) {
          const boundingBox = detection.boundingBox;
          const keypoints = detection.keypoints;

          // Convert to video coordinates
          const videoWidth = videoElement.videoWidth;
          const videoHeight = videoElement.videoHeight;

          detections.push({
            id: Date.now() + Math.random(),
            bbox: {
              x: boundingBox.originX,
              y: boundingBox.originY,
              width: boundingBox.width,
              height: boundingBox.height,
              // Normalized coordinates (0-1)
              xNorm: boundingBox.originX / videoWidth,
              yNorm: boundingBox.originY / videoHeight,
              widthNorm: boundingBox.width / videoWidth,
              heightNorm: boundingBox.height / videoHeight,
            },
            confidence: detection.categories[0]?.score || 0,
            keypoints: this._processKeypoints(
              keypoints,
              videoWidth,
              videoHeight
            ),
            rawDetection: detection,
          });
        }
      }

      // Keep history for motion analysis
      this.detectionHistory.push({
        timestamp: Date.now(),
        detections: detections,
      });

      if (this.detectionHistory.length > this.maxHistoryLength) {
        this.detectionHistory.shift();
      }

      return {
        success: detections.length > 0,
        detections: detections,
        faceCount: detections.length,
        timestamp: Date.now(),
        latencyMs: performance.now() - startTime,
      };
    } catch (error) {
      console.error("❌ Face detection error:", error);
      return {
        success: false,
        detections: [],
        faceCount: 0,
        error: error.message,
      };
    }
  }

  /**
   * Process keypoints (6 main facial landmarks from MediaPipe)
   * Returns object with named keypoints
   */
  _processKeypoints(keypoints, videoWidth, videoHeight) {
    if (!keypoints || keypoints.length === 0) {
      return null;
    }

    // MediaPipe Face Detection returns 6 keypoints:
    // 0: left eye, 1: right eye, 2: nose tip,
    // 3: mouth center, 4: left ear tragion, 5: right ear tragion
    const processed = {
      leftEye: keypoints[0]
        ? {
            x: keypoints[0].x * videoWidth,
            y: keypoints[0].y * videoHeight,
            xNorm: keypoints[0].x,
            yNorm: keypoints[0].y,
          }
        : null,
      rightEye: keypoints[1]
        ? {
            x: keypoints[1].x * videoWidth,
            y: keypoints[1].y * videoHeight,
            xNorm: keypoints[1].x,
            yNorm: keypoints[1].y,
          }
        : null,
      noseTip: keypoints[2]
        ? {
            x: keypoints[2].x * videoWidth,
            y: keypoints[2].y * videoHeight,
            xNorm: keypoints[2].x,
            yNorm: keypoints[2].y,
          }
        : null,
      mouthCenter: keypoints[3]
        ? {
            x: keypoints[3].x * videoWidth,
            y: keypoints[3].y * videoHeight,
            xNorm: keypoints[3].x,
            yNorm: keypoints[3].y,
          }
        : null,
      leftEarTragion: keypoints[4]
        ? {
            x: keypoints[4].x * videoWidth,
            y: keypoints[4].y * videoHeight,
            xNorm: keypoints[4].x,
            yNorm: keypoints[4].y,
          }
        : null,
      rightEarTragion: keypoints[5]
        ? {
            x: keypoints[5].x * videoWidth,
            y: keypoints[5].y * videoHeight,
            xNorm: keypoints[5].x,
            yNorm: keypoints[5].y,
          }
        : null,
    };

    return processed;
  }

  /**
   * Check if face is looking at camera (frontal pose)
   */
  isFaceFrontal(detection, threshold = 0.7) {
    if (!detection.keypoints) return false;

    const { leftEye, rightEye, noseTip } = detection.keypoints;
    if (!leftEye || !rightEye || !noseTip) return false;

    // Check if eyes and nose are roughly aligned (frontal pose)
    const eyeDistance = Math.abs(leftEye.xNorm - rightEye.xNorm);
    const eyeCenterX = (leftEye.xNorm + rightEye.xNorm) / 2;
    const noseOffset = Math.abs(noseTip.xNorm - eyeCenterX);

    const frontalScore = 1 - noseOffset / (eyeDistance + 0.001);
    return frontalScore > threshold;
  }

  /**
   * Estimate head rotation (pitch, yaw, roll)
   */
  estimateHeadRotation(detection) {
    if (!detection.keypoints) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    const { leftEye, rightEye, noseTip } = detection.keypoints;

    if (!leftEye || !rightEye || !noseTip) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Eye distance for normalization
    const eyeDistance = Math.abs(rightEye.xNorm - leftEye.xNorm);
    if (eyeDistance < 0.01) return { pitch: 0, yaw: 0, roll: 0 };

    // Yaw (left-right rotation) - using nose offset from eye center
    const eyeCenterX = (leftEye.xNorm + rightEye.xNorm) / 2;
    const yaw = (noseTip.xNorm - eyeCenterX) / eyeDistance;

    // Pitch (up-down) - using nose-to-eye vertical distance
    const eyeCenterY = (leftEye.yNorm + rightEye.yNorm) / 2;
    const noseVertical = noseTip.yNorm - eyeCenterY;
    const pitch = noseVertical / eyeDistance;

    // Roll (tilt) - using eye line angle
    const eyeLineY = rightEye.yNorm - leftEye.yNorm;
    const roll = eyeLineY / eyeDistance;

    return {
      pitch: Math.min(Math.max(pitch, -1), 1),
      yaw: Math.min(Math.max(yaw, -1), 1),
      roll: Math.min(Math.max(roll, -0.5), 0.5),
    };
  }

  /**
   * Get face detection history for motion analysis
   */
  getDetectionHistory() {
    return this.detectionHistory;
  }

  /**
   * Clear history (useful between sessions)
   */
  clearHistory() {
    this.detectionHistory = [];
  }

  /**
   * Check initialization status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      historyLength: this.detectionHistory.length,
    };
  }

  /**
   * Cleanup (call on component unmount)
   */
  dispose() {
    if (this.faceDetector) {
      this.faceDetector.close();
      this.faceDetector = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
    this.clearHistory();
    console.log("🧹 MediaPipe Face Detector disposed");
  }
}

// Export singleton instance
const mediaPipeFaceDetector = new MediaPipeFaceDetector();
export default mediaPipeFaceDetector;

// Also export class for testing
export { MediaPipeFaceDetector };
