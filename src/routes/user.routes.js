import express from "express";
import {
  getUsers,
  getAdminUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";

const router = express.Router();

router.route("/")
  .get(getUsers);

router.get("/admin", getAdminUsers);

router.route("/:id")
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

export default router;
