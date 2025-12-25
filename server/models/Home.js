import mongoose from "mongoose";

const HomeSchema = new mongoose.Schema({
  CourseID: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  InstructorID: { type: mongoose.Schema.Types.ObjectId, ref: "Instructor", default: null },
  RoomID: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  OccNumber: { type: [Number], required: true }, // Array of occurrence numbers
  OccType: { type: String, default: "Lecture" },
  
  // NEW: Department-specific fields
  Departments: [{ type: String }], // Which departments this occurrence is for
  EstimatedStudents: { type: Number, default: 0 }, // Estimated number of students for this occurrence
  
  // ✅ CRITICAL FIX: Add YearLevel field
  YearLevel: [{ type: String }], // Year level(s) of students (e.g., ["1"], ["2"], ["1", "2"])
  
  Year: { type: String, required: true }, // Academic year (e.g., "2025/2026")
  Semester: { type: String, required: true },
  Day: { type: String, required: true },
  StartTime: { type: String, required: true },
  EndTime: { type: String, required: true },
  Duration: { type: Number, default: 1 },
  CourseCode: { type: String },      
  Instructors: [{ type: String }],   // Selected instructor(s)
  OriginalInstructors: [{ type: String }], // Full list of instructors for the course
  Published: { type: Boolean, default: false }
});

export default mongoose.model("Schedule", HomeSchema);