/**
 * Authentication Controller Tests
 *
 * Tests for login, logout, and token verification functionality.
 * Uses MongoDB Memory Server for isolated database testing.
 */

const request = require("supertest");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ============================================
// TEST APP SETUP
// ============================================

// Create minimal test app without importing full server
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Import models and controller after mongoose is connected
  const User = require("../models/User");
  const authController = require("../controllers/authController");

  // Mount auth routes for testing
  app.post("/api/auth/login", authController.login);
  app.post("/api/auth/logout", (req, res, next) => {
    req.user = { id: "test-user", role: "student" };
    authController.logout(req, res, next);
  });

  return app;
};

// ============================================
// TEST DATA
// ============================================

const testStudent = {
  name: "Test Student",
  email: "student@test.com",
  usn: "1MS21CS001",
  role: "student",
  dateOfBirth: new Date("2000-01-15"),
  department: "CSE",
  section: "A",
  semester: 5,
  isActive: true,
};

const testTeacher = {
  name: "Test Teacher",
  email: "teacher@test.com",
  username: "teacher@test.com",
  role: "teacher",
  password: "Teacher@123", // Pre-save hook will hash this
  department: "CSE",
  isActive: true,
};

// ============================================
// TESTS
// ============================================

describe("Authentication Controller", () => {
  let app;
  let User;

  beforeAll(() => {
    // Create app after MongoDB Memory Server is connected (via setup.js)
    app = createTestApp();
    User = require("../models/User");
  });

  // ----------------------------------------
  // STUDENT LOGIN TESTS
  // ----------------------------------------

  describe("POST /api/auth/login - Student Login", () => {
    beforeEach(async () => {
      await User.create(testStudent);
    });

    test("should successfully login student with valid USN and DOB", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "student",
        usn: "1MS21CS001",
        dob: "15-01-2000",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.usn).toBe("1MS21CS001");
      expect(response.body.user.role).toBe("student");
      expect(response.body.user.password).toBeUndefined();
    });

    test("should fail login with invalid USN", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "student",
        usn: "INVALID_USN",
        dob: "15-01-2000",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should fail login with incorrect DOB", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "student",
        usn: "1MS21CS001",
        dob: "01-01-1999",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("should fail login with missing required fields", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "student",
        usn: "1MS21CS001",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test("should normalize USN to uppercase", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "student",
        usn: "1ms21cs001",
        dob: "15-01-2000",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ----------------------------------------
  // TEACHER LOGIN TESTS
  // ----------------------------------------

  describe("POST /api/auth/login - Teacher Login", () => {
    beforeEach(async () => {
      await User.create(testTeacher);
    });

    test("should successfully login teacher with valid credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "teacher",
        username: "teacher@test.com",
        password: "Teacher@123",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.role).toBe("teacher");
      expect(response.body.user.password).toBeUndefined();
    });

    test("should fail login with incorrect password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "teacher",
        username: "teacher@test.com",
        password: "WrongPassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ----------------------------------------
  // VALIDATION TESTS
  // ----------------------------------------

  describe("Login Validation", () => {
    test("should fail login with invalid role", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "invalid_role",
        username: "test",
        password: "test",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test("should fail login with missing role", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: "test",
        password: "test",
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ----------------------------------------
  // LOGOUT TESTS
  // ----------------------------------------

  describe("POST /api/auth/logout", () => {
    test("should successfully logout", async () => {
      const response = await request(app).post("/api/auth/logout").send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ----------------------------------------
  // JWT TOKEN TESTS
  // ----------------------------------------

  describe("JWT Token Generation", () => {
    beforeEach(async () => {
      await User.create(testStudent);
    });

    test("should return valid JWT token on login", async () => {
      const response = await request(app).post("/api/auth/login").send({
        role: "student",
        usn: "1MS21CS001",
        dob: "15-01-2000",
      });

      expect(response.body.token).toBeDefined();

      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.role).toBe("student");
      expect(decoded.usn).toBe("1MS21CS001");
    });
  });
});
