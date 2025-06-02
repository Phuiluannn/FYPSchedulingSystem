import * as instructorService from '../services/instructorService.js';

// Get all instructors
export const getAllInstructors = async (req, res) => {
  try {
    const instructors = await instructorService.getAllInstructors();
    res.status(200).json(instructors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single instructor by ID
export const getInstructorById = async (req, res) => {
  try {
    const instructor = await instructorService.getInstructorById(req.params.id);
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }
    res.status(200).json(instructor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new instructor
export const createInstructor = async (req, res) => {
  try {
    const instructor = await instructorService.createInstructor(req.body);
    res.status(201).json(instructor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update an instructor
export const updateInstructor = async (req, res) => {
  try {
    const instructor = await instructorService.updateInstructor(
      req.params.id,
      req.body
    );
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }
    res.status(200).json(instructor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an instructor
export const deleteInstructor = async (req, res) => {
  try {
    const instructor = await instructorService.deleteInstructor(req.params.id);
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }
    res.status(200).json({ message: "Instructor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};