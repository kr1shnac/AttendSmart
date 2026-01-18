/**
 * Face Detection Native Service
 * Provides face detection using MediaPipe for native/web platforms
 * Loads MediaPipe from CDN dynamically to avoid webpack bundling issues
 *
 * @version 2.0.0 - MediaPipe-based implementation (CDN-loaded)
 */

// MediaPipe will be loaded from CDN via script tags
// Types are defined in src/types/mediapipe.d.ts

class FaceDetectionNativeService {
  constructor() {
    this.faceDetection = null;
    this.camera = null;
    this.isInitialized = false;
    this.currentResults = null;
    this.onResultsCallback = null;
    this.scriptsLoaded = false;
  }

  // Load MediaPipe scripts from CDN
  async loadScripts() {
    if (this.scriptsLoaded) return true;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js";
      script.crossOrigin = "anonymous";

      script.onload = () => {
        const cameraScript = document.createElement("script");
        cameraScript.src =
          "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js";
        cameraScript.crossOrigin = "anonymous";

        cameraScript.onload = () => {
          this.scriptsLoaded = true;
          resolve(true);
        };

        cameraScript.onerror = () =>
          reject(new Error("Failed to load MediaPipe Camera Utils"));
        document.head.appendChild(cameraScript);
      };

      script.onerror = () =>
        reject(new Error("Failed to load MediaPipe Face Detection"));
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize MediaPipe Face Detection
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Load MediaPipe scripts from CDN first
      await this.loadScripts();

      const { FaceDetection } = window;
      this.faceDetection = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        },
      });

      this.faceDetection.setOptions({
        model: "short",
        minDetectionConfidence: 0.5,
      });

      this.faceDetection.onResults((results) => {
        this.currentResults = results;
        if (this.onResultsCallback) {
          this.onResultsCallback(results);
        }
      });

      this.isInitialized = true;
      console.log("✅ Face detection native service initialized (MediaPipe)");
      return true;
    } catch (error) {
      console.error("❌ Face detection initialization failed:", error);
      return false;
    }
  }

  /**
   * Start camera and begin face detection
   * @param {HTMLVideoElement} videoElement
   * @param {Function} onResults - Callback for detection results
   */
  async startCamera(videoElement, onResults) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.onResultsCallback = onResults;

    const { Camera } = window;
    this.camera = new Camera(videoElement, {
      onFrame: async () => {
        if (this.faceDetection && videoElement) {
          await this.faceDetection.send({ image: videoElement });
        }
      },
      width: 640,
      height: 480,
    });

    await this.camera.start();
  }

  /**
   * Verify face - checks if a face is currently detected
   * @returns {Promise<Object>} Verification result
   */
  async verifyFace() {
    if (!this.currentResults || !this.currentResults.detections?.length) {
      return {
        success: false,
        error: "No face detected",
        confidence: 0,
      };
    }

    const detection = this.currentResults.detections[0];
    const confidence = Math.round((detection.score || 0.5) * 100);

    return {
      success: confidence > 60,
      confidence,
      faceDetected: true,
      boundingBox: detection.boundingBox,
    };
  }

  /**
   * Enroll face - capture face data for enrollment
   * @returns {Promise<Object>} Enrollment result with face image
   */
  async enrollFace() {
    const verification = await this.verifyFace();

    if (!verification.success) {
      return {
        success: false,
        error: "Could not detect face for enrollment",
      };
    }

    // Note: MediaPipe doesn't provide 128D descriptors
    // The server-side face-engine will generate the descriptor from the image
    return {
      success: true,
      confidence: verification.confidence,
      faceDetected: true,
      // Descriptor will be generated server-side from captured image
      descriptor: null,
    };
  }

  /**
   * Stop camera and cleanup
   */
  stop() {
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    this.onResultsCallback = null;
    this.currentResults = null;
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.isInitialized;
  }
}

// Export singleton instance
const faceDetectionNativeService = new FaceDetectionNativeService();

// Named export for destructuring imports
export { faceDetectionNativeService };

// Default export
export default faceDetectionNativeService;
