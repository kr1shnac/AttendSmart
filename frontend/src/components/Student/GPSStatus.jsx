import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";
import gpsService from "../../services/gpsService";
import "./GPSStatus.css";

const GPSStatus = () => {
  const [gpsStatus, setGpsStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkGPS();
  }, []);

  const checkGPS = async () => {
    setLoading(true);
    const result = await gpsService.verifyLocation();
    setGpsStatus(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="gps-status glass-morphism loading">
        <div className="spinner-small"></div>
        <span>Checking GPS...</span>
      </div>
    );
  }

  // Handle connection/server errors differently from GPS errors
  if (!gpsStatus || !gpsStatus.success) {
    const isConnectionError =
      gpsStatus?.isConnectionError ||
      gpsStatus?.errorType === "network" ||
      gpsStatus?.errorType === "server" ||
      gpsStatus?.errorType === "timeout" ||
      gpsStatus?.errorType === "auth";

    // Connection/Server error - show warning, not "outside campus"
    if (isConnectionError) {
      return (
        <div className="gps-status glass-morphism warning">
          <FiWifiOff className="status-icon warning-icon" />
          <div className="status-info">
            <span className="status-title">Connection Issue</span>
            <span className="status-message">
              {gpsStatus?.error ||
                "Cannot reach server. GPS check unavailable."}
            </span>
          </div>
          <button onClick={checkGPS} className="retry-button">
            <FiRefreshCw className="button-icon" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    // GPS/Location error
    return (
      <div className="gps-status glass-morphism error">
        <FiAlertCircle className="status-icon error-icon" />
        <div className="status-info">
          <span className="status-title">GPS Unavailable</span>
          <span className="status-message">
            {gpsStatus?.error || "Enable location access in settings"}
          </span>
        </div>
        <button onClick={checkGPS} className="retry-button">
          <FiRefreshCw className="button-icon" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // Check for poor accuracy (worse than 500m is unreliable)
  const isPoorAccuracy = gpsStatus.accuracy > 500;
  const isVeryPoorAccuracy = gpsStatus.accuracy > 2000;

  // Determine the actual status to show
  let statusType = "success";
  let statusTitle = "Inside Campus";
  let statusMessage = `${gpsStatus.distance}m from center • Accuracy: ±${gpsStatus.accuracy}m`;
  let StatusIcon = FiCheckCircle;

  if (isVeryPoorAccuracy) {
    // Very poor accuracy (>2km) - show wifi/IP warning
    statusType = "warning";
    statusTitle = "Low GPS Accuracy";
    statusMessage = `Using network location (±${gpsStatus.accuracy}m). Use mobile device for accurate reading.`;
    StatusIcon = FiWifi;
  } else if (isPoorAccuracy && !gpsStatus.isWithinCampus) {
    // Poor accuracy and outside - can't be sure
    statusType = "warning";
    statusTitle = "Accuracy Too Low";
    statusMessage = `GPS accuracy ±${gpsStatus.accuracy}m is insufficient. Try outdoors or use mobile.`;
    StatusIcon = FiAlertTriangle;
  } else if (!gpsStatus.isWithinCampus) {
    // Good accuracy but outside campus
    statusType = "warning";
    statusTitle = "Outside Campus";
    statusMessage = `${gpsStatus.distance}m from center • Accuracy: ±${gpsStatus.accuracy}m`;
    StatusIcon = FiAlertTriangle;
  } else {
    // Inside campus
    statusType = "success";
    statusTitle = "Inside Campus";
    statusMessage = `${gpsStatus.distance}m from center • Accuracy: ±${gpsStatus.accuracy}m`;
    StatusIcon = FiCheckCircle;
  }

  return (
    <motion.div
      className={`gps-status glass-morphism ${statusType}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <StatusIcon className={`status-icon ${statusType}-icon`} />
      <div className="status-info">
        <span className="status-title">{statusTitle}</span>
        <span className="status-message">{statusMessage}</span>
      </div>
      <button onClick={checkGPS} className="refresh-button">
        <FiRefreshCw className="button-icon" />
      </button>
    </motion.div>
  );
};

export default GPSStatus;
