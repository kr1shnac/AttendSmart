import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import "./MobileNav.css";

const MobileNav = ({ role, onLogout }) => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const studentNav = [
    { path: "/student", icon: "🏠", label: "Home" },
    { path: "/student/history", icon: "📊", label: "History" },
    { path: "/student/profile", icon: "👤", label: "Profile" },
  ];

  const teacherNav = [
    { path: "/teacher", icon: "📡", label: "Live" },
    { path: "/teacher/sessions", icon: "📅", label: "Sessions" },
    { path: "/teacher/analytics", icon: "📊", label: "Stats" },
  ];

  const navItems = role === "teacher" ? teacherNav : studentNav;

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-container">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-nav-item ${isActive(item.path) ? "active" : ""}`}
          >
            {isActive(item.path) && (
              <motion.div
                className="active-indicator"
                layoutId="activeTab"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}

        <button onClick={onLogout} className="mobile-nav-item logout-btn">
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileNav;
