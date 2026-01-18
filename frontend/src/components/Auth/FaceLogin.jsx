/**
 * FaceLogin Component (MediaPipe Version)
 *
 * Allows students to login using face recognition.
 * Uses MediaPipe LivenessCheck for real human verification.
 *
 * @version 3.0.0 - MediaPipe-based (no face-api.js)
 */

import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiUser,
  FiSmile,
  FiAlertCircle,
  FiCheckCircle,
  FiCamera,
  FiRefreshCw,
  FiArrowLeft,
} from "react-icons/fi";
import LivenessCheck from "../Biometric/LivenessCheck";
import "./FaceLogin.css";

const FaceLogin = ({ onSwitchToManual }) => {
  const navigate = useNavigate();

  const [status, setStatus] = useState("Complete liveness check to login");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showLiveness, setShowLiveness] = useState(true);
  const [capturedImage, setCapturedImage] = useState(null);

  // Handle liveness completion - send captured image to backend for verification
  const handleLivenessComplete = useCallback(
    async (result) => {
      console.log("✅ Liveness complete, verifying with server...");
      setVerifying(true);
      setStatus("Verifying your identity...");
      setCapturedImage(result.imageUrl);

      try {
        // Create FormData with captured image
        const formData = new FormData();
        formData.append("faceImage", result.imageBlob, "face-login.jpg");
        formData.append("livenessScore", result.livenessScore);
        formData.append("timestamp", new Date().toISOString());

        // Call face-login API
        const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
        const response = await fetch(`${apiUrl}/api/auth/face-login`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          setStatus(`Welcome, ${data.user.name}!`);

          // Store token and user
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));

          // Redirect after success message
          setTimeout(() => {
            navigate("/student");
          }, 1500);
        } else {
          setError(data.message || "Face not recognized");
          setStatus("Face not recognized. Try again or use manual login.");
          setVerifying(false);
          setShowLiveness(false);

          // Allow retry after delay
          setTimeout(() => {
            setError("");
          }, 3000);
        }
      } catch (err) {
        console.error("[FaceLogin] Error:", err);
        setError(err.message || "Verification failed. Please try again.");
        setStatus("Error occurred");
        setVerifying(false);
        setShowLiveness(false);
      }
    },
    [navigate]
  );

  // Handle liveness error
  const handleLivenessError = useCallback((err) => {
    console.error("❌ Liveness error:", err);
    setError(err.message || "Liveness check failed");
    setShowLiveness(false);
  }, []);

  // Retry liveness check
  const handleRetry = () => {
    setError("");
    setCapturedImage(null);
    setShowLiveness(true);
    setStatus("Complete liveness check to login");
  };

  return (
    <div className="face-login">
      <motion.div
        className="face-login-container glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="face-login-header">
          <div className="face-icon-wrapper">
            <FiUser />
          </div>
          <h2>Face Login</h2>
          <p className="status-text">{status}</p>
        </div>

        <div className="camera-container">
          <div className="camera-frame">
            {/* Show LivenessCheck or result */}
            {showLiveness && !verifying ? (
              <LivenessCheck
                onComplete={handleLivenessComplete}
                onError={handleLivenessError}
                timeoutMs={45000}
                showDebug={true}
              />
            ) : capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured face"
                className="captured-preview"
              />
            ) : (
              <div className="camera-placeholder">
                <FiCamera className="placeholder-icon" />
                <p>Starting camera...</p>
              </div>
            )}

            {verifying && (
              <div className="verifying-overlay">
                <FiRefreshCw className="spinner-icon" />
                <p>Verifying...</p>
              </div>
            )}
          </div>

          {/* Status indicator */}
          {!showLiveness && !verifying && capturedImage && (
            <div className="detection-status">
              <div className="status-badge detected">
                <FiCheckCircle /> Photo Captured
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="error-toast">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="login-actions">
          {!showLiveness && !verifying && (
            <button className="primary-btn" onClick={handleRetry}>
              <FiRefreshCw />
              <span>Try Again</span>
            </button>
          )}

          <button
            className="manual-login-btn"
            onClick={() => {
              onSwitchToManual?.();
            }}
          >
            <FiArrowLeft />
            Use USN & DOB instead
          </button>
        </div>

        <div className="verification-info">
          <FiSmile className="info-icon" />
          <p>Complete the blink and head turn test to verify your identity.</p>
        </div>
      </motion.div>
    </div>
  );
};

FaceLogin.propTypes = {
  onSwitchToManual: PropTypes.func,
};

export default FaceLogin;
