import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }], // [admin, user]
    lastMessageAt: { type: Date }
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 }, { unique: false });
export default mongoose.model("Conversation", conversationSchema);
