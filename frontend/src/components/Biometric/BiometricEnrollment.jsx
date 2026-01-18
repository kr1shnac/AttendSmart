/**
 * BiometricEnrollment Component (MediaPipe Version)
 *
 * Face enrollment wizard using MediaPipe LivenessCheck.
 * Captures face image after liveness verification and sends to backend.
 *
 * @version 4.0.0 - MediaPipe-based (no face-api.js)
 */

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiShield,
  FiSmile,
  FiArrowRight,
  FiLock,
  FiRefreshCw,
} from "react-icons/fi";
import { biometricAPI } from "../../services/api";
import ConsentScreen from "./ConsentScreen";
import LivenessCheck from "./LivenessCheck";
import toast from "../../services/toastService";
import "./BiometricEnrollment.css";

// Enrollment steps
const STEPS = {
  CONSENT: -1,
  WELCOME: 0,
  FACE: 1,
  COMPLETE: 2,
};

const BiometricEnrollment = () => {
  const navigate = useNavigate();

  // Step state
  const [currentStep, setCurrentStep] = useState(STEPS.CONSENT);

  // Capture state
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [livenessVerified, setLivenessVerified] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLiveness, setShowLiveness] = useState(false);

  // Handle liveness check completion
  const handleLivenessComplete = useCallback((result) => {
    console.log("✅ Liveness complete:", result);
    setLivenessVerified(true);
    setCapturedImage(result.imageUrl);
    setCapturedBlob(result.imageBlob);
    setShowLiveness(false);
    toast.success("Face captured successfully!");
  }, []);

  // Handle liveness error
  const handleLivenessError = useCallback((err) => {
    console.error("❌ Liveness error:", err);
    setError(err.message || "Liveness check failed");
    setShowLiveness(false);
  }, []);

  // Enroll face to backend
  const handleEnrollFace = async () => {
    if (!capturedBlob) {
      setError("Please capture your face first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create FormData with image
      const formData = new FormData();
      formData.append("faceImage", capturedBlob, "face-enrollment.jpg");
      formData.append("livenessVerified", "true");
      formData.append("captureMethod", "mediapipe_liveness");
      formData.append("timestamp", new Date().toISOString());

      // Send to backend for encoding
      const response = await biometricAPI.enrollFaceImage(formData);

      if (response.success) {
        toast.success("Face enrolled successfully!");
        setCapturedImage(null);
        setCapturedBlob(null);
        setCurrentStep(STEPS.COMPLETE);
      } else {
        throw new Error(response.message || "Enrollment failed");
      }
    } catch (e) {
      console.error("Enrollment error:", e);
      setError(e.message || "Enrollment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setLivenessVerified(false);
    setError("");
    setShowLiveness(true);
  };

  const finishEnrollment = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    navigate(user.role === "teacher" ? "/teacher" : "/student");
  };

  // ============== RENDER COMPONENTS ==============

  const renderWelcome = () => (
    <motion.div
      className="enrollment-step welcome-step"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="welcome-icon-wrapper">
        <FiShield className="welcome-icon" />
      </div>
      <h2>Secure Face Verification</h2>
      <p className="welcome-subtitle">
        Let&apos;s set up your face ID for quick and secure attendance
      </p>

      <div className="features-list">
        <div className="feature-item">
          <div className="feature-icon-wrapper">
            <FiCamera />
          </div>
          <div className="feature-text">
            <strong>Real-time Detection</strong>
            <span>AI-powered face recognition</span>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">
            <FiSmile />
          </div>
          <div className="feature-text">
            <strong>Liveness Check</strong>
            <span>Blink & head turn verification</span>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">
            <FiLock />
          </div>
          <div className="feature-text">
            <strong>Privacy First</strong>
            <span>Only face ID stored, not photos</span>
          </div>
        </div>
      </div>

      <button
        className="primary-btn"
        onClick={() => setCurrentStep(STEPS.FACE)}
      >
        <span>Get Started</span>
        <FiArrowRight />
      </button>
    </motion.div>
  );

  const renderFaceStep = () => (
    <motion.div
      className="enrollment-step face-step"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="step-header">
        <div className="step-number">
          <FiCamera />
        </div>
        <h2>Face Registration</h2>
      </div>
      <p className="step-description">
        {capturedImage
          ? "Review your photo below"
          : showLiveness
          ? "Complete the liveness check"
          : "Start camera to begin"}
      </p>

      <div className="camera-container">
        <div className="camera-frame">
          {/* Show LivenessCheck or captured image */}
          {showLiveness ? (
            <LivenessCheck
              onComplete={handleLivenessComplete}
              onError={handleLivenessError}
              timeoutMs={45000}
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
              <p>Camera inactive</p>
            </div>
          )}
        </div>

        {/* Status badges */}
        {capturedImage && (
          <div className="detection-status">
            <div className="status-badge ready">
              <FiCheckCircle /> Photo Ready
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-toast">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      <div className="action-buttons">
        {!showLiveness && !capturedImage && (
          <button
            className="primary-btn"
            onClick={() => setShowLiveness(true)}
            disabled={loading}
          >
            <FiCamera />
            <span>Start Camera</span>
          </button>
        )}

        {capturedImage && (
          <>
            <button
              className="primary-btn"
              onClick={handleEnrollFace}
              disabled={loading}
            >
              <FiCheck />
              <span>{loading ? "Saving..." : "Save & Continue"}</span>
            </button>
            <button
              className="secondary-btn"
              onClick={handleRetake}
              disabled={loading}
            >
              <FiRefreshCw />
              <span>Retake Photo</span>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );

  const renderComplete = () => (
    <motion.div
      className="enrollment-step complete-step"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="success-animation">
        <FiCheckCircle className="success-icon" />
      </div>
      <h2>All Set!</h2>
      <p className="success-message">
        Your face ID is now registered. You can mark attendance securely.
      </p>
      <button className="primary-btn" onClick={finishEnrollment}>
        <span>Go to Dashboard</span>
        <FiArrowRight />
      </button>
    </motion.div>
  );

  const renderContent = () => {
    switch (currentStep) {
      case STEPS.CONSENT:
        return (
          <ConsentScreen
            onConsentGiven={() => setCurrentStep(STEPS.WELCOME)}
            onCancel={finishEnrollment}
          />
        );
      case STEPS.WELCOME:
        return renderWelcome();
      case STEPS.FACE:
        return renderFaceStep();
      case STEPS.COMPLETE:
        return renderComplete();
      default:
        return null;
    }
  };

  return (
    <div className="biometric-enrollment">
      {currentStep === STEPS.CONSENT ? (
        renderContent()
      ) : (
        <div className="enrollment-container glass-morphism">
          {/* Progress Bar */}
          <div className="progress-bar">
            {[1, 2].map((i) => (
              <div
                key={i}
                className={`progress-step ${currentStep >= i ? "active" : ""} ${
                  currentStep === i ? "current" : ""
                }`}
              >
                <div className="step-dot">
                  {currentStep > i ? <FiCheck /> : i}
                </div>
              </div>
            ))}
            <div className="progress-line">
              <div
                className="progress-fill"
                style={{ width: `${(currentStep / 2) * 100}%` }}
              />
            </div>
          </div>
          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default BiometricEnrollment;
