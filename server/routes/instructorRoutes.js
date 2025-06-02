import express from 'express';
import {
  getAllInstructors,
  getInstructorById,
  createInstructor,
  updateInstructor,
  deleteInstructor,
} from '../controllers/instructorController.js';

const router = express.Router();

router.get("/", getAllInstructors); // Use the imported function directly
router.get("/:id", getInstructorById);
router.post("/", createInstructor);
router.put("/:id", updateInstructor);
router.delete("/:id", deleteInstructor);

export default router;