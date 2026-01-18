import React, { useState, useEffect, useCallback } from "react";
import { formatEmail } from "../../utils/emailUtils";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiBook,
  FiArrowLeft,
  FiUsers,
  FiUser,
  FiUserPlus,
  FiSearch,
  FiCheck,
  FiX,
  FiEdit2,
  FiMail,
  FiSave,
  FiTrash2,
  FiPlus,
} from "react-icons/fi";
import { useParams, useNavigate } from "react-router-dom";
import { adminAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./ClassDetailManagement.css";

const ClassDetailManagement = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classData, setClassData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab state: 'students' or 'subjects'
  const [activeTab, setActiveTab] = useState("students");

  // Models state
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);

  // Selection state
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Teacher Editing state
  const [editingClassTeacher, setEditingClassTeacher] = useState(false);
  const [selectedClassTeacherId, setSelectedClassTeacherId] = useState("");

  // Subject Teacher Assignment state
  const [assignmentForm, setAssignmentForm] = useState({
    teacherId: "",
    subjectId: "",
  });

  // Fetch class details
  const fetchClassData = useCallback(async () => {
    try {
      const response = await adminAPI.getClassById(classId);
      setClassData(response.data?.class || null);
      setSelectedClassTeacherId(response.data?.class?.classTeacher?._id || "");
    } catch (error) {
      console.error("Error fetching class:", error);
      toast.error("Failed to fetch class details");
      navigate("/admin/classes");
    }
  }, [classId, navigate]);

  // Fetch initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchClassData(),
          adminAPI.getAllTeachers().then((res) => setTeachers(res.data || [])),
          adminAPI.getAllSubjects().then((res) => setSubjects(res.data || [])),
          adminAPI
            .getAllStudents({ limit: 1000, unassignedOnly: true })
            .then((res) => setAllStudents(res.data || [])), // Ideally paginate or search on demand
        ]);
      } catch (error) {
        console.error("Error loading initial data", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchClassData]);

  // ==============================
  // CLASS TEACHER HANDLERS
  // ==============================
  const handleAssignClassTeacher = async () => {
    try {
      await adminAPI.assignClassTeacher(classId, selectedClassTeacherId);
      toast.success("Class teacher updated successfully!");
      setEditingClassTeacher(false);
      await fetchClassData(); // Refresh to show changes
    } catch (error) {
      console.error("Error assigning class teacher:", error);
      toast.error("Failed to update class teacher");
    }
  };

  // ==============================
  // SUBJECT TEACHER HANDLERS
  // ==============================
  const handleAssignSubjectTeacher = async (e) => {
    e.preventDefault();
    try {
      if (!assignmentForm.teacherId || !assignmentForm.subjectId) {
        toast.error("Please select both a teacher and a subject");
        return;
      }

      await adminAPI.assignSubjectTeacher(
        classId,
        assignmentForm.teacherId,
        assignmentForm.subjectId
      );
      toast.success("Subject teacher assigned successfully");
      setShowAssignSubjectModal(false);
      setAssignmentForm({ teacherId: "", subjectId: "" }); // Reset
      await fetchClassData();
    } catch (error) {
      console.error("Error assigning subject teacher:", error);
      toast.error(
        error.response?.data?.message || "Failed to assign subject teacher"
      );
    }
  };

  const handleRemoveSubjectTeacher = async (
    teacherId,
    subjectId,
    teacherName
  ) => {
    if (!window.confirm(`Remove ${teacherName} from this subject assignment?`))
      return;
    try {
      await adminAPI.removeSubjectTeacher(classId, teacherId, subjectId);
      toast.success("Assignment removed successfully");
      await fetchClassData();
    } catch (error) {
      console.error("Error removing assignment:", error);
      toast.error("Failed to remove assignment");
    }
  };

  // ==============================
  // STUDENT HANDLERS
  // ==============================
  const handleAddStudents = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student");
      return;
    }
    try {
      await adminAPI.addStudentsToClass(classId, selectedStudents);
      toast.success(
        `${selectedStudents.length} student(s) added successfully!`
      );
      await fetchClassData();
      setShowAddStudentsModal(false);
      setSelectedStudents([]);
    } catch (error) {
      console.error("Error adding students:", error);
      toast.error(error.message || "Failed to add students");
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Remove ${studentName} from this class?`)) return;
    try {
      await adminAPI.removeStudentFromClass(classId, studentId);
      toast.success("Student removed successfully!");
      await fetchClassData();
    } catch (error) {
      console.error("Error removing student:", error);
      toast.error("Failed to remove student");
    }
  };

  // Filter students for modal
  const getAvailableStudents = () => {
    const enrolledIds =
      classData?.students?.map((s) => s.studentId?._id || s.studentId) || [];
    return allStudents.filter(
      (student) =>
        !enrolledIds.includes(student._id) &&
        (student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.usn?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  if (loading) {
    return (
      <div className="cdm-loading-container">
        <div className="cdm-spinner"></div>
        <p>Loading class details...</p>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="cdm-error-container">
        <h2>Class not found</h2>
        <button onClick={() => navigate("/admin/classes")}>
          Back to Classes
        </button>
      </div>
    );
  }

  return (
    <div className="class-detail-management">
      {/* Header */}
      <motion.div
        className="cdm-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          className="cdm-back-btn"
          onClick={() => navigate("/admin/classes")}
        >
          <FiArrowLeft /> <span>Back to Classes</span>
        </button>
        <div className="cdm-title-section">
          <div className="cdm-course-badge">Section {classData.section}</div>
          <div>
            <h1>{classData.className}</h1>
            <p className="cdm-subtitle">
              {classData.department} • {classData.academicYear}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Class Teacher Section */}
      <motion.div
        className="cdm-section glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="cdm-section-header">
          <h2>
            <FiUser /> Class Teacher
          </h2>
          {!editingClassTeacher && (
            <button
              className="cdm-edit-btn"
              onClick={() => setEditingClassTeacher(true)}
            >
              <FiEdit2 /> Change
            </button>
          )}
        </div>
        <div className="cdm-section-body">
          {editingClassTeacher ? (
            <div className="cdm-teacher-edit">
              <select
                value={selectedClassTeacherId}
                onChange={(e) => setSelectedClassTeacherId(e.target.value)}
                className="cdm-teacher-select"
              >
                <option value="">Select a teacher...</option>
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name} ({teacher.department})
                  </option>
                ))}
              </select>
              <div className="cdm-teacher-actions">
                <button
                  className="cdm-btn-save"
                  onClick={handleAssignClassTeacher}
                >
                  <FiSave /> Save
                </button>
                <button
                  className="cdm-btn-cancel"
                  onClick={() => setEditingClassTeacher(false)}
                >
                  <FiX /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="cdm-teacher-display">
              <div className="cdm-teacher-avatar">
                {(classData.classTeacher?.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="cdm-teacher-info">
                <span className="cdm-teacher-name">
                  {classData.classTeacher?.name || "Not Assigned"}
                </span>
                {classData.classTeacher && (
                  <span className="cdm-teacher-email">
                    <FiMail /> {formatEmail(classData.classTeacher.email)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="cdm-tabs">
        <button
          className={`cdm-tab ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          <FiUsers /> Students
          <span className="cdm-tab-count">
            {classData.students?.length || 0}
          </span>
        </button>
        <button
          className={`cdm-tab ${activeTab === "subjects" ? "active" : ""}`}
          onClick={() => setActiveTab("subjects")}
        >
          <FiBook /> Subject Teachers
          <span className="cdm-tab-count">
            {classData.subjectTeachers?.length || 0}
          </span>
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="cdm-content-area">
        {activeTab === "students" && (
          <motion.div
            className="cdm-tab-content glass-morphism"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="cdm-section-header">
              <h3>Enrolled Students</h3>
              <button
                className="cdm-add-btn"
                onClick={() => setShowAddStudentsModal(true)}
              >
                <FiUserPlus /> Add Students
              </button>
            </div>
            {!classData.students || classData.students.length === 0 ? (
              <div className="cdm-empty-state">
                <FiUsers className="cdm-empty-icon" />
                <p>No students enrolled in this class yet.</p>
              </div>
            ) : (
              <div className="cdm-students-grid">
                {classData.students.map((wrapper) => {
                  const student = wrapper.studentId || wrapper; // Handle populated vs unpopulated if structure varies slightly
                  return (
                    <div key={student._id} className="cdm-student-card">
                      <div className="cdm-student-avatar-sm">
                        {(student.name || "?").charAt(0)}
                      </div>
                      <div className="cdm-student-details">
                        <div className="name">{student.name}</div>
                        <div className="usn">{student.usn}</div>
                      </div>
                      <button
                        className="cdm-remove-icon-btn"
                        onClick={() =>
                          handleRemoveStudent(student._id, student.name)
                        }
                      >
                        <FiX />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "subjects" && (
          <motion.div
            className="cdm-tab-content glass-morphism"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="cdm-section-header">
              <h3>Subject Assignments</h3>
              <button
                className="cdm-add-btn"
                onClick={() => setShowAssignSubjectModal(true)}
              >
                <FiPlus /> Assign Subject Teacher
              </button>
            </div>
            {!classData.subjectTeachers ||
            classData.subjectTeachers.length === 0 ? (
              <div className="cdm-empty-state">
                <FiBook className="cdm-empty-icon" />
                <p>No subject teachers assigned yet.</p>
              </div>
            ) : (
              <div className="cdm-table-wrapper">
                <table className="cdm-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Code</th>
                      <th>Teacher</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classData.subjectTeachers.map((assignment, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="cdm-subject-name">
                            <FiBook className="icon" />
                            {assignment.subject?.subjectName ||
                              "Unknown Subject"}
                          </div>
                        </td>
                        <td>
                          <span className="cdm-code-badge">
                            {assignment.subject?.subjectCode || "N/A"}
                          </span>
                        </td>
                        <td>
                          <div className="cdm-teacher-cell">
                            <div className="avatar-xs">
                              {(assignment.teacher?.name || "?").charAt(0)}
                            </div>
                            {assignment.teacher?.name || "Unknown Teacher"}
                          </div>
                        </td>
                        <td>
                          <button
                            className="cdm-action-btn delete"
                            onClick={() =>
                              handleRemoveSubjectTeacher(
                                assignment.teacher?._id,
                                assignment.subject?._id,
                                assignment.teacher?.name
                              )
                            }
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Add Students Modal */}
      <AnimatePresence>
        {showAddStudentsModal && (
          <motion.div
            className="cdm-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddStudentsModal(false)}
          >
            <motion.div
              className="cdm-modal glass-morphism"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cdm-modal-header">
                <h2>Add Students</h2>
                <button
                  className="cdm-modal-close"
                  onClick={() => setShowAddStudentsModal(false)}
                >
                  <FiX />
                </button>
              </div>
              <div className="cdm-modal-search">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search by name or USN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="cdm-modal-body-scroll">
                {getAvailableStudents().length === 0 ? (
                  <p className="cdm-no-results">No students found.</p>
                ) : (
                  getAvailableStudents().map((student) => (
                    <div
                      key={student._id}
                      className={`cdm-student-select-item ${
                        selectedStudents.includes(student._id) ? "selected" : ""
                      }`}
                      onClick={() =>
                        setSelectedStudents((prev) =>
                          prev.includes(student._id)
                            ? prev.filter((id) => id !== student._id)
                            : [...prev, student._id]
                        )
                      }
                    >
                      <div className="check-circle">
                        {selectedStudents.includes(student._id) && <FiCheck />}
                      </div>
                      <div>
                        <div className="name">{student.name}</div>
                        <div className="meta">
                          {student.usn} • {student.branch}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="cdm-modal-footer">
                <span>{selectedStudents.length} selected</span>
                <button
                  className="cdm-btn-submit"
                  onClick={handleAddStudents}
                  disabled={selectedStudents.length === 0}
                >
                  Add Selected
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Subject Teacher Modal */}
      <AnimatePresence>
        {showAssignSubjectModal && (
          <motion.div
            className="cdm-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAssignSubjectModal(false)}
          >
            <motion.div
              className="cdm-modal glass-morphism"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cdm-modal-header">
                <h2>Assign Subject Teacher</h2>
                <button
                  className="cdm-modal-close"
                  onClick={() => setShowAssignSubjectModal(false)}
                >
                  <FiX />
                </button>
              </div>
              <form
                onSubmit={handleAssignSubjectTeacher}
                className="cdm-modal-form"
              >
                <div className="cdm-form-group">
                  <label>Subject</label>
                  <select
                    value={assignmentForm.subjectId}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        subjectId: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select Subject...</option>
                    {subjects.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.subjectName} ({sub.subjectCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cdm-form-group">
                  <label>Teacher</label>
                  <select
                    value={assignmentForm.teacherId}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        teacherId: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select Teacher...</option>
                    {teachers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cdm-modal-footer">
                  <button
                    type="button"
                    className="cdm-btn-cancel"
                    onClick={() => setShowAssignSubjectModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="cdm-btn-submit">
                    Assign
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClassDetailManagement;
