const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // Conversation type
    type: {
      type: String,
      enum: ["direct", "group", "class", "channel"],
      required: true,
    },

    // Participants
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "teacher", "student"],
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        lastRead: Date,
      },
    ],

    // For class conversations
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },

    // Channel info (for community, teachers-only)
    channel: {
      type: String,
      enum: ["community", "teachers"],
    },

    // Conversation metadata
    name: String, // For group/class names
    description: String,
    avatar: String,

    // Last message info
    lastMessage: {
      text: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      timestamp: Date,
    },

    // Admin-initiated conversations (for visibility control)
    initiatedByAdmin: {
      type: Boolean,
      default: false,
    },

    // Muted/Archived
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // NEW: Typing users tracking
    typingUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        lastTypingAt: Date,
      },
    ],

    // NEW: Unread message count per user
    unreadCount: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

// Indexes
conversationSchema.index({ "participants.user": 1 });
conversationSchema.index({ classId: 1 });
conversationSchema.index({ channel: 1 });
conversationSchema.index({ "lastMessage.timestamp": -1 });

module.exports = mongoose.model("Conversation", conversationSchema);
