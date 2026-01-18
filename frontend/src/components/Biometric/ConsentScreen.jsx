/**
 * ConsentScreen Component
 *
 * GDPR/POPI compliant consent screen shown before biometric enrollment.
 * Uses SINGLE combined consent checkbox (GDPR best practice).
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { userAPI } from "../../services/api";
import PropTypes from "prop-types";
import "./ConsentScreen.css";

const APP_VERSION = "1.0.0";
const CONSENT_TYPE = "biometric_enrollment";

const ConsentScreen = ({ onConsentGiven, onCancel }) => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    const checkExistingConsent = async () => {
      try {
        const hasConsent = await userAPI.hasEnrollmentConsent();
        if (hasConsent) {
          onConsentGiven?.();
        }
      } catch (err) {
        console.log("Consent check failed, showing consent screen");
      } finally {
        setCheckingExisting(false);
      }
    };

    checkExistingConsent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android")) return "android";
    if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
    return "web";
  };

  const handleProceed = async () => {
    if (!consentGiven) {
      setError("Please accept the consent to proceed");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await userAPI.recordConsent({
        consentType: CONSENT_TYPE,
        appVersion: APP_VERSION,
        platform: getPlatform(),
      });

      onConsentGiven?.();
    } catch (err) {
      console.error("Failed to record consent:", err);
      setError("Failed to save consent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="consent-screen">
        <div className="consent-container glass-morphism">
          <div className="consent-loading">
            <span className="spinner"></span>
            <p>Checking consent status...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="consent-screen">
      <motion.div
        className="consent-container glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="consent-header">
          <span className="consent-icon">🔐</span>
          <h2>Biometric Data Consent</h2>
        </div>

        <div className="consent-intro">
          <p>
            Before enrolling your biometric data, please review how your data
            will be used:
          </p>
        </div>

        {/* Information bullets - no checkboxes */}
        <div className="consent-info-list">
          <div className="consent-info-item">
            <span className="info-icon">📸</span>
            <div className="info-content">
              <strong>Attendance Verification Only</strong>
              <p>
                Your face data is used solely to verify your identity during
                attendance marking.
              </p>
            </div>
          </div>

          <div className="consent-info-item">
            <span className="info-icon">🔒</span>
            <div className="info-content">
              <strong>Encrypted Storage</strong>
              <p>
                Biometric data is encrypted using AES-256. Only mathematical
                representations are stored, not actual images.
              </p>
            </div>
          </div>

          <div className="consent-info-item">
            <span className="info-icon">🗑️</span>
            <div className="info-content">
              <strong>Deletion on Account Removal</strong>
              <p>
                All biometric data is permanently deleted when you delete your
                account.
              </p>
            </div>
          </div>

          <div className="consent-info-item">
            <span className="info-icon">🚫</span>
            <div className="info-content">
              <strong>Never Shared</strong>
              <p>Your biometric data is never shared with third parties.</p>
            </div>
          </div>
        </div>

        {/* Single combined consent checkbox */}
        <div
          className={`consent-checkbox-container ${
            consentGiven ? "checked" : ""
          }`}
          onClick={() => {
            setConsentGiven(!consentGiven);
            setError("");
          }}
        >
          <div className="consent-checkbox">
            {consentGiven && <span>✓</span>}
          </div>
          <div className="consent-checkbox-label">
            <strong>
              I consent to the collection and use of my biometric data
            </strong>
            <p>for attendance verification as described above.</p>
          </div>
        </div>

        {error && <div className="consent-error">{error}</div>}

        <div className="consent-actions">
          <button
            className="consent-proceed-btn"
            onClick={handleProceed}
            disabled={!consentGiven || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Saving...
              </>
            ) : (
              <>
                Continue to Enrollment
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>

          {onCancel && (
            <button
              className="consent-cancel-btn"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="consent-footer">
          <p>
            You can withdraw consent and delete your data at any time from
            Settings.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

ConsentScreen.propTypes = {
  onConsentGiven: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};

export default ConsentScreen;
