import Course from '../models/Course.js';
import Room from '../models/Room.js';
import Schedule from '../models/Home.js';
import mongoose from 'mongoose';

const TIMES = [
  "8.00 AM - 9.00 AM",
  "9.00 AM - 10.00 AM",
  "10.00 AM - 11.00 AM",
  "11.00 AM - 12.00 PM",
  "12.00 PM - 1.00 PM",
  "1.00 PM - 2.00 PM",
  "2.00 PM - 3.00 PM",
  "3.00 PM - 4.00 PM",
  "4.00 PM - 5.00 PM",
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export const generateTimetable = async (req) => {
  const { year, semester } = req.body;
  const courses = await Course.find({ academicYear: year, semester });
  const rooms = await Room.find();

  // Clear previous schedules for this year/semester
  await Schedule.deleteMany({ Year: year, Semester: semester });

  // Track room usage per day/time
  let roomUsage = {};
  rooms.forEach(room => {
    roomUsage[room._id] = {};
    DAYS.forEach(day => {
      roomUsage[room._id][day] = new Array(TIMES.length).fill(false);
    });
  });

  let schedules = [];

for (const course of courses) {
  let assigned = false;
  // Only consider rooms that can fit all students
  const suitableRooms = rooms.filter(room => room.capacity >= course.targetStudent);
  for (const day of DAYS) {
    for (let timeIdx = 0; timeIdx < TIMES.length; timeIdx++) {
      for (const room of suitableRooms) {
        if (!roomUsage[room._id][day][timeIdx]) {
          schedules.push({
            _id: new mongoose.Types.ObjectId().toString(), // <-- add this line
            CourseID: course._id,
            CourseCode: course.code,
            Instructors: course.instructors,
            InstructorID: null,
            RoomID: room._id,
            LectureOcc: 1,
            TutorialOcc: null,
            OccType: "Lecture",
            Year: year,
            Semester: semester,
            Day: day,
            StartTime: TIMES[timeIdx],
            EndTime: TIMES[timeIdx].split(" - ")[1]
            });
          roomUsage[room._id][day][timeIdx] = true;
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }
    if (assigned) break;
  }
}

//   if (schedules.length > 0) {
//     await Schedule.insertMany(schedules);
//   }

  console.log("Courses found:", courses.length);
console.log("Rooms found:", rooms.length);
console.log("Schedules generated:", schedules.length);

if (schedules.length > 0) {
  console.log("First schedule:", schedules[0]);
}

  const schedulesWithStringIds = schedules.map(sch => ({
  ...sch,
  _id: sch._id?.toString?.() ?? sch._id,
  CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
  RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
}));
return { schedules: schedulesWithStringIds };

};

export const getTimetable = async (year, semester) => {
  const schedules = await Schedule.find({ Year: year, Semester: semester }).lean();
  // Convert IDs to strings
  const schedulesWithStringIds = schedules.map(sch => ({
    ...sch,
    _id: sch._id?.toString?.() ?? sch._id,
    CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
    RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
  }));
  return { schedules: schedulesWithStringIds };
};