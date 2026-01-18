import React from "react";
import { motion } from "framer-motion";
import "./BiometricStats.css";

const BiometricStats = ({ biometricData }) => {
  if (!biometricData) {
    return (
      <div className="biometric-stats">
        <div className="no-data glass-morphism">
          <span className="no-data-icon">📊</span>
          <h3>No Biometric Data</h3>
          <p>Please enroll your face first to see statistics</p>
        </div>
      </div>
    );
  }

  const stats = biometricData.statistics || {};
  const faceData = biometricData.faceData || {};

  return (
    <div className="biometric-stats">
      <motion.div
        className="stats-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="stat-card glass-morphism">
          <div className="stat-icon">👤</div>
          <h3>{faceData.descriptors?.length || 0}</h3>
          <p>Enrolled Faces</p>
        </div>

        <div className="stat-card glass-morphism">
          <div className="stat-icon">🔍</div>
          <h3>{stats.totalFaceScans || 0}</h3>
          <p>Total Face Scans</p>
        </div>

        <div className="stat-card glass-morphism">
          <div className="stat-icon">✅</div>
          <h3>{stats.successfulFaceScans || 0}</h3>
          <p>Successful Scans</p>
        </div>

        <div className="stat-card glass-morphism">
          <div className="stat-icon">📈</div>
          <h3>{stats.averageConfidence?.toFixed(1) || 0}%</h3>
          <p>Average Confidence</p>
        </div>
      </motion.div>

      <motion.div
        className="info-section glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3>Enrollment Information</h3>
        <div className="info-row">
          <span className="info-label">Enrollment Date:</span>
          <span className="info-value">
            {biometricData.enrollmentDate
              ? new Date(biometricData.enrollmentDate).toLocaleDateString()
              : "Not enrolled"}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Last Verified:</span>
          <span className="info-value">
            {faceData.lastVerified
              ? new Date(faceData.lastVerified).toLocaleString()
              : "Never"}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Verification Count:</span>
          <span className="info-value">{faceData.verificationCount || 0}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Status:</span>
          <span
            className={`status-badge ${
              biometricData.isActive ? "active" : "inactive"
            }`}
          >
            {biometricData.isActive ? "✓ Active" : "✗ Inactive"}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default BiometricStats;
