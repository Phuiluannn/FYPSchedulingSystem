import express from 'express';
import {
  getAllFeedback,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
} from '../controllers/feedbackController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get("/", getAllFeedback);
router.get("/:id", getFeedbackById);
router.post("/", createFeedback);
router.put("/:id", updateFeedback);
router.delete("/:id", deleteFeedback);

export default router;