import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import { upsertProfile, getProfile, deleteProfile } from "../controllers/profile.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.route("/:userId")
  .get(getProfile)
  .post(upload.single("avatar"), upsertProfile)
  .delete(protect, deleteProfile);

export default router;
