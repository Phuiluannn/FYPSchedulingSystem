import StudentModel from '../models/Student.js';

export const getAllStudents = async (filters = {}) => {
  const query = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.semester) query.semester = String(filters.semester);
  if (filters.year) query.year = Number(filters.year);
  return StudentModel.find(query).sort({ year: 1, createdAt: -1 }).lean();
};

export const getStudentById = async (id) => {
  return StudentModel.findById(id).lean();
};

export const createStudent = async (payload) => {
  const counts = {};
  if (payload.counts && typeof payload.counts === "object") {
    Object.keys(payload.counts).forEach((k) => {
      counts[k] = Number(payload.counts[k] || 0);
    });
  }
  const total = Number(payload.totalStudents ?? Object.values(counts).reduce((a, b) => a + b, 0));
  const doc = new StudentModel({
    academicYear: payload.academicYear,
    semester: String(payload.semester),
    year: Number(payload.year),
    totalStudents: total,
    counts
  });
  return doc.save();
};

export const updateStudent = async (id, payload) => {
  const counts = {};
  if (payload.counts && typeof payload.counts === "object") {
    Object.keys(payload.counts).forEach((k) => {
      counts[k] = Number(payload.counts[k] || 0);
    });
  }
  const total = Number(payload.totalStudents ?? Object.values(counts).reduce((a, b) => a + b, 0));
  const data = {
    academicYear: payload.academicYear,
    semester: String(payload.semester),
    year: Number(payload.year),
    totalStudents: total,
    counts,
    updatedAt: Date.now()
  };
  return StudentModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
};

export const deleteStudent = async (id) => {
  return StudentModel.findByIdAndDelete(id);
};