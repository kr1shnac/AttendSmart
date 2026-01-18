// backend/scripts/seed-aiml-teachers.js
// Seed script to add AIML teachers and subjects for 5th semester
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Class = require("../models/Class");

// ==========================================
// AIML 5TH SEMESTER CONFIGURATION
// ==========================================

const SEMESTER = 5;
const DEPARTMENT = "AIML";
const BRANCH = "AIML";
const ACADEMIC_YEAR = "2024-2025";

// Teachers data from user
const teachersData = [
  {
    name: "Neethu Mam",
    phone: "+91 88617 87272",
    subject: "Computer Network",
    subjectCode: "BCS502",
  },
  {
    name: "Divya Mam",
    phone: "+91 99016 00284",
    subject: "RM & IPR",
    subjectCode: "BRMK557",
  },
  {
    name: "Swaroop Sir",
    phone: "+91 95027 29320",
    subject: "DS",
    subjectCode: "BCS515",
  },
  {
    name: "Kavitha Mam",
    phone: "+91 94491 67219",
    subject: "SEPM",
    subjectCode: "BCS501",
  },
  {
    name: "Pawan Raj Sir",
    phone: "+91 80731 01304",
    subject: "Data Visualization",
    subjectCode: "BAIL504",
  },
  {
    name: "Usha Mam",
    phone: "+91 96630 75706",
    subject: null, // Class Teacher - no subject
    subjectCode: null,
    isClassTeacher: true,
  },
  {
    name: "Sunanda Mam",
    phone: "+91 90082 68555",
    subject: "EVS",
    subjectCode: "BCS508",
  },
];

