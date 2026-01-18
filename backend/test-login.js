/**
 * Quick Login Test - Shows working credentials and tests login
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

async function testLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const User = mongoose.model(
      "User",
      new mongoose.Schema({}, { strict: false })
    );

    console.log("\n========================================");
    console.log("📋 WORKING LOGIN CREDENTIALS");
    console.log("========================================\n");

    // Get teachers
    const teachers = await User.find({ role: "teacher" })
      .select("name email")
      .limit(5);

    console.log("👨‍🏫 TEACHERS (Password: Teacher@123):");
    teachers.forEach((t, i) => {
      console.log(`${i + 1}. Email: ${t.email}`);
      console.log(`   Name: ${t.name}\n`);
    });

    // Get students
    const students = await User.find({ role: "student" })
      .select("name usn dateOfBirth")
      .limit(5);

    console.log("🎓 STUDENTS (USN + DOB in DD-MM-YYYY):");
    students.forEach((s, i) => {
      if (s.dateOfBirth) {
        const d = new Date(s.dateOfBirth);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

        console.log(`${i + 1}. USN: ${s.usn}`);
        console.log(`   Name: ${s.name}`);
        console.log(`   DOB: ${day}-${month}-${year}\n`);
      }
    });

    console.log("========================================");
    console.log("💡 HOW TO LOGIN:");
    console.log("========================================");
    console.log("Teacher: Select 'Teacher' → Email + Password");
    console.log("Student: Select 'Student' → USN + DOB");
    console.log("========================================\n");

    // Test if a teacher password works
    const testTeacher = teachers[0];
    if (testTeacher) {
      const teacherWithPass = await User.findById(testTeacher._id).select(
        "+password"
      );
      const passwordMatch = await bcrypt.compare(
        "Teacher@123",
        teacherWithPass.password
      );
      console.log(
        `\n✅ Password verification test: ${
          passwordMatch ? "PASSED" : "FAILED"
        }`
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testLogin();
