/* eslint-disable */
import React from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { FiUser, FiLogOut } from "react-icons/fi";
import "./Navbar.css";

const Navbar = ({ role, onLogout }) => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      onLogout();
      navigate("/login", { replace: true });
    }
  };

  const handleProfileClick = () => {
    if (role === "teacher") navigate("/teacher/profile");
    else if (role === "student") navigate("/student/profile");
    else if (role === "admin") navigate("/admin/profile"); // Optional for admin
  };

  // Determine home path based on role
  const homePath =
    role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";

  return (
    <nav
      className="navbar glass-morphism"
      role="navigation"
      aria-label="Main Navigation"
    >
      {/* LEFT: Logo & Role (Clickable -> Home) */}
      <div
        className="navbar-left"
        onClick={() => navigate(homePath)}
        style={{ cursor: "pointer" }}
        tabIndex={0}
        aria-label="Go to Dashboard"
      >
        <span className="navbar-logo aurora-text">AttendSmart</span>
        <span className="logo-subtitle">
          {role === "admin"
            ? "Admin"
            : role === "teacher"
            ? "Teacher"
            : "Student"}
        </span>
      </div>

      {/* RIGHT: Profile & Logout */}
      <div className="navbar-right">
        <button
          className="profile-button"
          onClick={handleProfileClick}
          aria-label="Go to Profile"
          title="Go to Profile"
        >
          <FiUser className="profile-icon" aria-hidden="true" />
          <span className="profile-name">{user.name || "User"}</span>
        </button>

        <button
          onClick={handleLogout}
          className="logout-button"
          aria-label="Logout"
          title="Logout"
        >
          <FiLogOut className="logout-icon" aria-hidden="true" />
          {/* Text hidden on mobile via CSS usually, but keeping structure clean */}
          <span className="logout-text">Logout</span>
        </button>
      </div>
    </nav>
  );
};

Navbar.propTypes = {
  role: PropTypes.string.isRequired,
  onLogout: PropTypes.func.isRequired,
};

export default Navbar;
