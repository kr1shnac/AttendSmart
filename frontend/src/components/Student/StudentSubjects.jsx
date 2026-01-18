import React from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiPhone, FiUser, FiBook, FiAward } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import "./StudentSubjects.css";

const StudentSubjects = ({ subjects, classTeacher, onClose }) => {
  // Check if we should show class teacher separately (only if NOT a subject teacher)
  const showClassTeacher = classTeacher && !classTeacher.isAlsoSubjectTeacher;

  return (
    <AnimatePresence>
      <motion.div
        className="subjects-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="subjects-modal glass-morphism"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2>Your Subjects</h2>
            <button className="close-btn" onClick={onClose}>
              <FiX />
            </button>
          </div>

          <div className="subjects-list">
            {/* Class Teacher Section - shown only if not a subject teacher */}
            {showClassTeacher && (
              <div className="class-teacher-section">
                <div className="class-teacher-label">
                  <FiAward /> Class Teacher
                </div>
                <motion.div
                  className="subject-card class-teacher-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="subject-info">
                    <div className="subject-header">
                      <h3>Class Teacher</h3>
                    </div>
                  </div>

                  <div className="teacher-section">
                    <div className="teacher-info">
                      <div className="teacher-avatar">
                        <FiUser />
                      </div>
                      <div className="teacher-details">
                        <span className="teacher-label">Mentor</span>
                        <span className="teacher-name">
                          {classTeacher.name}
                        </span>
                      </div>
                    </div>

                    <div className="contact-actions">
                      {classTeacher.phone && (
                        <>
                          <a
                            href={`tel:${classTeacher.phone}`}
                            className="contact-btn call"
                            title="Call Teacher"
                          >
                            <FiPhone />
                          </a>
                          <a
                            href={`https://wa.me/${(() => {
                              const cleanNum = classTeacher.phone.replace(
                                /\D/g,
                                ""
                              );
                              return cleanNum.length === 10
                                ? `91${cleanNum}`
                                : cleanNum;
                            })()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="contact-btn whatsapp"
                            title="Message on WhatsApp"
                          >
                            <FaWhatsapp />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
                <br />
                {/* Divider between class teacher and subjects */}
                {subjects.length > 0 && (
                  <div className="subjects-divider">
                    <span>Subject Teachers</span>
                  </div>
                )}
              </div>
            )}

            {/* Subject Teachers List */}
            {subjects.length === 0 && !showClassTeacher ? (
              <div className="no-subjects">
                <FiBook size={40} />
                <p>No subjects assigned yet.</p>
              </div>
            ) : (
              subjects.map((subject, index) => (
                <motion.div
                  key={index}
                  className="subject-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: (showClassTeacher ? 0.1 : 0) + index * 0.1,
                  }}
                >
                  <div className="subject-info">
                    <div className="subject-header">
                      <h3>{subject.subjectName}</h3>
                      <span className="subject-code">
                        {subject.subjectCode}
                      </span>
                    </div>
                    {subject.description && (
                      <p className="subject-desc">{subject.description}</p>
                    )}
                  </div>

                  <div className="teacher-section">
                    <div className="teacher-info">
                      <div className="teacher-avatar">
                        <FiUser />
                      </div>
                      <div className="teacher-details">
                        <span className="teacher-label">Instructor</span>
                        <span className="teacher-name">
                          {subject.teacherName}
                        </span>
                      </div>
                    </div>

                    <div className="contact-actions">
                      {subject.teacherPhone && (
                        <>
                          <a
                            href={`tel:${subject.teacherPhone}`}
                            className="contact-btn call"
                            title="Call Teacher"
                          >
                            <FiPhone />
                          </a>
                          <a
                            href={`https://wa.me/${(() => {
                              const cleanNum = subject.teacherPhone.replace(
                                /\D/g,
                                ""
                              );
                              return cleanNum.length === 10
                                ? `91${cleanNum}`
                                : cleanNum;
                            })()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="contact-btn whatsapp"
                            title="Message on WhatsApp"
                          >
                            <FaWhatsapp />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

StudentSubjects.propTypes = {
  subjects: PropTypes.arrayOf(
    PropTypes.shape({
      subjectName: PropTypes.string,
      subjectCode: PropTypes.string,
      description: PropTypes.string,
      teacherName: PropTypes.string,
      teacherPhone: PropTypes.string,
    })
  ).isRequired,
  classTeacher: PropTypes.shape({
    name: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
    isAlsoSubjectTeacher: PropTypes.bool,
  }),
  onClose: PropTypes.func.isRequired,
};

export default StudentSubjects;
