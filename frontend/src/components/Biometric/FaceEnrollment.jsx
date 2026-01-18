import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import LivenessCheck from "./LivenessCheck";
import "./FaceEnrollment.css";

const FaceEnrollment = ({ biometricData, onUpdate }) => {
  const [enrolling, setEnrolling] = useState(false);
  const [showLiveness, setShowLiveness] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  useEffect(() => {
    // Check if user already has enrolled face
    if (biometricData?.faceData?.descriptors?.length > 0) {
      setAlreadyEnrolled(true);
      setMessage(
        "⚠️ You have already enrolled your face. Only one face per account is allowed."
      );
      setMessageType("error");
    }
  }, [biometricData]);

  const startEnrollment = () => {
    if (alreadyEnrolled) {
      setMessage("❌ Face already enrolled. Cannot enroll multiple faces.");
      setMessageType("error");
      return;
    }

    setShowLiveness(true);
    setMessage("Starting liveness verification...");
    setMessageType("info");
  };

  const handleLivenessComplete = async (result) => {
    console.log("✅ Liveness complete, enrolling face...", result);
    setEnrolling(true);
    setShowLiveness(false);
    setMessage("Processing enrollment...");
    setMessageType("info");
    setCapturedImage(result.imageUrl);

    try {
      // Create FormData with captured image
      const formData = new FormData();
      formData.append("faceImage", result.imageBlob, "face-enrollment.jpg");
      formData.append("livenessScore", result.livenessScore);
      formData.append("passiveScore", result.passiveScore);
      formData.append("activeScore", result.activeScore);
      formData.append("timestamp", new Date().toISOString());

      // Get auth token
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Call enrollment API
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/biometric/enroll-face`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage("✅ Face enrolled successfully!");
        setMessageType("success");

        // Update parent component with new biometric data
        if (onUpdate) {
          onUpdate({
            faceData: {
              descriptors: data.descriptors || [],
              enrolledAt: new Date().toISOString(),
              livenessScore: result.livenessScore,
            },
          });
        }

        // Refresh after success
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.message || "Enrollment failed");
      }
    } catch (error) {
      console.error("❌ Enrollment error:", error);
      setMessage(
        `❌ ${error.message || "Enrollment failed. Please try again."}`
      );
      setMessageType("error");
      setEnrolling(false);
      setCapturedImage(null);
    }
  };

  const handleLivenessError = (error) => {
    console.error("❌ Liveness error:", error);
    setMessage(
      `❌ ${error.message || "Liveness check failed. Please try again."}`
    );
    setMessageType("error");
    setShowLiveness(false);
    setEnrolling(false);
  };

  const handleRetry = () => {
    setMessage("");
    setMessageType("");
    setCapturedImage(null);
    setEnrolling(false);
    setShowLiveness(false);
  };

  return (
    <div className="face-enrollment">
      <motion.div
        className="enrollment-container glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="enrollment-header">
          <h2>👤 Face Enrollment</h2>
          <p className="subtitle">
            Enroll your face for secure biometric authentication
          </p>
        </div>

        {/* Status Message */}
        {message && (
          <motion.div
            className={`message-box ${messageType}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p>{message}</p>
          </motion.div>
        )}

        {/* Liveness Check */}
        {showLiveness && !enrolling && (
          <div className="liveness-container">
            <LivenessCheck
              onComplete={handleLivenessComplete}
              onError={handleLivenessError}
              timeoutMs={45000}
              showDebug={false}
            />
          </div>
        )}

        {/* Captured Image Preview */}
        {capturedImage && enrolling && (
          <motion.div
            className="preview-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <img
              src={capturedImage}
              alt="Captured face"
              className="captured-preview"
            />
            <div className="processing-overlay">
              <div className="spinner"></div>
              <p>Processing enrollment...</p>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="enrollment-actions">
          {!showLiveness && !enrolling && !alreadyEnrolled && (
            <button
              onClick={startEnrollment}
              className="primary-button"
              disabled={enrolling}
            >
              <span>📸</span>
              <span>Start Face Enrollment</span>
            </button>
          )}

          {(messageType === "error" || alreadyEnrolled) && !showLiveness && (
            <button onClick={handleRetry} className="secondary-button">
              <span>🔄</span>
              <span>Try Again</span>
            </button>
          )}
        </div>

        {/* Enrolled Face Display */}
        {biometricData?.faceData?.descriptors &&
          biometricData.faceData.descriptors.length > 0 && (
            <motion.div
              className="enrolled-faces glass-morphism"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h3>🔒 Your Registered Face</h3>
              <p className="enrolled-info">
                Enrolled on:{" "}
                {new Date(
                  biometricData.faceData.enrolledAt || Date.now()
                ).toLocaleDateString()}
              </p>
              {biometricData.faceData.livenessScore && (
                <p className="liveness-score">
                  Liveness Score: {biometricData.faceData.livenessScore}%
                </p>
              )}
              <div className="security-note">
                <p>
                  ⚠️ For security reasons, you cannot change your enrolled face.
                  Contact support if you need to update your biometric data.
                </p>
              </div>
            </motion.div>
          )}

        {/* Information Box */}
        {!alreadyEnrolled && !showLiveness && (
          <motion.div
            className="info-box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h4>📋 Enrollment Requirements:</h4>
            <ul>
              <li>✓ Good lighting conditions</li>
              <li>✓ Face clearly visible</li>
              <li>✓ No glasses or masks (if possible)</li>
              <li>✓ Complete liveness challenges (blink + head turn)</li>
              <li>✓ Hold still during capture</li>
            </ul>
            <p className="security-info">
              🔒 Your face data is encrypted and stored securely. It will only
              be used for authentication purposes.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default FaceEnrollment;
