import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usersAPI, classesAPI } from "../../services/api";
import toast from "../../services/toastService";
import {
  FiUser,
  FiSettings,
  FiShield,
  FiEdit2,
  FiCamera,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiMapPin,
  FiClock,
  FiSave,
  FiX,
  FiLogOut,
  FiBell,
  FiSmartphone,
  FiLock,
} from "react-icons/fi";
import "./TeacherProfile.css";

const TeacherProfile = () => {
  const [activeTab, setActiveTab] = useState("details");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    employeeId: "",
    specialization: "",
    experience: "",
    officeRoom: "",
    officeHours: "",
  });

  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    sessionsThisMonth: 0,
    avgAttendance: 0,
  });

  useEffect(() => {
    loadProfileData();
    loadStats();
  }, []);

  const loadProfileData = async () => {
    try {
      const response = await usersAPI.getProfile();
      if (response.success && response.data) {
        const user = response.data;
        setProfileData({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          department: user.department || "",
          designation: user.designation || "Faculty",
          employeeId: user.employeeId || "",
          specialization: user.specialization || "",
          experience: user.experience || "",
          officeRoom: user.officeRoom || "",
          officeHours: user.officeHours || "To be updated",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const classesResponse = await classesAPI.getMyClasses();
      let classes = [];
      if (classesResponse.data) {
        if (Array.isArray(classesResponse.data)) {
          classes = classesResponse.data;
        } else if (Array.isArray(classesResponse.data.classes)) {
          classes = classesResponse.data.classes;
        }
      } else if (Array.isArray(classesResponse.classes)) {
        classes = classesResponse.classes;
      }

      const totalStudents = classes.reduce(
        (sum, cls) =>
          sum +
          (cls.totalStudents || cls.studentCount || cls.students?.length || 0),
        0
      );

      setStats((prev) => ({
        ...prev,
        totalClasses: classes.length,
        totalStudents,
      }));
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleInputChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    try {
      toast.loading("Saving profile...");
      const response = await usersAPI.updateProfile(profileData);
      if (response.success) {
        toast.success("Profile updated successfully!");
        setIsEditing(false);
      } else {
        toast.error(response.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    }
  };

  const tabs = [
    { id: "details", label: "Personal Details", icon: FiUser },
    { id: "settings", label: "Account Settings", icon: FiSettings },
    { id: "security", label: "Security", icon: FiShield },
  ];

  return (
    <div className="teacher-profile-container">
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your profile...</p>
        </div>
      ) : (
        <div className="profile-grid">
          {/* Left Sidebar - Identity */}
          <motion.div
            className="profile-sidebar glass-panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="profile-identity">
              <div className="avatar-wrapper">
                <div className="avatar-large">{profileData.name.charAt(0)}</div>
                <button className="change-photo-btn" title="Change Photo">
                  <FiCamera />
                </button>
              </div>
              <h2 className="profile-name">{profileData.name}</h2>
              <p className="profile-role">{profileData.designation}</p>
              <div className="profile-badges">
                <span className="badge dept">{profileData.department}</span>
                <span className="badge id">ID: {profileData.employeeId}</span>
              </div>
            </div>

            <div className="sidebar-stats">
              <div className="stat-item">
                <span className="stat-val">{stats.totalClasses}</span>
                <span className="stat-lbl">Classes</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{stats.totalStudents}</span>
                <span className="stat-lbl">Students</span>
              </div>
              <div className="stat-item">
                <span className="stat-val">{stats.avgAttendance}%</span>
                <span className="stat-lbl">Avg. Att.</span>
              </div>
            </div>

            <div className="sidebar-actions">
              <button
                className={`edit-toggle-btn ${isEditing ? "active" : ""}`}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <FiX /> Cancel Editing
                  </>
                ) : (
                  <>
                    <FiEdit2 /> Edit Profile
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* Right Content - Tabs & Forms */}
          <motion.div
            className="profile-content glass-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Tabs Navigation */}
            <div className="profile-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon />
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div
                      className="tab-indicator"
                      layoutId="activeTab"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="tab-content-area">
              <AnimatePresence mode="wait">
                {activeTab === "details" && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="details-form"
                  >
                    <div className="form-section">
                      <h3>Contact Information</h3>
                      <div className="input-group-grid">
                        <div className="input-wrapper">
                          <label>
                            <FiMail /> Email Address
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={profileData.email}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="input-wrapper">
                          <label>
                            <FiPhone /> Phone Number
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={profileData.phone}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>Academic Details</h3>
                      <div className="input-group-grid">
                        <div className="input-wrapper">
                          <label>
                            <FiBriefcase /> Department
                          </label>
                          <input
                            type="text"
                            name="department"
                            value={profileData.department}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="input-wrapper">
                          <label>
                            <FiBriefcase /> Specialization
                          </label>
                          <input
                            type="text"
                            name="specialization"
                            value={profileData.specialization}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h3>Office Info</h3>
                      <div className="input-group-grid">
                        <div className="input-wrapper">
                          <label>
                            <FiMapPin /> Office Room
                          </label>
                          <input
                            type="text"
                            name="officeRoom"
                            value={profileData.officeRoom}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                          />
                        </div>
                        <div className="input-wrapper">
                          <label>
                            <FiClock /> Office Hours
                          </label>
                          <input
                            type="text"
                            name="officeHours"
                            value={profileData.officeHours}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                    </div>

                    {isEditing && (
                      <motion.div
                        className="form-actions-footer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <button
                          className="save-changes-btn"
                          onClick={handleSave}
                        >
                          <FiSave /> Save Changes
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {activeTab === "settings" && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="settings-panel"
                  >
                    <div className="setting-row">
                      <div className="setting-info">
                        <div className="icon-box">
                          <FiBell />
                        </div>
                        <div>
                          <h4>Email Notifications</h4>
                          <p>Receive weekly attendance summaries</p>
                        </div>
                      </div>
                      <label className="switch">
                        <input type="checkbox" defaultChecked />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    <div className="setting-row">
                      <div className="setting-info">
                        <div className="icon-box">
                          <FiSmartphone />
                        </div>
                        <div>
                          <h4>SMS Alerts</h4>
                          <p>Get critical alerts on your phone</p>
                        </div>
                      </div>
                      <label className="switch">
                        <input type="checkbox" />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </motion.div>
                )}

                {activeTab === "security" && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="security-panel"
                  >
                    <div className="security-card">
                      <div className="icon-box danger">
                        <FiLock />
                      </div>
                      <div>
                        <h4>Change Password</h4>
                        <p>Update your password regularly for security</p>
                      </div>
                      <button className="action-btn-outline">Update</button>
                    </div>

                    <div className="security-card">
                      <div className="icon-box danger">
                        <FiLogOut />
                      </div>
                      <div>
                        <h4>Active Sessions</h4>
                        <p>Manage devices logged into your account</p>
                      </div>
                      <button className="action-btn-outline">View All</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TeacherProfile;
