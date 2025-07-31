import mongoose from "mongoose";

const HomeSchema = new mongoose.Schema({
  CourseID: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  InstructorID: { type: mongoose.Schema.Types.ObjectId, ref: "Instructor", default: null },
  RoomID: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  LectureOcc: { type: Number, default: 1 },
  TutorialOcc: { type: Number, default: null },
  OccType: { type: String, default: "Lecture" },
  Year: { type: String, required: true },
  Semester: { type: String, required: true },
  Day: { type: String, required: true },
  StartTime: { type: String, required: true },
  EndTime: { type: String, required: true },
  CourseCode: { type: String },      
  Instructors: [{ type: String }],   // Selected instructor(s)
  OriginalInstructors: [{ type: String }], // Full list of instructors for the course
});

export default mongoose.model("Schedule", HomeSchema);