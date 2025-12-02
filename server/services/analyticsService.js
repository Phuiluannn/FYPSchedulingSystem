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
  "5.00 PM - 6.00 PM",
  "6.00 PM - 7.00 PM",
  "7.00 PM - 8.00 PM",
  "8.00 PM - 9.00 PM",
  "9.00 PM - 10.00 PM"
];

export const getInstructorWorkload = async (year, semester, onlyPublished = false) => {
  console.log("=== FETCHING INSTRUCTOR WORKLOAD ===");
  console.log(`Year: ${year}, Semester: ${semester}, onlyPublished: ${onlyPublished}`);

  // Build the match criteria
  const matchCriteria = {
    Year: year,
    Semester: semester
  };

  // CRITICAL FIX: Handle published vs draft schedules properly
  if (onlyPublished) {
    matchCriteria.Published = true;
    console.log("Filtering for published schedules only");
  } else {
    // For admin view, prioritize draft schedules but fall back to published if no drafts
    console.log("Admin view - checking for draft schedules first");
    
    // First check if draft schedules exist
    const draftCount = await Schedule.countDocuments({
      Year: year,
      Semester: semester,
      Published: { $ne: true }
    });
    
    if (draftCount > 0) {
      matchCriteria.Published = { $ne: true };
      console.log(`Found ${draftCount} draft schedules, using drafts for workload calculation`);
    } else {
      matchCriteria.Published = true;
      console.log("No draft schedules found, falling back to published schedules for workload calculation");
    }
  }

  console.log("Final match criteria:", matchCriteria);

  const workload = await Schedule.aggregate([
    {
      $match: matchCriteria
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
  
  // Check for room double booking and capacity conflicts (unchanged)
  const roomUsage = {};
  for (const item of timetable) {
    const { RoomID, Day, StartTime, Duration, CourseCode, OccNumber } = item;
    const startTimeIdx = TIMES.indexOf(StartTime);
    
    if (!roomUsage[Day]) roomUsage[Day] = {};
    if (!roomUsage[Day][RoomID]) roomUsage[Day][RoomID] = [];

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

    // Check room capacity (unchanged)
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

  // FIXED: Check for instructor conflicts - group overlapping events
  const instructorConflicts = new Map();
  
  // Group events by instructor and day
  const instructorEvents = {};
  
  for (const item of timetable) {
    const { InstructorID, Day, StartTime, Duration, CourseCode, OccNumber } = item;
    
    if (!InstructorID || InstructorID.trim() === '') continue;
    
    const startTimeIdx = TIMES.indexOf(StartTime);
    if (startTimeIdx === -1) continue;
    
    const key = `${InstructorID}-${Day}`;
    if (!instructorEvents[key]) {
      instructorEvents[key] = [];
    }
    
    instructorEvents[key].push({
      ...item,
      startTimeIdx,
      endTimeIdx: startTimeIdx + (Duration || 1) - 1
    });
  }
  
  // Check for conflicts within each instructor's daily schedule
  Object.values(instructorEvents).forEach(events => {
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];
        
        // Check if time periods overlap
        const hasOverlap = !(event1.endTimeIdx < event2.startTimeIdx || event1.startTimeIdx > event2.endTimeIdx);
        
        if (hasOverlap) {
          // Create unique conflict ID
          const sortedIds = [event1._id, event2._id].sort();
          const conflictId = `${event1.InstructorID}-${event1.Day}-${sortedIds[0]}-${sortedIds[1]}`;
          
          if (!instructorConflicts.has(conflictId)) {
            const overlapStart = Math.max(event1.startTimeIdx, event2.startTimeIdx);
            const overlapTimeSlot = TIMES[overlapStart];
            
            const event1OccText = event1.OccNumber 
              ? Array.isArray(event1.OccNumber) 
                ? ` (Occ ${event1.OccNumber.join(", ")})` 
                : ` (Occ ${event1.OccNumber})`
              : "";
              
            const event2OccText = event2.OccNumber 
              ? Array.isArray(event2.OccNumber) 
                ? ` (Occ ${event2.OccNumber.join(", ")})` 
                : ` (Occ ${event2.OccNumber})`
              : "";
            
            instructorConflicts.set(conflictId, {
              Year: year,
              Semester: semester,
              Type: 'Instructor Conflict',
              Description: `Instructor assigned to both ${event1.CourseCode}${event1OccText} and ${event2.CourseCode}${event2OccText} on ${event1.Day} at ${overlapTimeSlot}`,
              CourseCode: event1.CourseCode, // Primary course
              InstructorID: event1.InstructorID,
              Day: event1.Day,
              StartTime: overlapTimeSlot,
              Priority: 'High',
              Status: 'Pending'
            });
          }
        }
      }
    }
  });
  
  // Add instructor conflicts to the main conflicts array
  conflicts.push(...Array.from(instructorConflicts.values()));

  // Save conflicts to database
  for (const conflict of conflicts) {
    await recordConflict(conflict);
  }

  console.log(`=== CONFLICTS DETECTED: ${conflicts.length} ===`);
  console.log(`Instructor conflicts: ${instructorConflicts.size}`);
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

export const autoResolveObsoleteConflicts = async (year, semester) => {
  console.log("=== AUTO-RESOLVING OBSOLETE CONFLICTS ===");
  
  try {
    // Get all pending conflicts for this year/semester
    const pendingConflicts = await Conflict.find({
      Year: year,
      Semester: semester,
      Status: 'Pending'
    });

    if (pendingConflicts.length === 0) {
      console.log("No pending conflicts found to check");
      return { resolved: 0, conflicts: [] };
    }

    console.log(`Found ${pendingConflicts.length} pending conflicts to validate`);

    // Get current schedules (drafts take priority over published)
    const draftSchedules = await Schedule.find({
      Year: year,
      Semester: semester,
      Published: { $ne: true }
    }).lean();

    const currentSchedules = draftSchedules.length > 0 
      ? draftSchedules 
      : await Schedule.find({
          Year: year,
          Semester: semester,
          Published: true
        }).lean();

    console.log(`Using ${currentSchedules.length} current schedules for conflict validation`);

    const resolvedConflicts = [];
    const stillValidConflicts = [];

    for (const conflict of pendingConflicts) {
      const isStillValid = await validateConflictStillExists(conflict, currentSchedules);
      
      if (isStillValid) {
        stillValidConflicts.push(conflict);
      } else {
        // Auto-resolve this conflict
        await Conflict.findByIdAndUpdate(
          conflict._id,
          { 
            Status: 'Resolved',
            ResolvedAt: new Date(),
            ResolvedBy: 'System Auto-Resolution',
            ResolutionNote: 'Conflict no longer exists in current timetable'
          }
        );
        
        resolvedConflicts.push(conflict);
        console.log(`Auto-resolved conflict: ${conflict.Type} for ${conflict.CourseCode}`);
      }
    }

    console.log(`Auto-resolution complete: ${resolvedConflicts.length} resolved, ${stillValidConflicts.length} still valid`);

    return {
      resolved: resolvedConflicts.length,
      conflicts: resolvedConflicts.map(c => ({
        id: c._id,
        type: c.Type,
        course: c.CourseCode,
        description: c.Description
      }))
    };

  } catch (error) {
    console.error("Error in auto-resolution:", error);
    throw error;
  }
};

const validateConflictStillExists = async (conflict, currentSchedules) => {
  const { Type, CourseCode, Day, StartTime, RoomID, InstructorID } = conflict;

  switch (Type) {
    case 'Room Double Booking':
      return await validateRoomDoubleBookingConflict(conflict, currentSchedules);
    
    case 'Room Capacity':
      return await validateRoomCapacityConflict(conflict, currentSchedules);
    
    case 'Instructor Conflict':
      return await validateInstructorConflict(conflict, currentSchedules);
    
    case 'Time Slot Exceeded':
      return await validateTimeSlotExceededConflict(conflict, currentSchedules);
    
    default:
      // For unknown conflict types, assume they're still valid
      console.log(`Unknown conflict type: ${Type}, assuming still valid`);
      return true;
  }
};

const validateRoomDoubleBookingConflict = async (conflict, schedules) => {
  const { CourseCode, Day, StartTime, RoomID } = conflict;
  
  // Find all events in the same room on the same day
  const roomEvents = schedules.filter(sch => 
    sch.RoomID?.toString() === RoomID?.toString() && 
    sch.Day === Day
  );

  if (roomEvents.length <= 1) {
    return false; // No double booking if 1 or fewer events
  }

  // Check for actual time overlaps
  const timeOverlaps = [];
  for (let i = 0; i < roomEvents.length; i++) {
    for (let j = i + 1; j < roomEvents.length; j++) {
      const event1 = roomEvents[i];
      const event2 = roomEvents[j];
      
      const startIdx1 = TIMES.indexOf(event1.StartTime);
      const endIdx1 = startIdx1 + (event1.Duration || 1) - 1;
      const startIdx2 = TIMES.indexOf(event2.StartTime);
      const endIdx2 = startIdx2 + (event2.Duration || 1) - 1;
      
      const hasOverlap = !(endIdx1 < startIdx2 || startIdx1 > endIdx2);
      if (hasOverlap) {
        timeOverlaps.push([event1, event2]);
      }
    }
  }

  return timeOverlaps.length > 0;
};

const validateRoomCapacityConflict = async (conflict, schedules) => {
  const { CourseCode, RoomID, Day, StartTime } = conflict;
  
  // FIXED: Check if this specific course event (same course, room, day, time) still exists
  const specificEvent = schedules.find(sch => 
    sch.CourseCode === CourseCode && 
    sch.RoomID?.toString() === RoomID?.toString() &&
    sch.Day === Day &&
    sch.StartTime === StartTime
  );

  if (!specificEvent) {
    console.log(`Room capacity conflict auto-resolved: Course ${CourseCode} no longer scheduled in room ${RoomID} at ${Day} ${StartTime}`);
    return false; // Specific event no longer exists, conflict is resolved
  }

  // If the event still exists at the same time/room, recheck capacity requirements
  const room = await Room.findById(RoomID);
  const course = await Course.findOne({ code: CourseCode });

  if (!room || !course) {
    console.log(`Room capacity conflict auto-resolved: Room or course not found for ${CourseCode}`);
    return false; // Room or course not found
  }

  // Recalculate required capacity for this specific event
  const requiredCapacity = calculateRequiredCapacity(
    CourseCode, 
    specificEvent.OccType, 
    specificEvent.OccNumber, 
    [course]
  );

  const stillHasCapacityIssue = room.capacity < requiredCapacity;
  
  if (!stillHasCapacityIssue) {
    console.log(`Room capacity conflict auto-resolved: Capacity issue resolved for ${CourseCode} in room ${room.code}`);
  } else {
    console.log(`Room capacity conflict still valid: ${CourseCode} still needs ${requiredCapacity} seats but room ${room.code} only has ${room.capacity}`);
  }

  return stillHasCapacityIssue;
};

const validateInstructorConflict = async (conflict, schedules) => {
  const { InstructorID, Day } = conflict;
  
  if (!InstructorID) return false;

  // Find all events assigned to this instructor on this day
  const instructorEvents = schedules.filter(sch => 
    sch.InstructorID?.toString() === InstructorID?.toString() && 
    sch.Day === Day
  );

  if (instructorEvents.length <= 1) {
    return false; // No conflict with 1 or fewer events
  }

  // Check for time overlaps
  for (let i = 0; i < instructorEvents.length; i++) {
    for (let j = i + 1; j < instructorEvents.length; j++) {
      const event1 = instructorEvents[i];
      const event2 = instructorEvents[j];
      
      const startIdx1 = TIMES.indexOf(event1.StartTime);
      const endIdx1 = startIdx1 + (event1.Duration || 1) - 1;
      const startIdx2 = TIMES.indexOf(event2.StartTime);
      const endIdx2 = startIdx2 + (event2.Duration || 1) - 1;
      
      const hasOverlap = !(endIdx1 < startIdx2 || startIdx1 > endIdx2);
      if (hasOverlap) {
        return true; // Conflict still exists
      }
    }
  }

  return false; // No overlaps found
};

const validateTimeSlotExceededConflict = async (conflict, schedules) => {
  const { CourseCode, Day, StartTime } = conflict;
  
  // Find the specific event
  const event = schedules.find(sch => 
    sch.CourseCode === CourseCode && 
    sch.Day === Day && 
    sch.StartTime === StartTime
  );

  if (!event) {
    return false; // Event no longer exists
  }

  const startIdx = TIMES.indexOf(event.StartTime);
  const duration = event.Duration || 1;
  
  return startIdx + duration > TIMES.length;
};

// Helper function to calculate required capacity (same logic as in Home.jsx)
const calculateRequiredCapacity = (courseCode, occType, occNumber, courses) => {
  const course = courses.find(c => c.code === courseCode);
  if (!course) return 0;
  
  const targetStudent = course.targetStudent || 0;
  
  if (occType === "Lecture") {
    const lectureOccurrence = course.lectureOccurrence || 1;
    return Math.ceil(targetStudent / lectureOccurrence);
  } 
  else if (occType === "Tutorial") {
    const tutorialOcc = course.tutorialOcc || 1;
    return Math.ceil(targetStudent / tutorialOcc);
  }
  
  return targetStudent;
};