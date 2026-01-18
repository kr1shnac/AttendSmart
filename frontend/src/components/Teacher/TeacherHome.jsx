import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FiBook, FiCalendar, FiBarChart2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import GPSStatus from "../Student/GPSStatus";
import "./TeacherHome.css";

const TeacherHome = () => {
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const teacherModules = [
    {
      id: "classes",
      title: "Classes",
      description: "Manage your classes, view students, and track performance",
      icon: FiBook,
      path: "/teacher/classes",
      color: "rgba(59, 130, 246, 0.15)", // Blue
      borderColor: "rgba(59, 130, 246, 0.4)",
      disabled: false,
    },
    {
      id: "sessions",
      title: "Sessions",
      description:
        "Schedule sessions, take attendance, and monitor live classes",
      icon: FiCalendar,
      path: "/teacher/sessions",
      color: "rgba(16, 185, 129, 0.15)", // Green
      borderColor: "rgba(16, 185, 129, 0.4)",
      disabled: false,
    },
    {
      id: "analysis",
      title: "Analysis",
      description:
        "View attendance analytics, insights, and performance trends",
      icon: FiBarChart2,
      path: "/teacher/analytics",
      color: "rgba(139, 92, 246, 0.15)", // Purple
      borderColor: "rgba(139, 92, 246, 0.4)",
      disabled: true, // Disabled - Coming soon
    },
  ];

  const handleCardClick = (path, disabled) => {
    if (disabled) return;
    navigate(path);
  };

  return (
    <div className="teacher-home">
      {/* Welcome Header */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="dashboard-title">
          <span role="img" aria-label="wave" className="wave-emoji">
            👋
          </span>{" "}
          Hi, <span className="highlighted-name">{user.name || "Teacher"}</span>
          !
        </h1>
        <h1 className="role-text">
          Teach. Guide. Inspire. We’ll handle the rest!
        </h1>
      </motion.div>

      {/* GPS Status - Teacher checks against campus location */}
      <GPSStatus />

      {/* Navigation Cards */}
      <motion.div
        className="teacher-modules-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="teacher-modules-grid">
          {teacherModules.map((module, index) => {
            const IconComponent = module.icon;
            return (
              <motion.div
                key={module.id}
                className={`teacher-module-card glass-morphism ${
                  module.disabled ? "disabled" : ""
                }`}
                style={{
                  background: module.disabled
                    ? "rgba(100, 100, 100, 0.1)"
                    : module.color,
                  borderColor: module.disabled
                    ? "rgba(100, 100, 100, 0.3)"
                    : module.borderColor,
                  opacity: module.disabled ? 0.6 : 1,
                  cursor: module.disabled ? "not-allowed" : "pointer",
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: module.disabled ? 0.6 : 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                onClick={() => handleCardClick(module.path, module.disabled)}
                whileHover={
                  module.disabled
                    ? {}
                    : {
                        y: -8,
                        boxShadow: `0 15px 50px ${module.borderColor}`,
                      }
                }
                whileTap={module.disabled ? {} : { scale: 0.98 }}
              >
                <div className="module-icon-wrapper">
                  <IconComponent className="module-icon" />
                </div>
                <div className="module-content">
                  <h3 className="module-title">
                    {module.title}
                    {module.disabled && (
                      <span className="coming-soon-badge">Coming Soon</span>
                    )}
                  </h3>
                  <p className="module-description">{module.description}</p>
                </div>
                <div className="module-arrow">
                  {module.disabled ? "🔒" : "→"}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default TeacherHome;
