const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Class = require("../models/Class");
const Log = require("../models/Log");

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Log admin action
 */
const logAdminAction = async (req, action, description, severity = "info") => {
  try {
    // Only log if userId is a valid ObjectId (skip for env-based admin)
    const userId = isValidObjectId(req.user._id) ? req.user._id : null;

    await Log.create({
      userId,
      userRole: req.user.role,
      action,
      eventDescription: description,
      severity,
      ipAddress: req.ip,
      deviceType: req.headers["user-agent"]?.includes("Mobile")
        ? "mobile"
        : "desktop",
    });
  } catch (error) {
    console.error("Failed to log admin action:", error.message);
  }
};

/**
 * Check if a value is a valid MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  // Check if it's a valid MongoDB ObjectId format (24 hex characters)
  return /^[0-9a-fA-F]{24}$/.test(id.toString());
};

// ============================================
// STUDENT MANAGEMENT
// ============================================

/**
 * Create a new student
 * @route POST /api/admin/students
 */
exports.createStudent = async (req, res) => {
  try {
    const {
      name,
      email,
      usn,
      dateOfBirth,
      phone,
      branch,
      semester,
      section,
      bloodGroup,
      address,
      fatherName,
      fatherPhone,
      motherName,
      motherPhone,
      class: classId,
    } = req.body;

    // Validate required fields
    if (!name || !email || !usn || !dateOfBirth) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, USN, and date of birth are required",
      });
    }

    // Check if USN already exists
    const existingUsn = await User.findOne({ usn: usn.toUpperCase() });
    if (existingUsn) {
      return res.status(400).json({
        status: "error",
        message: "A student with this USN already exists",
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        status: "error",
        message: "A user with this email already exists",
      });
    }

    // Auto-populate branch/section from Class if provided
    let finalBranch = branch || "CSE";
    let finalSection = section || "A";
    let finalSemester = semester || 1;

    if (classId && isValidObjectId(classId)) {
      const classObj = await Class.findById(classId);
      if (classObj) {
        finalBranch = classObj.department;
        finalSection = classObj.section;
        // Optional: Map or infer semester from academicYear if needed,
        // but for now relying on manual or default semester.
      }
    }

    // Create student
    const student = await User.create({
      name,
      email: email.toLowerCase(),
      usn: usn.toUpperCase(),
      dateOfBirth: new Date(dateOfBirth),
      phone: phone || "",
      branch: finalBranch,
      semester: finalSemester,
      section: finalSection,
      bloodGroup: bloodGroup || "",
      address: address || "",
      fatherName: fatherName || "",
      fatherPhone: fatherPhone || "",
      motherName: motherName || "",
      motherPhone: motherPhone || "",
      class: classId && isValidObjectId(classId) ? classId : null,
      role: "student",
      isActive: true,
      // Only set created_by if admin has a valid ObjectId (not env-based admin)
      ...(isValidObjectId(req.user._id) && { created_by: req.user._id }),
    });

    // Add student to the Class students array
    if (classId && isValidObjectId(classId)) {
      await Class.findByIdAndUpdate(classId, {
        $addToSet: { students: { studentId: student._id } },
      });
    }

    await logAdminAction(
      req,
      "create_student",
      `Created student: ${name} (${usn})`,
      "info"
    );

    return res.status(201).json({
      status: "success",
      message: "Student created successfully",
      data: {
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          usn: student.usn,
          dateOfBirth: student.dateOfBirth,
          branch: student.branch,
          semester: student.semester,
          section: student.section,
          class: student.class,
          isActive: student.isActive,
        },
      },
    });
  } catch (error) {
    console.error("Create student error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create student",
    });
  }
};

/**
 * Get all students with pagination and search
 * @route GET /api/admin/students
 */
