const Attendance = require("../models/Attendance");
const Session = require("../models/Session");
const User = require("../models/User");
const BiometricData = require("../models/BiometricData");
const BLEScanRecord = require("../models/BLEScanRecord");
const sensorFusion = require("../services/sensorFusionService");
const queueService = require("../services/queueService"); // ✅ ADDED: Queue service for async writes
const nonceStore = require("../utils/nonceStore");
const {
  euclideanDistance,
  cosineSimilarity,
  combinedConfidence,
} = require("../utils/biometricUtils");

// Helper function to calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Helper to calculate BLE distance from RSSI
function calculateBLEDistance(rssi) {
  const txPower = -59; // Calibrated TX power at 1m
  if (rssi === 0) return -1;

  const ratio = (rssi * 1.0) / txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  } else {
    return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
  }
}

// Get verification method string
function getVerificationMethod(verificationData) {
  const methods = [];
  if (verificationData.gps?.verified) methods.push("GPS");
  if (verificationData.ble?.verified) methods.push("BLE");
  if (verificationData.biometric?.verified) methods.push("Face");
  return methods.join("+") || "Manual";
}

// Start check-in process
exports.startCheckIn = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const studentId = req.user._id;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    if (session.status !== "live") {
      return res.status(400).json({
        status: "error",
        message: "Session is not active",
      });
    }

    let attendance = await Attendance.findOne({
      session: sessionId,
      student: studentId,
    });

    // Use atomic findOneAndUpdate to prevent race conditions
    // This is safer than find -> check -> save pattern
    attendance = await Attendance.findOneAndUpdate(
      {
        session: sessionId,
        student: studentId,
      },
      {
        $setOnInsert: {
          session: sessionId,
          student: studentId,
          class: session.class,
          deviceInfo: {
            userAgent: req.headers["user-agent"],
            platform: req.body.platform || "unknown",
            ipAddress: req.ip,
          },
          checkInTime: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Check if already fully verified
    if (attendance.status === "verified") {
      return res.status(400).json({
        status: "error",
        message: "Already checked in for this session",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Check-in started",
      data: {
        attendanceId: attendance._id,
        nextStep: "gps",
      },
    });
  } catch (error) {
    console.error("Start check-in error:", error);
    next(error);
  }
};

// Verify GPS location
exports.verifyGPS = async (req, res, next) => {
  try {
    const { attendanceId, latitude, longitude, accuracy } = req.body;

    const attendance = await Attendance.findById(attendanceId).populate(
      "session"
    );

    if (!attendance) {
      return res.status(404).json({
        status: "error",
        message: "Attendance record not found",
      });
    }

    const session = attendance.session;
    const sessionLocation = session.location?.coordinates;

    if (!sessionLocation || !sessionLocation.latitude) {
      return res.status(400).json({
        status: "error",
        message: "Session location not configured",
      });
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      sessionLocation.latitude,
      sessionLocation.longitude
    );

    const isWithinRadius = distance <= (sessionLocation.radius || 100);

    attendance.verificationData.gps = {
      verified: isWithinRadius,
      latitude,
      longitude,
      accuracy,
      distance,
      timestamp: new Date(),
    };
    attendance.verificationSteps.gpsCompleted = true;

    await attendance.save();

    // Emit real-time update
    if (req.app.io) {
      req.app.io.to(`session-${session._id}`).emit("verification-update", {
        attendanceId: attendance._id,
        student: attendance.student,
        step: "gps",
        verified: isWithinRadius,
        distance,
      });
    }

    res.status(200).json({
      status: "success",
      message: isWithinRadius ? "GPS verified" : "Location verification failed",
      data: {
        verified: isWithinRadius,
        distance,
        nextStep: "ble",
      },
    });
  } catch (error) {
    console.error("GPS verification error:", error);
    next(error);
  }
};

// Verify BLE signal
exports.verifyBLE = async (req, res, next) => {
  try {
    const { attendanceId, deviceId, rssi } = req.body;

    const attendance = await Attendance.findById(attendanceId).populate(
      "session"
    );

    if (!attendance) {
      return res.status(404).json({
        status: "error",
        message: "Attendance record not found",
      });
    }

    // Create BLE scan record
    const bleScanRecord = new BLEScanRecord({
      deviceId,
      studentId: attendance.student,
      sessionId: attendance.session._id,
      rssi,
      distance: calculateBLEDistance(rssi),
      timestamp: new Date(),
    });
    await bleScanRecord.save();

    const isVerified = rssi >= -85;

    attendance.verificationData.ble = {
      verified: isVerified,
      deviceId,
      rssi,
      distance: bleScanRecord.distance,
      scanRecordId: bleScanRecord._id,
      timestamp: new Date(),
    };
    attendance.verificationSteps.bleCompleted = true;

    await attendance.save();

    // Emit real-time update
    if (req.app.io) {
      req.app.io
        .to(`session-${attendance.session._id}`)
        .emit("verification-update", {
          attendanceId: attendance._id,
          student: attendance.student,
          step: "ble",
          verified: isVerified,
          rssi,
          distance: bleScanRecord.distance,
        });
    }

    res.status(200).json({
      status: "success",
      message: isVerified ? "BLE verified" : "Weak BLE signal",
      data: {
        verified: isVerified,
        rssi,
        distance: bleScanRecord.distance,
        nextStep: "biometric",
      },
    });
  } catch (error) {
    console.error("BLE verification error:", error);
    next(error);
  }
};

// Verify biometric (integrates with your existing biometricController)
exports.verifyBiometric = async (req, res, next) => {
  try {
    const {
      attendanceId,
      biometricType,
      confidence,
      biometricDataId,
      faceImageUrl,
    } = req.body;

    const attendance = await Attendance.findById(attendanceId).populate(
      "student session"
    );

    if (!attendance) {
      return res.status(404).json({
        status: "error",
        message: "Attendance record not found",
      });
    }

    const isVerified = confidence >= 70;

    attendance.verificationData.biometric = {
      verified: isVerified,
      type: biometricType,
      confidence,
      biometricDataId,
      biometricDataId,
      faceImageUrl,
      timestamp: new Date(),
    };
    attendance.verificationSteps.biometricCompleted = true;

    // If all steps complete, mark as present
    if (
      attendance.verificationSteps.gpsCompleted &&
      attendance.verificationSteps.bleCompleted &&
      attendance.verificationSteps.biometricCompleted
    ) {
      attendance.calculateVerificationScore();

      if (attendance.verificationScore >= 70) {
        attendance.status = "present";
        attendance.checkInTime = new Date();
      }
    }

    await attendance.save();

    // Update session stats
    await attendance.session.updateStats();

    // Emit real-time check-in
    if (req.app.io) {
      const studentData = await User.findById(attendance.student._id).select(
        "name usn email"
      );

      req.app.io
        .to(`session-${attendance.session._id}`)
        .emit("student-checkin", {
          attendanceId: attendance._id,
          student: studentData,
          status: attendance.status,
          verificationScore: attendance.verificationScore,
          verificationData: {
            gps: {
              distance: attendance.verificationData.gps?.distance,
              verified: attendance.verificationData.gps?.verified,
            },
            ble: {
              rssi: attendance.verificationData.ble?.rssi,
              verified: attendance.verificationData.ble?.verified,
            },
            biometric: {
              confidence,
              verified: isVerified,
            },
          },
          checkInTime: attendance.checkInTime,
          hasAlert: attendance.hasAlert,
          alertType: attendance.alertType,
          alertMessage: attendance.alertMessage,
          method: getVerificationMethod(attendance.verificationData),
        });
    }

    res.status(200).json({
      status: "success",
      message: "Check-in completed",
      data: {
        attendance: {
          _id: attendance._id,
          status: attendance.status,
          verificationScore: attendance.verificationScore,
          isVerified: attendance.isVerified,
          checkInTime: attendance.checkInTime,
        },
      },
    });
  } catch (error) {
    console.error("Biometric verification error:", error);
    next(error);
  }
};

// Get live attendance (for teacher's live monitor)
exports.getLiveAttendance = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId).populate("class");

    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const attendanceRecords = await Attendance.find({ session: sessionId })
      .populate("student", "name usn email")
      .sort({ checkInTime: -1 });

    const liveStudents = attendanceRecords
      .filter((a) => a.status === "present")
      .map((a) => ({
        id: a._id,
        name: a.student.name,
        usn: a.student.usn,
        checkInTime: a.checkInTime,
        verificationScore: a.verificationScore,
        distance: a.verificationData.gps?.distance || 0,
        signal: a.verificationData.ble?.rssi || 0,
        method: getVerificationMethod(a.verificationData),
        status: a.hasAlert ? a.alertType : "verified",
      }));

    const alerts = attendanceRecords
      .filter((a) => a.hasAlert)
      .map((a) => ({
        type: a.alertType,
        student: a.student.name,
        studentId: a.student._id,
        usn: a.student.usn,
        attendanceId: a._id,
        message: a.alertMessage,
        distance: a.verificationData?.gps?.distance || "N/A",
        peerVerification: a.peerVerification,
        time: a.updatedAt,
      }));

    res.status(200).json({
      status: "success",
      data: {
        session,
        liveStudents,
        alerts,
        stats: {
          present: session.presentCount,
          expected: session.expectedStudents,
          percentage: session.attendancePercentage,
        },
      },
    });
  } catch (error) {
    console.error("Get live attendance error:", error);
    next(error);
  }
};

