/**
 * Reset Face Enrollment Script
 *
 * This script resets face enrollment for all existing students,
 * forcing them to re-enroll their face on their next login.
 *
 * Usage: node reset-face-enrollment.js
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// Main reset function
const resetFaceEnrollment = async () => {
  try {
    await connectDB();

    // Get the User collection directly
    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    // Count students with face enrollment before reset
    const beforeCount = await usersCollection.countDocuments({
      role: "student",
      "faceDescriptor.enrolled": true,
    });

    console.log(`\n📊 Found ${beforeCount} students with face enrollment`);

    if (beforeCount === 0) {
      console.log("ℹ️  No students have face enrollment to reset.");
    }

    // Reset face enrollment for all students (even those not enrolled, to ensure clean state)
    console.log("\n🔄 Resetting face enrollment for all students...");

    const result = await usersCollection.updateMany(
      { role: "student" },
      {
        $set: {
          "faceDescriptor.enrolled": false,
          "faceDescriptor.descriptor": [],
          "faceDescriptor.enrolledAt": null,
          "faceDescriptor.quality": null,
          biometricEnrolled: false,
          enrollmentCompletedAt: null,
        },
      }
    );

    console.log(`\n✅ Reset complete!`);
    console.log(`   - Students modified: ${result.modifiedCount}`);
    console.log(`   - Total students matched: ${result.matchedCount}`);

    // Verify reset
    const afterCount = await usersCollection.countDocuments({
      role: "student",
      "faceDescriptor.enrolled": true,
    });

    console.log(
      `\n🔍 Verification: ${afterCount} students still have face enrollment`
    );

    if (afterCount === 0) {
      console.log("✅ All face enrollments have been successfully reset!");
      console.log("\n📌 Next steps:");
      console.log(
        "   1. Students will be prompted to enroll their face on next login"
      );
      console.log(
        "   2. After enrollment, they can use Face Login for quick access"
      );
    }
  } catch (error) {
    console.error("❌ Error resetting face enrollment:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
};

// Run the script
resetFaceEnrollment();