exports.getAllStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      branch,
      semester,
      section,
    } = req.query;

    const query = { role: "student" };

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { usn: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Additional filters
    if (branch) query.branch = branch;
    if (semester) query.semester = parseInt(semester);
    if (section) query.section = section;

    // Filter unassigned students (those not in any class)
    if (req.query.unassignedOnly === "true") {
      query.$or = [{ class: null }, { class: { $exists: false } }];
    }

    const students = await User.find(query)
      .populate("class", "className section")
      .select("-password -biometricCredentials -currentChallenge")
      .sort({ usn: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    return res.status(200).json({
      status: "success",
      results: students.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: students,
    });
  } catch (error) {
    console.error("Get all students error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch students",
    });
  }
};

/**
 * Update a student
 * @route PUT /api/admin/students/:id
 */
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { class: newClassId } = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData._id;

    // Normalize USN and email if provided
    if (updateData.usn) updateData.usn = updateData.usn.toUpperCase();
    if (updateData.email) updateData.email = updateData.email.toLowerCase();
    if (updateData.dateOfBirth)
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);

    // Handle Class Change Logic
    if (newClassId !== undefined) {
      // Fetch old user data to get previous class
      const oldUser = await User.findById(id);
      const oldClassId = oldUser.class;

      // If class is changing
      if (
        newClassId &&
        isValidObjectId(newClassId) &&
        newClassId !== oldClassId?.toString()
      ) {
        const classObj = await Class.findById(newClassId);
        if (classObj) {
          updateData.branch = classObj.department;
          updateData.section = classObj.section;
        }

        // Remove from old class
        if (oldClassId) {
          await Class.findByIdAndUpdate(oldClassId, {
            $pull: { students: { studentId: id } },
          });
        }
        // Add to new class
        await Class.findByIdAndUpdate(newClassId, {
          $addToSet: { students: { studentId: id } },
        });
      } else if (!newClassId && oldClassId) {
        // If class is being removed (set to null/empty)
        await Class.findByIdAndUpdate(oldClassId, {
          $pull: { students: { studentId: id } },
        });
      }
    }

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      updateData,
      { new: true, runValidators: true }
    )
      .populate("class", "className section")
      .select("-password -biometricCredentials");

    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Student not found",
      });
    }

    await logAdminAction(
      req,
      "update_student",
      `Updated student: ${student.name} (${student.usn})`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Student updated successfully",
      data: { student },
    });
  } catch (error) {
    console.error("Update student error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update student",
    });
  }
};

/**
 * Delete (deactivate) a student
 * @route DELETE /api/admin/students/:id
 */
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      { isActive: false },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Student not found",
      });
    }

    // Remove student from all classes
    await Class.updateMany(
      { "students.studentId": id },
      { $pull: { students: { studentId: id } } }
    );

    await logAdminAction(
      req,
      "delete_student",
      `Deactivated student: ${student.name} (${student.usn})`,
      "warning"
    );

    return res.status(200).json({
      status: "success",
      message: "Student deactivated successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete student",
    });
  }
};

// ============================================
// TEACHER MANAGEMENT
// ============================================

/**
 * Create a new teacher
 * @route POST /api/admin/teachers
 */
exports.createTeacher = async (req, res) => {
  try {
    const { name, email, password, phone, employeeId, department } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, and password are required",
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters",
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        status: "error",
        message: "A user with this email already exists",
      });
    }

    // Check if Employee ID already exists
    if (employeeId) {
      const existingEmployeeId = await User.findOne({ employeeId });
      if (existingEmployeeId) {
        return res.status(400).json({
          status: "error",
          message: "A user with this Employee ID already exists",
        });
      }
    }

    // Create teacher (password will be hashed by User model pre-save hook)
    const teacher = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || "",
      employeeId: employeeId || "",
      department: department || "Computer Science",
      role: "teacher",
      isActive: true,
      // Only set created_by if admin has a valid ObjectId (not env-based admin)
      ...(isValidObjectId(req.user._id) && { created_by: req.user._id }),
    });

    await logAdminAction(
      req,
      "create_teacher",
      `Created teacher: ${name} (${email})`,
      "info"
    );

    return res.status(201).json({
      status: "success",
      message: "Teacher created successfully",
      data: {
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          employeeId: teacher.employeeId,
          department: teacher.department,
          isActive: teacher.isActive,
        },
      },
    });
  } catch (error) {
    console.error("Create teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create teacher",
    });
  }
};