// Manual mark by teacher
exports.manualMark = async (req, res, next) => {
  try {
    const { sessionId, studentId, status, notes } = req.body;
    const teacherId = req.user._id;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    if (session.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized",
      });
    }

    let attendance = await Attendance.findOne({
      session: sessionId,
      student: studentId,
    });

    if (!attendance) {
      attendance = new Attendance({
        session: sessionId,
        student: studentId,
        class: session.class,
      });
    }

    attendance.status = status;
    attendance.notes = notes;
    attendance.markedBy = teacherId;

    if (status === "present" && !attendance.checkInTime) {
      attendance.checkInTime = new Date();
    }

    await attendance.save();
    await session.updateStats();

    res.status(200).json({
      status: "success",
      data: { attendance },
    });
  } catch (error) {
    next(error);
  }
};

// Get student attendance history
exports.getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { classId, startDate, endDate } = req.query;

    let query = { student: studentId };

    if (classId) query.class = classId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(query)
      .populate("session", "topic sessionType startTime")
      .populate("class", "subject courseCode")
      .sort({ createdAt: -1 });

    const stats = {
      total: attendance.length,
      present: attendance.filter((a) => a.status === "present").length,
      absent: attendance.filter((a) => a.status === "absent").length,
      percentage: 0,
    };

    if (stats.total > 0) {
      stats.percentage = Math.round((stats.present / stats.total) * 100);
    }

    res.status(200).json({
      status: "success",
      data: {
        attendance,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get student attendance history with summary
exports.getAttendanceHistory = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { subject, month } = req.query;

    let query = { student: studentId };

    // Filter by month
    if (month && month !== "all") {
      const now = new Date();
      if (month === "current") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query.createdAt = { $gte: startOfMonth };
      } else if (month === "last") {
        const startOfLastMonth = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        query.createdAt = { $gte: startOfLastMonth, $lte: endOfLastMonth };
      }
    }

    // Fetch attendance records
    let attendance = await Attendance.find(query)
      .populate("session", "topic sessionType startTime")
      .populate("class", "subject courseCode")
      .sort({ createdAt: -1 });

    // Filter by subject (client-side filter logic applied here for simplicity if subject is code)
    if (subject && subject !== "all") {
      attendance = attendance.filter((a) => a.class?.courseCode === subject);
    }

    // Calculate Summary Stats
    const summaryMap = {};

    attendance.forEach((record) => {
      const subjectName = record.class?.subject || "Unknown";
      const subjectCode = record.class?.courseCode || "N/A";

      if (!summaryMap[subjectCode]) {
        summaryMap[subjectCode] = {
          subject: subjectName,
          code: subjectCode,
          total: 0,
          present: 0,
        };
      }

      summaryMap[subjectCode].total += 1;
      if (record.status === "present") {
        summaryMap[subjectCode].present += 1;
      }
    });

    const summary = Object.values(summaryMap).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    }));

    // Format history for UI
    const history = attendance.map((a) => ({
      _id: a._id,
      date: a.createdAt,
      subject: a.class?.subject || "Unknown",
      status: a.status,
      room: "Room 101", // Placeholder or fetch from session
      teacher: "Dr. Smith", // Placeholder or fetch from session
      checkInTime: a.checkInTime
        ? new Date(a.checkInTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    }));

    res.status(200).json({
      status: "success",
      data: {
        history,
        summary,
      },
    });
  } catch (error) {
    console.error("Get attendance history error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// =============================================
// UNIFIED VERIFICATION (with Sensor Fusion)
// =============================================

/**
 * Unified verification endpoint - combines all sensor data
 * Uses sensor fusion service for weighted scoring
 */
exports.unifiedVerification = async (req, res, next) => {
  try {
    const { sessionId, verifications, platform } = req.body;
    const studentId = req.user._id;

    const session = await Session.findById(sessionId);
    // Check if session is valid for THIS verification attempt
    // For offline sync, we allow "completed" sessions if the queuedAt time was during the session
    const isLive = session.status === "live";
    const requestTime = new Date(
      req.body.queuedAt || req.body.timestamp || Date.now()
    );

    // Check if valid offline sync
    const isOfflineSync =
      session.status === "completed" &&
      requestTime >= session.startTime &&
      (session.endTime ? requestTime <= session.endTime : true) && // Handle sessions without clear end
      (req.body.offlineId || req.body.queuedAt); // Must have indicators of being a queued item

    if (!isLive && !isOfflineSync) {
      return res.status(400).json({
        status: "error",
        message: session
          ? "Session is not active and this is not a valid offline sync"
          : "Session not found",
      });
    }

    let attendance = await Attendance.findOne({
      session: sessionId,
      student: studentId,
    });

    if (!attendance) {
      try {
        attendance = new Attendance({
          session: sessionId,
          student: studentId,
          class: session.class,
          deviceInfo: {
            userAgent: req.headers["user-agent"],
            platform,
            ipAddress: req.ip,
          },
        });
        // We defer saving until calculation is done, BUT this leaves a race condition window.
        // Best practice: Try to save mostly-empty record first to reserve the spot, or handle E11000 at the end.
        // We will handle E11000 at `await attendance.save()` at the end of this function.
      } catch (err) {
        // Should not error here on instantiation
        console.error("Attendance instantiation error", err);
      }
    }

    // Validate BLE nonce (replay protection)
    if (verifications.ble?.nonce && session.location?.bleTokenSecret) {
      const bleValidation = await nonceStore.validateBLEToken(
        sessionId,
        verifications.ble.timestamp,
        verifications.ble.nonce,
        verifications.ble.signature,
        session.location.bleTokenSecret
      );
      verifications.ble.tokenValid = bleValidation.valid;
    }

    // Add attestation from request
    if (req.attestation) verifications.attestation = req.attestation;

    // ============ GPS AUTO-APPROVAL LOGIC ============
    // If GPS is verified and within radius, auto-approve without requiring other sensors
    // This is the primary verification method - if GPS passes, student is approved
    let gpsAutoApproved = false;
    let gpsVerificationResult = null;

    if (verifications.gps) {
      const sessionLocation = session.location?.coordinates;

      // Calculate GPS distance if not already provided
      if (
        !verifications.gps.distance &&
        sessionLocation?.latitude &&
        verifications.gps.latitude
      ) {
        verifications.gps.distance = calculateDistance(
          verifications.gps.latitude,
          verifications.gps.longitude,
          sessionLocation.latitude,
          sessionLocation.longitude
        );
      }

      const gpsRadius = sessionLocation?.radius || 100; // Default 100 meters
      const gpsDistance = verifications.gps.distance || 999;
      const gpsAccuracy = verifications.gps.accuracy || 0;

      // GPS is verified if student is within radius (accounting for GPS accuracy)
      const effectiveDistance = Math.max(0, gpsDistance - gpsAccuracy);
      const isWithinRadius = effectiveDistance <= gpsRadius;

      verifications.gps.verified =
        isWithinRadius && !verifications.gps.mockDetected;

      gpsVerificationResult = {
        verified: verifications.gps.verified,
        distance: gpsDistance,
        accuracy: gpsAccuracy,
        effectiveDistance,
        radius: gpsRadius,
        isWithinRadius,
      };

      // GPS AUTO-APPROVAL: If GPS is verified, auto-approve the attendance
      if (verifications.gps.verified) {
        gpsAutoApproved = true;
      }
    }

    // Perform sensor fusion for scoring (used for analytics, even if GPS auto-approved)
    const fusionResult = sensorFusion.performFusion(verifications);
    let outcome = fusionResult.outcome;

    // Override outcome if GPS auto-approved
    if (gpsAutoApproved) {
      outcome = {
        action: "AUTO_PRESENT",
        reason: "GPS location verified - within classroom radius",
        requiresTeacherAction: false,
      };
    } else if (verifications.gps && !verifications.gps.verified) {
      // GPS failed - mark as pending for teacher approval
      outcome = {
        action: "RED_FLAG",
        reason:
          "GPS verification failed - outside classroom radius or mock location detected",
        requiresTeacherAction: true,
      };
    }

    // Store verification data
    if (verifications.gps) {
      attendance.verificationData.gps = {
        verified: verifications.gps.verified,
        latitude: verifications.gps.latitude,
        longitude: verifications.gps.longitude,
        accuracy: verifications.gps.accuracy,
        distance: verifications.gps.distance,
        mockLocationDetected: verifications.gps.mockDetected || false,
        timestamp: new Date(),
      };
      attendance.verificationSteps.gpsCompleted = true;
    }
    if (verifications.ble) {
      attendance.verificationData.ble = {
        verified: verifications.ble.verified,
        rssi: verifications.ble.rssi,
        bleTokenValid: verifications.ble.tokenValid || false,
        timestamp: new Date(),
      };
      attendance.verificationSteps.bleCompleted = true;
    }
    if (verifications.face || verifications.fingerprint) {
      attendance.verificationData.biometric = {
        verified:
          verifications.face?.verified || verifications.fingerprint?.verified,
        type: verifications.fingerprint?.verified ? "fingerprint" : "face",
        confidence: verifications.face?.confidence || 100,
        timestamp: new Date(),
      };
      attendance.verificationSteps.biometricCompleted = true;
    }

    attendance.verificationScore = fusionResult.score;

    // Determine final attendance status based on outcome
    if (outcome.action === "AUTO_PRESENT") {
      attendance.status = "present";
      attendance.checkInTime = new Date();
      attendance.isVerified = true;
      attendance.hasAlert = false;
    } else if (outcome.action === "RED_FLAG") {
      attendance.status = "pending"; // Mark as pending for teacher review
      attendance.hasAlert = true;
      attendance.alertType = "gps_failed";
      attendance.alertMessage = outcome.reason;
    }

    try {
      await attendance.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        console.warn(
          `Race condition detected for student ${studentId} in session ${sessionId}. Recovering...`
        );
        const existing = await Attendance.findOne({
          session: sessionId,
          student: studentId,
        });

        if (existing) {
          // Merge the new verification data into the existing record
          if (attendance.verificationSteps.gpsCompleted) {
            existing.verificationData.gps = attendance.verificationData.gps;
            existing.verificationSteps.gpsCompleted = true;
          }
          if (attendance.verificationSteps.bleCompleted) {
            existing.verificationData.ble = attendance.verificationData.ble;
            existing.verificationSteps.bleCompleted = true;
          }
          if (attendance.verificationSteps.biometricCompleted) {
            existing.verificationData.biometric =
              attendance.verificationData.biometric;
            existing.verificationSteps.biometricCompleted = true;
            existing.verificationSteps.faceCompleted =
              attendance.verificationSteps.faceCompleted; // if applicable
          }

          existing.verificationScore = Math.max(
            existing.verificationScore,
            attendance.verificationScore
          );

          if (attendance.status === "present") {
            existing.status = "present";
            existing.checkInTime = attendance.checkInTime || new Date();
            existing.isVerified = true;
          }

          await existing.save();
          attendance = existing; // Update reference so response returns the saved doc
        }
      } else {
        throw saveError;
      }
    }
    if (session.updateStats) await session.updateStats();

    // Emit events
    if (req.app.io) {
      const studentData = await User.findById(studentId).select("name usn");
      req.app.io.to(`session-${sessionId}`).emit("verification-complete", {
        attendanceId: attendance._id,
        student: studentData,
        status: attendance.status,
        score: fusionResult.score,
        outcome: outcome.action,
        hasAlert: attendance.hasAlert,
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        attendance: {
          _id: attendance._id,
          status: attendance.status,
          score: fusionResult.score,
        },
        fusion: {
          score: fusionResult.score,
          outcome: outcome.action,
          flags: fusionResult.flags,
        },
      },
    });
  } catch (error) {
    console.error("Unified verification error:", error);
    next(error);
  }
};

/**
 * Resolve red flag - Teacher approve/deny
 */
exports.resolveRedFlag = async (req, res, next) => {
  try {
    const { attendanceId, action, notes } = req.body;
    const teacherId = req.user._id;

    const attendance = await Attendance.findById(attendanceId).populate(
      "session student"
    );
    if (!attendance) {
      return res
        .status(404)
        .json({ status: "error", message: "Attendance not found" });
    }
    if (attendance.session.teacher.toString() !== teacherId.toString()) {
      return res
        .status(403)
        .json({ status: "error", message: "Not authorized" });
    }

    attendance.status = action === "approve" ? "present" : "absent";
    if (action === "approve" && !attendance.checkInTime)
      attendance.checkInTime = new Date();
    attendance.hasAlert = false;
    attendance.markedBy = teacherId;
    attendance.notes = notes;

    await attendance.save();
    if (attendance.session.updateStats) await attendance.session.updateStats();

    // Log resolution
    const Log = require("../models/Log");
    await Log.create({
      userId: teacherId,
      userRole: "teacher",
      action: "red_flag_resolved",
      eventDescription: `Teacher ${action}d attendance for student`,
      metadata: {
        ipAddress: req.ip,
        sessionId: attendance.session._id.toString(),
        success: true,
      },
      severity: "info",
    });

    res.status(200).json({
      status: "success",
      message: `Red flag ${action}ed`,
      data: { attendance },
    });
  } catch (error) {
    console.error("Resolve red flag error:", error);
    next(error);
  }
};

/**
 * Real Face + GPS Verification
 * Compares student's live face descriptor against enrolled descriptor
 * Implements 3-tier status: auto-approve (green), pending (yellow), red-flag (red)
 */
exports.verifyWithRealFace = async (req, res, next) => {
  try {
    const { sessionId, gps, faceDescriptor } = req.body;
    const studentId = req.user._id || req.user.id;

    console.log(
      `\n🔐 [RealVerify] Starting verification for student ${studentId}`
    );

    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({
        status: "error",
        message: "Session ID is required",
      });
    }

    // Get session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    if (session.status !== "live") {
      return res.status(400).json({
        status: "error",
        message: "Session is not currently live",
      });
    }

    // Get student with enrolled face data
    const student = await User.findById(studentId).select(
      "name usn faceDescriptor biometricEnrolled"
    );

    if (!student) {
      return res.status(404).json({
        status: "error",
        message: "Student not found",
      });
    }

    // ============ GPS VERIFICATION ============
    let gpsVerified = false;
    let gpsDistance = 999;
    let gpsMessage = "GPS not provided";

    if (gps && gps.latitude && gps.longitude) {
      const sessionLocation = session.location?.coordinates;

      if (sessionLocation && sessionLocation.latitude) {
        gpsDistance = calculateDistance(
          gps.latitude,
          gps.longitude,
          sessionLocation.latitude,
          sessionLocation.longitude
        );

        const gpsRadius = sessionLocation.radius || 100;
        const gpsAccuracy = gps.accuracy || 0;
        const effectiveDistance = Math.max(0, gpsDistance - gpsAccuracy);

        gpsVerified = effectiveDistance <= gpsRadius;
        gpsMessage = gpsVerified
          ? `Within ${Math.round(gpsDistance)}m of classroom`
          : `Too far: ${Math.round(gpsDistance)}m (max: ${gpsRadius}m)`;
      } else {
        gpsMessage = "Session location not configured";
      }
    }

    console.log(
      `📍 [RealVerify] GPS: ${gpsVerified ? "✅" : "❌"} - ${gpsMessage}`
    );

    // ============ FACE VERIFICATION ============
    let faceVerified = false;
    let faceConfidence = 0;
    let faceMessage = "Face descriptor not provided";

    if (faceDescriptor && Array.isArray(faceDescriptor)) {
      // Check if student has enrolled face
      if (!student.faceDescriptor?.enrolled || !student.faceDescriptor?.data) {
        faceMessage =
          "Face not enrolled - please complete biometric enrollment first";
        console.log(`❌ [RealVerify] Student has no enrolled face`);
      } else {
        // Compare descriptors using COMBINED Euclidean + Cosine similarity
        const enrolledDescriptor = student.faceDescriptor.data;
        const distance = euclideanDistance(faceDescriptor, enrolledDescriptor);
        const similarity = cosineSimilarity(faceDescriptor, enrolledDescriptor);

        // Use relaxed thresholds matching authController (0.55 for Euclidean, 0.85 for Cosine)
        const FACE_THRESHOLD = 0.55;
        const COSINE_THRESHOLD = 0.85;

        // Match if EITHER metric passes (more lenient for better accuracy)
        const euclideanMatch = distance < FACE_THRESHOLD;
        const cosineMatch = similarity > COSINE_THRESHOLD;
        faceVerified = euclideanMatch || cosineMatch;

        // Use combined confidence for better accuracy
        faceConfidence = combinedConfidence(
          distance,
          similarity,
          FACE_THRESHOLD
        );

        faceMessage = faceVerified
          ? `Face matched (${faceConfidence}% confidence, dist=${distance.toFixed(
              3
            )}, sim=${similarity.toFixed(3)})`
          : `Face did NOT match (${faceConfidence}% confidence, need euclidean<${FACE_THRESHOLD} OR cosine>${COSINE_THRESHOLD})`;

        console.log(
          `🧑 [RealVerify] Face: dist=${distance.toFixed(
            4
          )}, sim=${similarity.toFixed(
            4
          )}, euclideanMatch=${euclideanMatch}, cosineMatch=${cosineMatch}`
        );
      }
    }

    console.log(
      `🧑 [RealVerify] Face: ${faceVerified ? "✅" : "❌"} - ${faceMessage}`
    );

    // ============ DETERMINE STATUS ============
    let status = "absent";
    let alertType = null;
    let alertMessage = "";
    let requiresTeacherAction = false;

    if (gpsVerified && faceVerified) {
      // Both passed - AUTO APPROVE (Green)
      status = "present";
      alertType = null;
      alertMessage = "";
      console.log(`✅ [RealVerify] AUTO-APPROVED: Both GPS and Face verified`);
    } else if (gpsVerified || faceVerified) {
      // One passed - PENDING (Yellow)
      status = "pending";
      requiresTeacherAction = true;
      if (!gpsVerified) {
        alertType = "gps_failed";
        alertMessage = `GPS failed: ${gpsMessage}. Face verified.`;
      } else {
        alertType = "face_failed";
        alertMessage = `Face failed: ${faceMessage}. GPS verified.`;
      }
      console.log(`⚠️ [RealVerify] PENDING: One verification failed`);
    } else {
      // Both failed - RED FLAG
      status = "pending";
      requiresTeacherAction = true;
      alertType = "both_failed";
      alertMessage = `Both failed - GPS: ${gpsMessage}, Face: ${faceMessage}`;
      console.log(`🚨 [RealVerify] RED FLAG: Both verifications failed`);
    }

    // ============ CREATE/UPDATE ATTENDANCE RECORD ============
    let attendance = await Attendance.findOne({
      session: sessionId,
      student: studentId,
    });

    if (!attendance) {
      attendance = new Attendance({
        session: sessionId,
        student: studentId,
        class: session.class,
        deviceInfo: {
          userAgent: req.headers["user-agent"],
          platform: req.body.platform || "web",
          ipAddress: req.ip,
        },
      });
    }

    // Update verification data
    attendance.verificationData.gps = {
      verified: gpsVerified,
      latitude: gps?.latitude,
      longitude: gps?.longitude,
      accuracy: gps?.accuracy,
      distance: gpsDistance,
      timestamp: new Date(),
    };
    attendance.verificationSteps.gpsCompleted = true;

    attendance.verificationData.biometric = {
      verified: faceVerified,
      type: "face",
      confidence: faceConfidence,
      timestamp: new Date(),
    };
    attendance.verificationSteps.biometricCompleted = true;

    // Set status
    attendance.status = status;
    attendance.hasAlert = requiresTeacherAction;
    attendance.alertType = alertType;
    attendance.alertMessage = alertMessage;

    if (status === "present") {
      attendance.checkInTime = new Date();
      attendance.isVerified = true;
    }

    await attendance.save();

    // Update session stats
    if (session.updateStats) await session.updateStats();

    // ============ EMIT REAL-TIME UPDATE ============
    if (req.app.io) {
      req.app.io.to(`session-${sessionId}`).emit("student-verification", {
        attendanceId: attendance._id,
        student: { _id: student._id, name: student.name, usn: student.usn },
        status: attendance.status,
        gpsVerified,
        faceVerified,
        faceConfidence,
        hasAlert: attendance.hasAlert,
        alertType,
        alertMessage,
        checkInTime: attendance.checkInTime,
        requiresTeacherAction,
      });
    }

    // ============ RETURN RESPONSE ============
    res.status(200).json({
      status: "success",
      message:
        status === "present"
          ? "Attendance marked successfully!"
          : "Verification submitted - awaiting teacher approval",
      data: {
        attendance: {
          _id: attendance._id,
          status: attendance.status,
          checkInTime: attendance.checkInTime,
        },
        verification: {
          gpsVerified,
          gpsDistance: Math.round(gpsDistance),
          gpsMessage,
          faceVerified,
          faceConfidence,
          faceMessage,
        },
        outcome: status === "present" ? "AUTO_APPROVED" : "PENDING_APPROVAL",
        requiresTeacherAction,
      },
    });
  } catch (error) {
    console.error("Real face verification error:", error);
    next(error);
  }
};

