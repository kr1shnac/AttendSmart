/**
 * Session Manager Service
 * Centralized session management for live attendance sessions
 * Handles session lifecycle, participant tracking, and cleanup
 */

const Session = require("../models/Session");
const Attendance = require("../models/Attendance");
const Class = require("../models/Class");

class SessionManager {
  /**
   * Get active live session for a teacher
   * @param {ObjectId} teacherId - Teacher's user ID
   * @returns {Object|null} Active session or null
   */
  async getActiveSessionForTeacher(teacherId) {
    const session = await Session.findOne({
      teacher: teacherId,
      status: "live",
    })
      .populate("class", "subject courseCode className")
      .sort({ startTime: -1 });

    return session;
  }

  /**
   * Check if teacher can create a new session
   * @param {ObjectId} teacherId - Teacher's user ID
   * @returns {Object} { canCreate: boolean, existingSession?: Object }
   */
  async canCreateSession(teacherId) {
    const existingSession = await this.getActiveSessionForTeacher(teacherId);

    if (existingSession) {
      return {
        canCreate: false,
        existingSession: {
          id: existingSession._id,
          topic: existingSession.topic,
          class: existingSession.class,
          startTime: existingSession.startTime,
        },
      };
    }

    return { canCreate: true };
  }

  /**
   * Add a participant to a session
   * @param {ObjectId} sessionId - Session ID
   * @param {ObjectId} userId - User ID
   * @param {String} socketId - Socket.IO socket ID
   * @param {String} role - 'teacher' or 'student'
   */
  async addParticipant(sessionId, userId, socketId, role) {
    const now = new Date();

    const session = await Session.findById(sessionId);
    if (!session || session.status !== "live") {
      return { success: false, error: "Session not active" };
    }

    // Remove any existing entry for this user (reconnection case)
    session.connectedParticipants = session.connectedParticipants.filter(
      (p) => p.userId.toString() !== userId.toString()
    );

    // Add new participant entry
    session.connectedParticipants.push({
      userId,
      role,
      socketId,
      connectedAt: now,
      lastSeen: now,
    });

    // Update teacher connection status
    if (role === "teacher") {
      session.teacherConnected = true;
    }

    session.lastHeartbeat = now;
    await session.save();

    return {
      success: true,
      participantCount: session.connectedParticipants.length,
    };
  }

  /**
   * Remove a participant from a session (on disconnect)
   * @param {ObjectId} sessionId - Session ID
   * @param {ObjectId} userId - User ID
   */
  async removeParticipant(sessionId, userId) {
    const session = await Session.findById(sessionId);
    if (!session) return { success: false };

    const participant = session.connectedParticipants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (!participant) return { success: false };

    // Remove participant
    session.connectedParticipants = session.connectedParticipants.filter(
      (p) => p.userId.toString() !== userId.toString()
    );

    // Update teacher connection status
    if (participant.role === "teacher") {
      session.teacherConnected = false;
    }

    await session.save();

    return {
      success: true,
      participantCount: session.connectedParticipants.length,
      wasTeacher: participant.role === "teacher",
    };
  }

  /**
   * Record heartbeat from a participant
   * @param {ObjectId} sessionId - Session ID
   * @param {ObjectId} userId - User ID
   */
  async recordHeartbeat(sessionId, userId) {
    const now = new Date();

    const session = await Session.findById(sessionId);
    if (!session || session.status !== "live") {
      return { success: false, error: "Session not active" };
    }

    // Update participant's lastSeen
    const participant = session.connectedParticipants.find(
      (p) => p.userId.toString() === userId.toString()
    );

    if (participant) {
      participant.lastSeen = now;
    }

    session.lastHeartbeat = now;
    await session.save();

    return { success: true };
  }

