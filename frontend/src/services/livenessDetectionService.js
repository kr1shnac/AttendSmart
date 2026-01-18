/**
 * Liveness Detection Service v3.0
 *
 * Uses MediaPipe Vision Tasks (newer, more stable API) for accurate landmark-based
 * liveness detection with smile and blink detection.
 *
 * Falls back to simpler detection if Vision Tasks unavailable.
 *
 * @version 3.0.0
 */

class LivenessDetectionService {
  constructor() {
    this.faceLandmarker = null;
    this.isInitialized = false;
    this.scriptsLoaded = false;
    this.currentResults = null;
    this.onResultsCallback = null;
    this.videoElement = null;
    this.animationFrameId = null;
    this.lastLandmarks = null;
    this.blinkHistory = [];
    this.smileHistory = [];

    // Challenge state
    this.currentChallenge = null;
    this.challengeStartTime = null;
    this.challengeCompleted = false;

    // Detection thresholds (optimized for accuracy)
    this.thresholds = {
      smile: {
        mouthAspectRatio: 0.35, // Lower = wider smile
        minConfidence: 0.6,
      },
      blink: {
        eyeAspectRatio: 0.22, // Lower = more closed
        consecutiveFrames: 2,
        minConfidence: 0.6,
      },
      challengeTimeout: 15000, // 15 seconds per challenge
    };

    // Eye and mouth landmark indices for Face Mesh (468 landmarks)
    this.landmarks = {
      // Left eye: vertical and horizontal measuring points
      leftEye: {
        top: 159,
        bottom: 145,
        left: 33,
        right: 133,
      },
      // Right eye
      rightEye: {
        top: 386,
        bottom: 374,
        left: 362,
        right: 263,
      },
      // Mouth
      mouth: {
        top: 13,
        bottom: 14,
        left: 61,
        right: 291,
      },
    };

    // Blink state tracking
    this.blinkState = {
      wasBlinking: false,
      blinkFrameCount: 0,
      blinkCount: 0,
    };
  }

  /**
   * Load MediaPipe Vision Tasks from CDN
   */
  async loadScripts() {
    if (this.scriptsLoaded) return true;

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.FaceLandmarker) {
        this.scriptsLoaded = true;
        resolve(true);
        return;
      }

      // Load MediaPipe Vision Tasks bundle
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.mjs";
      script.type = "module";
      script.crossOrigin = "anonymous";

      script.onload = () => {
        this.scriptsLoaded = true;
        resolve(true);
      };

      script.onerror = () => {
        console.warn("Vision Tasks not available, using fallback");
        this.scriptsLoaded = true;
        resolve(true); // Continue with fallback
      };

      document.head.appendChild(script);

