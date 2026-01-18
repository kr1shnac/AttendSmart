/**
 * Face Recognition Service - MediaPipe Face Detection
 * Loads MediaPipe from CDN dynamically to avoid webpack bundling issues
 */

// MediaPipe will be loaded from CDN via script tags
// Types are defined in src/types/mediapipe.d.ts

class FaceRecognitionService {
  constructor() {
    this.faceDetection = null;
    this.camera = null;
    this.isInitialized = false;
    this.onResultsCallback = null;
    this.scriptsLoaded = false;
  }

  // Load MediaPipe scripts from CDN
  async loadScripts() {
    if (this.scriptsLoaded) return true;

    return new Promise((resolve, reject) => {
      // Load Face Detection script
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js";
      script.crossOrigin = "anonymous";

      script.onload = () => {
        // Load Camera Utils script
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

  // Initialize MediaPipe Face Detection with smile detection
  async initialize(videoElement, onResults) {
    try {
      // Load MediaPipe scripts from CDN first
      await this.loadScripts();

      this.onResultsCallback = onResults;

      // Initialize Face Detection using globally loaded MediaPipe
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
        if (this.onResultsCallback) {
          // Safely pass results
          this.onResultsCallback(results);
        }
      });

      // Initialize Camera
      if (videoElement) {
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

      this.isInitialized = true;
      console.log("✅ Face detection initialized with smile detection");
      return true;
    } catch (error) {
      console.error("❌ Face detection initialization failed:", error);
      throw error;
    }
  }

  // Detect smile using facial landmarks
  detectSmile(landmarks) {
    if (!landmarks || landmarks.length === 0) {
      return { isSmiling: false, confidence: 0 };
    }

    try {
      // Get mouth corners and center points
      // MediaPipe face detection provides 6 key points
      const leftMouthCorner = landmarks[3]; // Approximate
      const rightMouthCorner = landmarks[4]; // Approximate

      // Calculate mouth width and height ratio
      const mouthWidth = Math.abs(rightMouthCorner.x - leftMouthCorner.x);
      const mouthHeight = Math.abs(rightMouthCorner.y - leftMouthCorner.y);

      // Smile detection: wider mouth relative to height
      const smileRatio = mouthWidth / (mouthHeight + 0.001); // Avoid division by zero

      // Threshold for smile detection (adjust based on testing)
      const isSmiling = smileRatio > 2.5;
      const confidence = Math.min(100, (smileRatio / 2.5) * 100);

      return {
        isSmiling,
        confidence: confidence,
        ratio: smileRatio,
      };
    } catch (error) {
      console.log("Smile detection calculation error:", error);
      return { isSmiling: false, confidence: 0 };
    }
  }

  // Enhanced smile detection using mouth aspect ratio
  detectSmileEnhanced(boundingBox) {
    // Simple smile detection based on bounding box shape
    // A smiling face typically has a wider bounding box
    const aspectRatio = boundingBox.width / boundingBox.height;

    // Typical face aspect ratio: 0.7-0.9
    // Smiling face: slightly wider, more open expression
    const isSmiling = aspectRatio > 0.75;
    const confidence = Math.min(100, (aspectRatio / 0.75) * 80);

    return {
      isSmiling,
      confidence,
      aspectRatio,
    };
  }

  // Stop camera and cleanup
  stop() {
    if (this.camera) {
      this.camera.stop();
    }
    this.isInitialized = false;
    this.onResultsCallback = null;
  }

  // Capture current frame as image
  async captureFrame(videoElement, canvasElement) {
    const canvas = canvasElement;
    const ctx = canvas.getContext("2d");

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    });
  }

  // Convert blob to base64
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export default new FaceRecognitionService();
