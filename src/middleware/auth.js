import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";

export const protect = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : null;
  if (!token) { res.status(401); throw new Error("Not authorized"); }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("_id name email role");
    if (!user) { res.status(401); throw new Error("User not found"); }
    req.user = user;
    next();
  } catch {
    res.status(401); throw new Error("Token invalid or expired");
  }
});

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    res.status(403); throw new Error("Forbidden");
  }
  next();
};
