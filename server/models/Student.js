import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema(
  {
    academicYear: { type: String, required: true }, // e.g. "2025/2026"
    semester: { type: String, required: true }, // "1" or "2"
    year: { type: Number, required: true }, // 1..4
    totalStudents: { type: Number, default: 0 },
    counts: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  { timestamps: true }
);

// prevent duplicate record for same academicYear + semester + year
StudentSchema.index({ academicYear: 1, semester: 1, year: 1 }, { unique: true });

export default mongoose.model('Student', StudentSchema);