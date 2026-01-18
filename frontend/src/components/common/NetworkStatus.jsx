/**
 * NetworkStatus Component - Sync Indicator
 *
 * Non-intrusive pill component showing network/sync status:
 * - Green: Online and synced
 * - Yellow: Syncing pending changes
 * - Red: Offline (changes saved locally)
 *
 * @module components/common/NetworkStatus
 * @version 1.0.0
 */

import React, { useState, useEffect } from "react";
import "./NetworkStatus.css";

// ============================================
// CONSTANTS
// ============================================

const STATUS = {
  ONLINE: "online",
  SYNCING: "syncing",
  OFFLINE: "offline",
};

const OFFLINE_STORAGE_KEY = "attendsmart_offline_queue";

// ============================================
// COMPONENT
// ============================================

const NetworkStatus = ({ className = "" }) => {
  const [status, setStatus] = useState(STATUS.ONLINE);
  const [pendingCount, setPendingCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // ============================================
  // NETWORK STATUS MONITORING
  // ============================================

  useEffect(() => {
    const updateStatus = () => {
      const isOnline = navigator.onLine;
      const queue = JSON.parse(
        localStorage.getItem(OFFLINE_STORAGE_KEY) || "[]"
      );
      const pending = queue.length;

      setPendingCount(pending);

      if (!isOnline) {
        setStatus(STATUS.OFFLINE);
        setIsVisible(true);
      } else if (pending > 0) {
        setStatus(STATUS.SYNCING);
        setIsVisible(true);
      } else {
        setStatus(STATUS.ONLINE);
        // Hide after a delay when everything is synced
        setTimeout(() => setIsVisible(false), 3000);
      }
    };

    // Initial check
    updateStatus();

    // Listen for network changes
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    // Poll for queue changes (in case sync happens elsewhere)
    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      clearInterval(interval);
    };
  }, []);

  // ============================================
  // STATUS CONFIGURATION
  // ============================================

  const getStatusConfig = () => {
    switch (status) {
      case STATUS.OFFLINE:
        return {
          dotClass: "dot-red",
          label: "Offline",
          detail: `${pendingCount} change${
            pendingCount !== 1 ? "s" : ""
          } saved locally`,
          icon: "📴",
        };
      case STATUS.SYNCING:
        return {
          dotClass: "dot-yellow",
          label: "Syncing",
          detail: `${pendingCount} pending...`,
          icon: "🔄",
        };
      case STATUS.ONLINE:
      default:
        return {
          dotClass: "dot-green",
          label: "Online",
          detail: "All changes synced",
          icon: "✓",
        };
    }
  };

  const config = getStatusConfig();

  // Don't render if not visible and online
  if (!isVisible && status === STATUS.ONLINE) {
    return null;
  }

  return (
    <div
      className={`network-status ${className} ${status}`}
      onClick={() => setShowDetails(!showDetails)}
      role="status"
      aria-live="polite"
    >
      {/* Status Pill */}
      <div className="network-status-pill">
        <span className={`status-dot ${config.dotClass}`} />
        <span className="status-label">{config.label}</span>
      </div>

      {/* Expandable Details */}
      {showDetails && (
        <div className="network-status-details">
          <span className="detail-icon">{config.icon}</span>
          <span className="detail-text">{config.detail}</span>
        </div>
      )}
    </div>
  );
};

export default NetworkStatus;
