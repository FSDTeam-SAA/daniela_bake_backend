import express from "express";
import { protect } from "../middleware/auth.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getOrCreateConversation, listConversations, getMessages, sendMessage, markRead
} from "../controllers/chat.controller.js";

const router = express.Router();
router.use(protect);

router.get("/conversations", listConversations);
router.post("/conversations", getOrCreateConversation);
router.get("/messages/:conversationId", getMessages);
router.post("/messages/:conversationId", upload.single("attachment"), sendMessage);
router.post("/messages/:conversationId/read", markRead);

export default router;
