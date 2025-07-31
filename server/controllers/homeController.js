import * as homeService from "../services/homeService.js";
import Schedule from "../models/Home.js";
import mongoose from "mongoose";

export const generateTimetable = async (req, res) => {
  try {
    const result = await homeService.generateTimetable(req);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const saveTimetable = async (req, res) => {
  try {
    const { year, semester, timetable } = req.body;
    // Remove old schedules for this year/semester
    await Schedule.deleteMany({ Year: year, Semester: semester });

    // Convert InstructorID to ObjectId if valid and include OriginalInstructors
    const timetableWithObjectIds = timetable.map(item => {
      const updatedItem = {
        ...item,
        InstructorID: item.InstructorID && typeof item.InstructorID === "string" && item.InstructorID.length === 24
          ? new mongoose.Types.ObjectId(item.InstructorID)
          : null,
        OriginalInstructors: item.OriginalInstructors || item.Instructors // Preserve original instructors
      };
      return updatedItem;
    });

    // Flatten and save new schedules
    await Schedule.insertMany(timetableWithObjectIds);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const getTimetable = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const result = await homeService.getTimetable(year, semester);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};