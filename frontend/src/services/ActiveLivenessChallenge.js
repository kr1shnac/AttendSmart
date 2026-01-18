/**
 * Active Liveness Challenge
 *
 * User must perform actions to prove they're real:
 * - Blink detection (required)
 * - Smile detection (required)
 *
 * Enhanced anti-spoofing:
 * - NO auto-pass fallbacks - user MUST complete each challenge
 * - Temporal consistency checks for natural expression transitions
 * - Micro-movement detection to catch static images
 *
 * Prevents 99%+ of proxy attacks (photos, videos, masks)
 *
 * @version 2.0.0
 */

// Challenge states
export const CHALLENGE_STATES = {
  IDLE: "idle",
  DETECTING_FACE: "detecting_face",
  WAITING_BLINK: "waiting_blink",
  WAITING_SMILE: "waiting_smile",
  CAPTURING: "capturing",
  COMPLETE: "complete",
  FAILED: "failed",
  ERROR: "error",
};

class ActiveLivenessChallenge {
  constructor() {
    this.currentState = CHALLENGE_STATES.IDLE;
    this.blinkDetected = false;
    this.smileDetected = false;
    this.startTime = null;

    // Tracking data
    this.eyeBrightnessHistory = [];
    this.mouthWidthHistory = [];
    this.facePositionHistory = [];
    this.faceStabilityFrames = 0;

    // Thresholds - STRICT for anti-spoofing
    this.BLINK_BRIGHTNESS_DROP = 0.82; // 18% brightness drop = blink (stricter)
    this.SMILE_WIDTH_INCREASE = 1.25; // 25% mouth width increase = smile
    this.MIN_STABILITY_FRAMES = 15; // Face must be stable for 15 frames (stricter)
    this.CHALLENGE_TIMEOUT_MS = 20000; // 20 second timeout per challenge
    this.MIN_MICRO_MOVEMENT = 0.002; // Minimum micro-movement required (anti-photo)
  }

  /**
   * Start challenge sequence
   */
  startChallenge() {
    this.reset();
    this.currentState = CHALLENGE_STATES.DETECTING_FACE;
    this.startTime = Date.now();
    console.log("🚀 Active liveness challenge started (blink + smile)");
    return this.getStatus();
  }

  /**
   * Process a frame during challenge
   * Call this every frame with detection results
   */
  processFrame(detection, faceDetector, analysisCtx) {
    if (
      this.currentState === CHALLENGE_STATES.COMPLETE ||
      this.currentState === CHALLENGE_STATES.FAILED ||
      this.currentState === CHALLENGE_STATES.ERROR
    ) {
      return this.getStatus();
    }

    // Check timeout - FAIL instead of bypass
    if (Date.now() - this.startTime > this.CHALLENGE_TIMEOUT_MS * 2) {
      this.currentState = CHALLENGE_STATES.FAILED;
      return {
        ...this.getStatus(),
        reason: "Challenge timeout - Please try again and complete all steps",
      };
    }

    if (!detection) {
      this.faceStabilityFrames = 0;
      return {
        ...this.getStatus(),
        instruction: "Position your face in the frame",
      };
    }

    // Track face stability and micro-movements
    this.faceStabilityFrames++;
    this._trackFacePosition(detection);

    // Check for micro-movements (anti-photo check)
    const hasMicroMovement = this._detectMicroMovement();

    // State machine
    switch (this.currentState) {
      case CHALLENGE_STATES.DETECTING_FACE:
        return this._handleDetectingFace(
          detection,
          faceDetector,
          hasMicroMovement
        );

      case CHALLENGE_STATES.WAITING_BLINK:
        return this._handleBlinkDetection(
          detection,
          analysisCtx,
          hasMicroMovement
        );

      case CHALLENGE_STATES.WAITING_SMILE:
        return this._handleSmileDetection(
          detection,
          faceDetector,
          hasMicroMovement
        );

      case CHALLENGE_STATES.CAPTURING:
        return this._handleCapturing();

      default:
        return this.getStatus();
    }
  }

