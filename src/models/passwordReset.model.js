import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    email: { type: String, required: true },
    otp: { type: String, required: true }, // 6-digit code (store as string)
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false }
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("PasswordReset", passwordResetSchema);
