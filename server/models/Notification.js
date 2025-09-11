import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["timetable_published", "feedback", "general", "conflict", "reminder"], 
    default: "general" 
  },
  recipients: {
    type: [String], // Array of user roles: ["student", "instructor", "admin"]
    required: true
  },
  academicYear: { type: String },
  semester: { type: String },
  // New fields for feedback notifications
  feedbackId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Feedback',
    required: function() { return this.type === 'feedback'; }
  },
  feedbackTitle: { 
    type: String,
    required: function() { return this.type === 'feedback'; }
  },
  isRead: { 
    type: Map, 
    of: Boolean, 
    default: {} // userId -> boolean mapping
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // 30 days
});

// Index for efficient queries
NotificationSchema.index({ recipients: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, feedbackId: 1 });
NotificationSchema.index({ 'isRead': 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Notification", NotificationSchema);