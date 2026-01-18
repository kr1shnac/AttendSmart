/* eslint-disable */
import React from "react";
import PropTypes from "prop-types";
import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa"; // professional icons
import "./StudentDetailCard.css";

const StudentDetailCard = ({ student }) => {
  // Open WhatsApp chat (no pre-filled message now)
  const openWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const whatsappNumber = cleanPhone.startsWith("91")
      ? cleanPhone
      : `91${cleanPhone}`;
    window.open(`https://wa.me/${whatsappNumber}`, "_blank");
  };

  // Make call to the number
  const makeCall = (phone) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  return (
    <div className="student-details-simple">
      {/* Basic Info */}
      <div className="info-section">
        <div className="info-row">
          <span className="info-label">Full Name</span>
          <span className="info-value">{student.name}</span>
        </div>
        <div className="info-row">
          <span className="info-label">USN</span>
          <span className="info-value">{student.usn}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Email</span>
          <span className="info-value">{student.email}</span>
        </div>
        {student.phone && (
          <div className="info-row">
            <span className="info-label">Student Phone</span>
            <span className="info-value">{student.phone}</span>
          </div>
        )}
        {student.fatherPhone && (
          <div className="info-row">
            <span className="info-label">Father&apos;s Phone</span>
            <span className="info-value">{student.fatherPhone}</span>
          </div>
        )}
        {student.motherPhone && (
          <div className="info-row">
            <span className="info-label">Mother&apos;s Phone</span>
            <span className="info-value">{student.motherPhone}</span>
          </div>
        )}
        {student.guardianPhone && (
          <div className="info-row">
            <span className="info-label">Guardian&apos;s Phone</span>
            <span className="info-value">{student.guardianPhone}</span>
          </div>
        )}
      </div>

      {/* Attendance Stats */}
      <div className="stats-section">
        <div className="stat-card present">
          <span className="stat-label">Present</span>
          <span className="stat-number">{student.totalPresent}</span>
        </div>
        <div className="stat-card absent">
          <span className="stat-label">Absent</span>
          <span className="stat-number">{student.totalAbsent}</span>
        </div>
        <div className="stat-card percentage">
          <span className="stat-label">Attendance</span>
          <span className="stat-number">{student.attendance}%</span>
        </div>
      </div>

      {/* Contact Buttons */}
      <div className="action-section">
        {student.phone && (
          <button
            className="action-button call-student"
            onClick={() => makeCall(student.phone)}
            aria-label="Call Student"
          >
            <FaPhoneAlt className="button-icon" />
            Call Student
          </button>
        )}
        {(student.fatherPhone ||
          student.motherPhone ||
          student.guardianPhone) && (
          <button
            className="action-button call-parent"
            onClick={() => {
              // Priority: Father, else Mother, else Guardian
              if (student.fatherPhone) makeCall(student.fatherPhone);
              else if (student.motherPhone) makeCall(student.motherPhone);
              else makeCall(student.guardianPhone);
            }}
            aria-label="Call Parent"
          >
            <FaPhoneAlt className="button-icon" />
            Call Parent
          </button>
        )}
        {student.phone && (
          <button
            className="action-button whatsapp"
            onClick={() => openWhatsApp(student.phone)}
            aria-label="WhatsApp Chat"
          >
            <FaWhatsapp className="button-icon" />
            WhatsApp
          </button>
        )}
      </div>
    </div>
  );
};

StudentDetailCard.propTypes = {
  student: PropTypes.shape({
    name: PropTypes.string,
    usn: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    fatherPhone: PropTypes.string,
    motherPhone: PropTypes.string,
    guardianPhone: PropTypes.string,
    totalPresent: PropTypes.number,
    totalAbsent: PropTypes.number,
    attendance: PropTypes.number,
  }).isRequired,
};

export default StudentDetailCard;