/**
 * Get all teachers
 * @route GET /api/admin/teachers
 */
exports.getAllTeachers = async (req, res) => {
  try {
    const { search = "", includeInactive = false } = req.query;

    const query = { role: "teacher" };

    if (!includeInactive) {
      query.isActive = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ];
    }

    const teachers = await User.find(query)
      .select("-password -biometricCredentials -currentChallenge")
      .sort({ name: 1 });

    return res.status(200).json({
      status: "success",
      results: teachers.length,
      data: teachers,
    });
  } catch (error) {
    console.error("Get all teachers error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch teachers",
    });
  }
};

/**
 * Update teacher credentials (email and/or password)
 * @route PUT /api/admin/teachers/:teacherId/credentials
 */
exports.updateTeacherCredentials = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { email, password, name, phone, department, employeeId } = req.body;

    const user = await User.findById(teacherId);
    if (!user || user.role !== "teacher") {
      return res.status(404).json({
        status: "error",
        message: "Teacher not found",
      });
    }

    // Update fields
    if (email) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid email format",
        });
      }
      user.email = email.toLowerCase();
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          status: "error",
          message: "Password must be at least 8 characters",
        });
      }
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(password, salt);
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (department) user.department = department;
    if (department) user.department = department;
    if (employeeId) {
      // Check for uniqueness if changing
      if (user.employeeId !== employeeId) {
        const existing = await User.findOne({ employeeId });
        if (existing) {
          return res.status(400).json({
            status: "error",
            message: "A user with this Employee ID already exists",
          });
        }
      }
      user.employeeId = employeeId;
    }

    await user.save();

    await logAdminAction(
      req,
      "update_teacher",
      `Updated teacher credentials: ${user.name}`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Teacher updated successfully",
      data: {
        teacher: {
          _id: user._id,
          name: user.name,
          email: user.email,
          department: user.department,
          employeeId: user.employeeId,
        },
      },
    });
  } catch (error) {
    console.error("Update teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update teacher",
    });
  }
};

/**
 * Delete (deactivate) a teacher
 * @route DELETE /api/admin/teachers/:id
 */
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await User.findOneAndUpdate(
      { _id: id, role: "teacher" },
      { isActive: false },
      { new: true }
    );

    if (!teacher) {
      return res.status(404).json({
        status: "error",
        message: "Teacher not found",
      });
    }

    await logAdminAction(
      req,
      "delete_teacher",
      `Deactivated teacher: ${teacher.name}`,
      "warning"
    );

    return res.status(200).json({
      status: "success",
      message: "Teacher deactivated successfully",
    });
  } catch (error) {
    console.error("Delete teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete teacher",
    });
  }
};

// ============================================
// CLASS MANAGEMENT (ADMIN)
// ============================================

/**
 * Create a new class
 * @route POST /api/admin/classes
 */
/**
 * Create a new class
 * @route POST /api/admin/classes
 */
