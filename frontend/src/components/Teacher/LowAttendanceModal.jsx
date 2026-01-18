/* eslint-disable */
import React, { useState } from "react";
import PropTypes from "prop-types";
import Modal from "../ui/Modal";
import StudentDetailCard from "../ui/StudentDetailCard";
import Button from "../ui/Button";
import "./LowAttendanceModal.css";

const LowAttendanceModal = ({ students, onClose }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.usn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.class &&
        student.class.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Low Attendance Students"
        subtitle={`All students below 75% attendance (${students.length} total)`}
        size="large"
      >
        {/* Search Bar */}
        <div className="modal-search">
          <input
            type="text"
            placeholder="Search by name, USN, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Students Table */}
        <div className="students-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>USN</th>
                <th>Class</th>
                <th>Attendance</th>
                <th>Missed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, index) => (
                <tr key={index}>
                  <td className="student-name">{student.name}</td>
                  <td>{student.usn}</td>
                  <td className="class-badge">{student.class}</td>
                  <td>
                    <span className="attendance-badge low">
                      {student.attendance}%
                    </span>
                  </td>
                  <td>
                    <span className="missed-badge">{student.missed}</span>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setSelectedStudent(student)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="no-results">
              <p>No students found matching &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Student Detail Modal */}
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

LowAttendanceModal.propTypes = {
  students: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default LowAttendanceModal;
