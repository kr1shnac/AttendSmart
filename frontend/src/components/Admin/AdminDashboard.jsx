import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FiUsers,
  FiBook,
  FiBarChart2,
  FiFileText,
  FiSettings,
  FiShield,
  FiMessageSquare,
  FiDatabase,
  FiLayers,
  FiMapPin,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClasses: 0,
    activeSessions: 0,
    avgAttendance: 0,
  });

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(
        `${
          process.env.REACT_APP_API_URL || "http://localhost:5000"
        }/api/admin/stats`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalUsers: data.data?.totalUsers || 0,
          totalClasses: data.data?.activeClasses || 0,
          activeSessions: data.data?.totalClasses || 0,
          avgAttendance: 0, // Will be calculated separately if needed
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const activeModules = [
    {
      id: "users",
      title: "User Management",
      description: "Manage students, teachers, and admin accounts",
      icon: FiUsers,
      path: "/admin/users",
      color: "rgba(59, 130, 246, 0.15)", // Blue
      borderColor: "rgba(59, 130, 246, 0.4)",
    },
    {
      id: "classes",
      title: "Class Management",
      description: "Create and manage classes, subjects, and schedules",
      icon: FiBook,
      path: "/admin/classes",
      color: "rgba(16, 185, 129, 0.15)", // Green
      borderColor: "rgba(16, 185, 129, 0.4)",
    },
    {
      id: "subjects",
      title: "Subject Management",
      description: "Manage curriculum subjects and codes",
      icon: FiLayers,
      path: "/admin/subjects",
      color: "rgba(99, 102, 241, 0.15)", // Indigo
      borderColor: "rgba(99, 102, 241, 0.4)",
    },
    {
      id: "location",
      title: "Location Settings",
      description: "Set campus GPS location for attendance verification",
      icon: FiMapPin,
      path: "/admin/location",
      color: "rgba(6, 182, 212, 0.15)", // Cyan
      borderColor: "rgba(6, 182, 212, 0.4)",
    },
  ];

  const comingSoonModules = [
    {
      id: "analytics",
      title: "Analytics & Reports",
      description: "View system-wide attendance insights and trends",
      icon: FiBarChart2,
      color: "rgba(139, 92, 246, 0.15)", // Purple
      borderColor: "rgba(139, 92, 246, 0.4)",
    },
    {
      id: "logs",
      title: "Audit Logs",
      description: "Monitor system activity and security events",
      icon: FiFileText,
      color: "rgba(245, 158, 11, 0.15)", // Amber
      borderColor: "rgba(245, 158, 11, 0.4)",
    },
    {
      id: "messages",
      title: "Broadcast Messages",
      description: "Send announcements to students and teachers",
      icon: FiMessageSquare,
      color: "rgba(236, 72, 153, 0.15)", // Pink
      borderColor: "rgba(236, 72, 153, 0.4)",
    },
    {
      id: "settings",
      title: "System Settings",
      description: "Configure attendance rules and preferences",
      icon: FiSettings,
      color: "rgba(100, 116, 139, 0.15)", // Slate
      borderColor: "rgba(100, 116, 139, 0.4)",
    },
    {
      id: "security",
      title: "Security & Access",
      description: "Manage permissions and security policies",
      icon: FiShield,
      color: "rgba(239, 68, 68, 0.15)", // Red
      borderColor: "rgba(239, 68, 68, 0.4)",
    },
    {
      id: "backup",
      title: "Backup & Data",
      description: "Database backups and data management",
      icon: FiDatabase,
      color: "rgba(6, 182, 212, 0.15)", // Cyan
      borderColor: "rgba(6, 182, 212, 0.4)",
    },
  ];

  const handleCardClick = (path) => {
    if (path) navigate(path);
  };

  return (
    <div className="admin-dashboard">
      {/* Beautiful Welcome Header */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="dashboard-title">
          <span role="img" aria-label="wave" className="wave-emoji">
            👋
          </span>{" "}
          Hi, <span className="highlighted-name">{user.name || "Admin"}</span>
        </h1>
        <h1 className="role-text">You command. The system performs.</h1>
      </motion.div>

      {/* Quick Stats Section */}
      <motion.div
        className="quick-stats-grid"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <FiUsers className="stat-icon-bg" />
        </div>

        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">{stats.totalClasses}</div>
            <div className="stat-label">Active Classes</div>
          </div>
          <FiBook className="stat-icon-bg" />
        </div>

        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">{stats.activeSessions}</div>
            <div className="stat-label">Live Sessions</div>
          </div>
          <FiBarChart2 className="stat-icon-bg" />
        </div>

        <div className="stat-card-admin glass-morphism">
          <div className="stat-content">
            <div className="stat-value">{stats.avgAttendance}%</div>
            <div className="stat-label">Avg Attendance</div>
          </div>
          <FiShield className="stat-icon-bg" />
        </div>
      </motion.div>

      {/* Active Admin Modules */}
      <motion.div
        className="admin-modules-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="section-heading">Active Modules</h2>
        <div className="admin-modules-grid">
          {activeModules.map((module, index) => {
            const IconComponent = module.icon;
            return (
              <motion.div
                key={module.id}
                className="admin-module-card glass-morphism"
                style={{
                  background: module.color,
                  borderColor: module.borderColor,
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                onClick={() => handleCardClick(module.path)}
                whileHover={{
                  y: -5,
                  boxShadow: `0 10px 40px ${module.borderColor}`,
                }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="module-icon-wrapper">
                  <IconComponent className="module-icon" />
                </div>
                <div className="module-content">
                  <h3 className="module-title">{module.title}</h3>
                  <p className="module-description">{module.description}</p>
                </div>
                <div className="module-arrow">→</div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Upcoming Features Section */}
      <motion.div
        className="admin-modules-section coming-soon-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="section-heading coming-soon-heading">
          Upcoming Features
          <span className="coming-soon-subtitle">
            Features under development
          </span>
        </h2>
        <div className="admin-modules-grid">
          {comingSoonModules.map((module, index) => {
            const IconComponent = module.icon;
            return (
              <motion.div
                key={module.id}
                className="admin-module-card glass-morphism disabled"
                style={{
                  background: "rgba(100, 100, 100, 0.1)",
                  borderColor: "rgba(100, 100, 100, 0.3)",
                  opacity: 0.6,
                  cursor: "not-allowed",
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 0.6, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <div className="module-icon-wrapper">
                  <IconComponent className="module-icon" />
                </div>
                <div className="module-content">
                  <h3 className="module-title">{module.title}</h3>
                  <p className="module-description">{module.description}</p>
                </div>
                <div className="module-arrow">🔒</div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
