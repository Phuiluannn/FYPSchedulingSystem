import InstructorModel from '../models/Instructor.js';

// Get all instructors
export const getAllInstructors = async () => {
  return await InstructorModel.find();
};

// Get a single instructor by ID
export const getInstructorById = async (id) => {
  return await InstructorModel.findById(id);
};

// Create a new instructor
export const createInstructor = async (data) => {
  const instructor = new InstructorModel(data);
  return await instructor.save();
};

// Update an instructor
export const updateInstructor = async (id, data) => {
  return await InstructorModel.findByIdAndUpdate(id, data, { new: true });
};

// Delete an instructor
export const deleteInstructor = async (id) => {
  return await InstructorModel.findByIdAndDelete(id);
};