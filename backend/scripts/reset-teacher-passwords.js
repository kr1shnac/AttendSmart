require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

async function resetTeacherPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Hash the correct password
    const correctPassword = "Teacher@123";
    const hashedPassword = await bcrypt.hash(correctPassword, 12);

    // Update all teachers with the correct password
    const result = await User.updateMany(
      { role: "teacher" },
      { $set: { password: hashedPassword } }
    );

    console.log(`✅ Updated ${result.modifiedCount} teacher accounts`);
    console.log("\nTeacher credentials:");
    console.log("Email: neethu.teacher@attendsmart.com");
    console.log("Password: Teacher@123");

    // Verify the update
    const teacher = await User.findOne({
      email: "neethu.teacher@attendsmart.com",
    }).select("+password");

    const isMatch = await bcrypt.compare(correctPassword, teacher.password);
    console.log(
      "\n✅ Verification:",
      isMatch ? "Password updated successfully!" : "Update failed!"
    );

    // List all teachers
    const allTeachers = await User.find({ role: "teacher" }).select(
      "name email"
    );
    console.log(
      `\n📋 All ${allTeachers.length} teachers now have password: Teacher@123`
    );
    allTeachers.forEach((t) => console.log(`   - ${t.email} (${t.name})`));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

resetTeacherPassword();
