import express from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  copyCourses
} from '../controllers/courseController.js';
import { authenticateToken } from "../middleware/authenticateToken.js";

const router = express.Router();

// Protect all course routes
router.use(authenticateToken);

router.get("/", getAllCourses);
router.get("/:id", getCourseById);
router.post("/", createCourse);
router.put("/:id", updateCourse);
router.delete("/:id", deleteCourse);
router.post("/copy", copyCourses);

export default router;