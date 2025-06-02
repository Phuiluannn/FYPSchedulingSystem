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