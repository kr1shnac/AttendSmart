import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "./ClassSelector.css";
import { API_BASE_URL } from "../../config/api";

const ClassSelector = ({ onClassSelected, onCreateNew }) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/classes/my-classes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.data.classes?.length > 0) {
          setClasses(data.data.classes);
        } else {
          setClasses([]);
        }
      } else {
        setClasses([]);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your classes...</p>
      </div>
    );
  }

  return (
    <div className="class-selector">
      <div className="selector-header">
        <h2>📚 Select a Class</h2>
        <p className="subtitle">Choose which class to start a session for</p>
      </div>

      <div className="classes-grid">
        {classes.map((cls, index) => (
          <motion.div
            key={cls._id}
            className="class-card glass-morphism"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onClassSelected(cls)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="class-header">
              <h3>{cls.subject}</h3>
              <span className="course-code">{cls.courseCode}</span>
            </div>

            <div className="class-details">
              <div className="detail-item">
                <span className="detail-icon">🎓</span>
                <span>{cls.className}</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">👥</span>
                <span>{cls.totalStudents} Students</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📆</span>
                <span>Semester {cls.semester}</span>
              </div>
            </div>

            {cls.schedule && cls.schedule.length > 0 && (
              <div className="class-schedule">
                <p className="schedule-label">Next Classes:</p>
                {cls.schedule.slice(0, 2).map((sch, idx) => (
                  <div key={idx} className="schedule-item">
                    <span>{sch.day}</span>
                    <span>•</span>
                    <span>
                      {sch.startTime} - {sch.endTime}
                    </span>
                    <span>•</span>
                    <span>{sch.room}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="select-class-btn">
              <span>Select Class</span>
              <span>→</span>
            </div>
          </motion.div>
        ))}

        {/* Create New Class Card */}
        <motion.div
          className="class-card glass-morphism create-new"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: classes.length * 0.1 }}
          onClick={onCreateNew}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="create-new-content">
            <div className="create-icon">➕</div>
            <h3>Create New Class</h3>
            <p>Set up a new class and add students</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ClassSelector;
