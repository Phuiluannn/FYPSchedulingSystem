import FeedbackModel from '../models/Feedback.js';

// Get all feedback (admin or user)
export const getAllFeedback = async (user, status = null) => {
  const query = {};
  if (user.role !== "admin") {
    query.user = user.id; // Only filter for non-admin
  }
  if (status && status !== "All") {
    query.status = status;
  }
  const q = FeedbackModel.find(query);
  if (user.role === "admin") {
    q.populate("user", "name email role");
  }
  return await q.sort({ submitted: -1 });
};

// Get a single feedback by ID
export const getFeedbackById = async (id) => {
  return await FeedbackModel.findById(id).populate("user", "name email role");
};

// Create a new feedback
export const createFeedback = async (data) => {
  const feedback = new FeedbackModel(data);
  return await feedback.save();
};

// Update a feedback
export const updateFeedback = async (id, data) => {
  // If status is set to Resolved, set resolved date (optional)
  if (data.status === "Resolved") {
    data.resolved = new Date();
  }
  return await FeedbackModel.findByIdAndUpdate(id, data, { new: true }).populate("user", "name email role");
};

// Delete a feedback
export const deleteFeedback = async (id) => {
  return await FeedbackModel.findByIdAndDelete(id);
};