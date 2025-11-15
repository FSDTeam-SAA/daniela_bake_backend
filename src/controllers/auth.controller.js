import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import PasswordReset from "../models/passwordReset.model.js";
import { sendSuccess } from "../utils/response.js";
import { sendMail } from "../utils/mailer.js";
import Profile from "../models/profile.model.js";


const signAccess = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });
const makeOpaque = () => crypto.randomBytes(48).toString("hex");

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error("Email already in use");
  }

  // 1) create user
  const user = await User.create({ name, email, password, role });

  // 2) create matching profile (name copied to fullName)
  await Profile.create({
    user: user._id,
    fullName: user.name,   // <-- same name as User
    // phone: null by default
    // avatar: defaults from schema
  });

  res.status(201);
  sendSuccess(
    res,
    {
      id: user._id,
      email: user.email,
      name: user.name,
    },
    "User registered successfully"
  );
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
  const old = await RefreshToken.findOne({ token: refreshToken });

  if (!old || old.expiresAt < new Date()) {
    res.status(401);
    throw new Error("Invalid refresh token");
  }

  // generate new tokens
  const accessToken = signAccess(old.user);
  const newRefreshToken = makeOpaque();

  // delete old token (rotation)
  await RefreshToken.deleteOne({ token: refreshToken });

  // save new refresh token
  await RefreshToken.create({
    user: old.user,
    token: newRefreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  sendSuccess(res, {
    accessToken,
    refreshToken: newRefreshToken
  }, "Tokens refreshed");
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
  await sendMail({
    to: email,
    subject: "Your Daniela Bake OTP",
    text: `Your password reset code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your password reset code is <strong>${otp}</strong>.</p><p>This code expires in 10 minutes.</p>`,
  });
  sendSuccess(res, { email }, "OTP sent to your inbox");
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
