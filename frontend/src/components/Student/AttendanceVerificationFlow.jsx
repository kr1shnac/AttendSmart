/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMapPin,
  FiCheckCircle,
  FiXCircle,
  FiShield,
  FiClock,
  FiAlertTriangle,
  FiRefreshCw,
  FiX,
  FiCamera,
} from "react-icons/fi";
import { RiShieldCheckLine } from "react-icons/ri";
import { MdFace, MdSecurity } from "react-icons/md";
import PropTypes from "prop-types";
import faceRecognitionService from "../../services/faceRecognitionService";
import "./AttendanceVerificationFlow.css";

const AttendanceVerificationFlow = ({ session, onComplete, onCancel }) => {
  const [phase, setPhase] = useState("gps"); // gps, face, submitting, success, pending, error
  const [gpsStatus, setGpsStatus] = useState("checking"); // checking, success, failed
  const [faceStatus, setFaceStatus] = useState("waiting"); // waiting, detecting, captured, failed
  const [errorMessage, setErrorMessage] = useState("");
  const [gpsData, setGpsData] = useState(null);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [verificationResult, setVerificationResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  // Use ref for camera state to avoid stale closures in detection loop
  const cameraActiveRef = useRef(false);

  // Start GPS verification immediately
  useEffect(() => {
    getGPSLocation();
    return () => stopCamera();
  }, []);

  const getGPSLocation = async () => {
    setGpsStatus("checking");

    if (!navigator.geolocation) {
      setGpsStatus("failed");
      setGpsData({ error: "Geolocation not supported" });
      setPhase("face");
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setGpsData(coords);
      setGpsStatus("success");

      // Move to face phase after GPS
      setTimeout(() => setPhase("face"), 1000);
    } catch (error) {
      console.error("GPS error:", error);
      setGpsStatus("failed");
      setGpsData({ error: error.message });
      // Still proceed to face phase
      setTimeout(() => setPhase("face"), 1000);
    }
  };

  // Start camera when entering face phase
  useEffect(() => {
    if (phase === "face" && !cameraActive) {
      startCamera();
    }
  }, [phase]);

  const startCamera = async () => {
    try {
      setFaceStatus("detecting");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Set ref BEFORE state to ensure detection loop works
      cameraActiveRef.current = true;
      setCameraActive(true);

      // Initialize MediaPipe face detection with callback
      await faceRecognitionService.initialize(videoRef.current, (results) => {
        handleFaceDetectionResults(results);
      });
    } catch (error) {
      console.error("Camera error:", error);
      setFaceStatus("failed");
      setErrorMessage("Could not access camera: " + error.message);
    }
  };

  const stopCamera = () => {
    // Set ref BEFORE state to stop detection loop immediately
    cameraActiveRef.current = false;
    // Stop MediaPipe face recognition service
    faceRecognitionService.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Handle MediaPipe face detection results (callback-based)
  const handleFaceDetectionResults = async (results) => {
    if (!cameraActiveRef.current) return;

    if (results.detections && results.detections.length > 0) {
      const detection = results.detections[0];
      const boundingBox = detection.boundingBox;

      // Draw detection overlay
      if (canvasRef.current && videoRef.current) {
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Convert normalized coordinates to pixels
        const x =
          boundingBox.xCenter * canvas.width -
          (boundingBox.width * canvas.width) / 2;
        const y =
          boundingBox.yCenter * canvas.height -
          (boundingBox.height * canvas.height) / 2;
        const width = boundingBox.width * canvas.width;
        const height = boundingBox.height * canvas.height;

        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
      }

      // Calculate confidence from detection score
      const confidence = Math.round((detection.score || 0.5) * 100);
      setFaceConfidence(confidence);

      // Auto-capture after stable detection (confidence > 70%)
      if (confidence > 70 && faceStatus === "detecting") {
        await captureFace();
      }
    }
  };

  const captureFace = async () => {
    try {
      setFaceStatus("captured");

      // Capture frame using faceRecognitionService
      const imageBlob = await faceRecognitionService.captureFrame(
        videoRef.current,
        canvasRef.current
      );

      if (imageBlob) {
        // Convert to base64 for sending to server
        const base64Image = await faceRecognitionService.blobToBase64(
          imageBlob
        );

        // Stop camera and service
        faceRecognitionService.stop();
        stopCamera();

        // Proceed to submit with image (server will generate descriptor)
        setTimeout(() => submitVerification(null, base64Image), 500);
      } else {
        throw new Error("Could not capture face");
      }
    } catch (error) {
      console.error("Face capture error:", error);
      setFaceStatus("failed");
      setErrorMessage("Failed to capture face: " + error.message);
    }
  };

  const submitVerification = async (descriptor, faceImage = null) => {
    setPhase("submitting");

    try {
      const token = localStorage.getItem("token");
      const apiUrl = process.env.REACT_APP_API_URL || "";

      const payload = {
        sessionId: session._id,
        gps: gpsData?.error ? null : gpsData,
        faceDescriptor: descriptor || faceDescriptor,
        faceImage: faceImage, // Base64 image for server-side descriptor generation
        platform: "web",
      };

      console.log("Submitting verification:", {
        sessionId: session._id,
        hasGps: !!payload.gps,
        hasFace: !!payload.faceDescriptor,
      });

      const response = await fetch(
        `${apiUrl}/api/attendance/verify-real-face`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Verification failed");
      }

      setVerificationResult(data.data);

      // Determine phase based on result
      if (data.data.outcome === "AUTO_APPROVED") {
        setPhase("success");
        localStorage.setItem(`attendance_${session._id}`, "verified");
        setTimeout(() => onComplete && onComplete(), 2500);
      } else {
        setPhase("pending");
        localStorage.setItem(`attendance_${session._id}`, "pending");
      }
    } catch (error) {
      console.error("Submission error:", error);
      setErrorMessage(error.message);
      setPhase("error");
    }
  };

  const handleRetry = () => {
    setPhase("gps");
    setGpsStatus("checking");
    setFaceStatus("waiting");
    setErrorMessage("");
    setGpsData(null);
    setFaceDescriptor(null);
    getGPSLocation();
  };

  return (
    <div className="avf-overlay">
      <motion.div
        className="avf-container"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Close Button */}
        <button className="avf-close" onClick={onCancel}>
          <FiX />
        </button>

        {/* Header */}
        <div className="avf-header">
          <div className="avf-logo">
            <MdSecurity />
          </div>
          <h2>Secure Check-In</h2>
          <p>
            {session?.subject ||
              session?.className ||
              "Attendance Verification"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* GPS Phase */}
          {phase === "gps" && (
            <motion.div
              className="avf-phase"
              key="gps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="avf-step-icon">
                <FiMapPin className={gpsStatus === "checking" ? "pulse" : ""} />
                {gpsStatus === "checking" && <div className="step-pulse" />}
              </div>
              <h3>Verifying Location</h3>
              <p>
                {gpsStatus === "checking"
                  ? "Getting your GPS coordinates..."
                  : gpsStatus === "success"
                  ? "Location verified!"
                  : "Location check failed - proceeding to face verification"}
              </p>
              <div className="avf-loader">
                <div className="loader-dot" />
                <div className="loader-dot" />
                <div className="loader-dot" />
              </div>
            </motion.div>
          )}

          {/* Face Phase */}
          {phase === "face" && (
            <motion.div
              className="avf-phase avf-face-phase"
              key="face"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="avf-camera-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="avf-camera-video"
                />
                <canvas ref={canvasRef} className="avf-camera-overlay" />
                <div className="avf-camera-guide">
                  <div className="guide-corner tl" />
                  <div className="guide-corner tr" />
                  <div className="guide-corner bl" />
                  <div className="guide-corner br" />
                </div>
              </div>
              <h3>
                <MdFace /> Face Verification
              </h3>
              <p>
                {faceStatus === "detecting"
                  ? `Looking for your face... ${
                      faceConfidence > 0 ? `(${faceConfidence}%)` : ""
                    }`
                  : faceStatus === "captured"
                  ? "Face captured! Processing..."
                  : "Position your face in the frame"}
              </p>
            </motion.div>
          )}

          {/* Submitting Phase */}
          {phase === "submitting" && (
            <motion.div
              className="avf-phase"
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="avf-step-icon pulse">
                <RiShieldCheckLine />
                <div className="step-pulse" />
              </div>
              <h3>Verifying Identity</h3>
              <p>Comparing face with enrolled data...</p>
              <div className="avf-loader">
                <div className="loader-dot" />
                <div className="loader-dot" />
                <div className="loader-dot" />
              </div>
            </motion.div>
          )}

          {/* Success Phase */}
          {phase === "success" && (
            <motion.div
              className="avf-success-phase"
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="success-animation">
                <div className="success-ring" />
                <div className="success-ring ring-2" />
                <motion.div
                  className="success-check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <FiCheckCircle />
                </motion.div>
              </div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Attendance Marked!
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                GPS and Face verified - Auto-approved
              </motion.p>
              <motion.div
                className="success-time"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                <FiClock />
                <span>{new Date().toLocaleTimeString()}</span>
              </motion.div>
            </motion.div>
          )}

          {/* Pending Phase */}
          {phase === "pending" && (
            <motion.div
              className="avf-pending-phase"
              key="pending"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="pending-icon-wrapper">
                <FiClock />
              </div>
              <h3>Awaiting Approval</h3>
              <p>
                {verificationResult?.verification?.gpsVerified
                  ? "GPS verified, but face match failed"
                  : verificationResult?.verification?.faceVerified
                  ? "Face verified, but GPS failed"
                  : "Verification incomplete"}
              </p>
              <p className="pending-note">
                Your teacher will review and approve your attendance.
              </p>
              <button
                className="btn-ok"
                onClick={() => onComplete && onComplete()}
              >
                OK
              </button>
            </motion.div>
          )}

          {/* Error Phase */}
          {phase === "error" && (
            <motion.div
              className="avf-error-phase"
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="error-icon-wrapper">
                <FiAlertTriangle />
              </div>
              <h3>Verification Failed</h3>
              <p>{errorMessage || "Unable to complete verification"}</p>
              <div className="error-actions">
                <button className="btn-retry" onClick={handleRetry}>
                  <FiRefreshCw /> Try Again
                </button>
                <button className="btn-cancel" onClick={onCancel}>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        {(phase === "gps" || phase === "face" || phase === "submitting") && (
          <div className="avf-footer">
            <div className="footer-item">
              <FiMapPin />
              <span>{gpsStatus === "success" ? "✓ GPS" : "GPS"}</span>
            </div>
            <div className="footer-divider" />
            <div className="footer-item">
              <MdFace />
              <span>{faceStatus === "captured" ? "✓ Face" : "Face"}</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

AttendanceVerificationFlow.propTypes = {
  session: PropTypes.object.isRequired,
  onComplete: PropTypes.func,
  onCancel: PropTypes.func,
};

export default AttendanceVerificationFlow;
