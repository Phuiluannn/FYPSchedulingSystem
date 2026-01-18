import express from "express";
import {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  removeStudent
} from "../controllers/studentController.js";
import { authenticateToken } from "../middleware/authenticateToken.js";

const router = express.Router();

// Protect all student routes
router.use(authenticateToken);

router.get("/", getStudents);
router.get("/:id", getStudent);
router.post("/", createStudent);
router.put("/:id", updateStudent);
router.delete("/:id", removeStudent);

export default router;