exports.createClass = async (req, res) => {
  try {
    const {
      className,
      section,
      academicYear,
      department,
      description,
      classTeacherId,
    } = req.body;

    // Validate required fields
    if (!className || !academicYear) {
      return res.status(400).json({
        status: "error",
        message: "Class name and academic year are required",
      });
    }

    // Check if class with same name and section exists
    const existingClass = await Class.findOne({
      className,
      section: section || "A",
      academicYear,
    });

    if (existingClass) {
      return res.status(400).json({
        status: "error",
        message:
          "A class with this name and section already exists for the academic year",
      });
    }

    let classTeacher = null;
    if (classTeacherId) {
      classTeacher = await User.findOne({
        _id: classTeacherId,
        role: "teacher",
        isActive: true,
      });

      if (!classTeacher) {
        return res.status(400).json({
          status: "error",
          message: "Selected class teacher not found or inactive",
        });
      }
    }

    // Create class
    const newClass = await Class.create({
      className,
      section: section || "A",
      academicYear,
      department: department || "Computer Science",
      classTeacher: classTeacherId || null,
      description: description || "",
      students: [],
      subjectTeachers: [],
      isActive: true,
    });

    await logAdminAction(
      req,
      "create_class",
      `Created class: ${className} - ${section} (${academicYear})`,
      "info"
    );

    return res.status(201).json({
      status: "success",
      message: "Class created successfully",
      data: { class: newClass },
    });
  } catch (error) {
    console.error("Create class error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create class",
    });
  }
};

/**
 * Get all classes (admin view)
 * @route GET /api/admin/classes
 */
exports.getAllClasses = async (req, res) => {
  try {
    const {
      search = "",
      semester,
      teacherId,
      includeInactive = false,
    } = req.query;

    const query = {};

    if (!includeInactive) {
      query.isActive = true;
    }

    if (search) {
      query.$or = [
        { className: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { courseCode: { $regex: search, $options: "i" } },
      ];
    }

    if (semester) query.semester = parseInt(semester);
    if (teacherId) query.teacherId = teacherId;

    const classes = await Class.find(query)
      .populate("classTeacher", "name email department")
      .populate({
        path: "subjectTeachers.teacher",
        select: "name email department",
      })
      .populate({
        path: "subjectTeachers.subject",
        select: "subjectName subjectCode",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      results: classes.length,
      data: classes,
    });
  } catch (error) {
    console.error("Get all classes error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch classes",
    });
  }
};

/**
 * Get single class by ID
 * @route GET /api/admin/classes/:id
 */
exports.getClassById = async (req, res) => {
  try {
    const { id } = req.params;

    const classDoc = await Class.findById(id)
      .populate("classTeacher", "name email department employeeId")
      .populate(
        "students.studentId",
        "name usn email phone branch semester section"
      )
      .populate({
        path: "subjectTeachers.teacher",
        select: "name email department",
      })
      .populate({
        path: "subjectTeachers.subject",
        select: "subjectName subjectCode description",
      });

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: { class: classDoc },
    });
  } catch (error) {
    console.error("Get class by ID error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch class",
    });
  }
};

/**
 * Update a class
 * @route PUT /api/admin/classes/:id
 */
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that need special handling
    delete updateData._id;
    delete updateData.students;

    // Handle teacher change
    if (updateData.teacherId) {
      const teacher = await User.findOne({
        _id: updateData.teacherId,
        role: "teacher",
        isActive: true,
      });
      if (!teacher) {
        return res.status(400).json({
          status: "error",
          message: "Selected teacher not found or inactive",
        });
      }
      updateData.teacher = updateData.teacherId;
      updateData.teacherName = teacher.name;
    }

    if (updateData.courseCode) {
      updateData.courseCode = updateData.courseCode.toUpperCase();
    }

    const classDoc = await Class.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("teacher", "name email department");

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    await logAdminAction(
      req,
      "update_class",
      `Updated class: ${classDoc.className} (${classDoc.courseCode})`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Class updated successfully",
      data: { class: classDoc },
    });
  } catch (error) {
    console.error("Update class error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update class",
    });
  }
};

/**
 * Delete (deactivate) a class
 * @route DELETE /api/admin/classes/:id
 */
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const classDoc = await Class.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    await logAdminAction(
      req,
      "delete_class",
      `Deactivated class: ${classDoc.className} (${classDoc.courseCode})`,
      "warning"
    );

    return res.status(200).json({
      status: "success",
      message: "Class deactivated successfully",
    });
  } catch (error) {
    console.error("Delete class error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to delete class",
    });
  }
};

/**
 * Assign teacher to class
 * @route PUT /api/admin/classes/:id/teacher
 */
