import asyncHandler from "express-async-handler";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { uploadToCloudinary } from "../utils/uploadImage.js";
import { sendSuccess } from "../utils/response.js";

const buildSuccessPayload = (data, message) => ({
  success: true,
  message,
  data,
});

// ensure a conversation between two users (admin<->user)
export const getOrCreateConversation = asyncHandler(async (req, res) => {
  const { userId } = req.body; // target user id (if admin) or admin id (if user)
  const a = req.user._id.toString();
  const b = userId;
  let conv = await Conversation.findOne({ participants: { $all: [a, b] } });
  if (!conv) conv = await Conversation.create({ participants: [a, b], lastMessageAt: new Date() });
  sendSuccess(res, conv, "Conversation ready");
});

export const listConversations = asyncHandler(async (req, res) => {
  const convs = await Conversation.find({ participants: req.user._id })
    .sort("-updatedAt")
    .populate("participants", "name email role");
  sendSuccess(res, convs, "Conversations fetched successfully");
});

export const getMessages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const messages = await Message.find({ conversation: req.params.conversationId })
    .sort("-createdAt")
    .skip((page - 1) * limit)
    .limit(Number(limit))
    // .populate("sender", "name role")
    // .populate("receiver", "name role");
  sendSuccess(res, messages.reverse(), "Messages fetched successfully");
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { text, receiverId } = req.body;

  let attachment = undefined;
  if (req.file) {
    const up = await uploadToCloudinary(req.file.path);
    attachment = { url: up.secure_url || up.url, public_id: up.public_id };
  }

  const msg = await Message.create({
    conversation: conversationId,
    sender: req.user._id,
    receiver: receiverId,
    text,
    attachment
  });

  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });

  await msg.populate([
    { path: "sender", select: "name role" },
    { path: "receiver", select: "name role" },
  ]);

  const messageData = msg.toObject();
  const responseData = [messageData];
  const socketPayload = buildSuccessPayload(responseData, "Message sent successfully");

  req.io?.to(conversationId.toString()).emit("message", socketPayload);

  res.status(201);
  sendSuccess(res, responseData, "Message sent successfully");
});

export const markRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  await Message.updateMany(
    { conversation: conversationId, receiver: req.user._id, readAt: { $exists: false } },
    { $set: { readAt: new Date() } }
  );
  const data = { conversationId, userId: req.user._id };
  const payload = buildSuccessPayload(data, "Messages marked as read");
  req.io?.to(conversationId).emit("message:read", payload);
  sendSuccess(res, data, "Messages marked as read");
});
