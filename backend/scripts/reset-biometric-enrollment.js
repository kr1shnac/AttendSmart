/**
 * Reset Biometric Enrollment Migration Script
 *
 * This script resets biometric enrollment for all users to force
 * re-enrollment after switching from face-api.js to MediaPipe.
 *
 * IMPORTANT: Run this ONCE after deploying the new biometric system.
 *
 * Usage:
 *   cd backend
 *   node scripts/reset-biometric-enrollment.js
 *
 * Options:
 *   --dry-run    Preview changes without modifying database
 *   --students   Only reset student enrollments
 *   --teachers   Only reset teacher enrollments
 *
 * @module scripts/reset-biometric-enrollment
 * @version 1.0.0
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const studentsOnly = args.includes("--students");
const teachersOnly = args.includes("--teachers");

// ============================================
// CONFIGURATION
// ============================================

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI environment variable is not set");
  console.error("   Please check your .env file");
  process.exit(1);
}

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================

async function resetBiometricEnrollment() {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 BIOMETRIC ENROLLMENT RESET MIGRATION");
  console.log("=".repeat(60));

  if (isDryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made");
  }

  try {
    // Connect to MongoDB
    console.log("\n⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB");

    // Get User model
    const User = mongoose.model(
      "User",
      new mongoose.Schema({}, { strict: false })
    );

    // Build query based on options
    const query = { role: { $ne: "admin" } }; // Never reset admin accounts

    if (studentsOnly) {
      query.role = "student";
      console.log("📌 Targeting: Students only");
    } else if (teachersOnly) {
      query.role = "teacher";
      console.log("📌 Targeting: Teachers only");
    } else {
      console.log("📌 Targeting: All students and teachers");
    }

    // Count affected users
    const affectedCount = await User.countDocuments({
      ...query,
      $or: [{ biometricEnrolled: true }, { "faceDescriptor.enrolled": true }],
    });

    console.log(`\n📊 Users with biometric enrollment: ${affectedCount}`);

    if (affectedCount === 0) {
      console.log("ℹ️  No users need enrollment reset");
      await mongoose.disconnect();
      console.log("\n✅ Migration complete (no changes needed)");
      return;
    }

    // Preview changes
    console.log("\n📋 Changes to be made:");
    console.log("   • Set biometricEnrolled = false");
    console.log("   • Set faceDescriptor.enrolled = false");
    console.log("   • Clear faceDescriptor.descriptor = []");
    console.log("   • Set enrollmentCompletedAt = null");
    console.log("   • Add migrationNote for audit trail");

    if (isDryRun) {
      console.log("\n⚠️  DRY RUN - Skipping actual database update");

      // Show sample of affected users
      const sampleUsers = await User.find(query)
        .limit(5)
        .select("name email role biometricEnrolled");

      console.log("\n📝 Sample of affected users:");
      sampleUsers.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.name} (${user.email}) - ${user.role}`);
      });
    } else {
      // Confirm before proceeding
      console.log(
        "\n⚠️  WARNING: This will reset biometric data for all matched users."
      );
      console.log("   Students will need to re-enroll their face data.");

      // Perform the update
      console.log("\n⏳ Updating database...");

      const updateResult = await User.updateMany(query, {
        $set: {
          biometricEnrolled: false,
          "faceDescriptor.enrolled": false,
          "faceDescriptor.descriptor": [],
          "faceDescriptor.enrolledAt": null,
          "faceDescriptor.quality": null,
          enrollmentCompletedAt: null,
          // Audit trail
          _migrationNote: `Biometric reset for MediaPipe migration on ${new Date().toISOString()}`,
        },
      });

      console.log(
        `\n✅ Successfully updated ${updateResult.modifiedCount} users`
      );
      console.log(`   Matched: ${updateResult.matchedCount}`);
      console.log(`   Modified: ${updateResult.modifiedCount}`);
    }

    // Disconnect
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

    console.log("\n" + "=".repeat(60));
    console.log("✅ MIGRATION COMPLETE");
    console.log("=".repeat(60));

    if (!isDryRun) {
      console.log("\n📢 Next steps:");
      console.log("   1. Notify students to update their Security Profile");
      console.log("   2. Monitor enrollment rates in admin dashboard");
      console.log("   3. Provide support for enrollment issues");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ============================================
// RUN MIGRATION
// ============================================

console.log("\n📦 Biometric Reset Migration Script v1.0.0");
console.log(`📅 Timestamp: ${new Date().toISOString()}`);

if (isDryRun) {
  console.log("🔍 Mode: Dry Run (preview only)");
} else {
  console.log("🔧 Mode: Live Update");
}

resetBiometricEnrollment()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
