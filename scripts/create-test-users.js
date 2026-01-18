/**
 * Create Test Users Script
 *
 * Creates mock users for load testing
 * Run: node scripts/create-test-users.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/attendsmart";

// User schema (simplified)
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  usn: String,
  biometricEnrolled: { type: Boolean, default: true },
  faceDescriptor: {
    enrolled: { type: Boolean, default: true },
    descriptor: [Number],
    quality: Number,
  },
});

const User = mongoose.model("User", userSchema);

async function createTestUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const hashedPassword = await bcrypt.hash("Test123!", 10);

    // Generate 128D face descriptor
    const generateDescriptor = () =>
      Array.from({ length: 128 }, () => Math.random() * 2 - 1);

    // Create teachers (10)
    console.log("Creating teachers...");
    for (let i = 1; i <= 10; i++) {
      await User.findOneAndUpdate(
        { email: `teacher${i}@test.com` },
        {
          name: `Test Teacher ${i}`,
          email: `teacher${i}@test.com`,
          password: hashedPassword,
          role: "teacher",
          biometricEnrolled: true,
          faceDescriptor: {
            enrolled: true,
            descriptor: generateDescriptor(),
            quality: 0.95,
          },
        },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Created 10 teachers");

    // Create students (100)
    console.log("Creating students...");
    for (let i = 1; i <= 100; i++) {
      await User.findOneAndUpdate(
        { email: `student${i}@test.com` },
        {
          name: `Test Student ${i}`,
          email: `student${i}@test.com`,
          password: hashedPassword,
          role: "student",
          usn: `TEST${String(i).padStart(3, "0")}`,
          biometricEnrolled: true,
          faceDescriptor: {
            enrolled: true,
            descriptor: generateDescriptor(),
            quality: 0.9,
          },
        },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Created 100 students");

    // Create test classes (10)
    const Class = mongoose.model(
      "Class",
      new mongoose.Schema({
        name: String,
        code: { type: String, unique: true },
      })
    );

    console.log("Creating classes...");
    for (let i = 1; i <= 10; i++) {
      await Class.findOneAndUpdate(
        { code: `class_test_${String(i).padStart(3, "0")}` },
        {
          name: `Load Test Class ${i}`,
          code: `class_test_${String(i).padStart(3, "0")}`,
        },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Created 10 classes");

    console.log("\n========================================");
    console.log("Test data created successfully!");
    console.log("Teachers: teacher1@test.com - teacher10@test.com");
    console.log("Students: student1@test.com - student100@test.com");
    console.log("Password: Test123!");
    console.log("========================================");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createTestUsers();
