import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  academicYear: { type: String, required: true },
  semester: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  creditHour: { type: Number, required: true },
  targetStudent: { type: Number, required: true },
  courseType: { type: String, required: true, enum: ["Faculty Core", "Program Core", "Elective"] },
  instructors: [{ type: String }], // or reference an Instructor model if needed
  roomTypes: [{ type: String }],
  hasTutorial: { type: String, enum: ["Yes", "No"], default: "No" },
  lectureHour: { type: Number, default: 0 }
});

export default mongoose.model('Course', courseSchema);