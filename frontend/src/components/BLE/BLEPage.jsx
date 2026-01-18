import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BLEScanner from "./BLEScanner";
import BLEBeacon from "./BLEBeacon";
import BLEDevices from "./BLEDevices";
import "./BLEPage.css";
import { API_BASE_URL } from "../../config/api";

const BLEPage = () => {
  const [activeTab, setActiveTab] = useState("scanner"); // 'scanner', 'beacon', 'devices'
  const [userRole, setUserRole] = useState("student");
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(user.role || "student");

    fetchActiveSessions();
  }, []);

  const fetchActiveSessions = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/ble/sessions/active`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.status === "success") {
        setActiveSessions(data.data.sessions);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ble-page">
      {/* Header */}
      <motion.div
        className="ble-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="aurora-text">📡 BLE Proximity System</h1>
        <p className="subtitle">
          Bluetooth Low Energy for Location Verification
        </p>

        <div className="session-status">
          <div className="status-indicator">
            <span
              className={`status-dot ${
                activeSessions.length > 0 ? "active" : "inactive"
              }`}
            ></span>
            <span className="status-text">
              {activeSessions.length} Active{" "}
              {activeSessions.length === 1 ? "Session" : "Sessions"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        className="tab-navigation glass-morphism"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <button
          className={`tab-button ${activeTab === "scanner" ? "active" : ""}`}
          onClick={() => setActiveTab("scanner")}
        >
          <span className="tab-icon">📱</span>
          <span>BLE Scanner</span>
          <span className="tab-subtitle">Detect Beacons</span>
        </button>

        {userRole === "teacher" && (
          <button
            className={`tab-button ${activeTab === "beacon" ? "active" : ""}`}
            onClick={() => setActiveTab("beacon")}
          >
            <span className="tab-icon">📡</span>
            <span>BLE Beacon</span>
            <span className="tab-subtitle">Broadcast Session</span>
          </button>
        )}

        <button
          className={`tab-button ${activeTab === "devices" ? "active" : ""}`}
          onClick={() => setActiveTab("devices")}
        >
          <span className="tab-icon">🔌</span>
          <span>My Devices</span>
          <span className="tab-subtitle">Manage Devices</span>
        </button>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "scanner" && (
          <motion.div
            key="scanner"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <BLEScanner
              activeSessions={activeSessions}
              onSessionUpdate={fetchActiveSessions}
            />
          </motion.div>
        )}

        {activeTab === "beacon" && (
          <motion.div
            key="beacon"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <BLEBeacon onSessionUpdate={fetchActiveSessions} />
          </motion.div>
        )}

        {activeTab === "devices" && (
          <motion.div
            key="devices"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <BLEDevices />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BLEPage;
