import Conflict from '../models/Conflict.js';
import Course from '../models/Course.js';
import Room from '../models/Room.js';
import Schedule from '../models/Home.js';

// Define TIMES array for conflict checking
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

export const getInstructorWorkload = async (year, semester) => {
  console.log("=== FETCHING INSTRUCTOR WORKLOAD ===");
  console.log(`Year: ${year}, Semester: ${semester}`);

  const workload = await Schedule.aggregate([
    {
      $match: {
        Year: year,
        Semester: semester
      }
    },
    {
      $group: {
        _id: "$InstructorID",
        totalHours: { $sum: { $ifNull: ["$Duration", 1] } },
        courses: { $addToSet: "$CourseCode" }
      }
    },
    {
      $lookup: {
        from: "instructors",
        localField: "_id",
        foreignField: "_id",
        as: "instructor"
      }
    },
    { $unwind: { path: "$instructor", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        name: { $ifNull: ["$instructor.name", "Unassigned"] },
        department: { $ifNull: ["$instructor.department", "N/A"] },
        totalHours: 1,
        courses: { $size: "$courses" }
      }
    },
    { $sort: { name: 1 } }
  ]);

  console.log(`Found ${workload.length} instructors with workload data`);
  return workload;
};

export const recordConflict = async (conflictData) => {
  console.log("=== RECORDING CONFLICT ===");
  console.log("Conflict data:", conflictData);

  // Validate required fields
  if (!conflictData.Year || !conflictData.Semester || !conflictData.Type || !conflictData.Description) {
    throw new Error("Missing required conflict data fields");
  }

  // Ensure RoomID is properly formatted for MongoDB
  let processedData = { ...conflictData };
  if (conflictData.RoomID && typeof conflictData.RoomID === 'string' && conflictData.RoomID.length === 24) {
    // RoomID is already a valid ObjectId string, keep it as is
    processedData.RoomID = conflictData.RoomID;
  } else if (conflictData.RoomID) {
    // If RoomID is provided but not a valid ObjectId, try to find the room
    const room = await Room.findOne({ code: conflictData.RoomID });
    processedData.RoomID = room ? room._id : null;
  }

  const conflict = new Conflict({
    ...processedData,
    CreatedAt: new Date()
  });

  await conflict.save();
  console.log("Conflict saved:", conflict);
  return conflict;
};

export const getConflicts = async (year, semester) => {
  console.log("=== FETCHING CONFLICTS ===");
  console.log(`Year: ${year}, Semester: ${semester}`);

  const conflicts = await Conflict.find({ Year: year, Semester: semester })
    .populate('RoomID', 'code capacity building block')
    .populate('InstructorID', 'name')
    .sort({ CreatedAt: -1 }) // Sort by most recent first
    .lean();

  console.log(`Found ${conflicts.length} conflicts`);

  const conflictsWithStringIds = conflicts.map(conflict => ({
    ...conflict,
    _id: conflict._id?.toString?.() ?? conflict._id,
    RoomID: conflict.RoomID?._id?.toString?.() ?? conflict.RoomID,
    InstructorID: conflict.InstructorID?._id?.toString?.() ?? conflict.InstructorID,
    RoomCode: conflict.RoomID?.code,
    RoomCapacity: conflict.RoomID?.capacity,
    RoomBuilding: conflict.RoomID?.building || conflict.RoomID?.block,
    InstructorName: conflict.InstructorID?.name
  }));

  return { conflicts: conflictsWithStringIds };
};

