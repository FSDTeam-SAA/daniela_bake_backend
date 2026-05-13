import express from "express";
import {
  getUsers,
  getAdminUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.route("/")
  .get(protect, requireRole("admin"), getUsers);

router.get("/admin", protect, requireRole("admin"), getAdminUsers);

router.route("/:id")
  .get(protect, requireRole("admin"), getUserById)
  .put(protect, requireRole("admin"), updateUser)
  .delete(protect, requireRole("admin"), deleteUser);

export default router;
