/* eslint-disable */
import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiUser, FiLogOut } from "react-icons/fi";
import Navbar from "../ui/Navbar";
import MessageCenter from "../common/MessageCenter";
import LiveSessionBar from "../common/LiveSessionBar";
import sessionStateManager from "../../services/sessionStateManager";
import "./Layout.css";

const Layout = ({ role, onLogout, children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize session state on app load/layout mount
    sessionStateManager.initialize();
  }, []);

  const handleLogout = async () => {
    // Check if user has active session
    const canLogoutResult = sessionStateManager.canLogout();

    if (!canLogoutResult.allowed) {
      // Teacher has active session - must end it first
      const endSession = window.confirm(
        `${canLogoutResult.message}\n\nDo you want to end the session and logout?`
      );

      if (endSession) {
        try {
          // Import dynamically to avoid circular dependency
          const { sessionsAPI } = await import("../../services/api");
          await sessionsAPI.end(canLogoutResult.sessionId);
          sessionStateManager.clearActiveSession();
        } catch (error) {
          console.error("Failed to end session:", error);
          alert("Failed to end session. Please try again.");
          return;
        }
      } else {
        return; // Cancel logout
      }
    } else {
      // Normal logout confirmation
      if (!window.confirm("Are you sure you want to logout?")) {
        return;
      }
    }

    // Clear session state and logout
    sessionStateManager.clearActiveSession();
    onLogout();
    navigate("/login");
  };

  // Determine home path based on role
  const homePath =
    role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";

  const handleProfileClick = () => {
    if (role === "teacher") navigate("/teacher/profile");
    else if (role === "student") navigate("/student/profile");
    else if (role === "admin") navigate("/admin");
  };

  return (
    <div className="layout">
      {/* MOBILE TOP BAR */}
      <div className="mobile-top-bar">
        <div
          className="top-bar-left"
          onClick={() => navigate(homePath)}
          style={{ cursor: "pointer" }}
        >
          <div className="brand-main">AttendSmart</div>
          <div className="brand-sub">
            {role === "admin"
              ? "Admin"
              : role === "student"
              ? "Student"
              : "Teacher"}
          </div>
        </div>
        <div className="top-bar-right">
          <button
            className="top-bar-profile"
            onClick={handleProfileClick}
            aria-label="Profile"
          >
            <FiUser />
          </button>
          <button
            className="top-bar-logout"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <FiLogOut />
          </button>
        </div>
      </div>

      {/* NEW NAVBAR COMPONENT */}
      <Navbar role={role} onLogout={handleLogout} />

      {/* LIVE SESSION BAR - Shows only for teachers when session is active */}
      {role === "teacher" && <LiveSessionBar />}

      {/* MAIN CONTENT */}
      <main className="main-content">{children}</main>

      {/* MESSAGE CENTER - Floating Chat Widget */}
      <MessageCenter />
    </div>
  );
};

export default Layout;
