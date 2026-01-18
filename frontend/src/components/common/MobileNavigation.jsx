import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiLogOut, FiSmartphone } from "react-icons/fi";
import "./MobileNavigation.css";

const MobileNavigation = ({ userRole }) => {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Determine home path based on role
  const homePath =
    userRole === "admin"
      ? "/admin"
      : userRole === "teacher"
      ? "/teacher"
      : "/student";

  return (
    <>
      {/* TOP BAR WITH BRANDING */}
      <div className="mobile-top-bar">
        <div className="brand-section" onClick={() => navigate(homePath)}>
          <div className="brand-logo">
            <FiSmartphone />
          </div>
          <div className="brand-text">
            <div className="brand-name">AttendSmart</div>
            <div className="user-role">
              {userRole === "student" ? "Student" : "Teacher"}
            </div>
          </div>
        </div>

        <button className="logout-btn-mobile" onClick={handleLogout}>
          <FiLogOut className="logout-icon" />
        </button>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div
            className="logout-modal-overlay"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              className="logout-modal glass-morphism"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Confirm Logout</h3>
              <p>Are you sure you want to log out?</p>
              <div className="modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button className="confirm-btn" onClick={confirmLogout}>
                  Logout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNavigation;
