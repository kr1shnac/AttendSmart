import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "../../services/toastService";
import "./ClassQuickSwitcher.css";

const ClassQuickSwitcher = ({ classes, currentClass, onClassChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const filteredClasses = classes.filter(
    (cls) =>
      cls.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.courseCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.className?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClassSelect = (selectedClass) => {
    onClassChange(selectedClass);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="class-quick-switcher" ref={dropdownRef}>
      <button
        className="current-class-btn glass-morphism"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="current-class-info">
          <span className="class-icon">📚</span>
          <div className="class-details">
            <span className="class-code">
              {currentClass?.courseCode || "Select Class"}
            </span>
            <span className="class-name">
              {currentClass?.subject || "No class selected"}
            </span>
          </div>
          <div className="class-meta">
            <span className="student-count">
              👥 {currentClass?.totalStudents || 0}
            </span>
          </div>
        </div>
        <motion.span
          className="switcher-arrow"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="switcher-dropdown glass-morphism"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="switcher-search">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div className="classes-list">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((cls, index) => (
                  <motion.button
                    key={cls._id || index}
                    className={`class-item ${
                      currentClass?._id === cls._id ? "active" : ""
                    }`}
                    onClick={() => handleClassSelect(cls)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{
                      x: 5,
                      backgroundColor: "rgba(0, 212, 255, 0.1)",
                    }}
                  >
                    <div className="class-item-icon">
                      {currentClass?._id === cls._id ? "✓" : "📖"}
                    </div>
                    <div className="class-item-content">
                      <div className="class-item-header">
                        <span className="item-code">{cls.courseCode}</span>
                        <span className="item-students">
                          {cls.totalStudents} students
                        </span>
                      </div>
                      <div className="class-item-name">{cls.subject}</div>
                      <div className="class-item-meta">
                        <span>{cls.className}</span>
                        {cls.section && <span>• Section {cls.section}</span>}
                      </div>
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="no-results">
                  <span className="no-results-icon">🔍</span>
                  <p>No classes found</p>
                  <small>Try a different search term</small>
                </div>
              )}
            </div>

            <div className="switcher-footer">
              <div className="footer-stats">
                <span>
                  {filteredClasses.length} of {classes.length} classes
                </span>
              </div>
              <button
                className="add-class-btn"
                onClick={() =>
                  toast.info("Go to Dashboard to create a new class")
                }
              >
                <span>➕</span>
                <span>Add New Class</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClassQuickSwitcher;
