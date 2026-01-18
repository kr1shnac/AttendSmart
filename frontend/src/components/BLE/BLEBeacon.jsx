import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import bleService from "../../services/bleService";
import { iBeaconNativeService } from "../../services/native";
import "./BLEBeacon.css";
import { API_BASE_URL } from "../../config/api";

const BLEBeacon = ({ onSessionUpdate }) => {
  const [broadcasting, setBroadcasting] = useState(false);
  const [sessionData, setSessionData] = useState({
    sessionName: "",
    room: "",
    duration: 60,
  });
  const [activeSession, setActiveSession] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [connectedStudents, setConnectedStudents] = useState([]);
  const [iBeaconAvailable, setIBeaconAvailable] = useState(false);
  const [beaconConfig, setBeaconConfig] = useState(null);

  // Initialize iBeacon service on mount
  useEffect(() => {
    const initIBeacon = async () => {
      try {
        const initialized = await iBeaconNativeService.initialize();
        setIBeaconAvailable(initialized);
        if (initialized) {
          console.log("✅ iBeacon service ready for broadcasting");
        }
      } catch (error) {
        console.warn("iBeacon initialization failed:", error);
      }
    };
    initIBeacon();

    // Cleanup on unmount
    return () => {
      if (broadcasting) {
        iBeaconNativeService.stopAdvertising();
      }
    };
  }, []);

  const handleInputChange = (e) => {
    setSessionData({
      ...sessionData,
      [e.target.name]: e.target.value,
    });
  };

  const startBroadcasting = async () => {
    if (!sessionData.sessionName || !sessionData.room) {
      setMessage("❌ Please fill in session name and room");
      setMessageType("error");
      return;
    }

    try {
      setMessage("📡 Starting BLE broadcast...");
      setMessageType("info");

      // Register device first (if not exists)
      const token = localStorage.getItem("token");
      const deviceId = `teacher-beacon-${Date.now()}`;

      // Request BLE device (optional for web)
      try {
        const device = await bleService.requestDevice();
        setDeviceInfo(device);
      } catch (bleError) {
        console.log("BLE device request skipped:", bleError.message);
      }

      // Register device with backend
      const registerResponse = await fetch(
        `${API_BASE_URL}/api/ble/device/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId,
            deviceName: sessionData.sessionName + " Beacon",
            deviceType: "teacher_beacon",
            location: {
              room: sessionData.room,
            },
          }),
        }
      );

      const registerData = await registerResponse.json();

      if (registerData.status !== "success") {
        throw new Error("Device registration failed");
      }

      // Start BLE session
      const sessionResponse = await fetch(
        `${API_BASE_URL}/api/ble/session/start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId,
            sessionName: sessionData.sessionName,
            room: sessionData.room,
            duration: parseInt(sessionData.duration),
          }),
        }
      );

      const sessionResponseData = await sessionResponse.json();

      if (sessionResponseData.status === "success") {
        setActiveSession(sessionResponseData.data);

        // Start real iBeacon broadcasting if available
        if (iBeaconAvailable) {
          try {
            // Generate beacon config for this session
            const roomNumber =
              parseInt(sessionData.room.replace(/\D/g, "")) || 1;
            const config = iBeaconNativeService.generateSessionBeacon(
              sessionResponseData.data.sessionId,
              roomNumber
            );

            await iBeaconNativeService.startAdvertising(config);
            setBeaconConfig(config);
            console.log("✅ Real iBeacon broadcasting started:", config);
          } catch (ibeaconError) {
            console.warn(
              "iBeacon advertising failed, session still valid:",
              ibeaconError
            );
          }
        }

        setBroadcasting(true);
        setMessage(`✅ Broadcasting started: ${sessionData.sessionName}`);
        setMessageType("success");
        onSessionUpdate?.();
      } else {
        setMessage(`❌ ${sessionResponseData.message}`);
        setMessageType("error");
      }
    } catch (error) {
      console.error("Start broadcasting error:", error);
      setMessage("❌ Failed to start broadcasting");
      setMessageType("error");
    }
  };

  const stopBroadcasting = async () => {
    try {
      // Stop real iBeacon broadcasting
      if (iBeaconAvailable) {
        await iBeaconNativeService.stopAdvertising();
        setBeaconConfig(null);
        console.log("✅ iBeacon advertising stopped");
      }

      const token = localStorage.getItem("token");
      const deviceId =
        activeSession?.deviceId || `teacher-beacon-${Date.now()}`;

      const response = await fetch(`${API_BASE_URL}/api/ble/session/stop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setBroadcasting(false);
        setActiveSession(null);
        setConnectedStudents([]);
        setMessage("Broadcast stopped");
        setMessageType("info");
        onSessionUpdate?.();
      }
    } catch (error) {
      console.error("Stop broadcasting error:", error);
      // Still stop local state even if backend fails
      setBroadcasting(false);
      setActiveSession(null);
    }
  };

  // Note: Student connections will be populated via backend polling
  // when students scan for the beacon and report their presence
  // The simulation code has been removed in favor of real iBeacon broadcasting

  return (
    <div className="ble-beacon">
      <div className="beacon-container">
        {/* Info Card */}
        <motion.div
          className="info-card glass-morphism"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3>📡 BLE Beacon Instructions (Teacher)</h3>
          <ul>
            <li>📝 Enter session details (class name, room)</li>
            <li>📡 Start broadcasting BLE beacon signal</li>
            <li>📱 Students will detect your beacon</li>
            <li>📏 Beacon range: 10-meter radius</li>
            <li>⏱️ Monitor connected students in real-time</li>
          </ul>
        </motion.div>

        {/* Session Configuration */}
        {!broadcasting && (
          <motion.div
            className="session-config glass-morphism"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h3>🎓 Session Configuration</h3>

            <div className="form-group">
              <label>Session Name</label>
              <input
                type="text"
                name="sessionName"
                className="aurora-input"
                placeholder="e.g., Computer Science 101"
                value={sessionData.sessionName}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Room</label>
              <input
                type="text"
                name="room"
                className="aurora-input"
                placeholder="e.g., Room 301"
                value={sessionData.room}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                name="duration"
                className="aurora-input"
                placeholder="60"
                value={sessionData.duration}
                onChange={handleInputChange}
                min="15"
                max="180"
              />
            </div>

            {message && (
              <motion.div
                className={`message-box ${messageType}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {message}
              </motion.div>
            )}

            <button onClick={startBroadcasting} className="primary-button">
              <span>📡</span>
              <span>Start Broadcasting</span>
            </button>
          </motion.div>
        )}

        {/* Active Broadcasting */}
        {broadcasting && activeSession && (
          <motion.div
            className="active-broadcast glass-morphism"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="broadcast-header">
              <div className="broadcast-icon">
                <div className="pulse-ring"></div>
                <div className="pulse-ring delay-1"></div>
                <div className="pulse-ring delay-2"></div>
                📡
              </div>
              <div className="broadcast-info">
                <h3>{sessionData.sessionName}</h3>
                <p className="room-name">📍 {sessionData.room}</p>
              </div>
            </div>

            <div className="session-details">
              <div className="detail-item">
                <span className="detail-label">Session ID</span>
                <span className="detail-value">
                  {activeSession.sessionId?.substring(0, 12)}...
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Beacon UUID</span>
                <span className="detail-value">
                  {activeSession.beaconUUID?.substring(0, 18)}...
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Started</span>
                <span className="detail-value">
                  {new Date(activeSession.startTime).toLocaleTimeString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ends</span>
                <span className="detail-value">
                  {new Date(activeSession.endTime).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="broadcast-stats">
              <div className="stat">
                <span className="stat-value">{connectedStudents.length}</span>
                <span className="stat-label">Connected Students</span>
              </div>
              <div className="stat">
                <span className="stat-value">10m</span>
                <span className="stat-label">Broadcast Range</span>
              </div>
              <div className="stat">
                <span className="stat-value">Active</span>
                <span className="stat-label">Status</span>
              </div>
            </div>

            <button onClick={stopBroadcasting} className="stop-button">
              <span>✕</span>
              <span>Stop Broadcasting</span>
            </button>
          </motion.div>
        )}

        {/* Connected Students */}
        {connectedStudents.length > 0 && (
          <motion.div
            className="connected-students glass-morphism"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h3>👥 Connected Students ({connectedStudents.length})</h3>
            <div className="students-list">
              {connectedStudents.map((student) => {
                const signalQuality = bleService.getSignalQuality(student.rssi);

                return (
                  <motion.div
                    key={student.id}
                    className="student-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="student-avatar">
                      {student.name.charAt(0)}
                    </div>
                    <div className="student-info">
                      <div className="student-name">{student.name}</div>
                      <div className="student-details">
                        <span style={{ color: signalQuality.color }}>
                          {signalQuality.icon} {student.rssi} dBm
                        </span>
                        <span>📏 {student.distance}m</span>
                        <span className="connected-time">
                          {student.connectedAt}
                        </span>
                      </div>
                    </div>
                    <div className="student-status">
                      <span className="status-badge success">✓ Verified</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default BLEBeacon;
