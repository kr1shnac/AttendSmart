const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const subjectController = require("../controllers/subjectController");
const { protect, authorize } = require("../middleware/auth");

// ============================================
// ALL ROUTES REQUIRE ADMIN AUTHENTICATION
// ============================================
router.use(protect);
router.use(authorize("admin"));

// ============================================
// DASHBOARD STATS
// ============================================
router.get("/stats", adminController.getDashboardStats);

// ============================================
// SUBJECT MANAGEMENT
// ============================================
router.post("/subjects", subjectController.createSubject);
router.get("/subjects", subjectController.getAllSubjects);
router.put("/subjects/:id", subjectController.updateSubject);
router.delete("/subjects/:id", subjectController.deleteSubject);

// ============================================
// STUDENT MANAGEMENT
// ============================================
router.post("/students", adminController.createStudent);
router.get("/students", adminController.getAllStudents);
router.put("/students/:id", adminController.updateStudent);
router.delete("/students/:id", adminController.deleteStudent);

// ============================================
// TEACHER MANAGEMENT
// ============================================
router.post("/teachers", adminController.createTeacher);
router.get("/teachers", adminController.getAllTeachers);
router.put(
  "/teachers/:teacherId/credentials",
  adminController.updateTeacherCredentials
);
router.delete("/teachers/:id", adminController.deleteTeacher);

// ============================================
// CLASS MANAGEMENT
// ============================================
router.post("/classes", adminController.createClass);
router.get("/classes", adminController.getAllClasses);
router.get("/classes/:id", adminController.getClassById);
router.put("/classes/:id", adminController.updateClass);
router.delete("/classes/:id", adminController.deleteClass);

// Class teacher assignment (single class teacher)
router.put("/classes/:id/class-teacher", adminController.assignClassTeacher);

// Subject teacher assignment (multiple subject teachers)
router.post(
  "/classes/:id/subject-teachers",
  adminController.assignSubjectTeacher
);
router.delete(
  "/classes/:id/subject-teachers/:teacherId",
  adminController.removeSubjectTeacher
);

// Class student management
router.post("/classes/:id/students", adminController.addStudentsToClass);
router.delete(
  "/classes/:id/students/:studentId",
  adminController.removeStudentFromClass
);

// ============================================
// USER STATUS MANAGEMENT
// ============================================
router.patch("/users/:userId/active", adminController.setUserActiveStatus);
router.patch("/users/:userId/role", adminController.changeUserRole);

module.exports = router;
