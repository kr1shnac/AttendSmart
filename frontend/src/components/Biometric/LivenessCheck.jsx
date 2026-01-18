/**
 * LivenessCheck Component
 *
 * Production-grade liveness verification using:
 * - MediaPipe Face Detection (99% accuracy)
 * - Passive liveness analysis (anti-spoofing)
 * - Active challenges (blink + head turn)
 *
 * @version 2.0.0
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  FiEye,
  FiSmile,
  FiCamera,
  FiCheck,
  FiAlertTriangle,
  FiCircle,
} from "react-icons/fi";

// Import services
import mediaPipeFaceDetector from "../../services/MediaPipeFaceDetector";
import passiveLivenessDetector from "../../services/PassiveLivenessDetector";
import activeLivenessChallenge, {
  CHALLENGE_STATES,
} from "../../services/ActiveLivenessChallenge";

// Import styles
import "./LivenessCheck.css";

const LivenessCheck = ({
  onComplete,
  onError,
  showDebug = false,
  timeoutMs = 60000,
}) => {
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const timeoutRef = useRef(null);

  // State
  const [state, setState] = useState("initializing");
  const [instructions, setInstructions] = useState("Initializing camera...");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [smileDetected, setSmileDetected] = useState(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    activeLivenessChallenge.reset();
    passiveLivenessDetector.reset();
  }, []);

  // Initialize camera and detection
  const initialize = useCallback(async () => {
    try {
      setState("initializing");
      setInstructions("Starting camera...");
      setProgress(5);

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      const video = videoRef.current;
      if (!video || !document.body.contains(video)) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Video element not available");
      }

      video.srcObject = stream;
      streamRef.current = stream;

      try {
        await video.play();
      } catch (playError) {
        if (playError.name === "AbortError") {
          console.warn("Video play interrupted");
          return;
        }
        throw playError;
      }

      setInstructions("Loading face detection...");
      setProgress(10);

      // Initialize MediaPipe Face Detector
      const detectorReady = await mediaPipeFaceDetector.initialize();

      if (!detectorReady) {
        throw new Error("Failed to initialize MediaPipe Face Detector");
      }

      // Initialize passive liveness detector
      if (!analysisCanvasRef.current) {
        analysisCanvasRef.current = document.createElement("canvas");
      }
      passiveLivenessDetector.initialize(analysisCanvasRef.current);

      // Start active challenge
      activeLivenessChallenge.startChallenge();

      setState("detecting_face");
      setInstructions("Position your face in the frame");
      setProgress(15);

      // Start detection loop
      startDetectionLoop();

      // Set overall timeout
      timeoutRef.current = setTimeout(() => {
        setError("Verification timeout. Please try again.");
        setState("error");
        if (onError) {
          onError(new Error("Verification timeout"));
        }
      }, timeoutMs);
    } catch (err) {
      console.error("❌ Liveness initialization error:", err);
      setError(err.message);
      setState("error");
      if (onError) {
        onError(err);
      }
    }
  }, [onError, timeoutMs]);

  // Detection loop
  const startDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    const analysisCanvas = analysisCanvasRef.current;
    const analysisCtx = analysisCanvas?.getContext("2d", {
      willReadFrequently: true,
    });

    const processFrame = async () => {
      if (!video || video.paused || video.ended) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Update canvas dimensions
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      if (analysisCanvas) {
        analysisCanvas.width = canvas.width;
        analysisCanvas.height = canvas.height;
      }

      // Draw video to canvas
      ctx.drawImage(video, 0, 0);
      if (analysisCtx) {
        analysisCtx.drawImage(video, 0, 0);
      }

      // Detect faces
      const detectionResult = mediaPipeFaceDetector.detectFaces(video);

      if (detectionResult.success && detectionResult.detections.length > 0) {
        const detection = detectionResult.detections[0];

        // Draw bounding box
        drawDetection(ctx, detection);

        // Process active liveness challenge
        const challengeStatus = activeLivenessChallenge.processFrame(
          detection,
          mediaPipeFaceDetector,
          analysisCtx
        );

        // Update UI based on challenge status
        updateUIFromChallenge(challengeStatus);

        // Update debug info
        if (showDebug) {
          // Calculate smile metrics for debug if available
          const mouthMetrics =
            activeLivenessChallenge.mouthWidthHistory?.slice(-1)[0];

          setDebugInfo({
            face: "YES",
            confidence: (detection.confidence * 100).toFixed(0) + "%",
            state: challengeStatus.state,
            blink: challengeStatus.blinkDetected ? "YES" : "NO",
            smile: challengeStatus.smileDetected ? "YES" : "NO",
            mouthRatio: mouthMetrics?.widthRatio?.toFixed(3) || "N/A",
            progress: challengeStatus.progress + "%",
          });
        }

        // Check if challenge is complete
        if (challengeStatus.isComplete) {
          handleChallengeComplete(detection);
          return;
        }

        // Check if challenge failed
        if (challengeStatus.isFailed) {
          handleChallengeFailed(challengeStatus.reason);
          return;
        }
      } else {
        // No face detected
        if (showDebug) {
          setDebugInfo({ face: "NO", state: state });
        }
      }

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [showDebug, state]);

  // Update UI from challenge status
  const updateUIFromChallenge = useCallback((status) => {
    setProgress(status.progress);
    setBlinkDetected(status.blinkDetected);
    setSmileDetected(status.smileDetected);

    switch (status.state) {
      case CHALLENGE_STATES.DETECTING_FACE:
        setState("detecting_face");
        setInstructions(
          status.instruction || "Position your face in the frame"
        );
        break;
      case CHALLENGE_STATES.WAITING_BLINK:
        setState("waiting_blink");
        setInstructions(status.instruction || "Please blink naturally");
        break;
      case CHALLENGE_STATES.WAITING_SMILE:
        setState("waiting_smile");
        setInstructions(status.instruction || "Please smile!");
        break;
      case CHALLENGE_STATES.CAPTURING:
        setState("capturing");
        setInstructions("Hold still - capturing...");
        break;
      default:
        break;
    }
  }, []);

  // Draw face detection on canvas
  const drawDetection = useCallback((ctx, detection) => {
    const { bbox, keypoints } = detection;

    // Draw bounding box
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

    // Draw corner brackets
    const cornerSize = 20;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(bbox.x, bbox.y + cornerSize);
    ctx.lineTo(bbox.x, bbox.y);
    ctx.lineTo(bbox.x + cornerSize, bbox.y);
    // Top-right
    ctx.moveTo(bbox.x + bbox.width - cornerSize, bbox.y);
    ctx.lineTo(bbox.x + bbox.width, bbox.y);
    ctx.lineTo(bbox.x + bbox.width, bbox.y + cornerSize);
    // Bottom-right
    ctx.moveTo(bbox.x + bbox.width, bbox.y + bbox.height - cornerSize);
    ctx.lineTo(bbox.x + bbox.width, bbox.y + bbox.height);
    ctx.lineTo(bbox.x + bbox.width - cornerSize, bbox.y + bbox.height);
    // Bottom-left
    ctx.moveTo(bbox.x + cornerSize, bbox.y + bbox.height);
    ctx.lineTo(bbox.x, bbox.y + bbox.height);
    ctx.lineTo(bbox.x, bbox.y + bbox.height - cornerSize);
    ctx.strokeStyle = "#00ffd4";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw keypoints
    if (keypoints) {
      ctx.fillStyle = "#ff0066";
      Object.values(keypoints).forEach((point) => {
        if (point) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, []);

  // Handle challenge complete
  const handleChallengeComplete = useCallback(
    async (detection) => {
      try {
        setState("complete");
        setInstructions("Verification complete!");
        setProgress(100);

        // Cancel animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Capture final frame
        const canvas = canvasRef.current;
        if (canvas) {
          const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", 0.92);
          });

          const imageUrl = canvas.toDataURL("image/jpeg", 0.92);

          // Run passive liveness check
          const passiveResult = await passiveLivenessDetector.checkLiveness(
            videoRef.current,
            detection,
            mediaPipeFaceDetector
          );

          console.log("✅ Liveness verification complete", {
            passive: passiveResult.score,
            activeBlinkDetected: blinkDetected,
            activeSmileDetected: smileDetected,
          });

          // Calculate combined score
          // Bonus for passing active challenges
          const activeScore =
            (blinkDetected ? 50 : 0) + (smileDetected ? 50 : 0);

          const combinedScore = Math.round(
            (passiveResult.score + activeScore) / 2
          );

          // Call onComplete
          if (onComplete) {
            onComplete({
              imageBlob: blob,
              imageUrl: imageUrl,
              livenessScore: combinedScore,
              passiveScore: passiveResult.score,
              activeScore: activeScore,
              blinkDetected: blinkDetected,
              smileDetected: smileDetected,
              passiveReasons: passiveResult.reasons,
              timestamp: new Date().toISOString(),
            });
          }

          // Stop camera
          cleanup();
        }
      } catch (err) {
        console.error("❌ Error completing liveness check:", err);
        setError(err.message);
        if (onError) {
          onError(err);
        }
      }
    },
    [blinkDetected, smileDetected, cleanup, onComplete, onError]
  );

  // Handle challenge failed
  const handleChallengeFailed = useCallback(
    (reason) => {
      setState("failed");
      setError(reason || "Verification failed");
      setProgress(0);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (onError) {
        onError(new Error(reason || "Verification failed"));
      }

      cleanup();
    },
    [cleanup, onError]
  );

  // Initialize on mount
  useEffect(() => {
    initialize();
    return cleanup;
  }, [initialize, cleanup]);

  return (
    <div className="liveness-check">
      {/* Video container */}
      <div className="liveness-video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="liveness-video"
        />
        <canvas ref={canvasRef} className="liveness-canvas" />

        {/* Face guide overlay */}
        <div className="liveness-overlay">
          <div
            className={`face-guide ${state === "complete" ? "success" : ""}`}
            style={{
              borderColor:
                state === "complete"
                  ? "#10b981"
                  : state === "failed"
                  ? "#ef4444"
                  : "rgba(255, 255, 255, 0.5)",
            }}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="liveness-instructions">
        <div className="instruction-header">
          {state === "waiting_blink" && (
            <FiEye className="instruction-icon pulse" />
          )}
          {state === "waiting_smile" && (
            <FiSmile className="instruction-icon pulse" />
          )}
          {state === "detecting_face" && (
            <FiCamera className="instruction-icon" />
          )}
          {state === "complete" && (
            <FiCheck className="instruction-icon success" />
          )}
          {state === "failed" && (
            <FiAlertTriangle className="instruction-icon error" />
          )}
        </div>

        <p className={`instruction-text ${state}`}>{instructions}</p>

        {/* Progress bar */}
        <div className="liveness-progress">
          <div
            className="liveness-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Challenge indicators */}
        <div className="challenge-indicators">
          <div className={`indicator ${blinkDetected ? "complete" : ""}`}>
            <span className="indicator-icon">
              {blinkDetected ? <FiCheck /> : <FiCircle />}
            </span>
            <span className="indicator-text">Blink</span>
          </div>
          <div className={`indicator ${smileDetected ? "complete" : ""}`}>
            <span className="indicator-icon">
              {smileDetected ? <FiCheck /> : <FiCircle />}
            </span>
            <span className="indicator-text">Smile</span>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="liveness-error">
          <FiAlertTriangle className="error-icon" />
          <span className="error-text">{error}</span>
        </div>
      )}

      {/* Debug info */}
      {showDebug && (
        <div className="liveness-debug">
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

LivenessCheck.propTypes = {
  onComplete: PropTypes.func.isRequired,
  onError: PropTypes.func,
  showDebug: PropTypes.bool,
  timeoutMs: PropTypes.number,
};

export default LivenessCheck;
