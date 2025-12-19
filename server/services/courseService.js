import CourseModel from '../models/Course.js';
import StudentModel from '../models/Student.js';

// Helper function to get department student counts for a specific year/semester/year-level
const getDepartmentStudentCounts = async (academicYear, semester, yearLevel) => {
  const student = await StudentModel.findOne({
    academicYear,
    semester: String(semester),
    year: Number(yearLevel)
  });
  
  if (!student || !student.counts) {
    return {};
  }
  
  // Convert Map to plain object
  return Object.fromEntries(student.counts);
};

// Helper function to automatically generate lecture groupings
const generateLectureGroupings = (departmentStudents, numLectures, allDepartments) => {
  const groupings = [];
  
  // Get departments with students
  const deptArray = allDepartments
    .filter(dept => departmentStudents[dept] > 0)
    .sort((a, b) => departmentStudents[b] - departmentStudents[a]); // Sort by count descending
  
  if (deptArray.length === 0 || numLectures === 0) {
    return [];
  }
  
  // Distribute departments evenly across lectures
  const deptsPerLecture = Math.ceil(deptArray.length / numLectures);
  
  for (let i = 0; i < numLectures; i++) {
    const startIdx = i * deptsPerLecture;
    const endIdx = Math.min(startIdx + deptsPerLecture, deptArray.length);
    const lectureDepts = deptArray.slice(startIdx, endIdx);
    
    if (lectureDepts.length > 0) {
      const estimatedStudents = lectureDepts.reduce((sum, dept) => 
        sum + (departmentStudents[dept] || 0), 0
      );
      
      groupings.push({
        occNumber: i + 1,
        departments: lectureDepts,
        estimatedStudents
      });
    }
  }
  
  return groupings;
};

// Get all courses
export const getAllCourses = async () => {
  return await CourseModel.find();
};

// Get a single course by ID
export const getCourseById = async (id) => {
  return await CourseModel.findById(id);
};

// Create a new course with department-based logic
export const createCourse = async (courseData) => {
  // Get department student counts if year is specified
  let departmentStudents = {};
  
  if (courseData.year && courseData.year.length > 0 && courseData.academicYear && courseData.semester) {
    // For Faculty Core courses, aggregate all departments
    // For Programme Core/Elective, only get specified departments
    const relevantDepts = courseData.courseType === "Faculty Core" 
      ? ["Artificial Intelligence", "Computer System and Network", "Data Science", 
         "Information Systems", "Multimedia Computing", "Software Engineering"]
      : (courseData.department || []);
    
    // Aggregate student counts across all year levels for this course
    for (const yearLevel of courseData.year) {
      const yearCounts = await getDepartmentStudentCounts(
        courseData.academicYear, 
        courseData.semester, 
        yearLevel
      );
      
      // Add to departmentStudents
      for (const dept of relevantDepts) {
        departmentStudents[dept] = (departmentStudents[dept] || 0) + (yearCounts[dept] || 0);
      }
    }
  }
  
  // Calculate total target students from department counts
  const calculatedTargetStudent = Object.values(departmentStudents).reduce((sum, count) => sum + count, 0);
  const targetStudent = calculatedTargetStudent > 0 ? calculatedTargetStudent : (courseData.targetStudent || 0);
  
  // Generate lecture groupings if lectures are specified AND hasTutorial is "Yes"
  let lectureGroupings = [];
  if (courseData.hasTutorial === "Yes" && courseData.lectureOccurrence > 0) {
    const allDepts = courseData.courseType === "Faculty Core"
      ? ["Artificial Intelligence", "Computer System and Network", "Data Science", 
         "Information Systems", "Multimedia Computing", "Software Engineering"]
      : (courseData.department || []);
    
    lectureGroupings = generateLectureGroupings(
      departmentStudents, 
      courseData.lectureOccurrence,
      allDepts
    );
  }
  
  const course = new CourseModel({
    ...courseData,
    targetStudent,
    departmentStudents: new Map(Object.entries(departmentStudents)),
    lectureGroupings,
    year: Array.isArray(courseData.year) ? courseData.year : [],
    department: Array.isArray(courseData.department) ? courseData.department : [],
    // Keep lectureOccurrence as provided, don't reset to 0
    lectureOccurrence: courseData.lectureOccurrence || 0,
    tutorialOcc: 0, // Will be calculated
    tutorialGroupings: []
  });
  
  // FIXED: Calculate tutorial occurrences for BOTH "Yes" and "No" cases
  // "No" means no separate lectures, but tutorials still exist
  course.calculateTutorialOccurrences(40); // Max 40 students per tutorial
  
  return await course.save();
};

