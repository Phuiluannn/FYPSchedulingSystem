import FeedbackModel from '../models/Feedback.js';
import Notification from '../models/Notification.js';
import { createNotification } from './notificationService.js';

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
  const savedFeedback = await feedback.save();
  
  // Populate the user data before returning
  const populatedFeedback = await FeedbackModel.findById(savedFeedback._id).populate("user", "name email role");
  
  // Create notification for admins about new feedback
  try {
    const notificationData = {
      title: "New Feedback Received",
      message: `${populatedFeedback.user.name} submitted feedback: "${populatedFeedback.title}"`,
      type: "feedback_admin",
      recipients: ["admin"], // Send to all admins
      feedbackId: populatedFeedback._id,
      feedbackTitle: populatedFeedback.title,
      feedbackType: populatedFeedback.type,
      feedbackPriority: populatedFeedback.priority,
      submittedBy: populatedFeedback.user.name,
      submittedByRole: populatedFeedback.user.role
    };

    await createNotification(notificationData);
    console.log(`✅ Admin notification created for new feedback ${populatedFeedback._id}`);
  } catch (notificationError) {
    console.error("Error creating admin feedback notification:", notificationError);
    // Don't throw error here - feedback creation should still succeed even if notification fails
  }
  
  return populatedFeedback;
};

// Update a feedback
export const updateFeedback = async (id, data) => {
  // Get the original feedback to check if response is being added/updated
  const originalFeedback = await FeedbackModel.findById(id).populate("user", "name email role id");
  
  if (!originalFeedback) {
    throw new Error("Feedback not found");
  }

  // If status is set to Resolved, set resolved date
  if (data.status === "Resolved") {
    data.resolved = new Date();
  }

  // Check if a response is being added or updated
  const isNewResponse = !originalFeedback.response && data.response;
  const isUpdatedResponse = originalFeedback.response && data.response && originalFeedback.response !== data.response;

  // Update the feedback
  const updatedFeedback = await FeedbackModel.findByIdAndUpdate(id, data, { new: true }).populate("user", "name email role");

  // Create notification if response was added or updated
  if (isNewResponse || isUpdatedResponse) {
    try {
      const notificationData = {
        title: "Feedback Response Received",
        message: `Your feedback "${originalFeedback.title}" has received ${isNewResponse ? 'a' : 'an updated'} response from the administrator.`,
        type: "feedback",
        feedbackId: originalFeedback._id,
        feedbackTitle: originalFeedback.title,
        // Create a user-specific notification by using isRead Map
        isRead: new Map([[originalFeedback.user._id.toString(), false]])
      };

      await createNotification(notificationData);
      console.log(`✅ Notification created for user ${originalFeedback.user._id} about feedback response`);
    } catch (notificationError) {
      console.error("Error creating feedback response notification:", notificationError);
      // Don't throw error here - feedback update should still succeed even if notification fails
    }
  }

  return updatedFeedback;
};

// Delete a feedback
export const deleteFeedback = async (id) => {
  const feedback = await FeedbackModel.findByIdAndDelete(id);
  
  if (feedback) {
    // Delete all notifications related to this feedback (both admin and user notifications)
    try {
      const result = await Notification.deleteMany({ feedbackId: id });
      console.log(`✅ Deleted ${result.deletedCount} notification(s) associated with feedback ${id}`);
    } catch (notificationError) {
      console.error("Error deleting feedback notifications:", notificationError);
      // Don't throw error here - feedback deletion already succeeded
    }
  }
  
  return feedback;
};