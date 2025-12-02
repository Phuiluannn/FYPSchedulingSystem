import * as studentService from "../services/studentService.js";

export const getStudents = async (req, res) => {
  try {
    const filters = {
      academicYear: req.query.academicYear,
      semester: req.query.semester,
      year: req.query.year
    };
    const students = await studentService.getAllStudents(filters);
    res.status(200).json(students);
  } catch (error) {
    console.error("getStudents error:", error);
    res.status(500).json({ message: "Failed to fetch students" });
  }
};

export const getStudent = async (req, res) => {
  try {
    const student = await studentService.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student record not found" });
    res.status(200).json(student);
  } catch (error) {
    console.error("getStudent error:", error);
    res.status(500).json({ message: "Failed to fetch student" });
  }
};

export const createStudent = async (req, res) => {
  try {
    const created = await studentService.createStudent(req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error("createStudent error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Record for that academic year/semester/year already exists" });
    }
    res.status(400).json({ message: error.message || "Failed to create student record" });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const updated = await studentService.updateStudent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Student record not found" });
    res.status(200).json(updated);
  } catch (error) {
    console.error("updateStudent error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Record for that academic year/semester/year already exists" });
    }
    res.status(400).json({ message: error.message || "Failed to update student record" });
  }
};

export const removeStudent = async (req, res) => {
  try {
    await studentService.deleteStudent(req.params.id);
    res.status(200).json({ message: "Student record deleted" });
  } catch (error) {
    console.error("removeStudent error:", error);
    res.status(500).json({ message: "Failed to delete student record" });
  }
};