// Update an existing course
export const updateCourse = async (id, courseData) => {
  const existingCourse = await CourseModel.findById(id);
  if (!existingCourse) {
    throw new Error('Course not found');
  }
  
  // Get department student counts if year is specified
  let departmentStudents = {};
  
  if (courseData.year && courseData.year.length > 0 && courseData.academicYear && courseData.semester) {
    const relevantDepts = courseData.courseType === "Faculty Core" 
      ? ["Artificial Intelligence", "Computer System and Network", "Data Science", 
         "Information Systems", "Multimedia Computing", "Software Engineering"]
      : (courseData.department || []);
    
    for (const yearLevel of courseData.year) {
      const yearCounts = await getDepartmentStudentCounts(
        courseData.academicYear, 
        courseData.semester, 
        yearLevel
      );
      
      for (const dept of relevantDepts) {
        departmentStudents[dept] = (departmentStudents[dept] || 0) + (yearCounts[dept] || 0);
      }
    }
  }
  
  const calculatedTargetStudent = Object.values(departmentStudents).reduce((sum, count) => sum + count, 0);
  const targetStudent = calculatedTargetStudent > 0 ? calculatedTargetStudent : (courseData.targetStudent || 0);
  
  // Generate lecture groupings only if hasTutorial is "Yes"
  let lectureGroupings = [];
  if (courseData.hasTutorial === "Yes" && courseData.lectureOccurrence > 0) {
    const allDepts = courseData.courseType === "Faculty Core"
      ? ["Artificial Intelligence", "Computer System and Network", "Data Science", 
         "Information Systems", "Multimedia Computing", "Software Engineering"]
      : (courseData.department || []);
    
    lectureGroupings = generateLectureGroupings(
      departmentStudents, 
      courseData.lectureOccurrence,
      allDepts
    );
  }
  
  const instructorsChanged = JSON.stringify(existingCourse.instructors?.sort()) !== 
                            JSON.stringify(courseData.instructors?.sort());
  
  // Update course data
  Object.assign(existingCourse, {
    ...courseData,
    targetStudent,
    departmentStudents: new Map(Object.entries(departmentStudents)),
    lectureGroupings,
    year: Array.isArray(courseData.year) ? courseData.year : [],
    department: Array.isArray(courseData.department) ? courseData.department : [],
    lectureOccurrence: courseData.lectureOccurrence || 0,
    tutorialOcc: 0,
    tutorialGroupings: []
  });
  
  existingCourse.calculateTutorialOccurrences(40);
  
  const savedCourse = await existingCourse.save();
  
  // ✅ NEW: Update all existing schedules if instructors changed
  if (instructorsChanged) {
    console.log(`Instructors changed for ${savedCourse.code}, updating existing schedules...`);
    
    // Import Schedule model at the top of the file
    const Schedule = (await import('../models/Home.js')).default;
    
    // Update all draft schedules for this course
    const updateResult = await Schedule.updateMany(
      {
        CourseID: savedCourse._id,
        Published: { $ne: true } // Only update draft schedules
      },
      {
        $set: {
          OriginalInstructors: courseData.instructors || [],
          // Clear specific instructor assignments when instructor list changes
          InstructorID: null,
          Instructors: []
        }
      }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} draft schedules with new instructor list`);
  }
  
  return savedCourse;
};

// Delete a course
export const deleteCourse = async (id) => {
  return await CourseModel.findByIdAndDelete(id);
};

// Copy courses
export const copyCourses = async (fromYear, fromSemester, toYear, toSemester) => {
  // First, get all courses to be copied to check which years they cover
  const coursesToCopy = await CourseModel.find({
    academicYear: fromYear,
    semester: fromSemester,
  });
  
  if (coursesToCopy.length === 0) {
    throw new Error(`No courses found for ${fromYear} Semester ${fromSemester}.`);
  }
  
  // Collect all unique year levels from the courses to be copied
  const requiredYears = new Set();
  coursesToCopy.forEach(course => {
    if (course.year && Array.isArray(course.year)) {
      course.year.forEach(y => requiredYears.add(Number(y)));
    }
  });
  
  // Check if student data exists for ALL required year levels in target year/semester
  const targetStudentData = await StudentModel.find({
    academicYear: toYear,
    semester: String(toSemester)
  });
  
  const availableYears = new Set(targetStudentData.map(s => Number(s.year)));
  const missingYears = [...requiredYears].filter(year => !availableYears.has(year)).sort();
  
  if (missingYears.length > 0) {
    const yearsList = missingYears.map(y => `Year ${y}`).join(', ');
    throw new Error(
      `Missing student data for ${yearsList} in ${toYear} Semester ${toSemester}. ` +
      `Please configure student enrollment data for all required year levels before copying courses.`
    );
  }

  // Find existing codes in the target year/semester
  const existingCourses = await CourseModel.find({
    academicYear: toYear,
    semester: toSemester,
  });
  const existingCodes = new Set(existingCourses.map(c => c.code));

  // Only copy courses that don't already exist
  const newCourses = [];
  
  for (const course of coursesToCopy) {
    if (existingCodes.has(course.code)) continue;
    
    const { _id, ...rest } = course.toObject();
    
    // Recalculate department students for the new year/semester
    let departmentStudents = {};
    
    if (rest.year && rest.year.length > 0) {
      const relevantDepts = rest.courseType === "Faculty Core" 
        ? ["Artificial Intelligence", "Computer System and Network", "Data Science", 
           "Information Systems", "Multimedia Computing", "Software Engineering"]
        : (rest.department || []);
      
      for (const yearLevel of rest.year) {
        const yearCounts = await getDepartmentStudentCounts(toYear, toSemester, yearLevel);
        for (const dept of relevantDepts) {
          departmentStudents[dept] = (departmentStudents[dept] || 0) + (yearCounts[dept] || 0);
        }
      }
    }
    
    const calculatedTargetStudent = Object.values(departmentStudents).reduce((sum, count) => sum + count, 0);
    
    // Generate lecture groupings only if hasTutorial is "Yes"
    let lectureGroupings = [];
    if (rest.hasTutorial === "Yes" && rest.lectureOccurrence > 0) {
      const allDepts = rest.courseType === "Faculty Core"
        ? ["Artificial Intelligence", "Computer System and Network", "Data Science", 
           "Information Systems", "Multimedia Computing", "Software Engineering"]
        : (rest.department || []);
      
      lectureGroupings = generateLectureGroupings(
        departmentStudents, 
        rest.lectureOccurrence,
        allDepts
      );
    }
    
    const newCourse = new CourseModel({
      ...rest,
      academicYear: toYear,
      semester: toSemester,
      targetStudent: calculatedTargetStudent > 0 ? calculatedTargetStudent : rest.targetStudent,
      departmentStudents: new Map(Object.entries(departmentStudents)),
      lectureGroupings,
      year: Array.isArray(rest.year) ? rest.year : [],
      department: Array.isArray(rest.department) ? rest.department : [],
      lectureOccurrence: rest.lectureOccurrence || 0,
      tutorialOcc: 0,
      tutorialGroupings: []
    });
    
    // FIXED: Calculate tutorials for both cases
    newCourse.calculateTutorialOccurrences(40);
    
    newCourses.push(newCourse);
  }

  if (newCourses.length === 0) {
    throw new Error("No new courses to copy (all already exist in the target year/semester).");
  }

  return await CourseModel.insertMany(newCourses);
};