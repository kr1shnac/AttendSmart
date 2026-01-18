/* eslint-disable */
import React, { useState } from "react";
import PropTypes from "prop-types";
import Modal from "../ui/Modal";
import StudentDetailCard from "../ui/StudentDetailCard";
import Button from "../ui/Button";
import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import "./TopPerformersModal.css";

const RankBadge = ({ rank }) => {
  let bgColor = "rgba(255, 255, 255, 0.1)";
  let color = "#fff";
  if (rank === 1) {
    bgColor = "gold";
    color = "#000";
  } else if (rank === 2) {
    bgColor = "silver";
    color = "#000";
  } else if (rank === 3) {
    bgColor = "#cd7f32"; // bronze
    color = "#000";
  }
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        backgroundColor: bgColor,
        color: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: "1rem",
        userSelect: "none",
      }}
    >
      {rank}
    </div>
  );
};

const TopPerformersModal = ({ students, onClose }) => {
  const [selectedStudent, setSelectedStudent] = useState(null);

  const openWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const whatsappNumber = cleanPhone.startsWith("91")
      ? cleanPhone
      : `91${cleanPhone}`;
    window.open(`https://wa.me/${whatsappNumber}`, "_blank");
  };

  const makeCall = (phone) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Top Performers"
        subtitle={`Top students with highest attendance (${students.length} total)`}
        size="large"
      >
        <div className="performers-list">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>USN</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Attendance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={index}>
                  <td>
                    <RankBadge rank={index + 1} />
                  </td>
                  <td>{student.name}</td>
                  <td>{student.usn}</td>
                  <td>{student.totalPresent}</td>
                  <td>{student.totalAbsent}</td>
                  <td>{student.attendance}%</td>
                  <td>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setSelectedStudent(student)}
                    >
                      View
                    </Button>
                    {student.phone && (
                      <>
                        <Button
                          variant="primary"
                          size="small"
                          onClick={() => makeCall(student.phone)}
                        >
                          <FaPhoneAlt /> Call
                        </Button>
                        <Button
                          variant="success"
                          size="small"
                          onClick={() => openWhatsApp(student.phone)}
                        >
                          <FaWhatsapp /> WhatsApp
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!students.length && (
            <p className="no-performers">No top performers found.</p>
          )}
        </div>
      </Modal>

      {selectedStudent && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedStudent(null)}
          title={selectedStudent.name}
          subtitle={selectedStudent.usn}
          size="medium"
        >
          <StudentDetailCard student={selectedStudent} />
        </Modal>
      )}
    </>
  );
};

RankBadge.propTypes = {
  rank: PropTypes.number.isRequired,
};

TopPerformersModal.propTypes = {
  students: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default TopPerformersModal;
