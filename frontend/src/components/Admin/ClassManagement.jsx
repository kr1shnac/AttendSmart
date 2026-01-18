import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiBook,
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiX,
  FiCheck,
  FiArrowLeft,
  FiUsers,
  FiUser,
  FiCalendar,
  FiHash,
  FiChevronRight,
  FiLayers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./ClassManagement.css";

const ClassManagement = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editingClass, setEditingClass] = useState(null);

  const [classForm, setClassForm] = useState({
    className: "",
    section: "A",
    academicYear: "2024-25",
    department: "Computer Science",
    classTeacherId: "",
    description: "",
  });

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    try {
      const response = await adminAPI.getAllClasses({ search: searchQuery });
      setClasses(response.data || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast.error("Failed to fetch classes");
    }
  }, [searchQuery]);

  // Fetch teachers for dropdown
  const fetchTeachers = useCallback(async () => {
    try {
      const response = await adminAPI.getAllTeachers();
      setTeachers(response.data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchClasses(), fetchTeachers()]);
      setLoading(false);
    };
    loadData();
  }, [fetchClasses, fetchTeachers]);

  // Reset form
  const resetForm = () => {
    setClassForm({
      className: "",
      section: "A",
      academicYear: "2024-25",
      department: "Computer Science",
      classTeacherId: "",
      description: "",
    });
    setEditingClass(null);
  };

  // Open modal
  const openModal = (mode, classData = null) => {
    setModalMode(mode);
    if (mode === "edit" && classData) {
      setEditingClass(classData);
      setClassForm({
        className: classData.className || "",
        section: classData.section || "A",
        academicYear: classData.academicYear || "2024-25",
        department: classData.department || "Computer Science",
        classTeacherId: classData.classTeacher?._id || "",
        description: classData.description || "",
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === "add") {
        await adminAPI.createClass(classForm);
        toast.success("Class created successfully!");
      } else {
        await adminAPI.updateClass(editingClass._id, classForm);
        toast.success("Class updated successfully!");
      }
      await fetchClasses();
      closeModal();
    } catch (error) {
      console.error("Error saving class:", error);
      toast.error(error.message || "Failed to save class");
    }
  };

  // Handle delete
  const handleDelete = async (classData) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${classData.className} - ${classData.section}?`
      )
    ) {
      return;
    }
    try {
      await adminAPI.deleteClass(classData._id);
      toast.success("Class deleted successfully!");
      await fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Failed to delete class");
    }
  };

  // Navigate to class detail
  const handleClassClick = (classData) => {
    navigate(`/admin/classes/${classData._id}`);
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.className?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="class-management">
      {/* Header */}
      <motion.div
        className="cm-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className="cm-back-btn" onClick={() => navigate("/admin")}>
          <FiArrowLeft />
          <span>Back to Dashboard</span>
        </button>
        <div className="cm-title-section">
          <FiBook className="cm-title-icon" />
          <h1>Class Management</h1>
        </div>
      </motion.div>

      {/* Actions Bar */}
      <motion.div
        className="cm-actions-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="cm-search-box">
          <FiSearch className="cm-search-icon" />
          <input
            type="text"
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="cm-add-btn" onClick={() => openModal("add")}>
          <FiPlus />
          <span>Create Class</span>
        </button>
      </motion.div>

      {/* Classes Grid */}
      <motion.div
        className="cm-classes-grid"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="cm-loading">
            <div className="cm-spinner"></div>
            <p>Loading classes...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="cm-empty">
            <FiBook className="cm-empty-icon" />
            <h3>No classes found</h3>
            <p>
              {searchQuery
                ? "Try adjusting your search"
                : 'Click "Create Class" to get started'}
            </p>
          </div>
        ) : (
          filteredClasses.map((classData, index) => (
            <motion.div
              key={classData._id}
              className="cm-class-card glass-morphism"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -5 }}
            >
              <div className="cm-card-header">
                <div className="cm-course-code">
                  Section {classData.section}
                </div>
                <div className="cm-card-actions">
                  <button
                    className="cm-action-btn edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal("edit", classData);
                    }}
                    title="Edit"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    className="cm-action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(classData);
                    }}
                    title="Delete"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              <div
                className="cm-card-body"
                onClick={() => handleClassClick(classData)}
              >
                <h3 className="cm-class-name">{classData.className}</h3>
                <p className="cm-subject">{classData.department}</p>

                <div className="cm-class-meta">
                  <div className="cm-meta-item">
                    <FiCalendar />
                    <span>{classData.academicYear}</span>
                  </div>
                  <div className="cm-meta-item">
                    <FiUsers />
                    <span>{classData.students?.length || 0} Students</span>
                  </div>
                </div>

                <div className="cm-teacher-info">
                  <FiUser />
                  <span>
                    {classData.classTeacher?.name || "No Class Teacher"}
                  </span>
                </div>
              </div>

              <div
                className="cm-card-footer"
                onClick={() => handleClassClick(classData)}
              >
                <span>Manage Subjects & Students</span>
                <FiChevronRight />
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="cm-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="cm-modal glass-morphism"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cm-modal-header">
                <h2>{modalMode === "add" ? "Create" : "Edit"} Class</h2>
                <button className="cm-modal-close" onClick={closeModal}>
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="cm-modal-form">
                <div className="cm-form-group">
                  <label>
                    <FiBook /> Class Name *
                  </label>
                  <input
                    type="text"
                    value={classForm.className}
                    onChange={(e) =>
                      setClassForm({
                        ...classForm,
                        className: e.target.value,
                      })
                    }
                    placeholder="e.g., CSE 5th Semester"
                    required
                  />
                </div>

                <div className="cm-form-row">
                  <div className="cm-form-group">
                    <label>
                      <FiHash /> Section
                    </label>
                    <select
                      value={classForm.section}
                      onChange={(e) =>
                        setClassForm({
                          ...classForm,
                          section: e.target.value,
                        })
                      }
                    >
                      {["A", "B", "C", "D", "E"].map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cm-form-group">
                    <label>
                      <FiCalendar /> Academic Year *
                    </label>
                    <select
                      value={classForm.academicYear}
                      onChange={(e) =>
                        setClassForm({
                          ...classForm,
                          academicYear: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="2024-25">2024-25</option>
                      <option value="2025-26">2025-26</option>
                      <option value="2023-24">2023-24</option>
                    </select>
                  </div>
                </div>

                <div className="cm-form-group">
                  <label>
                    <FiLayers /> Department
                  </label>
                  <select
                    value={classForm.department}
                    onChange={(e) =>
                      setClassForm({
                        ...classForm,
                        department: e.target.value,
                      })
                    }
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Science">
                      Information Science
                    </option>
                    <option value="Electronics">Electronics</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>

                <div className="cm-form-group">
                  <label>
                    <FiUser /> Class Teacher (Optional)
                  </label>
                  <select
                    value={classForm.classTeacherId}
                    onChange={(e) =>
                      setClassForm({
                        ...classForm,
                        classTeacherId: e.target.value,
                      })
                    }
                  >
                    <option value="">Select a class teacher...</option>
                    {teachers.map((teacher) => (
                      <option key={teacher._id} value={teacher._id}>
                        {teacher.name} ({teacher.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cm-form-group">
                  <label>Description</label>
                  <textarea
                    value={classForm.description}
                    onChange={(e) =>
                      setClassForm({
                        ...classForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Brief description of the class (optional)"
                    rows={3}
                  />
                </div>

                <div className="cm-modal-actions">
                  <button
                    type="button"
                    className="cm-btn-cancel"
                    onClick={closeModal}
                  >
                    <FiX /> Cancel
                  </button>
                  <button type="submit" className="cm-btn-submit">
                    <FiCheck />{" "}
                    {modalMode === "add" ? "Create Class" : "Update Class"}
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

export default ClassManagement;
