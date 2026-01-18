import React, { useState, useEffect, useCallback } from "react";
import { onConnectionChange, healthAPI } from "../../services/api";
import { CONNECTION_STATUS } from "../../config/api";
import "./ConnectionStatus.css";

/**
 * ConnectionStatus - Production-grade connection indicator
 *
 * Displays a small status indicator showing the current connection state.
 * - Polls health endpoint periodically
 * - Shows real-time connection status changes
 * - Provides user feedback during connection issues
 *
 * @param {Object} props
 * @param {boolean} props.showLatency - Show latency in ms when connected
 * @param {number} props.pollInterval - How often to check health (ms)
 */
const ConnectionStatus = ({
  showLatency = false,
  pollInterval = 30000, // 30 seconds
}) => {
  const [status, setStatus] = useState(CONNECTION_STATUS.CONNECTED);
  const [latency, setLatency] = useState(null);
  const [databaseConnected, setDatabaseConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Check health endpoint
  const checkHealth = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    try {
      const result = await healthAPI.quickPing(5000);

      if (result.online) {
        setStatus(CONNECTION_STATUS.CONNECTED);
        setLatency(result.latency);
        setDatabaseConnected(result.database);
      } else {
        setStatus(CONNECTION_STATUS.DISCONNECTED);
        setLatency(null);
        setDatabaseConnected(false);
      }
    } catch (error) {
      setStatus(CONNECTION_STATUS.ERROR);
      setLatency(null);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = onConnectionChange((newStatus) => {
      setStatus(newStatus);

      // If reconnecting or error, check health immediately
      if (
        newStatus === CONNECTION_STATUS.RECONNECTING ||
        newStatus === CONNECTION_STATUS.ERROR
      ) {
        checkHealth();
      }
    });

    return unsubscribe;
  }, [checkHealth]);

  // Periodic health check
  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up polling
    const interval = setInterval(checkHealth, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval, checkHealth]);

  // Get status display properties
  const getStatusInfo = () => {
    switch (status) {
      case CONNECTION_STATUS.CONNECTED:
        return {
          color: databaseConnected ? "connected" : "warning",
          icon: "●",
          text: databaseConnected
            ? showLatency && latency
              ? `Connected (${latency}ms)`
              : "Connected"
            : "Database reconnecting...",
        };
      case CONNECTION_STATUS.CONNECTING:
        return {
          color: "connecting",
          icon: "◐",
          text: "Connecting...",
        };
      case CONNECTION_STATUS.RECONNECTING:
        return {
          color: "reconnecting",
          icon: "◐",
          text: "Reconnecting...",
        };
      case CONNECTION_STATUS.DISCONNECTED:
        return {
          color: "disconnected",
          icon: "●",
          text: "Connection lost",
        };
      case CONNECTION_STATUS.ERROR:
        return {
          color: "error",
          icon: "●",
          text: "Connection error",
        };
      default:
        return {
          color: "unknown",
          icon: "○",
          text: "Unknown",
        };
    }
  };

  const statusInfo = getStatusInfo();
  const isHealthy = status === CONNECTION_STATUS.CONNECTED && databaseConnected;

  return (
    <div
      className={`connection-status connection-status--${statusInfo.color}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={checkHealth}
      role="status"
      aria-label={`Connection status: ${statusInfo.text}`}
    >
      <span
        className={`connection-status__icon ${isChecking ? "checking" : ""}`}
      >
        {statusInfo.icon}
      </span>

      {/* Only show text on non-healthy states or when there's room */}
      {!isHealthy && (
        <span className="connection-status__text">{statusInfo.text}</span>
      )}

      {/* Tooltip for details */}
      {showTooltip && (
        <div className="connection-status__tooltip">
          <div className="tooltip-row">
            <span>Server:</span>
            <span
              className={
                status === CONNECTION_STATUS.CONNECTED ? "good" : "bad"
              }
            >
              {status === CONNECTION_STATUS.CONNECTED ? "Online" : "Offline"}
            </span>
          </div>
          <div className="tooltip-row">
            <span>Database:</span>
            <span className={databaseConnected ? "good" : "bad"}>
              {databaseConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {latency && (
            <div className="tooltip-row">
              <span>Latency:</span>
              <span>{latency}ms</span>
            </div>
          )}
          <div className="tooltip-hint">Click to refresh</div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