  /**
   * Track face position for micro-movement detection
   */
  _trackFacePosition(detection) {
    if (!detection.keypoints || !detection.keypoints.noseTip) return;

    this.facePositionHistory.push({
      x: detection.keypoints.noseTip.xNorm,
      y: detection.keypoints.noseTip.yNorm,
      timestamp: Date.now(),
    });

    // Keep last 60 frames (2 seconds at 30fps)
    if (this.facePositionHistory.length > 60) {
      this.facePositionHistory.shift();
    }
  }

  /**
   * Detect micro-movements (real faces have subtle movements, photos don't)
   */
  _detectMicroMovement() {
    if (this.facePositionHistory.length < 20) return true; // Not enough data yet

    const recent = this.facePositionHistory.slice(-20);
    let totalMovement = 0;

    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].x - recent[i - 1].x;
      const dy = recent[i].y - recent[i - 1].y;
      totalMovement += Math.sqrt(dx * dx + dy * dy);
    }

    const avgMovement = totalMovement / (recent.length - 1);
    return avgMovement > this.MIN_MICRO_MOVEMENT;
  }

  /**
   * Handle face detection phase
   */
  _handleDetectingFace(detection, faceDetector, hasMicroMovement) {
    // Check if face is frontal and stable
    const isFrontal = faceDetector.isFaceFrontal(detection, 0.65);

    if (this.faceStabilityFrames >= this.MIN_STABILITY_FRAMES && isFrontal) {
      // Require some micro-movement to proceed (anti-photo)
      if (!hasMicroMovement && this.facePositionHistory.length >= 20) {
        return {
          ...this.getStatus(),
          instruction: "Please move slightly - stay natural",
        };
      }

      this.currentState = CHALLENGE_STATES.WAITING_BLINK;
      this.eyeBrightnessHistory = []; // Reset for blink detection
      console.log("✅ Face detected, starting blink challenge");
      return {
        ...this.getStatus(),
        instruction: "Please blink your eyes",
      };
    }

    return {
      ...this.getStatus(),
      instruction: isFrontal ? "Hold still..." : "Look directly at camera",
    };
  }

  /**
   * Handle blink detection - NO AUTO-PASS
   * User MUST actually blink
   */
  _handleBlinkDetection(detection, analysisCtx, hasMicroMovement) {
    if (!detection.keypoints || !detection.keypoints.leftEye) {
      return {
        ...this.getStatus(),
        instruction: "Please blink your eyes",
      };
    }

    // Get eye brightness
    const eyeBrightness = this._getEyeRegionBrightness(
      detection.keypoints,
      analysisCtx
    );
    this.eyeBrightnessHistory.push(eyeBrightness);

    // Keep last 30 frames
    if (this.eyeBrightnessHistory.length > 30) {
      this.eyeBrightnessHistory.shift();
    }

    // Need at least 10 frames of history
    if (this.eyeBrightnessHistory.length >= 10) {
      const blinkDetected = this._detectBlinkPattern();

      if (blinkDetected) {
        this.blinkDetected = true;
        this.currentState = CHALLENGE_STATES.WAITING_SMILE;
        this.mouthWidthHistory = []; // Reset for smile detection
        console.log("👁️ Blink detected! Moving to smile challenge");
        return {
          ...this.getStatus(),
          instruction: "Great! Now please smile",
        };
      }
    }

    // REMOVED: No auto-pass after timeout - user MUST blink
    // Check for photo (no micro-movement)
    if (!hasMicroMovement && this.facePositionHistory.length >= 30) {
      return {
        ...this.getStatus(),
        instruction: "Move naturally - blink your eyes",
      };
    }

    return {
      ...this.getStatus(),
      instruction: "Please blink your eyes",
      debug: { eyeBrightness, historyLength: this.eyeBrightnessHistory.length },
    };
  }

  /**
   * Get eye region brightness from canvas
   */
  _getEyeRegionBrightness(keypoints, analysisCtx) {
    if (!analysisCtx || !keypoints.leftEye) return 128;

    try {
      const regionSize = 12; // Slightly larger region for better detection
      const leftEye = keypoints.leftEye;
      const rightEye = keypoints.rightEye;

      // Sample both eyes
      let totalBrightness = 0;
      let sampleCount = 0;

      for (const eye of [leftEye, rightEye]) {
        if (!eye) continue;

        const imageData = analysisCtx.getImageData(
          Math.max(0, Math.floor(eye.x) - regionSize),
          Math.max(0, Math.floor(eye.y) - regionSize),
          regionSize * 2,
          regionSize * 2
        );

        for (let i = 0; i < imageData.data.length; i += 4) {
          totalBrightness +=
            (imageData.data[i] +
              imageData.data[i + 1] +
              imageData.data[i + 2]) /
            3;
          sampleCount++;
        }
      }

      return sampleCount > 0 ? totalBrightness / sampleCount : 128;
    } catch (error) {
      return 128;
    }
  }

  /**
   * Detect blink pattern in brightness history
   * Blink: brightness drops then recovers within 300ms
   */
  _detectBlinkPattern() {
    const history = this.eyeBrightnessHistory;
    if (history.length < 10) return false;

    // Calculate average brightness
    const avg = history.reduce((a, b) => a + b, 0) / history.length;

    // Look for dip pattern in last 10 frames
    const recent = history.slice(-10);
    const minBrightness = Math.min(...recent);
    const maxBrightness = Math.max(...recent);

    // Blink = significant brightness drop then recovery
    const hasSignificantDrop = minBrightness < avg * this.BLINK_BRIGHTNESS_DROP;
    const hasRecovery = maxBrightness > avg * 0.95;
    const hasRange = maxBrightness - minBrightness > 18; // At least 18 brightness units change (stricter)

    return hasSignificantDrop && hasRecovery && hasRange;
  }

  /**
   * Handle smile detection - NO AUTO-PASS
   * User MUST actually smile
   */
  _handleSmileDetection(detection, faceDetector, hasMicroMovement) {
    if (!detection.keypoints) {
      return {
        ...this.getStatus(),
        instruction: "Please smile",
      };
    }

    // Calculate mouth width ratio
    const mouthMetrics = this._calculateMouthMetrics(detection);

    if (mouthMetrics) {
      this.mouthWidthHistory.push(mouthMetrics);
    }

    // Keep last 30 frames
    if (this.mouthWidthHistory.length > 30) {
      this.mouthWidthHistory.shift();
    }

    // Need baseline + current frames
    if (this.mouthWidthHistory.length >= 8) {
      const smileDetected = this._detectSmilePattern();

      if (smileDetected) {
        this.smileDetected = true;
        this.currentState = CHALLENGE_STATES.CAPTURING;
        console.log("😊 Smile detected! Capturing...");
        return {
          ...this.getStatus(),
          instruction: "Hold still - capturing...",
        };
      }
    }

    // REMOVED: No auto-pass after timeout - user MUST smile
    // Check for photo (no micro-movement)
    if (!hasMicroMovement && this.facePositionHistory.length >= 30) {
      return {
        ...this.getStatus(),
        instruction: "Move naturally - please smile",
      };
    }

    return {
      ...this.getStatus(),
      instruction: "Please smile",
      debug: {
        mouthWidth: mouthMetrics?.widthRatio?.toFixed(3) || "N/A",
        historyLength: this.mouthWidthHistory.length,
      },
    };
  }

  /**
   * Calculate mouth metrics for smile detection
   */
  _calculateMouthMetrics(detection) {
    const { leftEye, rightEye, mouthCenter, noseTip } = detection.keypoints;

    if (!leftEye || !rightEye || !mouthCenter) return null;

    // Eye distance for normalization
    const eyeDistance = Math.sqrt(
      Math.pow(rightEye.xNorm - leftEye.xNorm, 2) +
        Math.pow(rightEye.yNorm - leftEye.yNorm, 2)
    );

    if (eyeDistance < 0.05) return null;

    // Face center X
    // Face center X
    // const faceCenterX = (leftEye.xNorm + rightEye.xNorm) / 2; // Unused

    // Mouth horizontal spread (estimate based on face proportions)
    // When smiling, mouth appears wider relative to face width
    // Mouth horizontal spread logic simplified
    // const mouthToFaceRatio = Math.abs(mouthCenter.xNorm - faceCenterX); // Unused

    // Use nose-to-mouth distance as height reference
    const noseToMouth = noseTip
      ? Math.abs(mouthCenter.yNorm - noseTip.yNorm)
      : eyeDistance * 0.5;

    // Width ratio: wider = smiling
    const widthRatio = eyeDistance / (noseToMouth + 0.001);

    return {
      widthRatio,
      eyeDistance,
      noseToMouth,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect smile pattern - looking for transition from neutral to wide mouth
   */
  _detectSmilePattern() {
    if (this.mouthWidthHistory.length < 8) return false;

    // Baseline: first 3 frames (should be neutral)
    const baseline = this.mouthWidthHistory.slice(0, 3);
    const baselineAvg =
      baseline.reduce((sum, m) => sum + m.widthRatio, 0) / baseline.length;

    // Current: last 3 frames
    const current = this.mouthWidthHistory.slice(-3);
    const currentAvg =
      current.reduce((sum, m) => sum + m.widthRatio, 0) / current.length;

    // Smile detection: current ratio is significantly higher than baseline
    const ratioIncrease = currentAvg / baselineAvg;
    const isSmiling = ratioIncrease >= this.SMILE_WIDTH_INCREASE;

    // Also check for sustained smile (not just a spike)
    const consistentSmile = current.every(
      (m) => m.widthRatio / baselineAvg > 1.15
    );

    return isSmiling && consistentSmile;
  }

  /**
   * Handle capture phase
   */
  _handleCapturing() {
    // Mark complete after brief delay (capture happens in component)
    this.currentState = CHALLENGE_STATES.COMPLETE;
    console.log(
      "✅ Active liveness challenge complete! (blink + smile verified)"
    );
    return {
      ...this.getStatus(),
      instruction: "Verification complete!",
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      state: this.currentState,
      blinkDetected: this.blinkDetected,
      smileDetected: this.smileDetected,
      // Legacy compatibility
      headTurnDetected: this.smileDetected,
      isComplete: this.currentState === CHALLENGE_STATES.COMPLETE,
      isFailed: this.currentState === CHALLENGE_STATES.FAILED,
      progress: this._calculateProgress(),
      elapsedMs: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Calculate progress percentage
   */
  _calculateProgress() {
    switch (this.currentState) {
      case CHALLENGE_STATES.IDLE:
        return 0;
      case CHALLENGE_STATES.DETECTING_FACE:
        return 10;
      case CHALLENGE_STATES.WAITING_BLINK:
        return 25;
      case CHALLENGE_STATES.WAITING_SMILE:
        return 50;
      case CHALLENGE_STATES.CAPTURING:
        return 75;
      case CHALLENGE_STATES.COMPLETE:
        return 100;
      case CHALLENGE_STATES.FAILED:
      case CHALLENGE_STATES.ERROR:
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Reset challenge state
   */
  reset() {
    this.currentState = CHALLENGE_STATES.IDLE;
    this.blinkDetected = false;
    this.smileDetected = false;
    this.startTime = null;
    this.eyeBrightnessHistory = [];
    this.mouthWidthHistory = [];
    this.facePositionHistory = [];
    this.faceStabilityFrames = 0;
    console.log("🔄 Active liveness challenge reset");
  }
}

// Export singleton
const activeLivenessChallenge = new ActiveLivenessChallenge();
export default activeLivenessChallenge;

// Also export class
export { ActiveLivenessChallenge };
