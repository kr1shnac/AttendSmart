require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

async function checkPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const teacher = await User.findOne({
      email: "neethu.teacher@attendsmart.com",
    }).select("+password");

    if (!teacher) {
      console.log("❌ Teacher not found");
      process.exit(1);
    }

    console.log("Teacher found:", teacher.name);
    console.log("Email:", teacher.email);
    console.log("Role:", teacher.role);
    console.log("Active:", teacher.isActive);
    console.log("\nTesting password: Teacher@123");

    const isMatch = await bcrypt.compare("Teacher@123", teacher.password);
    console.log("Password matches:", isMatch);

    if (!isMatch) {
      console.log("\n❌ Password does NOT match!");
      console.log("Testing other common passwords...\n");

      const testPasswords = [
        "teacher@123",
        "Teacher123",
        "Neethu@123",
        "neethu@123",
        "password",
        "Password@123",
      ];

      for (const pwd of testPasswords) {
        const match = await bcrypt.compare(pwd, teacher.password);
        if (match) {
          console.log("✅ MATCH FOUND:", pwd);
        }
      }
    } else {
      console.log("\n✅ Password is correct: Teacher@123");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkPassword();