// =============================================
// QUEUE-BASED ATTENDANCE MARKING (Phase 3)
// =============================================

/**
 * Mark attendance via Redis queue for high-concurrency handling
 * Returns 200 OK immediately - actual DB write happens in background worker
 *
 * This is the API Gateway pattern - instant response, background processing.
 *
 * @route POST /api/attendance/mark-queued
 * @access Private (Student)
 */
exports.markAttendanceQueued = async (req, res, next) => {
  try {
    const {
      sessionId,
      gps,
      livenessImageBase64,
      livenessScore,
      deviceId,
      platform,
      offlineId, // Client-generated ID for offline sync
      queuedAt, // When client originally attempted to mark (for offline)
    } = req.body;

    const studentId = req.user._id.toString();
    const studentName = req.user.name;

    // ============================================
    // INPUT VALIDATION (Fast - no DB queries here)
    // ============================================

    if (!sessionId) {
      return res.status(400).json({
        status: "error",
        message: "Session ID is required",
        code: "MISSING_SESSION_ID",
      });
    }

    if (
      !gps ||
      typeof gps.latitude !== "number" ||
      typeof gps.longitude !== "number"
    ) {
      return res.status(400).json({
        status: "error",
        message: "Valid GPS coordinates are required",
        code: "INVALID_GPS",
      });
    }

    // ============================================
    // SERIALIZE DATA FOR QUEUE
    // ============================================

    const attendanceData = {
      session: sessionId,
      student: studentId,
      studentName,

      // GPS data
      verificationData: {
        gps: {
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracy: gps.accuracy || 0,
          timestamp: new Date(),
        },
      },

      // Device info
      deviceInfo: {
        userAgent: req.headers["user-agent"],
        platform: platform || "unknown",
        deviceId: deviceId || null,
        ipAddress: req.ip,
      },

      // Liveness data (if provided)
      livenessVerified: (livenessScore || 0) >= 0.8,
      livenessScore: livenessScore || 0,

      // Offline sync metadata
      offlineId: offlineId || null,
      queuedAt: queuedAt ? new Date(queuedAt) : new Date(),

      // Image stored separately (base64 for now, could be S3 URL)
      livenessImageBase64: livenessImageBase64 || null,
    };

    // ============================================
    // ADD TO QUEUE (Instant return)
    // ============================================

    console.log(
      `📤 [Queue] Adding attendance job for student ${studentId} in session ${sessionId}`
    );

    const queueResult = await queueService.addAttendanceJob(
      attendanceData,
      studentId,
      sessionId
    );

    // ============================================
    // IMMEDIATE RESPONSE
    // ============================================

    // If queue is unavailable, queueService has fallback to direct write
    if (queueResult.fallback) {
      console.log(`⚠️ [Queue] Used fallback direct write for ${studentId}`);
      return res.status(200).json({
        status: "success",
        message: "Attendance recorded (direct)",
        data: {
          attendanceId: queueResult.attendanceId,
          jobId: null,
          pending: false,
          fallback: true,
        },
      });
    }

    // Normal queue response - instant!
    return res.status(200).json({
      status: "success",
      message: "Attendance received, processing in background",
      data: {
        jobId: queueResult.jobId,
        pending: true,
        offlineId: offlineId || null,
        estimatedProcessingTime: "< 5 seconds",
      },
    });
  } catch (error) {
    console.error("❌ [Queue] markAttendanceQueued error:", error);

    // Return error but don't crash - client may retry
    return res.status(500).json({
      status: "error",
      message: "Failed to queue attendance. Please try again.",
      code: "QUEUE_ERROR",
      retryable: true,
    });
  }
};
