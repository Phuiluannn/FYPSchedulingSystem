import express from 'express';
import {
  getAllInstructors,
  getInstructorById,
  createInstructor,
  updateInstructor,
  deleteInstructor,
} from '../controllers/instructorController.js';
import { authenticateToken } from "../middleware/authenticateToken.js";

const router = express.Router();

// Protect all instructor routes
router.use(authenticateToken);

router.get("/", getAllInstructors);
router.get("/:id", getInstructorById);
router.post("/", createInstructor);
router.put("/:id", updateInstructor);
router.delete("/:id", deleteInstructor);

export default router;