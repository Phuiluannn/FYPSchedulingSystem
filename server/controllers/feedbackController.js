import * as feedbackService from '../services/feedbackService.js';
import { io } from '../index.js';

// Get all feedback (admin sees all, user sees own)
export const getAllFeedback = async (req, res) => {
  try {
    const { status } = req.query;
    const feedback = await feedbackService.getAllFeedback(req.user, status);
    res.status(200).json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single feedback by ID
export const getFeedbackById = async (req, res) => {
  try {
    const feedback = await feedbackService.getFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    // Only owner or admin can view
    if (req.user.role !== "admin" && req.user.id !== feedback.user.id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    res.status(200).json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new feedback
export const createFeedback = async (req, res) => {
  try {
    const data = {
      ...req.body,
      user: req.user.id,
    };
    const feedback = await feedbackService.createFeedback(data);
    // Emit to all clients
    io.emit('feedback:new', feedback);
    res.status(201).json(feedback);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a feedback (admin can update any, user cannot)
export const updateFeedback = async (req, res) => {
  try {
    const feedback = await feedbackService.getFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const updatedFeedback = await feedbackService.updateFeedback(req.params.id, req.body);
    // Emit to all clients
    io.emit('feedback:update', updatedFeedback);
    res.status(200).json(updatedFeedback);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a feedback (user can delete own, admin can delete any)
export const deleteFeedback = async (req, res) => {
  try {
    const feedback = await feedbackService.getFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    if (
      req.user.role !== "admin" &&
      req.user.id !== feedback.user.id.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await feedbackService.deleteFeedback(req.params.id);
    // Emit to all clients about feedback deletion
    io.emit('feedback:delete', { _id: req.params.id });
    // Emit to all clients about notification deletion
    io.emit('notification:deleteFeedback', { feedbackId: req.params.id });
    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};