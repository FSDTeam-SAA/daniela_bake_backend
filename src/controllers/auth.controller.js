import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import PasswordReset from "../models/passwordReset.model.js";
import { sendSuccess } from "../utils/response.js";

const signAccess = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });
const makeOpaque = () => crypto.randomBytes(48).toString("hex");

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const exists = await User.findOne({ email });
  if (exists) { res.status(400); throw new Error("Email already in use"); }
  const user = await User.create({ name, email, password, role });
  res.status(201);
  sendSuccess(res, { id: user._id, email: user.email }, "User registered successfully");
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401); throw new Error("Invalid credentials");
  }
  user.lastLogin = new Date(); await user.save();
  const accessToken = signAccess(user._id);
  const refreshToken = makeOpaque();
  await RefreshToken.create({ user: user._id, token: refreshToken, expiresAt: new Date(Date.now()+1000*60*60*24*7) }); // 7 days
  sendSuccess(
    res,
    {
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    },
    "Login successful"
  );
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const doc = await RefreshToken.findOne({ token: refreshToken });
  if (!doc) { res.status(401); throw new Error("Invalid refresh token"); }
  const accessToken = signAccess(doc.user);
  sendSuccess(res, { accessToken }, "Access token refreshed");
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await RefreshToken.deleteOne({ token: refreshToken });
  sendSuccess(res, null, "Logged out");
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.comparePassword(currentPassword))) {
    res.status(400); throw new Error("Current password incorrect");
  }
  user.password = newPassword;
  await user.save();
  sendSuccess(res, null, "Password updated successfully");
});

// --- Forgot/Reset via OTP ---
const generateOTP = () => Math.floor(100000 + Math.random()*900000).toString();

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) { res.status(404); throw new Error("No user for email"); }
  const otp = generateOTP();
  await PasswordReset.create({
    user: user._id,
    email,
    otp,
    expiresAt: new Date(Date.now()+1000*60*10) // 10 min
  });
  // TODO: send via real email/SMS; for now return it for testing
  sendSuccess(res, { otp }, "OTP generated"); // remove otp in production
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const entry = await PasswordReset.findOne({ email, otp, used: false });
  if (!entry || entry.expiresAt < new Date()) { res.status(400); throw new Error("OTP invalid or expired"); }
  sendSuccess(res, null, "OTP valid");
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const entry = await PasswordReset.findOne({ email, otp, used: false });
  if (!entry || entry.expiresAt < new Date()) { res.status(400); throw new Error("OTP invalid or expired"); }
  const user = await User.findOne({ email }).select("+password");
  user.password = newPassword; await user.save();
  entry.used = true; await entry.save();
  // revoke all refresh tokens for security
  await RefreshToken.deleteMany({ user: user._id });
  sendSuccess(res, null, "Password reset successful");
});
