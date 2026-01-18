const Subject = require("../models/Subject");

/**
 * Create a new subject
 * @route POST /api/admin/subjects
 */
exports.createSubject = async (req, res) => {
  try {
    const {
      subjectName,
      subjectCode,
      credits,
      semester,
      department,
      description,
    } = req.body;

    // Validate required fields
    if (!subjectName || !subjectCode) {
      return res.status(400).json({
        status: "error",
        message: "Subject name and code are required",
      });
    }

    // Check if subject code already exists
    const existingSubject = await Subject.findOne({
      subjectCode: subjectCode.toUpperCase(),
    });
    if (existingSubject) {
      return res.status(400).json({
        status: "error",
        message: "A subject with this code already exists",
      });
    }

    // Create subject
    const subject = await Subject.create({
      subjectName,
      subjectCode: subjectCode.toUpperCase(),
      credits: credits || 3,
      semester: semester || null,
      department: department || "Computer Science",
      description: description || "",
    });

    return res.status(201).json({
      status: "success",
      message: "Subject created successfully",
      data: { subject },
    });
  } catch (error) {
    console.error("Create subject error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create subject",
    });
  }
};

/**
 * Get all subjects
 * @route GET /api/admin/subjects
 */
exports.getAllSubjects = async (req, res) => {
  try {
    const {
      search = "",
      department,
      semester,
      includeInactive = false,
    } = req.query;

    const query = {};

    if (!includeInactive) {
      query.isActive = true;
    }

    if (search) {
      query.$or = [
        { subjectName: { $regex: search, $options: "i" } },
        { subjectCode: { $regex: search, $options: "i" } },
      ];
    }

    if (department) query.department = department;
    if (semester) query.semester = parseInt(semester);

    const subjects = await Subject.find(query).sort({ subjectCode: 1 });

    return res.status(200).json({
      status: "success",
      results: subjects.length,
      data: subjects,
    });
  } catch (error) {
    console.error("Get all subjects error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch subjects",
    });
  }
};

/**
 * Update a subject
 * @route PUT /api/admin/subjects/:id
 */
exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;

    // Normalize subject code if provided
    if (updateData.subjectCode) {
      updateData.subjectCode = updateData.subjectCode.toUpperCase();
    }

    const subject = await Subject.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!subject) {
      return res.status(404).json({
        status: "error",
        message: "Subject not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Subject updated successfully",
      data: { subject },
    });
  } catch (error) {
    console.error("Update subject error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update subject",
    });
  }
};

/**
 * Delete (deactivate) a subject
 * @route DELETE /api/admin/subjects/:id
 */
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!subject) {
      return res.status(404).json({
        status: "error",
        message: "Subject not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Subject deactivated successfully",
    });
  } catch (error) {
    console.error("Delete subject error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete subject",
    });
  }
};