export const checkAndRecordConflicts = async (timetable, year, semester) => {
  console.log("=== CHECKING FOR CONFLICTS ===");
  
  const conflicts = [];
  
  // Check for room double booking and capacity conflicts
  const roomUsage = {};
  for (const item of timetable) {
    const { RoomID, Day, StartTime, Duration, CourseCode, OccNumber } = item;
    const startTimeIdx = TIMES.indexOf(StartTime);
    
    if (!roomUsage[Day]) roomUsage[Day] = {};
    if (!roomUsage[Day][RoomID]) roomUsage[Day][RoomID] = [];

    // Format OccNumber for description
    const occNumberText = OccNumber 
      ? Array.isArray(OccNumber) 
        ? ` (Occ ${OccNumber.join(", ")})` 
        : ` (Occ ${OccNumber})`
      : "";

    // Check for double booking
    for (let i = 0; i < Duration; i++) {
      const timeSlot = TIMES[startTimeIdx + i];
      if (roomUsage[Day][RoomID].includes(timeSlot)) {
        conflicts.push({
          Year: year,
          Semester: semester,
          Type: 'Room Double Booking',
          Description: `Room ${RoomID} double booked on ${Day} at ${timeSlot}${occNumberText} for course ${CourseCode}`,
          CourseCode,
          RoomID,
          Day,
          StartTime: timeSlot,
          Priority: 'High',
          Status: 'Pending'
        });
      }
      roomUsage[Day][RoomID].push(timeSlot);
    }

    // Check room capacity
    const course = await Course.findOne({ code: CourseCode });
    const room = await Room.findById(RoomID);
    if (course && room) {
      const requiredCapacity = Math.ceil(course.targetStudent / (course.lectureOccurrence || course.tutorialOcc || 1));
      if (room.capacity < requiredCapacity) {
        conflicts.push({
          Year: year,
          Semester: semester,
          Type: 'Room Capacity',
          Description: `Room ${room.code} (capacity ${room.capacity}) assigned to ${CourseCode}${occNumberText} needing ${requiredCapacity} capacity`,
          CourseCode,
          RoomID,
          Day,
          StartTime,
          Priority: 'High',
          Status: 'Pending'
        });
      }
    }
  }

  // NEW: Check for instructor conflicts
  const instructorUsage = {};
  
  for (const item of timetable) {
    const { InstructorID, Day, StartTime, Duration, CourseCode, OccNumber } = item;
    
    // Skip if no instructor assigned
    if (!InstructorID || InstructorID.trim() === '') continue;
    
    const startTimeIdx = TIMES.indexOf(StartTime);
    if (startTimeIdx === -1) continue;
    
    const duration = Duration || 1;
    
    // Initialize instructor usage tracking
    if (!instructorUsage[Day]) instructorUsage[Day] = {};
    if (!instructorUsage[Day][InstructorID]) instructorUsage[Day][InstructorID] = [];
    
    // Format OccNumber for description
    const occNumberText = OccNumber 
      ? Array.isArray(OccNumber) 
        ? ` (Occ ${OccNumber.join(", ")})` 
        : ` (Occ ${OccNumber})`
      : "";
    
    // Check each time slot for this event's duration
    for (let i = 0; i < duration; i++) {
      const timeSlotIdx = startTimeIdx + i;
      if (timeSlotIdx >= TIMES.length) break; // Don't exceed available time slots
      
      const timeSlot = TIMES[timeSlotIdx];
      
      // Check if instructor already has a class at this time
      const existingClass = instructorUsage[Day][InstructorID].find(
        existing => existing.timeSlotIdx === timeSlotIdx
      );
      
      if (existingClass) {
        // Found a conflict!
        conflicts.push({
          Year: year,
          Semester: semester,
          Type: 'Instructor Conflict',
          Description: `Instructor assigned to both ${existingClass.courseCode}${existingClass.occNumberText} and ${CourseCode}${occNumberText} on ${Day} at ${timeSlot}`,
          CourseCode,
          InstructorID,
          Day,
          StartTime: timeSlot,
          Priority: 'High',
          Status: 'Pending'
        });
      } else {
        // Add this class to instructor's schedule
        instructorUsage[Day][InstructorID].push({
          timeSlot,
          timeSlotIdx,
          courseCode: CourseCode,
          occNumberText,
          startTime: StartTime,
          duration: duration
        });
      }
    }
  }

  // Save conflicts to database
  for (const conflict of conflicts) {
    await recordConflict(conflict);
  }

  console.log(`=== CONFLICTS DETECTED: ${conflicts.length} ===`);
  return conflicts;
};

// New function to resolve conflicts
export const resolveConflict = async (conflictId) => {
  console.log("=== RESOLVING CONFLICT ===");
  console.log(`Conflict ID: ${conflictId}`);

  const updatedConflict = await Conflict.findByIdAndUpdate(
    conflictId,
    { Status: 'Resolved' },
    { new: true }
  );

  if (!updatedConflict) {
    throw new Error('Conflict not found');
  }

  console.log("Conflict resolved:", updatedConflict);
  return updatedConflict;
};

// New function to get conflict statistics
export const getConflictStats = async (year, semester) => {
  console.log("=== FETCHING CONFLICT STATISTICS ===");
  
  const totalConflicts = await Conflict.countDocuments({ Year: year, Semester: semester });
  const pendingConflicts = await Conflict.countDocuments({ Year: year, Semester: semester, Status: 'Pending' });
  const resolvedConflicts = await Conflict.countDocuments({ Year: year, Semester: semester, Status: 'Resolved' });
  
  const conflictsByType = await Conflict.aggregate([
    { $match: { Year: year, Semester: semester } },
    { $group: { _id: '$Type', count: { $sum: 1 } } }
  ]);

  const conflictsByPriority = await Conflict.aggregate([
    { $match: { Year: year, Semester: semester } },
    { $group: { _id: '$Priority', count: { $sum: 1 } } }
  ]);

  return {
    total: totalConflicts,
    pending: pendingConflicts,
    resolved: resolvedConflicts,
    byType: conflictsByType,
    byPriority: conflictsByPriority
  };
};