import React, { useState, useEffect, useCallback } from "react";
import { formatEmail } from "../../utils/emailUtils";

import { motion, AnimatePresence } from "framer-motion";
import {
  FiUsers,
  FiUserPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiX,
  FiCheck,
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiHash,
  FiBriefcase,
  FiLock,
  FiEye,
  FiEyeOff,
  FiLayers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../services/api";
import toast from "../../services/toastService";
import "./UserManagement.css";

const UserManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]); // Fetched classes
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // add or edit
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    usn: "",
    dateOfBirth: "",
    phone: "",
    class: "", // Class ID
    semester: 1,
    // Branch/Section auto-handled by backend based on class
  });

  const [teacherForm, setTeacherForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    employeeId: "",
    department: "Computer Science",
  });

  // Fetch data
  const fetchStudents = useCallback(async () => {
    try {
      const response = await adminAPI.getAllStudents({ search: searchQuery });
      setStudents(response.data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to fetch students");
    }
  }, [searchQuery]);

  const fetchTeachers = useCallback(async () => {
    try {
      const response = await adminAPI.getAllTeachers({ search: searchQuery });
      setTeachers(response.data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("Failed to fetch teachers");
    }
  }, [searchQuery]);

  const fetchClasses = useCallback(async () => {
    try {
      const response = await adminAPI.getAllClasses();
      setClasses(response.data || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        activeTab === "students" ? fetchStudents() : fetchTeachers(),
        fetchClasses(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [activeTab, fetchStudents, fetchTeachers, fetchClasses]);

  // Reset form
  const resetForm = () => {
    setStudentForm({
      name: "",
      email: "",
      usn: "",
      dateOfBirth: "",
      phone: "",
      class: "",
      semester: 1,
    });
    setTeacherForm({
      name: "",
      email: "",
      password: "",
      phone: "",
      employeeId: "",
      department: "Computer Science",
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  // Open modal for add/edit
  const openModal = (mode, user = null) => {
    setModalMode(mode);
    if (mode === "edit" && user) {
      setEditingUser(user);
      if (activeTab === "students") {
        setStudentForm({
          name: user.name || "",
          email: user.email || "",
          usn: user.usn || "",
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split("T")[0] : "",
          phone: user.phone || "",
          class: user.class?._id || user.class || "", // Handle populated or unpopulated
          semester: user.semester || 1,
        });
      } else {
        setTeacherForm({
          name: user.name || "",
          email: user.email || "",
          password: "",
          phone: user.phone || "",
          employeeId: user.employeeId || "",
          department: user.department || "Computer Science",
        });
      }
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
      if (activeTab === "students") {
        if (modalMode === "add") {
          await adminAPI.createStudent(studentForm);
          toast.success("Student created successfully!");
        } else {
          await adminAPI.updateStudent(editingUser._id, studentForm);
          toast.success("Student updated successfully!");
        }
        await fetchStudents();
      } else {
        if (modalMode === "add") {
          if (!teacherForm.password || teacherForm.password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
          }
          await adminAPI.createTeacher(teacherForm);
          toast.success("Teacher created successfully!");
        } else {
          const updateData = { ...teacherForm };
          if (!updateData.password) delete updateData.password;
          await adminAPI.updateTeacher(editingUser._id, updateData);
          toast.success("Teacher updated successfully!");
        }
        await fetchTeachers();
      }
      closeModal();
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error(error.message || "Failed to save user");
    }
  };

  // Handle delete
  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.name}?`)) {
      return;
    }
    try {
      if (activeTab === "students") {
        await adminAPI.deleteStudent(user._id);
        toast.success("Student deleted successfully!");
        await fetchStudents();
      } else {
        await adminAPI.deleteTeacher(user._id);
        toast.success("Teacher deleted successfully!");
        await fetchTeachers();
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const currentData = activeTab === "students" ? students : teachers;
  const filteredData = currentData.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.usn && user.usn.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="user-management">
      {/* Header */}
      <motion.div
        className="um-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button className="um-back-btn" onClick={() => navigate("/admin")}>
          <FiArrowLeft />
          <span>Back to Dashboard</span>
        </button>
        <div className="um-title-section">
          <FiUsers className="um-title-icon" />
          <h1>User Management</h1>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        className="um-tabs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <button
          className={`um-tab ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          <FiUser />
          <span>Students</span>
          <span className="um-tab-count">{students.length}</span>
        </button>
        <button
          className={`um-tab ${activeTab === "teachers" ? "active" : ""}`}
          onClick={() => setActiveTab("teachers")}
        >
          <FiBriefcase />
          <span>Teachers</span>
          <span className="um-tab-count">{teachers.length}</span>
        </button>
      </motion.div>

      {/* Actions Bar */}
      <motion.div
        className="um-actions-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="um-search-box">
          <FiSearch className="um-search-icon" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="um-add-btn" onClick={() => openModal("add")}>
          <FiUserPlus />
          <span>Add {activeTab === "students" ? "Student" : "Teacher"}</span>
        </button>
      </motion.div>

      {/* Data Table */}
      <motion.div
        className="um-table-container glass-morphism"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {loading ? (
          <div className="um-loading">
            <div className="um-spinner"></div>
            <p>Loading {activeTab}...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="um-empty">
            <FiUsers className="um-empty-icon" />
            <h3>No {activeTab} found</h3>
            <p>
              {searchQuery
                ? "Try adjusting your search"
                : `Click "Add ${
                    activeTab === "students" ? "Student" : "Teacher"
                  }" to get started`}
            </p>
          </div>
        ) : (
          <table className="um-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                {activeTab === "students" ? (
                  <>
                    <th>USN</th>
                    <th>Class</th>
                    <th>Dept.</th>
                  </>
                ) : (
                  <>
                    <th>Employee ID</th>
                    <th>Department</th>
                  </>
                )}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((user, index) => (
                <motion.tr
                  key={user._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td>
                    <div className="um-user-cell">
                      <div className="um-avatar">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                    </div>
                  </td>
                  <td>{formatEmail(user.email)}</td>
                  {activeTab === "students" ? (
                    <>
                      <td className="um-mono">{user.usn}</td>
                      <td>
                        {user.class ? (
                          <span className="um-mono badge-class">
                            {user.class.className || "Class Assigned"}
                          </span>
                        ) : (
                          <span className="um-mono text-muted">-</span>
                        )}
                      </td>
                      <td>{user.branch || user.class?.department || "N/A"}</td>
                    </>
                  ) : (
                    <>
                      <td className="um-mono">{user.employeeId || "N/A"}</td>
                      <td>{user.department}</td>
                    </>
                  )}
                  <td>
                    <span
                      className={`um-status ${
                        user.isActive ? "active" : "inactive"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="um-actions">
                      <button
                        className="um-action-btn edit"
                        onClick={() => openModal("edit", user)}
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="um-action-btn delete"
                        onClick={() => handleDelete(user)}
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
            className="um-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="um-modal glass-morphism"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="um-modal-header">
                <h2>
                  {modalMode === "add" ? "Add" : "Edit"}{" "}
                  {activeTab === "students" ? "Student" : "Teacher"}
                </h2>
                <button className="um-modal-close" onClick={closeModal}>
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="um-modal-form">
                {activeTab === "students" ? (
                  <>
                    <div className="um-form-group">
                      <label>
                        <FiUser /> Full Name *
                      </label>
                      <input
                        type="text"
                        value={studentForm.name}
                        onChange={(e) =>
                          setStudentForm({
                            ...studentForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="um-form-row">
                      <div className="um-form-group">
                        <label>
                          <FiMail /> Email *
                        </label>
                        <input
                          type="email"
                          value={studentForm.email}
                          onChange={(e) =>
                            setStudentForm({
                              ...studentForm,
                              email: e.target.value,
                            })
                          }
                          placeholder="student@example.com"
                          required
                        />
                      </div>
                      <div className="um-form-group">
                        <label>
                          <FiHash /> USN *
                        </label>
                        <input
                          type="text"
                          value={studentForm.usn}
                          onChange={(e) =>
                            setStudentForm({
                              ...studentForm,
                              usn: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="1RV21CS001"
                          required
                        />
                      </div>
                    </div>
                    <div className="um-form-row">
                      <div className="um-form-group">
                        <label>
                          <FiCalendar /> Date of Birth *
                        </label>
                        <input
                          type="date"
                          value={studentForm.dateOfBirth}
                          onChange={(e) =>
                            setStudentForm({
                              ...studentForm,
                              dateOfBirth: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="um-form-group">
                        <label>
                          <FiPhone /> Phone
                        </label>
                        <input
                          type="tel"
                          value={studentForm.phone}
                          onChange={(e) =>
                            setStudentForm({
                              ...studentForm,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+91 9876543210"
                        />
                      </div>
                    </div>

                    {/* Class & Semester Section */}
                    <div className="um-form-row">
                      <div className="um-form-group">
                        <label>
                          <FiLayers /> Class *
                        </label>
                        <select
                          value={studentForm.class}
                          onChange={(e) =>
                            setStudentForm({
                              ...studentForm,
                              class: e.target.value,
                            })
                          }
                          required
                        >
                          <option value="">Select Class...</option>
                          {classes.map((cls) => (
                            <option key={cls._id} value={cls._id}>
                              {cls.className} (Sec {cls.section})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="um-form-group">
                        <label>Semester</label>
                        <select
                          value={studentForm.semester}
                          onChange={(e) =>
                            setStudentForm({
                              ...studentForm,
                              semester: parseInt(e.target.value),
                            })
                          }
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                            <option key={sem} value={sem}>
                              {sem}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="um-form-group">
                      <label>
                        <FiUser /> Full Name *
                      </label>
                      <input
                        type="text"
                        value={teacherForm.name}
                        onChange={(e) =>
                          setTeacherForm({
                            ...teacherForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="um-form-row">
                      <div className="um-form-group">
                        <label>
                          <FiMail /> Email *
                        </label>
                        <input
                          type="email"
                          value={teacherForm.email}
                          onChange={(e) =>
                            setTeacherForm({
                              ...teacherForm,
                              email: e.target.value,
                            })
                          }
                          placeholder="teacher@example.com"
                          required
                        />
                      </div>
                      <div className="um-form-group">
                        <label>
                          <FiLock /> Password{" "}
                          {modalMode === "add" ? "*" : "(leave blank to keep)"}
                        </label>
                        <div className="um-password-input">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={teacherForm.password}
                            onChange={(e) =>
                              setTeacherForm({
                                ...teacherForm,
                                password: e.target.value,
                              })
                            }
                            placeholder={
                              modalMode === "add"
                                ? "Min 8 characters"
                                : "New password"
                            }
                            required={modalMode === "add"}
                            minLength={modalMode === "add" ? 8 : 0}
                          />
                          <button
                            type="button"
                            className="um-password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <FiEyeOff /> : <FiEye />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="um-form-row">
                      <div className="um-form-group">
                        <label>
                          <FiHash /> Employee ID
                        </label>
                        <input
                          type="text"
                          value={teacherForm.employeeId}
                          onChange={(e) =>
                            setTeacherForm({
                              ...teacherForm,
                              employeeId: e.target.value,
                            })
                          }
                          placeholder="EMP001"
                        />
                      </div>
                      <div className="um-form-group">
                        <label>
                          <FiPhone /> Phone
                        </label>
                        <input
                          type="tel"
                          value={teacherForm.phone}
                          onChange={(e) =>
                            setTeacherForm({
                              ...teacherForm,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+91 9876543210"
                        />
                      </div>
                    </div>
                    <div className="um-form-group">
                      <label>
                        <FiBriefcase /> Department
                      </label>
                      <select
                        value={teacherForm.department}
                        onChange={(e) =>
                          setTeacherForm({
                            ...teacherForm,
                            department: e.target.value,
                          })
                        }
                      >
                        <option value="Computer Science">
                          Computer Science
                        </option>
                        <option value="Information Science">
                          Information Science
                        </option>
                        <option value="Electronics">Electronics</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Civil">Civil</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="um-modal-actions">
                  <button
                    type="button"
                    className="um-btn-cancel"
                    onClick={closeModal}
                  >
                    <FiX /> Cancel
                  </button>
                  <button type="submit" className="um-btn-submit">
                    <FiCheck /> {modalMode === "add" ? "Create" : "Update"}
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

export default UserManagement;
