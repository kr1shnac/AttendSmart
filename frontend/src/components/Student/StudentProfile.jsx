import React, { useState, useEffect } from "react";
import { formatEmail } from "../../utils/emailUtils";

import { motion, AnimatePresence } from "framer-motion";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiDroplet,
  FiLayers,
  FiHash,
  FiSettings,
  FiBell,
  FiShield,
  FiX,
  FiMapPin,
  FiMessageCircle, // WhatsApp Icon
  FiBriefcase, // For occupation fields
} from "react-icons/fi";
import { MdSchool, MdFamilyRestroom } from "react-icons/md";
import toast from "../../services/toastService";
import "./StudentProfile.css";
import { API_BASE_URL } from "../../config/api";

const StudentProfile = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    usn: "",
    email: "",
    department: "",
    semester: "",
    section: "",
    phone: "",
    whatsapp: "", // ✅ Added WhatsApp
    bloodGroup: "",
    dateOfBirth: "",
    fatherName: "",
    fatherPhone: "",
    fatherOccupation: "",
    motherName: "",
    motherPhone: "",
    motherOccupation: "",
    address: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();

        if (result.success || result.status === "success") {
          const user = result.data.user || result.data;
          const nameParts = (user.name || "").split(" ");

          setProfileData({
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            usn: user.usn || "N/A",
            email: user.email || "N/A",
            department: user.department || "N/A",
            semester: user.semester || "N/A",
            section: user.section || "N/A",
            phone: user.phone || "N/A",
            whatsapp: user.whatsapp || user.phone || "N/A", // ✅ Map WhatsApp (fallback to phone)
            bloodGroup: user.bloodGroup || "N/A",
            dateOfBirth: user.dob
              ? new Date(user.dob).toLocaleDateString()
              : "N/A",
            fatherName: user.fatherName || "Not Updated",
            fatherPhone: user.fatherPhone || "Not Updated",
            fatherOccupation: user.fatherOccupation || "N/A",
            motherName: user.motherName || "Not Updated",
            motherPhone: user.motherPhone || "Not Updated",
            motherOccupation: user.motherOccupation || "N/A",
            address: user.address || "Not Updated",
          });
        } else {
          toast.error("Failed to load profile data");
        }
      } catch (error) {
        console.error("Profile fetch error:", error);
        toast.error("Could not connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const getInitials = (fName, lName) => {
    return `${(fName || "").charAt(0)}${(lName || "").charAt(0)}`.toUpperCase();
  };

  const handleToggle = (setting) => {
    toast.success(`${setting} updated successfully`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="student-profile">
      {/* HEADER */}
      <motion.div
        className="profile-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>
          <FiUser /> My Profile
        </h1>
        <p className="subtitle">Personal information & preferences</p>
      </motion.div>

      {/* MAIN PROFILE CARD */}
      <div className="profile-container glass-morphism">
        {/* LEFT: AVATAR & IDENTITY */}
        <div className="profile-sidebar">
          <div className="avatar-wrapper">
            <div className="initials-avatar">
              {getInitials(profileData.firstName, profileData.lastName)}
            </div>
            <div className="online-status"></div>
          </div>

          <div className="identity-text">
            <h2>
              {profileData.firstName} {profileData.lastName}
            </h2>
            <span className="usn-pill">
              <FiHash /> {profileData.usn}
            </span>
            <p className="dept-text">
              <MdSchool /> {profileData.department}
            </p>
          </div>

          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
          >
            <FiSettings /> Open Settings
          </button>
        </div>

        {/* RIGHT: SCROLLABLE DETAILS AREA */}
        <div className="profile-content-area">
          {/* SECTION 1: PERSONAL INFO */}
          <div className="details-section">
            <h3 className="details-heading">
              <FiUser /> Personal Details
            </h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>Email Address</label>
                <div className="value">
                  <FiMail /> {formatEmail(profileData.email)}
                </div>
              </div>
              <div className="detail-item">
                <label>Phone Number</label>
                <div className="value">
                  <FiPhone /> {profileData.phone}
                </div>
              </div>
              {/* ✅ WHATSAPP NUMBER ADDED */}
              <div className="detail-item">
                <label>WhatsApp Number</label>
                <div className="value">
                  <FiMessageCircle /> {profileData.whatsapp}
                </div>
              </div>
              <div className="detail-item">
                <label>Current Semester</label>
                <div className="value">
                  <FiLayers /> Sem {profileData.semester} - Sec{" "}
                  {profileData.section}
                </div>
              </div>
              <div className="detail-item">
                <label>Date of Birth</label>
                <div className="value">
                  <FiCalendar /> {profileData.dateOfBirth}
                </div>
              </div>
              <div className="detail-item">
                <label>Blood Group</label>
                <div className="value">
                  <FiDroplet /> {profileData.bloodGroup}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: FAMILY & ADDRESS (Filtered as requested) */}
          <div className="details-section">
            <h3 className="details-heading">
              <MdFamilyRestroom /> Family & Address
            </h3>
            <div className="details-grid">
              {/* Father */}
              <div className="detail-item">
                <label>Father&apos;s Name</label>
                <div className="value">
                  <FiUser /> {profileData.fatherName}
                </div>
              </div>
              <div className="detail-item">
                <label>Father&apos;s Occupation</label>
                <div className="value">
                  <FiBriefcase /> {profileData.fatherOccupation}
                </div>
              </div>
              <div className="detail-item">
                <label>Father&apos;s Phone</label>
                <div className="value">
                  <FiPhone /> {profileData.fatherPhone}
                </div>
              </div>

              {/* Mother */}
              <div className="detail-item">
                <label>Mother&apos;s Name</label>
                <div className="value">
                  <FiUser /> {profileData.motherName}
                </div>
              </div>
              <div className="detail-item">
                <label>Mother&apos;s Occupation</label>
                <div className="value">
                  <FiBriefcase /> {profileData.motherOccupation}
                </div>
              </div>
              <div className="detail-item">
                <label>Mother&apos;s Phone</label>
                <div className="value">
                  <FiPhone /> {profileData.motherPhone}
                </div>
              </div>

              {/* Address */}
              <div className="detail-item full-width">
                <label>Permanent Address</label>
                <div className="value">
                  <FiMapPin /> {profileData.address}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <div className="settings-overlay">
            <motion.div
              className="settings-modal glass-morphism"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="modal-header">
                <h3>
                  <FiSettings /> Settings
                </h3>
                <button
                  className="close-btn"
                  onClick={() => setShowSettings(false)}
                >
                  <FiX />
                </button>
              </div>
              <div className="settings-content">
                <div className="settings-group">
                  <h4>
                    <FiBell /> Notifications
                  </h4>
                  <div className="setting-row">
                    <div className="setting-label">
                      <span>Push Notifications</span>
                      <p>Receive alerts for attendance</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        defaultChecked
                        onChange={() => handleToggle("Push Notifications")}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
                <div className="settings-group">
                  <h4>
                    <FiShield /> Security
                  </h4>
                  <div className="setting-row">
                    <div className="setting-label">
                      <span>Biometric Login</span>
                      <p>Use face/fingerprint</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        defaultChecked
                        onChange={() => handleToggle("Biometric Login")}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <p>Version 1.0.0 • AttendSmart</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentProfile;
