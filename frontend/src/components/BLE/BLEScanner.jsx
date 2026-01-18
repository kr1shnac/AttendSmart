import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import bleService from "../../services/bleService";
import "./BLEScanner.css";
import { API_BASE_URL } from "../../config/api";

const BLEScanner = ({ activeSessions }) => {
  const [scanning, setScanning] = useState(false);
  const [detectedBeacons, setDetectedBeacons] = useState([]);
  const [selectedBeacon, setSelectedBeacon] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scanning) {
        stopScanning();
      }
    };
  }, [scanning]);

  const startScanning = () => {
    if (!bleService.isSupported()) {
      setMessage(
        "⚠️ Bluetooth is not supported in this browser. Use Chrome/Edge on desktop or mobile app."
      );
      setMessageType("error");
      return;
    }

    setScanning(true);
    setMessage("📡 Scanning for nearby beacons...");
    setMessageType("info");
    setDetectedBeacons([]);

    bleService.startScanning((device) => {
      setDetectedBeacons((prev) => {
        // Keep only last 5 detections
        const updated = [device, ...prev];
        return updated.slice(0, 5);
      });
    });
  };

  const stopScanning = () => {
    bleService.stopScanning();
    setScanning(false);
    setMessage("Scanning stopped");
    setMessageType("info");
  };

  const recordProximity = async (beacon) => {
    try {
      setMessage("📝 Recording proximity...");
      setMessageType("info");

      // Get the active session from props or state
      if (!activeSessions || activeSessions.length === 0) {
        setMessage("❌ No active session found");
        setMessageType("error");
        return;
      }

      const activeSession = activeSessions[0];
      const token = localStorage.getItem("token");
      const deviceId = `student-device-${Date.now()}`;

      const response = await fetch(`${API_BASE_URL}/api/ble/scan/record`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentDeviceId: deviceId,
          beaconUUID: beacon.uuid,
          beaconDeviceId: beacon.id,
          sessionId: activeSession._id,
          sessionName: activeSession.activeSession?.sessionName,
          room: activeSession.activeSession?.room,
          rssi: beacon.rssi,
          txPower: -59,
          metadata: {
            deviceType: "web",
            appVersion: "1.0.0",
          },
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setMessage(
          `✅ Proximity verified: ${data.data.distance}m away (${data.data.signalQuality})`
        );
        setMessageType("success");
        setSelectedBeacon(beacon);
      } else {
        setMessage(`❌ ${data.message}`);
        setMessageType("error");
      }
    } catch (error) {
      console.error("Record proximity error:", error);
      setMessage("❌ Failed to record proximity");
      setMessageType("error");
    }
  };

  return (
    <div className="ble-scanner">
      <div className="scanner-container">
        {/* Info Card */}
        <motion.div
          className="info-card glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3>📱 BLE Scanner Instructions</h3>
          <ul>
            <li>📡 Start scanning to detect nearby teacher beacons</li>
            <li>📏 Must be within 10 meters for valid attendance</li>
            <li>📶 Signal strength determines proximity</li>
            <li>✅ Click "Record Proximity" to verify location</li>
            <li>🔋 Battery-efficient scanning technology</li>
          </ul>

          {activeSessions.length > 0 && (
            <div className="active-sessions-info">
              <h4>🎓 Active Sessions ({activeSessions.length})</h4>
              {activeSessions.map((session, idx) => (
                <div key={idx} className="session-badge">
                  <span className="session-room">
                    📍 {session.activeSession?.room}
                  </span>
                  <span className="session-name">
                    {session.activeSession?.sessionName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Scanner Control */}
        <motion.div
          className="scanner-control glass-morphism"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="scanner-display">
            {!scanning ? (
              <div className="scanner-idle">
                <div className="radar-icon">📡</div>
                <p>BLE Scanner Ready</p>
                <p className="small-text">
                  Click "Start Scanning" to detect beacons
                </p>
              </div>
            ) : (
              <div className="scanner-active">
                <div className="radar-animation">
                  <div className="radar-sweep"></div>
                  <div className="radar-circle circle-1"></div>
                  <div className="radar-circle circle-2"></div>
                  <div className="radar-circle circle-3"></div>
                </div>
                <p className="scanning-text">Scanning for beacons...</p>
              </div>
            )}
          </div>

          {/* Message Display */}
          {message && (
            <motion.div
              className={`message-box ${messageType}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {message}
            </motion.div>
          )}

          {/* Control Buttons */}
          <div className="action-buttons">
            {!scanning ? (
              <button onClick={startScanning} className="primary-button">
                <span>📡</span>
                <span>Start Scanning</span>
              </button>
            ) : (
              <button onClick={stopScanning} className="secondary-button">
                <span>✕</span>
                <span>Stop Scanning</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Detected Beacons */}
        {detectedBeacons.length > 0 && (
          <motion.div
            className="detected-beacons glass-morphism"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h3>📡 Detected Beacons ({detectedBeacons.length})</h3>
            <div className="beacons-list">
              {detectedBeacons.map((beacon, index) => {
                const signalQuality = bleService.getSignalQuality(beacon.rssi);
                const isInRange = parseFloat(beacon.distance) <= 10;

                return (
                  <motion.div
                    key={index}
                    className={`beacon-item ${
                      isInRange ? "in-range" : "out-of-range"
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="beacon-icon">{isInRange ? "✅" : "⚠️"}</div>
                    <div className="beacon-info">
                      <div className="beacon-name">{beacon.name}</div>
                      <div className="beacon-details">
                        <span className="detail-item">
                          📏 {beacon.distance}m
                        </span>
                        <span
                          className="detail-item"
                          style={{ color: signalQuality.color }}
                        >
                          {signalQuality.icon} {beacon.rssi} dBm
                        </span>
                        <span className="detail-item">
                          {new Date(beacon.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <button
                      className={`record-button ${
                        isInRange ? "enabled" : "disabled"
                      }`}
                      onClick={() => recordProximity(beacon)}
                      disabled={!isInRange}
                    >
                      {isInRange ? "✓ Record" : "✗ Too Far"}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Proximity Visualization */}
        {selectedBeacon && (
          <motion.div
            className="proximity-viz glass-morphism"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3>📍 Proximity Verified</h3>
            <div className="proximity-circle">
              <div className="distance-marker">
                <span className="distance-value">
                  {selectedBeacon.distance}m
                </span>
                <span className="distance-label">Distance</span>
              </div>
            </div>
            <div className="proximity-details">
              <div className="detail">
                <span>Signal:</span>
                <span>{selectedBeacon.rssi} dBm</span>
              </div>
              <div className="detail">
                <span>Status:</span>
                <span className="status-success">✓ Verified</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default BLEScanner;
