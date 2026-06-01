import express from "express";
import {
  register,
  login,
  refresh,
  logout,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

export default router;
