import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  academicYear: { type: String, required: true },
  semester: { type: String, required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  creditHour: { type: Number, required: true },
  targetStudent: { type: Number, required: true },
  courseType: { type: String, required: true, enum: ["Faculty Core", "Programme Core", "Elective"] },
  instructors: [{ type: String }],
  roomTypes: [{ type: String }],
  hasTutorial: { type: String, enum: ["Yes", "No"], default: "No" },
  lectureHour: { type: Number, default: 0 },
  lectureOccurrence: {
    type: Number,
    default: 0,
    required: function () {
      return this.hasTutorial === "Yes";
    },
    validate: {
      validator: function (v) {
        if (this.hasTutorial === "Yes") {
          return v > 0;
        }
        return true;
      },
      message: "Lecture occurrence must be a positive number when tutorial is required.",
    },
  },
  tutorialOcc: { // New field
    type: Number,
    default: 0,
    required: function () {
      return this.hasTutorial === "Yes";
    },
    validate: {
      validator: function (v) {
        if (this.hasTutorial === "Yes") {
          return v > 0;
        }
        return true;
      },
      message: "Tutorial occurrence must be a positive number when tutorial is required.",
    },
  },
  year: {
    type: [{ type: String, enum: ["1", "2", "3", "4"] }],
    required: true,
    validate: {
      validator: function (v) {
        return v && v.length > 0;
      },
      message: "At least one year is required.",
    },
  },
  department: {
    type: [{ type: String, enum: ["Artificial Intelligence", "Computer System and Network", "Data Science", "Information Systems", "Multimedia Computing", "Software Engineering"] }],
    required: function () {
      return this.courseType === "Programme Core" || this.courseType === "Elective";
    },
    validate: {
      validator: function (v) {
        if (this.courseType === "Programme Core" || this.courseType === "Elective") {
          return v && v.length > 0;
        }
        return true;
      },
      message: "At least one department is required for Programme Core or Elective courses.",
    },
  },
});

courseSchema.index({ code: 1, academicYear: 1, semester: 1 }, { unique: true });

export default mongoose.model('Course', courseSchema);