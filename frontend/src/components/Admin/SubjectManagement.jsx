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
  FiHash,
  FiCalendar,
  FiLayers,
  FiInfo,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./SubjectManagement.css";

const SubjectManagement = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editingSubject, setEditingSubject] = useState(null);

  const [subjectForm, setSubjectForm] = useState({
    subjectName: "",
    subjectCode: "",
    credits: 3,
    semester: 1,
    department: "Computer Science",
    description: "",
  });

  // Fetch subjects
  const fetchSubjects = useCallback(async () => {
    try {
      const response = await adminAPI.getAllSubjects({ search: searchQuery });
      setSubjects(response.data || []);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      toast.error("Failed to fetch subjects");
    }
  }, [searchQuery]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSubjects();
      setLoading(false);
    };
    loadData();
  }, [fetchSubjects]);

  // Reset form
  const resetForm = () => {
    setSubjectForm({
      subjectName: "",
      subjectCode: "",
      credits: 3,
      semester: 1,
      department: "Computer Science",
      description: "",
    });
    setEditingSubject(null);
  };

  // Open modal
  const openModal = (mode, subjectData = null) => {
    setModalMode(mode);
    if (mode === "edit" && subjectData) {
      setEditingSubject(subjectData);
      setSubjectForm({
        subjectName: subjectData.subjectName || "",
        subjectCode: subjectData.subjectCode || "",
        credits: subjectData.credits || 3,
        semester: subjectData.semester || 1,
        department: subjectData.department || "Computer Science",
        description: subjectData.description || "",
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
        await adminAPI.createSubject(subjectForm);
        toast.success("Subject created successfully!");
      } else {
        await adminAPI.updateSubject(editingSubject._id, subjectForm);
        toast.success("Subject updated successfully!");
      }
      await fetchSubjects();
      closeModal();
    } catch (error) {
      console.error("Error saving subject:", error);
      toast.error(error.message || "Failed to save subject");
    }
  };

  // Handle delete
  const handleDelete = async (subject) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${subject.subjectName} (${subject.subjectCode})?`
      )
    ) {
      return;
    }
    try {
      await adminAPI.deleteSubject(subject._id);
      toast.success("Subject deleted successfully!");
      await fetchSubjects();
    } catch (error) {
      console.error("Error deleting subject:", error);
      toast.error("Failed to delete subject");
    }
  };

  const filteredSubjects = subjects.filter(
    (s) =>
      s.subjectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.subjectCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="subject-management">
      {/* Header */}
      <motion.div
        className="sm-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className="sm-back-btn" onClick={() => navigate("/admin")}>
          <FiArrowLeft />
          <span>Back to Dashboard</span>
        </button>
        <div className="sm-title-section">
          <FiBook className="sm-title-icon" />
          <h1>Subject Management</h1>
        </div>
      </motion.div>

      {/* Actions Bar */}
      <motion.div
        className="sm-actions-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="sm-search-box">
          <FiSearch className="sm-search-icon" />
          <input
            type="text"
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="sm-add-btn" onClick={() => openModal("add")}>
          <FiPlus />
          <span>Create Subject</span>
        </button>
      </motion.div>

      {/* Subjects Table */}
      <motion.div
        className="sm-table-container glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="sm-loading">
            <div className="sm-spinner"></div>
            <p>Loading subjects...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="sm-empty">
            <FiBook className="sm-empty-icon" />
            <h3>No subjects found</h3>
            <p>
              {searchQuery
                ? "Try adjusting your search"
                : 'Click "Create Subject" to get started'}
            </p>
          </div>
        ) : (
          <table className="sm-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th>Code</th>
                <th>Department</th>
                <th>Semester</th>
                <th>Credits</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map((subject, index) => (
                <motion.tr
                  key={subject._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td>
                    <div className="sm-subject-cell">
                      <div className="sm-avatar">
                        {subject.subjectName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="sm-subject-info">
                        <span className="name">{subject.subjectName}</span>
                        {subject.description && (
                          <span className="desc">
                            {subject.description.substring(0, 30)}
                            {subject.description.length > 30 ? "..." : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="sm-mono">{subject.subjectCode}</td>
                  <td>{subject.department}</td>
                  <td>{subject.semester ? `Sem ${subject.semester}` : "-"}</td>
                  <td>{subject.credits}</td>
                  <td>
                    <div className="sm-actions">
                      <button
                        className="sm-action-btn edit"
                        onClick={() => openModal("edit", subject)}
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="sm-action-btn delete"
                        onClick={() => handleDelete(subject)}
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="sm-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="sm-modal glass-morphism"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm-modal-header">
                <h2>{modalMode === "add" ? "Create" : "Edit"} Subject</h2>
                <button className="sm-modal-close" onClick={closeModal}>
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="sm-modal-form">
                <div className="sm-form-row">
                  <div className="sm-form-group">
                    <label>
                      <FiBook /> Subject Name *
                    </label>
                    <input
                      type="text"
                      value={subjectForm.subjectName}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          subjectName: e.target.value,
                        })
                      }
                      placeholder="e.g., Data Structures"
                      required
                    />
                  </div>
                  <div className="sm-form-group">
                    <label>
                      <FiHash /> Subject Code *
                    </label>
                    <input
                      type="text"
                      value={subjectForm.subjectCode}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          subjectCode: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="e.g., CS301"
                      required
                    />
                  </div>
                </div>

                <div className="sm-form-row">
                  <div className="sm-form-group">
                    <label>
                      <FiLayers /> Department
                    </label>
                    <select
                      value={subjectForm.department}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
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
                  <div className="sm-form-group">
                    <label>
                      <FiCalendar /> Semester
                    </label>
                    <select
                      value={subjectForm.semester}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          semester: parseInt(e.target.value),
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                        <option key={sem} value={sem}>
                          Semester {sem}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm-form-group">
                    <label>Credits</label>
                    <select
                      value={subjectForm.credits}
                      onChange={(e) =>
                        setSubjectForm({
                          ...subjectForm,
                          credits: parseInt(e.target.value),
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sm-form-group">
                  <label>
                    <FiInfo /> Description
                  </label>
                  <textarea
                    value={subjectForm.description}
                    onChange={(e) =>
                      setSubjectForm({
                        ...subjectForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Brief description of the subject..."
                    rows={3}
                  />
                </div>

                <div className="sm-modal-actions">
                  <button
                    type="button"
                    className="sm-btn-cancel"
                    onClick={closeModal}
                  >
                    <FiX /> Cancel
                  </button>
                  <button type="submit" className="sm-btn-submit">
                    <FiCheck />{" "}
                    {modalMode === "add" ? "Create Subject" : "Update Subject"}
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

export default SubjectManagement;
