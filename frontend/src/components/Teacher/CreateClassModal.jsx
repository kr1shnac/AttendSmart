/* eslint-disable */
import React, { useState } from "react";
import PropTypes from "prop-types";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import toast from "../../services/toastService";
import "./CreateClassModal.css";

/**
 * Modal for creating a new class
 */
const CreateClassModal = ({ isOpen, onClose, onSave }) => {
  const [className, setClassName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [semester, setSemester] = useState("1");
  const [maxStudents, setMaxStudents] = useState("50");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!className.trim()) {
      toast.error("Class name is required");
      return;
    }

    if (!courseCode.trim()) {
      toast.error("Course code is required");
      return;
    }

    const classData = {
      className: className.trim(),
      courseCode: courseCode.trim(),
      description: description.trim(),
      semester: parseInt(semester),
      maxStudents: parseInt(maxStudents),
    };

    try {
      setLoading(true);
      await onSave(classData);
      handleClose();
    } catch (error) {
      console.error("Error creating class:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setClassName("");
    setCourseCode("");
    setDescription("");
    setSemester("1");
    setMaxStudents("50");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Class">
      <form onSubmit={handleSubmit} className="create-class-form">
        <div className="form-group">
          <label htmlFor="className">Class Name *</label>
          <input
            type="text"
            id="className"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="e.g., Data Structures"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="courseCode">Course Code *</label>
          <input
            type="text"
            id="courseCode"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            placeholder="e.g., CS301"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="semester">Semester</label>
          <select
            id="semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={loading}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                {sem}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="maxStudents">Max Students</label>
          <input
            type="number"
            id="maxStudents"
            value={maxStudents}
            onChange={(e) => setMaxStudents(e.target.value)}
            min="10"
            max="500"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Class description and details..."
            rows="4"
            disabled={loading}
          />
        </div>

        <div className="form-actions">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Class"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

CreateClassModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default CreateClassModal;
