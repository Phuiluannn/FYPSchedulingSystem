import CourseModel from '../models/Course.js';

// Get all courses
export const getAllCourses = async () => {
  return await CourseModel.find();
};

// Get a single course by ID
export const getCourseById = async (id) => {
  return await CourseModel.findById(id);
};

// Create a new course
export const createCourse = async (courseData) => {
  const course = new CourseModel(courseData);
  return await course.save();
};

// Update an existing course
export const updateCourse = async (id, courseData) => {
  return await CourseModel.findByIdAndUpdate(id, courseData, { new: true });
};

// Delete a course
export const deleteCourse = async (id) => {
  return await CourseModel.findByIdAndDelete(id);
};

export const copyCourses = async (fromYear, fromSemester, toYear, toSemester) => {
  const coursesToCopy = await CourseModel.find({
    academicYear: fromYear,
    semester: fromSemester,
  });

  // Find existing codes in the target year/semester
  const existingCourses = await CourseModel.find({
    academicYear: toYear,
    semester: toSemester,
  });
  const existingCodes = new Set(existingCourses.map(c => c.code));

  // Only copy courses that don't already exist in the target year/semester
  const newCourses = coursesToCopy
    .filter(course => !existingCodes.has(course.code))
    .map(course => {
      const { _id, ...rest } = course.toObject();
      return {
        ...rest,
        academicYear: toYear,
        semester: toSemester,
      };
    });

  if (newCourses.length === 0) {
    throw new Error("No new courses to copy (all already exist in the target year/semester).");
  }

  return await CourseModel.insertMany(newCourses);
};