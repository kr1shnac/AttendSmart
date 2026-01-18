import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FaceEnrollment from "./FaceEnrollment";
import FaceVerification from "./FaceVerification";
import BiometricStats from "./BiometricStats";
import "./BiometricPage.css";
import { API_BASE_URL } from "../../config/api";

const BiometricPage = () => {
  const [activeTab, setActiveTab] = useState("enroll"); // 'enroll', 'verify', 'stats'
  const [biometricData, setBiometricData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's biometric data
  const fetchBiometricData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/biometric/data`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.status === "success") {
        setBiometricData(data.data.biometricData);
      }
    } catch (error) {
      console.log("No biometric data found yet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBiometricData();
  }, []);

  const handleDataUpdate = () => {
    fetchBiometricData();
  };

  if (loading) {
    return (
      <div className="biometric-loading">
        <div className="spinner"></div>
        <p>Loading biometric system...</p>
      </div>
    );
  }

  return (
    <div className="biometric-page">
      {/* Header */}
      <motion.div
        className="biometric-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="aurora-text">Biometric System</h1>
        <p className="subtitle">Advanced Face Recognition & Verification</p>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        className="tab-navigation glass-morphism"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <button
          className={`tab-button ${activeTab === "enroll" ? "active" : ""}`}
          onClick={() => setActiveTab("enroll")}
        >
          <span className="tab-icon">📸</span>
          <span>Enroll Face</span>
        </button>

        <button
          className={`tab-button ${activeTab === "verify" ? "active" : ""}`}
          onClick={() => setActiveTab("verify")}
        >
          <span className="tab-icon">✓</span>
          <span>Verify Face</span>
        </button>

        <button
          className={`tab-button ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveTab("stats")}
        >
          <span className="tab-icon">📊</span>
          <span>Statistics</span>
        </button>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "enroll" && (
          <motion.div
            key="enroll"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <FaceEnrollment
              biometricData={biometricData}
              onUpdate={handleDataUpdate}
            />
          </motion.div>
        )}

        {activeTab === "verify" && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <FaceVerification
              biometricData={biometricData}
              onUpdate={handleDataUpdate}
            />
          </motion.div>
        )}

        {activeTab === "stats" && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <BiometricStats biometricData={biometricData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BiometricPage;
