import express from "express";
import {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  removeStudent
} from "../controllers/studentController.js";

const router = express.Router();

router.get("/", getStudents);
router.get("/:id", getStudent);
router.post("/", createStudent);
router.put("/:id", updateStudent);
router.delete("/:id", removeStudent);

export default router;