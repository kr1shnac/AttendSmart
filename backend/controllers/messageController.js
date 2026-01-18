const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const Class = require("../models/Class");

// Utility: send Socket.io event to participants
const emitToConversation = (io, conversationId, event, data) => {
  io.to(conversationId.toString()).emit(event, data);
};

// Helper: parse @mentions in message text and validate users
const extractMentions = async (message) => {
  const mentionRegex = /@([\w\d]+)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(message)) !== null) {
    const username = match[1];
    const user = await User.findOne({
      name: new RegExp(`^${username}$`, "i"),
    }).select("_id name");
    if (user) {
      mentions.push({ user: user._id, name: user.name, position: match.index });
    }
  }

  return mentions;
};

// ============================================
// GET CONVERSATIONS (WhatsApp-style chat list)
// ============================================
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let conversations;

    if (userRole === "admin") {
      conversations = await Conversation.find()
        .populate("participants.user", "name email role")
        .populate("lastMessage.sender", "name")
        .sort({ "lastMessage.timestamp": -1 });
    } else if (userRole === "teacher") {
      conversations = await Conversation.find({
        $or: [{ "participants.user": userId }, { channel: "teachers" }],
      })
        .populate("participants.user", "name email role")
        .populate("lastMessage.sender", "name")
        .sort({ "lastMessage.timestamp": -1 });
    } else {
      conversations = await Conversation.find({
        "participants.user": userId,
        $or: [
          { type: "class" },
          {
            type: "direct",
            $or: [
              { initiatedByAdmin: true },
              { "participants.role": { $ne: "admin" } },
            ],
          },
        ],
      })
        .populate("participants.user", "name email role")
        .populate("lastMessage.sender", "name")
        .sort({ "lastMessage.timestamp": -1 });
    }

    res.status(200).json({
      success: true,
      data: { conversations },
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
      error: error.message,
    });
  }
};

// ============================================
// GET MESSAGES IN A CONVERSATION
// ============================================
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    const { limit = 50, before } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user.toString() === userId
    );

    if (!isParticipant && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation",
      });
    }

    const query = {
      $or: [
        { channelId: conversationId },
        {
          recipientUser: userId,
          sender: { $in: conversation.participants.map((p) => p.user) },
        },
      ],
      deletedBy: { $ne: userId },
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender", "name email role")
      .populate("replyTo", "message sender")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        channelId: conversationId,
        "recipients.user": userId,
        "recipients.read": false,
      },
      {
        $set: {
          "recipients.$.read": true,
          "recipients.$.readAt": new Date(),
        },
      }
    );

    // Update conversation last read
    await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $set: { "participants.$[elem].lastRead": new Date() },
      },
      {
        arrayFilters: [{ "elem.user": userId }],
      }
    );

    res
      .status(200)
      .json({ success: true, data: { messages: messages.reverse() } });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
      error: error.message,
    });
  }
};

// ============================================
// SEND MESSAGE (Supports urgency and mentions)
// ============================================
exports.sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      message,
      replyTo,
      priority = "normal",
      mentions = [],
    } = req.body;
    const senderId = req.user.userId;
    const senderRole = req.user.role;

    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message content is required" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.user.toString() === senderId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this conversation",
      });
    }

    if (conversation.channel === "community" && senderRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can post in community channel",
      });
    }

    const recipients = conversation.participants.map((p) => ({
      user: p.user,
      read: p.user.toString() === senderId,
    }));

    const newMessage = new Message({
      message: message.trim(),
      sender: senderId,
      senderRole,
      messageType: conversation.type === "direct" ? "direct" : "group",
      channelId: conversationId,
      classId: conversation.classId,
      channel: conversation.channel,
      replyTo: replyTo || null,
      priority,
      mentions,
      recipients,
    });

    await newMessage.save();

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        text: message.trim().substring(0, 100),
        sender: senderId,
        timestamp: new Date(),
      },
    });

    await newMessage.populate("sender", "name email role");

    // Emit socket event for urgent messages if priority is urgent
    if (priority === "urgent") {
      const io = req.app.get("io");
      io.to(conversationId.toString()).emit("urgent-notification", {
        message: newMessage.message,
        conversationId,
        sender: newMessage.sender.name,
        priority: "urgent",
      });
    }

    // Notify mentioned users
    if (mentions.length > 0) {
      const io = req.app.get("io");
      mentions.forEach((mentionedUserId) => {
        io.to(mentionedUserId.toString()).emit("mention-notification", {
          message: newMessage.message,
          sender: newMessage.sender.name,
          conversationId,
          mentionedUserId,
        });
      });
    }

    res.status(201).json({ success: true, data: { message: newMessage } });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
};

