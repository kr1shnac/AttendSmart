const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const messageController = require("../controllers/messageController");

// ============================================
// CONVERSATIONS (WhatsApp-style chat list)
// ============================================

// Get all conversations for current user
router.get("/conversations", protect, messageController.getConversations);

// Get messages in a conversation
router.get(
  "/conversations/:conversationId/messages",
  protect,
  messageController.getMessages
);

// Start new conversation
router.post("/conversations", protect, messageController.startConversation);

// ============================================
// MESSAGING
// ============================================

// Send message
router.post("/send", protect, messageController.sendMessage);

// Send broadcast (admin/teacher only)
router.post(
  "/broadcast",
  protect,
  messageController.checkBroadcastPermission,
  messageController.sendBroadcast
);

// ============================================
// CONTACTS
// ============================================

// Get available contacts (for starting new chats)
router.get("/contacts", protect, messageController.getContacts);

module.exports = router;
