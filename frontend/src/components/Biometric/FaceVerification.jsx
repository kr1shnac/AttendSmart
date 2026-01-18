import React, { useState } from "react";
import { motion } from "framer-motion";
import LivenessCheck from "./LivenessCheck";
import "./FaceVerification.css";

const FaceVerification = ({ biometricData }) => {
  const [verifying, setVerifying] = useState(false);
  const [showLiveness, setShowLiveness] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);

  const startVerification = () => {
    // Check if face is enrolled
    if (
      !biometricData?.faceData?.descriptors ||
      biometricData.faceData.descriptors.length === 0
    ) {
      setMessage("❌ No face enrolled. Please enroll your face first.");
      setMessageType("error");
      return;
    }

    setShowLiveness(true);
    setVerificationResult(null);
    setMessage("Starting liveness verification...");
    setMessageType("info");
  };

  const handleLivenessComplete = async (result) => {
    console.log("✅ Liveness complete, verifying identity...", result);
    setVerifying(true);
    setShowLiveness(false);
    setMessage("Verifying your identity...");
    setMessageType("info");
    setCapturedImage(result.imageUrl);

    try {
      // Create FormData with captured image
      const formData = new FormData();
      formData.append("faceImage", result.imageBlob, "face-verification.jpg");
      formData.append("livenessScore", result.livenessScore);
      formData.append("timestamp", new Date().toISOString());

      // Get auth token
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Call verification API
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/biometric/verify-face`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.verified) {
        setVerificationResult({
          success: true,
          confidence: data.confidence || result.livenessScore,
          message: "Identity verified successfully!",
        });
        setMessage("✅ Identity verified successfully!");
        setMessageType("success");
      } else {
        setVerificationResult({
          success: false,
          confidence: data.confidence || 0,
          message: data.message || "Face does not match enrolled data",
        });
        setMessage(`❌ ${data.message || "Verification failed"}`);
        setMessageType("error");
      }
    } catch (error) {
      console.error("❌ Verification error:", error);
      setVerificationResult({
        success: false,
        confidence: 0,
        message: error.message || "Verification failed",
      });
      setMessage(
        `❌ ${error.message || "Verification failed. Please try again."}`
      );
      setMessageType("error");
    } finally {
      setVerifying(false);
    }
  };

  const handleLivenessError = (error) => {
    console.error("❌ Liveness error:", error);
    setMessage(
      `❌ ${error.message || "Liveness check failed. Please try again."}`
    );
    setMessageType("error");
    setShowLiveness(false);
    setVerifying(false);
  };

  const handleRetry = () => {
    setMessage("");
    setMessageType("");
    setCapturedImage(null);
    setVerifying(false);
    setShowLiveness(false);
    setVerificationResult(null);
  };

  return (
    <div className="face-verification">
      <motion.div
        className="verification-container glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="verification-header">
          <h2>🔐 Face Verification</h2>
          <p className="subtitle">
            Verify your identity using facial recognition
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
        {showLiveness && !verifying && (
          <div className="liveness-container">
            <LivenessCheck
              onComplete={handleLivenessComplete}
              onError={handleLivenessError}
              timeoutMs={45000}
              showDebug={false}
            />
          </div>
        )}

        {/* Verification Result */}
        {verificationResult && (
          <motion.div
            className={`verification-result ${
              verificationResult.success ? "success" : "failure"
            }`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="result-icon">
              {verificationResult.success ? "✅" : "❌"}
            </div>
            <h3>{verificationResult.message}</h3>
            {verificationResult.confidence > 0 && (
              <div className="confidence-display">
                <p>Confidence: {verificationResult.confidence}%</p>
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${verificationResult.confidence}%` }}
                  />
                </div>
              </div>
            )}
            {capturedImage && (
              <div className="result-image">
                <img src={capturedImage} alt="Verification capture" />
              </div>
            )}
          </motion.div>
        )}

        {/* Processing Overlay */}
        {verifying && capturedImage && (
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
              <p>Verifying identity...</p>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="verification-actions">
          {!showLiveness && !verifying && (
            <button
              onClick={startVerification}
              className="primary-button"
              disabled={
                !biometricData?.faceData?.descriptors ||
                biometricData.faceData.descriptors.length === 0
              }
            >
              <span>🔐</span>
              <span>Verify Identity</span>
            </button>
          )}

          {(verificationResult || messageType === "error") &&
            !showLiveness &&
            !verifying && (
              <button onClick={handleRetry} className="secondary-button">
                <span>🔄</span>
                <span>Try Again</span>
              </button>
            )}
        </div>

        {/* Information Box */}
        {!showLiveness && !verificationResult && (
          <motion.div
            className="info-box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h4>📋 Verification Process:</h4>
            <ul>
              <li>✓ Position your face in the camera</li>
              <li>✓ Complete liveness challenges</li>
              <li>✓ System compares with enrolled face</li>
              <li>✓ Instant verification result</li>
            </ul>
            <p className="security-info">
              🔒 Verification is performed securely using encrypted face data.
              Your biometric information never leaves the secure system.
            </p>
          </motion.div>
        )}

        {/* Enrollment Status */}
        {biometricData?.faceData?.descriptors &&
          biometricData.faceData.descriptors.length > 0 && (
            <div className="enrollment-status">
              <p className="status-text">
                ✅ Face enrolled on{" "}
                {new Date(
                  biometricData.faceData.enrolledAt || Date.now()
                ).toLocaleDateString()}
              </p>
            </div>
          )}

        {!biometricData?.faceData?.descriptors ||
          (biometricData.faceData.descriptors.length === 0 && (
            <div className="enrollment-warning">
              <p>
                ⚠️ No face enrolled. Please enroll your face in the Biometric
                Enrollment section first.
              </p>
            </div>
          ))}
      </motion.div>
    </div>
  );
};

export default FaceVerification;