async function seedAIMLTeachers() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in .env");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected\n");

    // 1. Remove existing teachers (excluding admin)
    console.log("🗑️  Removing existing teachers...");
    const deletedTeachers = await User.deleteMany({ role: "teacher" });
    console.log(
      `✅ Removed ${deletedTeachers.deletedCount} existing teachers\n`
    );

    // 2. Remove existing subjects
    console.log("🗑️  Removing existing subjects...");
    const deletedSubjects = await Subject.deleteMany({});
    console.log(
      `✅ Removed ${deletedSubjects.deletedCount} existing subjects\n`
    );

    // 3. Remove existing classes (to prevent courseCode duplicate issues)
    console.log("🗑️  Removing existing classes...");
    const deletedClasses = await Class.deleteMany({});
    console.log(`✅ Removed ${deletedClasses.deletedCount} existing classes\n`);

    // 4. Create new subjects
    console.log("📚 Creating AIML 5th Semester Subjects...");
    const subjectsToCreate = teachersData
      .filter((t) => t.subject && t.subjectCode)
      .map((t) => ({
        subjectName: t.subject,
        subjectCode: t.subjectCode,
        semester: SEMESTER,
        department: DEPARTMENT,
        credits: 3,
        isActive: true,
      }));

    const createdSubjects = await Subject.insertMany(subjectsToCreate);
    console.log(`✅ Created ${createdSubjects.length} subjects:`);
    createdSubjects.forEach((s) =>
      console.log(`   - ${s.subjectCode}: ${s.subjectName}`)
    );
    console.log("");

    // Create a map of subject code to subject ID
    const subjectMap = {};
    createdSubjects.forEach((s) => {
      subjectMap[s.subjectCode] = s._id;
    });

    // 5. Create new teachers
    console.log("👨‍🏫 Creating AIML Teachers...");
    const teacherPassword = await bcrypt.hash("Teacher@123", 12);

    const createdTeachers = [];
    let classTeacher = null;

    for (let i = 0; i < teachersData.length; i++) {
      const t = teachersData[i];

      // Generate unique email based on name
      const nameParts = t.name.toLowerCase().replace(/\s+/g, " ").split(" ");
      const firstName = nameParts[0];

      const teacherDoc = {
        name: t.name,
        email: `${firstName}.teacher@attendsmart.com`,
        phone: t.phone,
        whatsapp: t.phone,
        password: teacherPassword,
        role: "teacher",
        isActive: true,
        employeeId: `AIML${String(i + 1).padStart(3, "0")}`,
        department: DEPARTMENT,
      };

      const teacher = await User.create(teacherDoc);
      createdTeachers.push({
        ...teacher.toObject(),
        subject: t.subject,
        subjectCode: t.subjectCode,
        isClassTeacher: t.isClassTeacher || false,
      });

      if (t.isClassTeacher) {
        classTeacher = teacher;
      }

      console.log(
        `   ✅ ${t.name} (${teacherDoc.email}) - ${
          t.subject || "Class Teacher"
        }`
      );
    }
    console.log("");

    // 6. Get existing students (to assign to new classes)
    console.log("📝 Finding existing students...");
    const allStudents = await User.find({ role: "student" });
    console.log(`   Found ${allStudents.length} students`);

    // Prepare student list
    const studentDocs = allStudents.map((s) => ({
      studentId: s._id,
      usn: s.usn,
      name: s.name,
    }));

    // 7. Create subject-teacher assignments for main AIML class
    const subjectTeachers = createdTeachers
      .filter((t) => t.subjectCode && subjectMap[t.subjectCode])
      .map((t) => ({
        teacher: t._id,
        subject: subjectMap[t.subjectCode],
        assignedDate: new Date(),
      }));

    // 8. Create main AIML class
    console.log("📚 Creating AIML main class...");
    const aimlClass = await Class.create({
      className: `AIML 5th Semester - Section A`,
      section: "A",
      academicYear: ACADEMIC_YEAR,
      department: DEPARTMENT,
      classTeacher: classTeacher ? classTeacher._id : null,
      subjectTeachers: subjectTeachers,
      students: studentDocs,
      totalStudents: studentDocs.length,
      isActive: true,
      description: "AIML 5th Semester Class",
      courseCode: "AIML5-A", // Unique course code
    });
    console.log(
      `   ✅ Created AIML main class with ${subjectTeachers.length} subject-teacher assignments`
    );

    // 9. Create individual subject classes for each subject
    console.log("\n📚 Creating individual subject classes...");

    for (const t of createdTeachers) {
      if (!t.subjectCode || !subjectMap[t.subjectCode]) continue;

      const subjectClass = await Class.create({
        className: `${t.subject} - AIML Section A`,
        section: "A",
        academicYear: ACADEMIC_YEAR,
        department: DEPARTMENT,
        classTeacher: classTeacher ? classTeacher._id : null,
        subjectTeachers: [
          {
            teacher: t._id,
            subject: subjectMap[t.subjectCode],
            assignedDate: new Date(),
          },
        ],
        students: studentDocs,
        totalStudents: studentDocs.length,
        isActive: true,
        description: `${t.subject} class for AIML 5th Semester`,
        courseCode: `${t.subjectCode}-AIML-A`, // Unique course code per subject
      });
      console.log(`   ✅ ${t.subject} (${t.subjectCode}) - ${t.name}`);
    }

    // 10. Update student records to reflect AIML branch and assign to class
    console.log("\n📝 Updating student records for AIML...");
    const updatedStudents = await User.updateMany(
      { role: "student" },
      {
        $set: {
          branch: BRANCH,
          department: DEPARTMENT,
          semester: SEMESTER,
          class: aimlClass._id,
        },
      }
    );
    console.log(
      `   ✅ Updated ${updatedStudents.modifiedCount} students to AIML branch`
    );

    console.log("\n═══════════════════════════════════════");
    console.log("✅ AIML TEACHERS SEEDING COMPLETE");
    console.log("═══════════════════════════════════════");
    console.log("\n📋 Teacher Credentials (password: Teacher@123):");
    createdTeachers.forEach((t) => {
      console.log(`   ${t.name}: ${t.email}`);
    });
    console.log("\n📚 Subjects Created:");
    createdSubjects.forEach((s) => {
      console.log(`   ${s.subjectCode}: ${s.subjectName}`);
    });
    console.log("═══════════════════════════════════════\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ SEED ERROR:", error);
    process.exit(1);
  }
}

seedAIMLTeachers();