/**
 * Assign class teacher (Main teacher)
 * @route PUT /api/admin/classes/:id/class-teacher
 */
exports.assignClassTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({
        status: "error",
        message: "Teacher ID is required",
      });
    }

    const teacher = await User.findOne({
      _id: teacherId,
      role: "teacher",
      isActive: true,
    });

    if (!teacher) {
      return res.status(400).json({
        status: "error",
        message: "Teacher not found or inactive",
      });
    }

    const classDoc = await Class.findByIdAndUpdate(
      id,
      { classTeacher: teacherId },
      { new: true }
    ).populate("classTeacher", "name email department");

    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    await logAdminAction(
      req,
      "assign_class_teacher",
      `Assigned ${teacher.name} as class teacher for ${classDoc.className}`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Class teacher assigned successfully",
      data: { class: classDoc },
    });
  } catch (error) {
    console.error("Assign class teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to assign class teacher",
    });
  }
};

/**
 * Assign subject teacher
 * @route POST /api/admin/classes/:id/subject-teachers
 */
exports.assignSubjectTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId, subjectId } = req.body;

    if (!teacherId || !subjectId) {
      return res.status(400).json({
        status: "error",
        message: "Teacher ID and Subject ID are required",
      });
    }

    // Implementation of parallel validation for better perf
    const [teacher, subject, classDoc] = await Promise.all([
      User.findOne({ _id: teacherId, role: "teacher", isActive: true }),
      mongoose.model("Subject").findOne({ _id: subjectId, isActive: true }),
      Class.findById(id),
    ]);

    if (!teacher)
      return res
        .status(400)
        .json({ status: "error", message: "Teacher not found or inactive" });
    if (!subject)
      return res
        .status(400)
        .json({ status: "error", message: "Subject not found or inactive" });
    if (!classDoc)
      return res
        .status(404)
        .json({ status: "error", message: "Class not found" });

    // Check if assignments exist
    const exists = classDoc.subjectTeachers.some(
      (st) =>
        st.teacher.toString() === teacherId &&
        st.subject.toString() === subjectId
    );

    if (exists) {
      return res.status(400).json({
        status: "error",
        message:
          "This teacher is already assigned to this subject in this class",
      });
    }

    // Add assignment
    classDoc.subjectTeachers.push({
      teacher: teacherId,
      subject: subjectId,
      assignedDate: new Date(),
    });

    await classDoc.save();

    // Populate for response
    await classDoc.populate([
      { path: "subjectTeachers.teacher", select: "name email" },
      { path: "subjectTeachers.subject", select: "subjectName subjectCode" },
    ]);

    await logAdminAction(
      req,
      "assign_subject_teacher",
      `Assigned ${teacher.name} to teach ${subject.subjectName} in ${classDoc.className}`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Subject teacher assigned successfully",
      data: { class: classDoc },
    });
  } catch (error) {
    console.error("Assign subject teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to assign subject teacher",
    });
  }
};

/**
 * Remove subject teacher
 * @route DELETE /api/admin/classes/:id/subject-teachers/:teacherId
 */
exports.removeSubjectTeacher = async (req, res) => {
  try {
    const { id, teacherId } = req.params;
    const { subjectId } = req.body; // Optional: specify which subject if teacher has multiple

    const classDoc = await Class.findById(id);
    if (!classDoc)
      return res
        .status(404)
        .json({ status: "error", message: "Class not found" });

    // Filter out the assignment
    let originalLength = classDoc.subjectTeachers.length;

    if (subjectId) {
      classDoc.subjectTeachers = classDoc.subjectTeachers.filter(
        (st) =>
          !(
            st.teacher.toString() === teacherId &&
            st.subject.toString() === subjectId
          )
      );
    } else {
      // Remove all assignments for this teacher in this class if subject not specified
      classDoc.subjectTeachers = classDoc.subjectTeachers.filter(
        (st) => st.teacher.toString() !== teacherId
      );
    }

    if (classDoc.subjectTeachers.length === originalLength) {
      return res
        .status(404)
        .json({ status: "error", message: "Assignment not found" });
    }

    await classDoc.save();

    return res.status(200).json({
      status: "success",
      message: "Subject teacher removed successfully",
    });
  } catch (error) {
    console.error("Remove subject teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to remove subject teacher",
    });
  }
};

