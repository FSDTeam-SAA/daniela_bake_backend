import express from "express";
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.controller.js";

const router = express.Router();

router.route("/")
  .get(getUsers);

router.route("/:id")
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

export default router;
