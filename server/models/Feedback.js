import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema({
  title: { type: String, required: true, maxLength: 100 },
  type: { type: String, required: true, enum: ["Schedule Issue", "Bug", "Feature Request", "Improvement Suggestion", "Other"] },
  feedback: { type: String, required: true, maxLength: 500 },
  status: { 
    type: String, 
    required: true, 
    enum: ["Pending", "In Progress", "Resolved"], 
    default: "Pending" 
  },
  priority: { type: String, default: "Low" },
  submitted: { type: Date, default: Date.now },
  resolved: { type: Date },
  response: { type: String, default: "" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  // Fields to track if the user who submitted the feedback has been deleted
  isUserDeleted: { type: Boolean, default: false },
  deletedUserName: { type: String },
  deletedUserEmail: { type: String },
  deletedUserRole: { type: String }
});

export default mongoose.model("Feedback", FeedbackSchema);