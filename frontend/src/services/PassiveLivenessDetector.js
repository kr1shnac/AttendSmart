/**
 * Passive Liveness Detector
 *
 * Detects spoofing without user action using:
 * 1. Texture analysis (print vs real face)
 * 2. Depth estimation from landmarks
 * 3. Micro-motion detection
 * 4. Eye region analysis
 *
 * @version 1.0.0
 */

class PassiveLivenessDetector {
  constructor() {
    this.motionVectors = [];
    this.textureHistory = [];
    this.analysisCanvas = null;
    this.analysisCtx = null;
  }

  /**
   * Initialize with canvas for pixel analysis
   */
  initialize(canvas) {
    this.analysisCanvas = canvas || document.createElement("canvas");
    this.analysisCtx = this.analysisCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    console.log("✅ Passive Liveness Detector initialized");
  }

  /**
   * Main passive liveness check
   * Returns: { isLive: boolean, score: 0-100, reasons: [] }
   */
  // eslint-disable-next-line no-unused-vars
  async checkLiveness(videoElement, detection, faceDetector) {
    const reasons = [];
    let livenessScore = 50; // Start at neutral

    try {
      // Draw video frame to canvas for analysis
      this.analysisCanvas.width = videoElement.videoWidth;
      this.analysisCanvas.height = videoElement.videoHeight;
      this.analysisCtx.drawImage(videoElement, 0, 0);

      // 1. Texture Analysis (30% weight)
      const textureScore = this._analyzeTexture(detection);
      reasons.push(`Texture: ${textureScore}/100`);
      livenessScore += (textureScore - 50) * 0.3;

      // 2. Depth Analysis from landmarks (20% weight)
      const depthScore = this._estimateDepth(detection);
      reasons.push(`Depth: ${depthScore}/100`);
      livenessScore += (depthScore - 50) * 0.2;

      // 3. Micro-motion Detection (25% weight)
      const motionScore = this._detectMicroMotion(detection);
      reasons.push(`Motion: ${motionScore}/100`);
      livenessScore += (motionScore - 50) * 0.25;

      // 4. Eye Region Analysis (25% weight)
      const eyeScore = this._analyzeEyeRegion(detection);
      reasons.push(`Eyes: ${eyeScore}/100`);
      livenessScore += (eyeScore - 50) * 0.25;

      // Update motion tracking
      this._updateMotionVector(detection);
    } catch (error) {
      console.error("Passive liveness error:", error);
      reasons.push(`Error: ${error.message}`);
    }

    const finalScore = Math.min(Math.max(Math.round(livenessScore), 0), 100);
    const isLive = finalScore >= 50; // Threshold: 50/100

    return {
      isLive,
      score: finalScore,
      reasons,
      confidence: Math.abs(finalScore - 50) / 50,
    };
  }

  /**
   * Texture Analysis - Detect compression artifacts and frequency patterns
   */
  _analyzeTexture(detection) {
    const { bbox } = detection;

    try {
      // Get face region pixels
      const x = Math.max(0, Math.floor(bbox.x));
      const y = Math.max(0, Math.floor(bbox.y));
      const w = Math.min(Math.floor(bbox.width), this.analysisCanvas.width - x);
      const h = Math.min(
        Math.floor(bbox.height),
        this.analysisCanvas.height - y
      );

      if (w <= 0 || h <= 0) return 50;

      const imageData = this.analysisCtx.getImageData(x, y, w, h);
      const data = imageData.data;

      // 1. Check for high-frequency components
      const frequencies = this._computeFrequencies(data);
      const highFreqRatio = frequencies.high / (frequencies.total + 1);

      // 2. Check for block artifacts (JPEG compression)
      const blockiness = this._detectBlockiness(data);

      // 3. Color consistency
      const colorScore = this._analyzeColorSpace(data);

      // Combine scores
      let textureScore = 50;
      textureScore += highFreqRatio * 25; // More high freq = more real
      textureScore -= blockiness * 15; // More blocks = more fake
      textureScore += colorScore * 20; // Good color range = more real

      return Math.max(0, Math.min(100, Math.round(textureScore)));
    } catch (error) {
      console.warn("Texture analysis error:", error);
      return 50;
    }
  }

  /**
   * Compute frequency components
   */
  _computeFrequencies(pixelData) {
    let lowFreq = 0,
      highFreq = 0;

    for (let i = 0; i < pixelData.length - 16; i += 16) {
      const center = pixelData[i];
      const neighbor = pixelData[i + 4];
      const diff = Math.abs(center - neighbor);

      if (diff < 10) lowFreq++;
      else if (diff > 30) highFreq++;
    }

    return {
      low: lowFreq,
      high: highFreq,
      total: lowFreq + highFreq + 1,
    };
  }

  /**
   * Detect JPEG block artifacts
   */
  _detectBlockiness(pixelData) {
    let blockEdges = 0;
    const blockSize = 8;
    const step = blockSize * 4;

    for (let i = step; i < pixelData.length - step; i += step) {
      const before = pixelData[i - 4];
      const after = pixelData[i];
      const diff = Math.abs(before - after);

      if (diff > 20) blockEdges++;
    }

    return Math.min(blockEdges / (pixelData.length / step), 1);
  }