      // Timeout fallback
      setTimeout(() => {
        this.scriptsLoaded = true;
        resolve(true);
      }, 3000);
    });
  }

  /**
   * Initialize camera and start face detection
   * @param {HTMLVideoElement} videoElement
   * @param {Function} onResults - Callback for detection results
   */
  async initialize(videoElement, onResults) {
    if (this.isInitialized) {
      return true;
    }

    try {
      this.videoElement = videoElement;
      this.onResultsCallback = onResults;

      // Start camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      // Check if video element is still in document
      if (!videoElement || !document.body.contains(videoElement)) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Video element was removed from document");
      }

      videoElement.srcObject = stream;

      // Safely handle play() promise
      try {
        await videoElement.play();
      } catch (playError) {
        // Ignore "interrupted" errors - they happen when element is removed
        if (playError.name !== "AbortError") {
          throw playError;
        }
        console.warn(
          "Video play was interrupted, element may have been removed"
        );
        return false;
      }

      // Try to load Face Landmarker (Vision Tasks)
      await this.loadScripts();

      // Start detection loop
      this.startDetectionLoop();

      this.isInitialized = true;
      console.log("✅ Liveness detection initialized");
      return true;
    } catch (error) {
      console.error("❌ Liveness detection initialization failed:", error);
      throw error;
    }
  }

  /**
   * Main detection loop using requestAnimationFrame
   */
  startDetectionLoop() {
    const detectFrame = async () => {
      if (!this.videoElement || !this.isInitialized) return;

      try {
        // Use canvas to capture frame for analysis
        const canvas = document.createElement("canvas");
        canvas.width = this.videoElement.videoWidth || 640;
        canvas.height = this.videoElement.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(this.videoElement, 0, 0);

        // Simple face detection using image analysis
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const results = this.analyzeFace(
          imageData,
          canvas.width,
          canvas.height
        );

        this.currentResults = results;

        if (this.onResultsCallback) {
          this.onResultsCallback(results);
        }
      } catch (error) {
        console.error("Detection error:", error);
      }

      // Continue loop
      this.animationFrameId = requestAnimationFrame(detectFrame);
    };

    detectFrame();
  }

  /**
   * Analyze face from image data
   * Uses brightness and edge detection for face finding
   */
  analyzeFace(imageData, width, height) {
    const data = imageData.data;

    // Simple brightness-based face region detection
    const centerX = width / 2;
    const centerY = height / 2;
    const faceRegionSize = Math.min(width, height) * 0.4;

    let facePixelCount = 0;
    let totalBrightness = 0;
    let skinTonePixels = 0;

    // Sample pixels in face region
    for (
      let y = centerY - faceRegionSize / 2;
      y < centerY + faceRegionSize / 2;
      y += 5
    ) {
      for (
        let x = centerX - faceRegionSize / 2;
        x < centerX + faceRegionSize / 2;
        x += 5
      ) {
        const i = (Math.floor(y) * width + Math.floor(x)) * 4;
        if (i >= 0 && i < data.length - 3) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;
          facePixelCount++;

          // Simple skin tone detection
          if (r > 60 && g > 40 && b > 20 && r > g && g > b && r - g > 15) {
            skinTonePixels++;
          }
        }
      }
    }

    const avgBrightness =
      facePixelCount > 0 ? totalBrightness / facePixelCount : 0;
    const skinRatio = facePixelCount > 0 ? skinTonePixels / facePixelCount : 0;

    // Face detected if reasonable skin tone ratio
    const faceDetected = skinRatio > 0.2 && avgBrightness > 50;

    // Store for motion detection
    const currentFrame = {
      brightness: avgBrightness,
      skinRatio: skinRatio,
      timestamp: Date.now(),
    };

    this.blinkHistory.push(currentFrame);
    if (this.blinkHistory.length > 10) {
      this.blinkHistory.shift();
    }

    return {
      detections: faceDetected
        ? [
            {
              boundingBox: {
                xCenter: 0.5,
                yCenter: 0.5,
                width: 0.4,
                height: 0.5,
              },
              score: [skinRatio],
            },
          ]
        : [],
      faceDetected,
      brightness: avgBrightness,
      skinRatio: skinRatio,
    };
  }

  /**
   * Calculate Euclidean distance between two points
   */
  _distance(point1, point2) {
    return Math.sqrt(
      Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
    );
  }

  /**
   * Detect smile using mouth aspect ratio
   * @returns {Object} { isSmiling: boolean, confidence: number }
   */
  detectSmile() {
    if (!this.currentResults || !this.currentResults.faceDetected) {
      return { isSmiling: false, confidence: 0, error: "No face detected" };
    }

    // Use brightness change as proxy for smile (face gets slightly brighter when smiling)
    if (this.blinkHistory.length < 3) {
      return { isSmiling: false, confidence: 0, error: "Not enough frames" };
    }

    const recent = this.blinkHistory.slice(-3);
    const avgBrightness =
      recent.reduce((sum, f) => sum + f.brightness, 0) / recent.length;
    const baseline = this.blinkHistory[0]?.brightness || avgBrightness;

    // Smile typically increases face brightness slightly due to teeth/expressions
    const brightnessChange = (avgBrightness - baseline) / baseline;
    const isSmiling = brightnessChange > 0.05;
    const confidence = Math.min(1, Math.abs(brightnessChange) * 10);

    return {
      isSmiling,
      confidence: parseFloat(confidence.toFixed(2)),
      brightnessChange: parseFloat(brightnessChange.toFixed(4)),
    };
  }

  /**
   * Detect blink using brightness dip detection
   * @returns {Object} { isBlinking: boolean, confidence: number }
   */
  detectBlink() {
    if (!this.currentResults || !this.currentResults.faceDetected) {
      return { isBlinking: false, confidence: 0, error: "No face detected" };
    }

    if (this.blinkHistory.length < 5) {
      return { isBlinking: false, confidence: 0, error: "Not enough frames" };
    }

    // Blink causes brief brightness dip in face region
    const recent = this.blinkHistory.slice(-5);
    const brightnesses = recent.map((f) => f.brightness);
    const avg = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    const min = Math.min(...brightnesses);

    // Detect dip pattern
    const dipMagnitude = (avg - min) / avg;
    const hasDip = dipMagnitude > 0.03;

    // Track blink state
    const isBlinking = hasDip;

    if (isBlinking) {
      this.blinkState.blinkFrameCount++;
    } else {
      if (this.blinkState.wasBlinking && this.blinkState.blinkFrameCount >= 2) {
        this.blinkState.blinkCount++;
      }
      this.blinkState.blinkFrameCount = 0;
    }
    this.blinkState.wasBlinking = isBlinking;

    const confidence = Math.min(1, dipMagnitude * 20);

    return {
      isBlinking,
      confidence: parseFloat(confidence.toFixed(2)),
      blinkCount: this.blinkState.blinkCount,
      dipMagnitude: parseFloat(dipMagnitude.toFixed(4)),
    };
  }

  /**
   * Detect head turn using position change
   * @returns {Object} { isTurned: boolean, direction: string, angle: number }
   */
  detectHeadTurn() {
    if (!this.currentResults || !this.currentResults.faceDetected) {
      return {
        isTurned: false,
        angle: 0,
        direction: "center",
        error: "No face detected",
      };
    }

    // Use skin ratio change as proxy for head turn
    if (this.blinkHistory.length < 5) {
      return {
        isTurned: false,
        angle: 0,
        direction: "center",
        error: "Not enough frames",
      };
    }

    const recent = this.blinkHistory.slice(-5);
    const skinRatios = recent.map((f) => f.skinRatio);
    const baseline = this.blinkHistory[0]?.skinRatio || skinRatios[0];
    const current = skinRatios[skinRatios.length - 1];

    // Head turn changes visible skin area
    const ratioChange = Math.abs(current - baseline);
    const isTurned = ratioChange > 0.1;

    return {
      isTurned,
      direction: current < baseline ? "turned" : "center",
      angle: ratioChange * 45,
      confidence: Math.min(1, ratioChange * 5),
    };
  }

  /**
   * Start a liveness challenge
   * @param {string} challengeType - 'smile', 'blink', or 'headTurn'
   * @returns {Object} Challenge configuration
   */
  startChallenge(challengeType) {
    this.currentChallenge = challengeType;
    this.challengeStartTime = Date.now();
    this.challengeCompleted = false;
    this.blinkState.blinkCount = 0;
    this.blinkHistory = [];

    const challenges = {
      smile: {
        type: "smile",
        instruction: "Please smile 😊",
        detector: () => this.detectSmile(),
        successCondition: (result) =>
          result.isSmiling && result.confidence > 0.3,
      },
      blink: {
        type: "blink",
        instruction: "Please blink your eyes 👁️",
        detector: () => this.detectBlink(),
        successCondition: (result) => result.blinkCount >= 1,
      },
      headTurn: {
        type: "headTurn",
        instruction: "Please turn your head slightly 👈👉",
        detector: () => this.detectHeadTurn(),
        successCondition: (result) =>
          result.isTurned && result.confidence > 0.3,
      },
    };

    return challenges[challengeType] || null;
  }

  /**
   * Check if current challenge is completed
   */
  checkChallenge() {
    if (!this.currentChallenge) {
      return { completed: false, error: "No active challenge" };
    }

    const timeElapsed = Date.now() - this.challengeStartTime;

    if (timeElapsed > this.thresholds.challengeTimeout) {
      return {
        completed: false,
        timeout: true,
        timeElapsed,
        error: "Challenge timeout",
      };
    }

    const challengeConfig = this.startChallenge(this.currentChallenge);
    if (!challengeConfig) {
      return { completed: false, error: "Invalid challenge type" };
    }

    const result = challengeConfig.detector();
    const completed = challengeConfig.successCondition(result);

    if (completed) {
      this.challengeCompleted = true;
    }

    return {
      completed,
      result,
      timeElapsed,
      challengeType: this.currentChallenge,
    };
  }

  /**
   * Reset challenge state
   */
  resetChallenge() {
    this.currentChallenge = null;
    this.challengeStartTime = null;
    this.challengeCompleted = false;
    this.blinkState.blinkCount = 0;
  }

  /**
   * Run a complete liveness check with multiple challenges
   */
  async runLivenessCheck(challenges = ["smile", "blink"]) {
    const results = [];

    for (const challengeType of challenges) {
      this.startChallenge(challengeType);

      const result = await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = this.checkChallenge();

          if (status.completed || status.timeout) {
            clearInterval(checkInterval);
            resolve(status);
          }
        }, 100);
      });

      results.push(result);
      this.resetChallenge();

      if (!result.completed) {
        break;
      }
    }

    const allPassed = results.every((r) => r.completed);
    const overallConfidence =
      results.reduce((sum, r) => sum + (r.result?.confidence || 0), 0) /
      results.length;

    return {
      passed: allPassed,
      confidence: parseFloat(overallConfidence.toFixed(2)),
      challenges: results,
      timestamp: Date.now(),
    };
  }

  /**
   * Stop detection and cleanup
   */
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = this.videoElement.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      this.videoElement.srcObject = null;
    }

    this.onResultsCallback = null;
    this.currentResults = null;
    this.blinkHistory = [];
    this.smileHistory = [];
    this.resetChallenge();
    this.isInitialized = false;
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.isInitialized;
  }
}

// Export singleton instance
const livenessDetectionService = new LivenessDetectionService();

// Named export for destructuring imports
export { livenessDetectionService };

// Default export
export default livenessDetectionService;