/**
 * Add students to class
 * @route POST /api/admin/classes/:id/students
 */
exports.addStudentsToClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Student IDs array is required",
      });
    }

    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    // Get existing student IDs in the class
    const existingStudentIds = classDoc.students.map((s) =>
      s.studentId.toString()
    );

    // Filter out students already in the class
    const newStudentIds = studentIds.filter(
      (sid) => !existingStudentIds.includes(sid)
    );

    if (newStudentIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "All selected students are already in this class",
      });
    }

    // Fetch student details
    const students = await User.find({
      _id: { $in: newStudentIds },
      role: "student",
      isActive: true,
    }).select("name usn class");

    if (students.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No valid students found",
      });
    }

    // Filter out students who are already assigned to a class
    const unassignedStudents = students.filter(
      (s) => !s.class || s.class.toString() === id
    );

    if (unassignedStudents.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "All selected students are already assigned to a class",
      });
    }

    if (unassignedStudents.length < students.length) {
      // Some students were skipped
      console.warn(
        `Skipped ${
          students.length - unassignedStudents.length
        } already assigned students.`
      );
    }

    // Add students to class
    const studentsToAdd = unassignedStudents.map((student) => ({
      studentId: student._id,
      usn: student.usn,
      name: student.name,
      enrolledDate: new Date(),
    }));

    classDoc.students.push(...studentsToAdd);
    await classDoc.save();

    // Update each student's class reference
    await User.updateMany(
      { _id: { $in: students.map((s) => s._id) } },
      { $set: { class: classDoc._id } }
    );

    await logAdminAction(
      req,
      "add_students_to_class",
      `Added ${students.length} students to class ${classDoc.className}`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: `${students.length} students added to class`,
      data: {
        addedCount: students.length,
        class: classDoc,
      },
    });
  } catch (error) {
    console.error("Add students to class error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to add students",
    });
  }
};

/**
 * Remove student from class
 * @route DELETE /api/admin/classes/:id/students/:studentId
 */
exports.removeStudentFromClass = async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    const studentIndex = classDoc.students.findIndex(
      (s) => s.studentId.toString() === studentId
    );

    if (studentIndex === -1) {
      return res.status(404).json({
        status: "error",
        message: "Student not found in this class",
      });
    }

    const removedStudent = classDoc.students[studentIndex];
    classDoc.students.splice(studentIndex, 1);
    await classDoc.save();

    // Remove class reference from student
    await User.findByIdAndUpdate(studentId, { $unset: { class: 1 } });

    await logAdminAction(
      req,
      "remove_student_from_class",
      `Removed ${removedStudent.name} from class ${classDoc.className}`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Student removed from class",
    });
  } catch (error) {
    console.error("Remove student from class error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to remove student",
    });
  }
};

// ============================================
// USER STATUS MANAGEMENT
// ============================================

/**
 * Activate or deactivate a user
 * @route PATCH /api/admin/users/:userId/active
 */
exports.setUserActiveStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        status: "error",
        message: "isActive must be a boolean",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    user.isActive = isActive;
    await user.save();

    await logAdminAction(
      req,
      "set_user_active",
      `${isActive ? "Activated" : "Deactivated"} user: ${user.name}`,
      isActive ? "info" : "warning"
    );

    return res.status(200).json({
      status: "success",
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (error) {
    console.error("Set user active status error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update user status",
    });
  }
};

/**
 * Change a user's role
 * @route PATCH /api/admin/users/:userId/role
 */