  /**
   * End a session and save final data
   * @param {ObjectId} sessionId - Session ID
   * @param {String} reason - 'manual', 'auto_cleanup', 'force_end'
   * @param {ObjectId} endedBy - User who ended the session (optional)
   */
  async endSession(sessionId, reason = "manual", endedBy = null) {
    const session = await Session.findById(sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.status !== "live") {
      return { success: false, error: "Session is not active" };
    }

    // Update session status
    session.status = "completed";
    session.completedAt = new Date();
    session.endedReason = reason;
    session.teacherConnected = false;
    session.connectedParticipants = [];

    await session.save();

    // Update final attendance statistics
    await session.updateStats();

    return {
      success: true,
      session: {
        id: session._id,
        presentCount: session.presentCount,
        absentCount: session.absentCount,
        attendancePercentage: session.attendancePercentage,
      },
    };
  }

  /**
   * Get session with student's attendance status
   * @param {ObjectId} sessionId - Session ID
   * @param {ObjectId} studentId - Student's user ID
   */
  async getSessionForStudent(sessionId, studentId) {
    const session = await Session.findById(sessionId)
      .populate("class", "subject courseCode className")
      .populate("teacher", "name");

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Get student's attendance record
    const attendance = await Attendance.findOne({
      session: sessionId,
      student: studentId,
    });

    return {
      success: true,
      session,
      attendance: attendance
        ? {
            status: attendance.status,
            checkInTime: attendance.checkInTime,
            isVerified: attendance.isVerified,
            verificationScore: attendance.verificationScore,
          }
        : null,
    };
  }

  /**
   * Get active sessions for a student (based on enrolled classes)
   * @param {ObjectId} studentId - Student's user ID
   */
  async getActiveSessionsForStudent(studentId) {
    // Find classes the student is enrolled in
    const classes = await Class.find({
      $or: [{ "students.studentId": studentId }, { students: studentId }],
    }).select("_id");

    const classIds = classes.map((c) => c._id);

    // Find active sessions for those classes
    const sessions = await Session.find({
      class: { $in: classIds },
      status: "live",
    })
      .populate("class", "subject courseCode className")
      .populate("teacher", "name")
      .sort({ startTime: -1 });

    // Get attendance status for each session
    const sessionsWithAttendance = await Promise.all(
      sessions.map(async (session) => {
        const attendance = await Attendance.findOne({
          session: session._id,
          student: studentId,
        });

        return {
          ...session.toObject(),
          attendanceStatus: attendance?.status || "pending",
          hasMarkedAttendance: attendance?.status === "present",
        };
      })
    );

    return sessionsWithAttendance;
  }

  /**
   * Cleanup stale/abandoned sessions
   * Called by cron job
   * @param {Number} staleThresholdMinutes - Minutes after which session is considered stale
   */
  async cleanupAbandonedSessions(staleThresholdMinutes = 30) {
    const staleThreshold = new Date(
      Date.now() - staleThresholdMinutes * 60 * 1000
    );

    const staleSessions = await Session.find({
      status: "live",
      lastHeartbeat: { $lt: staleThreshold },
      teacherConnected: false,
    });

    const results = [];

    for (const session of staleSessions) {
      const result = await this.endSession(session._id, "auto_cleanup");
      results.push({
        sessionId: session._id,
        topic: session.topic,
        ...result,
      });
      console.log(`[SessionManager] Auto-ended stale session: ${session._id}`);
    }

    return {
      cleanedCount: results.length,
      sessions: results,
    };
  }

  /**
   * Get session statistics for a session
   * @param {ObjectId} sessionId - Session ID
   */
  async getSessionStats(sessionId) {
    const session = await Session.findById(sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    return {
      success: true,
      stats: {
        expectedStudents: session.expectedStudents,
        presentCount: session.presentCount,
        absentCount: session.absentCount,
        attendancePercentage: session.attendancePercentage,
        connectedCount: session.connectedParticipants.length,
        teacherConnected: session.teacherConnected,
        duration: session.duration,
        startTime: session.startTime,
        status: session.status,
      },
    };
  }

  /**
   * Get participant list for a session
   * @param {ObjectId} sessionId - Session ID
   */
  async getConnectedParticipants(sessionId) {
    const session = await Session.findById(sessionId).populate(
      "connectedParticipants.userId",
      "name usn email role"
    );

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    return {
      success: true,
      participants: session.connectedParticipants,
      count: session.connectedParticipants.length,
    };
  }
}

// Export singleton instance
module.exports = new SessionManager();
