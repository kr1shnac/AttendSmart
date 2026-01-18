import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { FiLogOut, FiSmartphone } from "react-icons/fi";
import "./DesktopNavigation.css";

const DesktopNavigation = ({ userRole }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const homePath =
    userRole === "admin"
      ? "/admin"
      : userRole === "teacher"
      ? "/teacher"
      : "/student";

  return (
    <nav className="desktop-navigation">
      <div
        className="nav-brand"
        onClick={() => navigate(homePath)}
        style={{ cursor: "pointer" }}
      >
        <div className="brand-logo">
          <FiSmartphone />
        </div>
        <div className="brand-text">
          <div className="brand-name">AttendSmart</div>
          <div className="brand-role">
            {userRole === "student" ? "Student" : "Teacher"}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}></div>

      <button className="logout-btn" onClick={handleLogout}>
        <FiLogOut />
        <span>Logout</span>
      </button>
    </nav>
  );
};

DesktopNavigation.propTypes = {
  userRole: PropTypes.string,
};

export default DesktopNavigation;