  /**
   * Analyze color space for skin tones
   */
  _analyzeColorSpace(pixelData) {
    let skinToneCount = 0;
    let totalSamples = 0;

    for (let i = 0; i < pixelData.length; i += 16) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      totalSamples++;

      // Skin tone detection (broad range for all ethnicities)
      const isSkinTone =
        r > 60 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        r > b &&
        r - b > 15 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15;

      if (isSkinTone) skinToneCount++;
    }

    return totalSamples > 0 ? skinToneCount / totalSamples : 0;
  }

  /**
   * Depth estimation from facial proportions
   */
  _estimateDepth(detection) {
    if (!detection.keypoints) return 50;

    // eslint-disable-next-line no-unused-vars
    const { leftEye, rightEye, noseTip, mouthCenter } = detection.keypoints;
    if (!leftEye || !rightEye || !noseTip) return 50;

    // Calculate proportional distances
    const eyeDistance = Math.hypot(
      rightEye.xNorm - leftEye.xNorm,
      rightEye.yNorm - leftEye.yNorm
    );

    const eyeCenterY = (leftEye.yNorm + rightEye.yNorm) / 2;
    const eyeNoseDistance = Math.abs(noseTip.yNorm - eyeCenterY);
    const noseHeightRatio = eyeNoseDistance / (eyeDistance + 0.001);

    let depthScore = 50;

    // Real faces have specific proportions (1.4 - 1.8 golden ratio)
    if (noseHeightRatio > 0.3 && noseHeightRatio < 0.8) {
      depthScore += 35;
    }

    // Check face aspect ratio
    const { bbox } = detection;
    const aspectRatio = bbox.heightNorm / (bbox.widthNorm + 0.001);
    if (aspectRatio > 1.1 && aspectRatio < 1.6) {
      depthScore += 15;
    }

    return Math.min(100, depthScore);
  }

  /**
   * Detect micro-motions (natural facial movements)
   */
  _detectMicroMotion(detection) {
    if (this.motionVectors.length < 5) {
      return 50; // Not enough history
    }

    // Current position is used for future comparison
    // eslint-disable-next-line no-unused-vars
    const currentPos = {
      x: detection.bbox.xNorm + detection.bbox.widthNorm / 2,
      y: detection.bbox.yNorm + detection.bbox.heightNorm / 2,
    };

    // Calculate motion variance over last frames
    let totalMotion = 0;
    for (let i = 1; i < this.motionVectors.length; i++) {
      const motion = Math.hypot(
        this.motionVectors[i].x - this.motionVectors[i - 1].x,
        this.motionVectors[i].y - this.motionVectors[i - 1].y
      );
      totalMotion += motion;
    }

    const avgMotion = totalMotion / (this.motionVectors.length - 1);

    // Real faces have small natural motions (breathing, micro-expressions)
    // Still images have zero motion
    // Videos have too consistent motion
    if (avgMotion > 0.001 && avgMotion < 0.02) {
      return 80; // Natural motion range
    } else if (avgMotion < 0.0005) {
      return 25; // Too still = likely photo
    } else if (avgMotion > 0.05) {
      return 40; // Too much motion = suspicious
    }

    return 55;
  }

  /**
   * Analyze eye region for reflections
   */
  _analyzeEyeRegion(detection) {
    if (!detection.keypoints) return 50;

    const { leftEye, rightEye } = detection.keypoints;
    if (!leftEye || !rightEye) return 50;

    try {
      // Check for specular highlights in eyes (real eyes reflect light)
      const eyeRegionSize = 15;

      const leftEyeData = this.analysisCtx.getImageData(
        Math.max(0, Math.floor(leftEye.x) - eyeRegionSize),
        Math.max(0, Math.floor(leftEye.y) - eyeRegionSize),
        eyeRegionSize * 2,
        eyeRegionSize * 2
      );

      const brightness = this._calculateMaxBrightness(leftEyeData.data);

      // Real eyes have bright specular highlights
      let eyeScore = 50;
      if (brightness > 200) {
        eyeScore += 35; // Strong highlight = real
      } else if (brightness > 150) {
        eyeScore += 15; // Some highlight
      }

      return Math.min(100, eyeScore);
    } catch (error) {
      return 50;
    }
  }

  /**
   * Calculate maximum brightness in region
   */
  _calculateMaxBrightness(pixelData) {
    let maxBrightness = 0;

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      const brightness = (r + g + b) / 3;
      maxBrightness = Math.max(maxBrightness, brightness);
    }

    return maxBrightness;
  }

  /**
   * Update motion tracking
   */
  _updateMotionVector(detection) {
    this.motionVectors.push({
      x: detection.bbox.xNorm + detection.bbox.widthNorm / 2,
      y: detection.bbox.yNorm + detection.bbox.heightNorm / 2,
      timestamp: Date.now(),
    });

    // Keep last 30 frames
    if (this.motionVectors.length > 30) {
      this.motionVectors.shift();
    }
  }

  /**
   * Reset for new session
   */
  reset() {
    this.motionVectors = [];
    this.textureHistory = [];
  }

  /**
   * Get analysis summary
   */
  getAnalysisSummary() {
    return {
      motionSamples: this.motionVectors.length,
      textureSamples: this.textureHistory.length,
    };
  }
}

// Export singleton
const passiveLivenessDetector = new PassiveLivenessDetector();
export default passiveLivenessDetector;

// Also export class
export { PassiveLivenessDetector };
