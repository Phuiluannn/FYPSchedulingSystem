import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  academicYear: { type: String, required: true },
  semester: { type: String, required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  creditHour: { type: Number, required: true },
  targetStudent: { type: Number, required: true }, // Total target students (can be calculated from departmentStudents)
  
  // NEW: Department-specific student counts
  departmentStudents: {
    type: Map,
    of: Number,
    default: {}
    // e.g., { "Artificial Intelligence": 50, "Software Engineering": 45, ... }
  },
  
  courseType: { type: String, required: true, enum: ["Faculty Core", "Programme Core", "Elective"] },
  instructors: [{ type: String }],
  roomTypes: [{ type: String }],
  hasTutorial: { type: String, enum: ["Yes", "No"], default: "No" },
  lectureHour: { type: Number, default: 0 },
  
  // NEW: Lecture occurrence configuration
  lectureOccurrence: {
    type: Number,
    default: 0
  },
  
  // NEW: Department groupings for each lecture occurrence
  lectureGroupings: [{
    occNumber: { type: Number, required: true },
    departments: [{ type: String }],
    estimatedStudents: { type: Number, default: 0 }
  }],
  // e.g., [
  //   { occNumber: 1, departments: ["AI", "CSN", "MM"], estimatedStudents: 150 },
  //   { occNumber: 2, departments: ["SE", "IS", "DS"], estimatedStudents: 140 }
  // ]
  
  // Tutorial occurrences will be calculated automatically based on departmentStudents
  tutorialOcc: {
    type: Number,
    default: 0
  },
  
  // NEW: Tutorial configuration (one or two departments per tutorial)
  tutorialGroupings: [{
    occNumber: { type: Number, required: true },
    departments: [{ type: String }],
    estimatedStudents: { type: Number, default: 0 }
  }],
  // e.g., [
  //   { occNumber: 1, departments: ["AI"], estimatedStudents: 50 },
  //   { occNumber: 2, departments: ["CSN"], estimatedStudents: 45 },
  //   { occNumber: 3, departments: ["MM", "IS"], estimatedStudents: 55 },
  //   ...
  // ]
  
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

// FIXED: Helper method to calculate tutorial occurrences
// This now works for BOTH hasTutorial "Yes" and "No"
// "No" means no separate lectures, but tutorials still exist based on student numbers
courseSchema.methods.calculateTutorialOccurrences = function(maxStudentsPerTutorial = 40) {
  // FIXED: Always calculate tutorials if there are department students
  // regardless of hasTutorial value
  if (!this.departmentStudents || this.departmentStudents.size === 0) {
    this.tutorialGroupings = [];
    this.tutorialOcc = 0;
    return 0;
  }
  
  const tutorialGroupings = [];
  let occNumber = 1;
  
  // Get all departments with students
  const deptEntries = Array.from(this.departmentStudents.entries())
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]); // Sort by student count descending
  
  let i = 0;
  while (i < deptEntries.length) {
    const [dept, count] = deptEntries[i];
    
    if (count <= maxStudentsPerTutorial) {
      // Try to pair with another small department
      if (i + 1 < deptEntries.length) {
        const [nextDept, nextCount] = deptEntries[i + 1];
        if (count + nextCount <= maxStudentsPerTutorial) {
          // Pair two departments
          tutorialGroupings.push({
            occNumber: occNumber++,
            departments: [dept, nextDept],
            estimatedStudents: count + nextCount
          });
          i += 2;
          continue;
        }
      }
      // Single department
      tutorialGroupings.push({
        occNumber: occNumber++,
        departments: [dept],
        estimatedStudents: count
      });
      i++;
    } else {
      // Large department - split into multiple tutorials
      // FIX: Use floor division with remainder distribution
      const numTutorials = Math.ceil(count / maxStudentsPerTutorial);
      const baseStudents = Math.floor(count / numTutorials);
      const remainder = count % numTutorials;
      
      for (let j = 0; j < numTutorials; j++) {
        // First 'remainder' tutorials get one extra student
        const studentsInThisTutorial = j < remainder ? baseStudents + 1 : baseStudents;
        
        tutorialGroupings.push({
          occNumber: occNumber++,
          departments: [dept],
          estimatedStudents: studentsInThisTutorial
        });
      }
      i++;
    }
  }
  
  this.tutorialGroupings = tutorialGroupings;
  this.tutorialOcc = tutorialGroupings.length;
  return tutorialGroupings.length;
};

export default mongoose.model('Course', courseSchema);