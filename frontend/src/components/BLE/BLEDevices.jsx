import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "./BLEDevices.css";
import { API_BASE_URL } from "../../config/api";

const BLEDevices = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/ble/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          setDevices(data.data.devices || []);
        }
      }
    } catch (error) {
      console.error("Error fetching BLE devices:", error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ble-devices">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ble-devices">
      <div className="devices-container">
        <motion.div
          className="devices-header glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3>🔌 My BLE Devices</h3>
          <p className="subtitle">Manage your registered Bluetooth devices</p>

          <button className="add-device-button">
            <span>➕</span>
            <span>Register New Device</span>
          </button>
        </motion.div>

        <div className="devices-grid">
          {devices.map((device, index) => (
            <motion.div
              key={device.id}
              className="device-card glass-morphism"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="device-header">
                <div className="device-icon">
                  {device.deviceType === "teacher_beacon" ? "📡" : "📱"}
                </div>
                <div className="device-title">
                  <h4>{device.deviceName}</h4>
                  <span className="device-type">
                    {device.deviceType.replace("_", " ")}
                  </span>
                </div>
                <div
                  className={`device-status ${
                    device.isActive ? "active" : "inactive"
                  }`}
                >
                  <span className="status-dot"></span>
                  {device.isActive ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="device-info">
                <div className="info-row">
                  <span className="info-label">Device ID:</span>
                  <span className="info-value">{device.deviceId}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Last Seen:</span>
                  <span className="info-value">
                    {new Date(device.lastSeen).toLocaleString()}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Battery:</span>
                  <span className="info-value">
                    <span className="battery-indicator">
                      🔋 {device.batteryLevel}%
                    </span>
                  </span>
                </div>
              </div>

              <div className="device-stats">
                {device.deviceType === "student_scanner" ? (
                  <>
                    <div className="stat">
                      <span className="stat-value">
                        {device.statistics.totalScans}
                      </span>
                      <span className="stat-label">Total Scans</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">
                        {new Date(
                          device.statistics.lastScan
                        ).toLocaleDateString()}
                      </span>
                      <span className="stat-label">Last Scan</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="stat">
                      <span className="stat-value">
                        {device.statistics.totalBroadcasts}
                      </span>
                      <span className="stat-label">Total Broadcasts</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">
                        {new Date(
                          device.statistics.lastBroadcast
                        ).toLocaleDateString()}
                      </span>
                      <span className="stat-label">Last Broadcast</span>
                    </div>
                  </>
                )}
              </div>

              <div className="device-actions">
                <button className="action-btn view">
                  <span>👁️</span> View Details
                </button>
                <button className="action-btn delete">
                  <span>🗑️</span> Remove
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {devices.length === 0 && (
          <motion.div
            className="no-devices glass-morphism"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="no-devices-icon">🔌</span>
            <h3>No Devices Found</h3>
            <p>Register your first BLE device to get started</p>
            <button className="primary-button">
              <span>➕</span>
              <span>Register Device</span>
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default BLEDevices;