// ============================================
// START CONVERSATION (Create new chat)
// ============================================
exports.startConversation = async (req, res) => {
  try {
    const { recipientId, type, classId } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (type === "direct" && !recipientId) {
      return res.status(400).json({
        success: false,
        message: "Recipient is required for direct messages",
      });
    }

    if (userRole === "student" && recipientId) {
      const recipient = await User.findById(recipientId);
      if (recipient && recipient.role === "admin") {
        return res.status(403).json({
          success: false,
          message: "Students cannot initiate conversations with admins",
        });
      }
    }

    let conversation;

    if (type === "direct") {
      conversation = await Conversation.findOne({
        type: "direct",
        "participants.user": { $all: [userId, recipientId] },
      });
    } else if (type === "class" && classId) {
      conversation = await Conversation.findOne({ type: "class", classId });
    }

    if (conversation) {
      await conversation.populate("participants.user", "name email role");
      return res.status(200).json({ success: true, data: { conversation } });
    }

    const newConversation = new Conversation({
      type,
      participants: [{ user: userId, role: userRole }],
      initiatedByAdmin: userRole === "admin",
    });

    if (type === "direct") {
      const recipient = await User.findById(recipientId);
      newConversation.participants.push({
        user: recipientId,
        role: recipient.role,
      });
      newConversation.name = `${userRole} - ${recipient.role}`;
    } else if (type === "class" && classId) {
      const classData = await Class.findById(classId).populate("students");
      newConversation.classId = classId;
      newConversation.name = classData.className || "Class Group";
      newConversation.participants = [
        { user: classData.teacher, role: "teacher" },
        ...classData.students.map((s) => ({ user: s._id, role: "student" })),
      ];
    }

    await newConversation.save();
    await newConversation.populate("participants.user", "name email role");

    res
      .status(201)
      .json({ success: true, data: { conversation: newConversation } });
  } catch (error) {
    console.error("Start conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start conversation",
      error: error.message,
    });
  }
};

// ============================================
// BROADCAST MESSAGE (Admin/Teacher Announcements with priority & notifications)
// ============================================
exports.sendBroadcast = async (req, res) => {
  try {
    const {
      subject,
      message,
      targetRoles,
      classId,
      priority = "normal",
    } = req.body;
    const senderId = req.user.userId;
    const senderRole = req.user.role;

    if (!message || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message content is required" });
    }

    let recipients = [];
    let channelName = "";

    if (targetRoles && targetRoles.includes("all")) {
      if (senderRole !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can broadcast to entire community",
        });
      }
      recipients = await User.find({}).select("_id role");
      channelName = "community";
    } else if (targetRoles && targetRoles.includes("teacher")) {
      if (senderRole !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only admins can broadcast to teachers",
        });
      }
      recipients = await User.find({ role: "teacher" }).select("_id role");
      channelName = "teachers";
    } else if (classId) {
      const classData = await Class.findById(classId);
      if (!classData) {
        return res
          .status(404)
          .json({ success: false, message: "Class not found" });
      }
      if (
        senderRole === "teacher" &&
        classData.teacher.toString() !== senderId
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only broadcast to your own class",
        });
      }
      recipients = await User.find({ _id: { $in: classData.students } }).select(
        "_id role"
      );
      channelName = "class";
    }

    if (recipients.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No recipients found" });
    }

    const broadcast = new Message({
      subject: subject?.trim(),
      message: message.trim(),
      sender: senderId,
      senderRole,
      messageType: "broadcast",
      channel: channelName,
      classId: classId || null,
      priority,
      recipients: recipients.map((r) => ({ user: r._id, read: false })),
    });

    await broadcast.save();

    // TODO: Emit urgent notifications for urgent broadcasts via Socket.io

    res.status(201).json({
      success: true,
      message: "Broadcast sent successfully",
      data: { messageId: broadcast._id, recipientCount: recipients.length },
    });
  } catch (error) {
    console.error("Send broadcast error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send broadcast",
      error: error.message,
    });
  }
};

// ============================================
// GET AVAILABLE CONTACTS (For starting new chats)
// ============================================
exports.getContacts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let contacts = [];

    if (userRole === "admin") {
      contacts = await User.find({ _id: { $ne: userId } }).select(
        "name email role"
      );
    } else if (userRole === "teacher") {
      contacts = await User.find({
        _id: { $ne: userId },
        role: { $in: ["student", "teacher", "admin"] },
      }).select("name email role");
    } else {
      const user = await User.findById(userId).populate("enrolledClasses");
      const classIds = user?.enrolledClasses?.map((c) => c._id) || [];

      const classes = await Class.find({ _id: { $in: classIds } });
      const teacherIds = classes.map((c) => c.teacher);
      const studentIds = classes.flatMap((c) => c.students);

      contacts = await User.find({
        _id: { $in: [...teacherIds, ...studentIds], $ne: userId },
        role: { $ne: "admin" },
      }).select("name email role");

      const adminConversations = await Conversation.find({
        "participants.user": userId,
        initiatedByAdmin: true,
      }).populate("participants.user", "name email role");

      const adminsWhoInitiated = adminConversations
        .flatMap((c) => c.participants)
        .filter((p) => p.user.role === "admin")
        .map((p) => p.user);

      contacts = [...contacts, ...adminsWhoInitiated];
    }

    res.status(200).json({ success: true, data: { contacts } });
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
      error: error.message,
    });
  }
};

// Permission check middleware for broadcasts
exports.checkBroadcastPermission = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "teacher") {
    return res.status(403).json({
      success: false,
      message: "Only admins and teachers can send broadcasts",
    });
  }
  next();
};
