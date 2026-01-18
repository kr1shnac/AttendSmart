/**
 * Login Component
 *
 * Advanced authentication interface for AttendSmart with:
 * - Role-based login (Student/Teacher/Admin)
 * - Biometric authentication simulation for students
 * - Manual login fallback
 * - Production-ready error handling
 *
 * @version 2.0.0
 * @author AttendSmart Team
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { authAPI, biometricAPI } from "../../services/api";
import FaceLogin from "./FaceLogin";
import "./Login.css";

// ============================================
// CONSTANTS
// ============================================
const ROLES = {
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin",
};

const BIOMETRIC_STEPS = [
  { text: "Initializing scanner...", duration: 1200 },
  { text: "Locating face...", duration: 1200 },
  { text: "Face detected — analyzing...", duration: 1400 },
  { text: "Liveness check...", duration: 1400 },
];

const SCAN_INTERVAL = 1200;
const FALLBACK_DELAY = 1200;

// ============================================
// CUSTOM HOOKS
// ============================================

/**
 * Custom hook to manage interval-based effects with cleanup
 */
const useInterval = (callback, delay, shouldRun) => {
  const savedCallback = useRef(callback);
  const intervalRef = useRef(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!shouldRun || delay === null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => savedCallback.current(), delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [delay, shouldRun]);

  return intervalRef;
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Role Tab Button Component
 */
const RoleTab = React.memo(({ role, activeRole, onClick, label }) => (
  <button
    className={`tab-btn ${activeRole === role ? "active" : ""}`}
    onClick={() => onClick(role)}
    type="button"
    role="tab"
    aria-selected={activeRole === role}
    aria-controls={`${role}-panel`}
  >
    {label}
  </button>
));

RoleTab.displayName = "RoleTab";
RoleTab.propTypes = {
  role: PropTypes.string.isRequired,
  activeRole: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
};

/**
 * Background Animation Component
 */
const BackgroundAnimations = React.memo(() => (
  <div className="background-animations" aria-hidden="true">
    <div className="grid-lines" />
    <div className="floating-particles" />
  </div>
));

BackgroundAnimations.displayName = "BackgroundAnimations";

/**
 * Biometric Scanner Mini Component - Now just visual, status moved outside
 */
const BiometricScannerMini = React.memo(({ confidence }) => (
  <div className="biometric-scanner-mini" aria-hidden="true">
    <div className="scanner-animation">
      <div className="scan-line" />
    </div>
    <div className="biometric-preview-confidence">
      <div
        className="confidence-wave"
        style={{ width: `${confidence}%` }}
        role="progressbar"
        aria-valuenow={confidence}
        aria-valuemin="0"
        aria-valuemax="100"
      />
    </div>
  </div>
));

BiometricScannerMini.displayName = "BiometricScannerMini";
BiometricScannerMini.propTypes = {
  confidence: PropTypes.number.isRequired,
};

/**
 * Input Field Component with accessibility
 */
const InputField = React.memo(
  ({
    id,
    type,
    placeholder,
    value,
    onChange,
    autoComplete,
    required = true,
  }) => (
    <div className="input-group">
      <input
        id={id}
        className="aurora-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        aria-label={placeholder}
      />
    </div>
  )
);

InputField.displayName = "InputField";
InputField.propTypes = {
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  autoComplete: PropTypes.string,
  required: PropTypes.bool,
};

/**
 * Error Message Component
 */
const ErrorMessage = React.memo(({ message }) => {
  if (!message) return null;

  return (
    <div className="help-message error-message" role="alert" aria-live="polite">
      {message}
    </div>
  );
});

ErrorMessage.displayName = "ErrorMessage";
ErrorMessage.propTypes = {
  message: PropTypes.string,
};

/**
 * Biometric Modal Component
 */
const BiometricModal = React.memo(({ isOpen, confidence, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="biometric-modal"
      className="modal active"
      onClick={(e) => {
        if (e.target.id === "biometric-modal") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content glass-morphism">
        <div className="biometric-scanner">
          <h2 id="modal-title" className="visually-hidden">
            Biometric Scan in Progress
          </h2>
          <div className="face-frame">
            <div className="scanning-overlay">
              <div className="neon-halo" />
              <div className="breathing-outline" />
              <div className="scan-lines-animation" />
              <div className="particle-trails" />
            </div>

            <div className="confidence-meter">
              <div
                className="confidence-wave"
                style={{ width: `${confidence}%` }}
                role="progressbar"
                aria-valuenow={confidence}
                aria-valuemin="0"
                aria-valuemax="100"
              />
              <span className="confidence-text">
                Analyzing... {confidence}%
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              className="fallback-btn aurora-button"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

BiometricModal.displayName = "BiometricModal";
BiometricModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  confidence: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
};

// ============================================
// MAIN COMPONENT
// ============================================

const Login = ({ setIsAuthenticated, setUserRole }) => {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  // Form state
  const [role, setRole] = useState(ROLES.STUDENT);
  const [usn, setUsn] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFallbackFields, setShowFallbackFields] = useState(false);

  // Biometric simulation state
  const [biometricActive, setBiometricActive] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState(
    "Initializing scanner..."
  );
  const [scanConfidence, setScanConfidence] = useState(0);
  const [biometricAttempts, setBiometricAttempts] = useState(0);
  const biometricStepRef = useRef(0);

  // NEW: Face Login mode
  const [showFaceLogin, setShowFaceLogin] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset form when role changes
  useEffect(() => {
    setError("");
    setUsn("");
    setDob("");
    setEmail("");
    setPassword("");
  }, [role]);

  // Biometric simulation callback with attempt tracking
  const runBiometricStep = useCallback(() => {
    if (!isMountedRef.current) return;

    if (biometricStepRef.current < BIOMETRIC_STEPS.length) {
      setBiometricStatus(BIOMETRIC_STEPS[biometricStepRef.current].text);
      setScanConfidence(
        Math.min(
          60 + biometricStepRef.current * 10 + Math.floor(Math.random() * 15),
          85
        )
      );
      biometricStepRef.current++;
    } else {
      // Failed attempt
      const nextAttempt = biometricAttempts + 1;
      setBiometricAttempts(nextAttempt);

      if (nextAttempt >= 3) {
        // Max attempts reached - auto-fallback to manual
        setBiometricStatus("Biometric authentication failed after 3 attempts");
        setScanConfidence(0);
        setBiometricActive(false);

        setTimeout(() => {
          if (isMountedRef.current) {
            setShowFallbackFields(true);
          }
        }, FALLBACK_DELAY);
      } else {
        // Retry automatically
        setBiometricStatus(`Attempt ${nextAttempt} failed. Retrying...`);
        setScanConfidence(34);

        setTimeout(() => {
          if (isMountedRef.current) {
            biometricStepRef.current = 0;
            setBiometricStatus("Initializing scanner...");
            setScanConfidence(0);
          }
        }, 1500);
      }
    }
  }, [biometricAttempts]);

  // Start biometric simulation when conditions are met
  const shouldRunBiometric =
    role === ROLES.STUDENT && !showFallbackFields && biometricActive;
  useInterval(runBiometricStep, SCAN_INTERVAL, shouldRunBiometric);

  // Start biometric when student role is active (auto-start)
  useEffect(() => {
    if (role === ROLES.STUDENT && !showFallbackFields) {
      biometricStepRef.current = 0;
      setBiometricActive(true);
      setBiometricStatus("Initializing scanner...");
      setScanConfidence(0);
      setBiometricAttempts(0); // Reset attempts on role switch
    } else {
      setBiometricActive(false);
    }
  }, [role, showFallbackFields]);

  // Handle role change
  const handleRoleChange = useCallback((newRole) => {
    setRole(newRole);
    setShowFallbackFields(false);
    setBiometricActive(false);
    setBiometricAttempts(0); // Reset attempts on role change
  }, []);

  // Form submission handler
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        let payload;

        if (role === ROLES.STUDENT) {
          if (!showFallbackFields) {
            throw new Error(
              "Please use Manual Login or enable biometric on your device."
            );
          }

          // Validate inputs
          const trimmedUsn = usn.trim();
          if (!trimmedUsn) {
            throw new Error("Please enter your USN.");
          }
          if (!dob) {
            throw new Error("Please select your date of birth.");
          }

          payload = {
            role: ROLES.STUDENT,
            usn: trimmedUsn.toUpperCase(),
            dob,
          };
        } else {
          // Validate inputs
          const trimmedEmail = email.trim();
          if (!trimmedEmail) {
            throw new Error("Please enter your email.");
          }
          if (!password) {
            throw new Error("Please enter your password.");
          }

          payload = {
            role: ROLES.TEACHER,
            username: trimmedEmail,
            password,
          };
        }

        const response = await authAPI.login(payload);

        if (!isMountedRef.current) return;

        if (!response || !response.user) {
          throw new Error(
            response?.message || "Login failed. Please try again."
          );
        }

        // Store authentication data
        if (response.token) {
          localStorage.setItem("token", response.token);
        }
        localStorage.setItem("user", JSON.stringify(response.user));

        // Update app state
        setIsAuthenticated?.(true);
        setUserRole?.(response.user.role);

        // Check biometric enrollment for non-admin users
        if (response.user.role !== ROLES.ADMIN) {
          try {
            console.log("🔍 Checking enrollment status...");
            const enrollmentStatus = await biometricAPI.getEnrollmentStatus();

            // Enhanced Debug logging
            console.log(
              "📋 Full enrollment response:",
              JSON.stringify(enrollmentStatus, null, 2)
            );
            console.log(
              "📋 needsEnrollment:",
              enrollmentStatus?.data?.needsEnrollment
            );
            console.log(
              "📋 faceEnrolled:",
              enrollmentStatus?.data?.faceEnrolled
            );

            if (
              enrollmentStatus.success &&
              enrollmentStatus.data.needsEnrollment
            ) {
              console.log("🔄 Redirecting to biometric enrollment...");
              // Redirect to biometric enrollment
              navigate("/biometric-enrollment", { replace: true });
              return;
            } else {
              console.log("✅ Enrollment not needed or already complete");
            }
          } catch (enrollmentErr) {
            // If enrollment check fails, proceed to dashboard
            console.warn("⚠️ Enrollment check failed:", enrollmentErr);
          }
        }

        // Navigate based on role
        const redirectPath = {
          [ROLES.ADMIN]: "/admin",
          [ROLES.TEACHER]: "/teacher",
          [ROLES.STUDENT]: "/student",
        };

        navigate(redirectPath[response.user.role] || "/student", {
          replace: true,
        });
      } catch (err) {
        if (!isMountedRef.current) return;

        const errorMessage =
          err.message ||
          err.response?.data?.message ||
          "Login failed. Please try again.";
        setError(errorMessage);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [
      role,
      usn,
      dob,
      email,
      password,
      showFallbackFields,
      navigate,
      setIsAuthenticated,
      setUserRole,
    ]
  );

  // Memoized form visibility
  const showLoginForm = useMemo(
    () => showFallbackFields || role === ROLES.TEACHER,
    [showFallbackFields, role]
  );

  const showBiometricPanel = useMemo(
    () => role === ROLES.STUDENT && !showFallbackFields,
    [role, showFallbackFields]
  );

  return (
    <div className="login-root">
      <BackgroundAnimations />

      {/* NEW: Face Login Mode */}
      {showFaceLogin && (
        <FaceLogin
          onSwitchToManual={() => {
            setShowFaceLogin(false);
            setShowFallbackFields(true);
          }}
        />
      )}

      {/* Regular Login Screen */}
      {!showFaceLogin && (
        <div id="login-screen" className="screen active">
          <div className="login-container glass-morphism">
            {/* Header */}
            <header className="login-header">
              <h1 className="aurora-text">AttendSmart</h1>
              <p className="subtitle">Advanced Biometric Attendance System</p>
            </header>

            {/* Role Selector */}
            <div
              className="tab-selector"
              role="tablist"
              aria-label="User role selection"
            >
              <RoleTab
                role={ROLES.STUDENT}
                activeRole={role}
                onClick={handleRoleChange}
                label="Student"
              />
              <RoleTab
                role={ROLES.TEACHER}
                activeRole={role}
                onClick={handleRoleChange}
                label="Teacher"
              />
            </div>

            {/* Biometric Panel - Auto-Start Authentication */}
            {showBiometricPanel && (
              <div
                id="biometric-login"
                className="biometric-login-panel"
                role="tabpanel"
                aria-labelledby="student-tab"
              >
                <div className="biometric-header">
                  <h3 className="aurora-text">Biometric Authentication</h3>
                  <p>Scanning automatically... Please position your face</p>
                </div>

                <BiometricScannerMini confidence={scanConfidence} />

                {/* Status Display Below Scanner */}
                <div className="biometric-status-display">
                  <div className="status-text">{biometricStatus}</div>
                  {biometricAttempts > 0 && biometricAttempts < 3 && (
                    <div className="attempt-counter">
                      Attempt {biometricAttempts} of 3
                    </div>
                  )}
                  {biometricAttempts >= 3 && (
                    <div className="fallback-notice">
                      Switching to manual login...
                    </div>
                  )}
                </div>

                {/* NEW: Face Login Button */}
                <div
                  className="face-login-option"
                  style={{ marginTop: "20px", textAlign: "center" }}
                >
                  <button
                    type="button"
                    className="aurora-button"
                    onClick={() => setShowFaceLogin(true)}
                    style={{
                      background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                      padding: "12px 24px",
                      fontSize: "0.95rem",
                    }}
                  >
                    📸 Use Face Login (Real Camera)
                  </button>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "rgba(255,255,255,0.6)",
                      marginTop: "8px",
                    }}
                  >
                    Login instantly with your enrolled face
                  </p>
                </div>
              </div>
            )}

            {/* Login Form */}
            {showLoginForm && (
              <form
                id="login-form"
                className="login-form"
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="form-fields" style={{ marginBottom: 12 }}>
                  {role === ROLES.STUDENT && showFallbackFields && (
                    <>
                      <InputField
                        id="student-usn-login"
                        type="text"
                        placeholder="USN"
                        value={usn}
                        onChange={(e) => setUsn(e.target.value)}
                        autoComplete="username"
                      />
                      <InputField
                        id="student-dob-login"
                        type="date"
                        placeholder="Date of birth"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        autoComplete="bday"
                      />
                    </>
                  )}

                  {role === ROLES.TEACHER && (
                    <>
                      <InputField
                        id="email"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                      <InputField
                        id="password"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </>
                  )}
                </div>

                <button
                  className="aurora-button login-btn"
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? "Processing…" : "Access System"}
                </button>

                <ErrorMessage message={error} />
              </form>
            )}

            {/* Help Message for Students */}
            {role === ROLES.STUDENT && (
              <div className="help-message">
                <p className="contact-teacher-msg">
                  New student? <strong>Contact your teacher</strong> to create
                  your account.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

Login.propTypes = {
  setIsAuthenticated: PropTypes.func,
  setUserRole: PropTypes.func,
};

Login.defaultProps = {
  setIsAuthenticated: () => {},
  setUserRole: () => {},
};

export default Login;
