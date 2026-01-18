const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // Message content
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    // Sender info
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["admin", "teacher", "student"],
      required: true,
    },

    // Message type
    messageType: {
      type: String,
      enum: ["direct", "group", "broadcast", "announcement"],
      required: true,
      default: "direct",
    },

    // For direct messages
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // For group/broadcast messages
    recipients: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        read: {
          type: Boolean,
          default: false,
        },
        readAt: Date,
      },
    ],

    // Channel/Group info
    channel: {
      type: String,
      enum: ["community", "teachers", "class", "direct", "announcement"],
    },
    channelId: {
      type: String, // Format example: "class_123" or "direct_123_456"
    },

    // For class-specific messages
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },

    // Message metadata
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    expiresAt: Date,

    // Reply/Thread support
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Deleted messages (soft delete)
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Reactions - NEW
    reactions: [
      {
        emoji: {
          type: String,
          enum: ["👍", "❤️", "😂", "🔥", "👏"],
          required: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Mentions - NEW
    mentions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        name: String, // Display name e.g. "Alice Johnson"
        position: Number, // Position in message string (optional)
      },
    ],

    // Edited message tracking - NEW
    editedAt: Date,
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipientUser: 1, createdAt: -1 });
messageSchema.index({ "recipients.user": 1, createdAt: -1 });
messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ classId: 1, createdAt: -1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Message", messageSchema);
