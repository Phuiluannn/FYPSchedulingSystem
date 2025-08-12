import mongoose from "mongoose";

const ConflictSchema = new mongoose.Schema({
  Year: { type: String, required: true },
  Semester: { type: String, required: true },
  Type: { 
    type: String, 
    required: true,
    enum: ['Room Capacity', 'Room Double Booking', 'Instructor Conflict', 'Course Overlap', 'Time Slot Exceeded']
  },
  Description: { type: String, required: true },
  Status: { 
    type: String, 
    default: 'Pending',
    enum: ['Pending', 'Resolved']
  },
  Priority: { 
    type: String, 
    default: 'High',
    enum: ['High', 'Medium', 'Low']
  },
  CourseCode: { type: String },
  RoomID: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  InstructorID: { type: mongoose.Schema.Types.ObjectId, ref: "Instructor" },
  Day: { type: String },
  StartTime: { type: String },
  CreatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Conflict", ConflictSchema);