exports.changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ["student", "teacher", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid role. Allowed roles: ${validRoles.join(", ")}`,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await logAdminAction(
      req,
      "change_user_role",
      `Changed ${user.name} role from ${oldRole} to ${role}`,
      "warning"
    );

    return res.status(200).json({
      status: "success",
      message: "User role updated successfully",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Change user role error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to change user role",
    });
  }
};

// ============================================
// TEACHER ASSIGNMENT
// ============================================

/**
 * Assign class teacher
 * @route PUT /api/admin/classes/:id/class-teacher
 */
exports.assignClassTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    // Verify teacher exists and is a teacher
    const teacher = await User.findOne({ _id: teacherId, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({
        status: "error",
        message: "Teacher not found",
      });
    }

    const oldTeacherId = classDoc.classTeacher;
    classDoc.classTeacher = teacherId;
    await classDoc.save();

    await logAdminAction(
      req,
      "assign_class_teacher",
      `Assigned ${teacher.name} as class teacher for ${classDoc.className}`,
      "info"
    );

    // Update teacher's record if needed? (Not strictly required if querying by class)

    return res.status(200).json({
      status: "success",
      message: "Class teacher assigned successfully",
      data: { class: classDoc },
    });
  } catch (error) {
    console.error("Assign class teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to assign class teacher",
    });
  }
};

/**
 * Assign subject teacher
 * @route POST /api/admin/classes/:id/subject-teachers
 */
exports.assignSubjectTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectId, teacherId } = req.body;

    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    // Check if assignment already exists
    const exists = classDoc.subjectTeachers.some(
      (st) =>
        st.subject.toString() === subjectId &&
        st.teacher.toString() === teacherId
    );
    if (exists) {
      return res.status(400).json({
        status: "error",
        message:
          "This teacher is already assigned to this subject in this class",
      });
    }

    classDoc.subjectTeachers.push({
      subject: subjectId,
      teacher: teacherId,
    });
    await classDoc.save();

    await logAdminAction(
      req,
      "assign_subject_teacher",
      `Assigned subject teacher for ${classDoc.className}`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Subject teacher assigned successfully",
    });
  } catch (error) {
    console.error("Assign subject teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to assign subject teacher",
    });
  }
};

/**
 * Remove subject teacher
 * @route DELETE /api/admin/classes/:id/subject-teachers/:teacherId
 */
exports.removeSubjectTeacher = async (req, res) => {
  try {
    const { id, teacherId } = req.params;
    const { subjectId } = req.query; // If we want to remove specific subject assignment

    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        status: "error",
        message: "Class not found",
      });
    }

    if (subjectId) {
      classDoc.subjectTeachers = classDoc.subjectTeachers.filter(
        (st) =>
          !(
            st.teacher.toString() === teacherId &&
            st.subject.toString() === subjectId
          )
      );
    } else {
      // Remove all assignments for this teacher in this class
      classDoc.subjectTeachers = classDoc.subjectTeachers.filter(
        (st) => st.teacher.toString() !== teacherId
      );
    }

    await classDoc.save();

    await logAdminAction(
      req,
      "remove_subject_teacher",
      `Removed subject teacher from ${classDoc.className}`,
      "info"
    );

    return res.status(200).json({
      status: "success",
      message: "Subject teacher removed successfully",
    });
  } catch (error) {
    console.error("Remove subject teacher error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to remove subject teacher",
    });
  }
};

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * Get admin dashboard statistics
 * @route GET /api/admin/stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalStudents, totalTeachers, totalClasses, activeClasses] =
      await Promise.all([
        User.countDocuments({ role: "student", isActive: true }),
        User.countDocuments({ role: "teacher", isActive: true }),
        Class.countDocuments({}),
        Class.countDocuments({ isActive: true }),
      ]);

    return res.status(200).json({
      status: "success",
      data: {
        totalStudents,
        totalTeachers,
        totalClasses,
        activeClasses,
        totalUsers: totalStudents + totalTeachers,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch dashboard stats",
    });
  }
};
