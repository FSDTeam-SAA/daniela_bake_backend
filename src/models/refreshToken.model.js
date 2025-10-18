import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    token: { type: String, required: true, index: true }, // store as opaque string (can be JWT too)
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto TTL
export default mongoose.model("RefreshToken", refreshTokenSchema);
