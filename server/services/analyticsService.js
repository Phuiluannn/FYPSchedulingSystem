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

  // 🔧 NEW: Check for existing duplicate conflict
  const existingConflict = await Conflict.findOne({
    Year: conflictData.Year,
    Semester: conflictData.Semester,
    Type: conflictData.Type,
    Description: conflictData.Description,
    Day: conflictData.Day,
    StartTime: conflictData.StartTime,
    Status: 'Pending' // Only check pending conflicts
  });

  if (existingConflict) {
    console.log("⚠️ DUPLICATE CONFLICT DETECTED - Skipping:", {
      type: existingConflict.Type,
      description: existingConflict.Description
    });
    return existingConflict; // Return existing instead of creating duplicate
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
  console.log("✅ New conflict saved:", conflict);
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

  // NEW: Check for Department Tutorial Clashes
console.log("=== CHECKING DEPARTMENT TUTORIAL CLASHES ===");
const departmentTutorialConflicts = new Map();

// Group tutorial events by day
const tutorialsByDay = {};

for (const item of timetable) {
  const { OccType, Day, StartTime, Duration, CourseCode, OccNumber, Departments, YearLevel } = item; // ✅ ADD YearLevel
  
  // Only check tutorials
  if (OccType !== 'Tutorial') continue;
  if (!Departments || Departments.length === 0) continue;
  
  const startTimeIdx = TIMES.indexOf(StartTime);
  if (startTimeIdx === -1) continue;
  
  if (!tutorialsByDay[Day]) {
    tutorialsByDay[Day] = [];
  }
  
  tutorialsByDay[Day].push({
    ...item,
    startTimeIdx,
    endTimeIdx: startTimeIdx + (Duration || 1) - 1
  });
}

// Check for department clashes within each day
Object.entries(tutorialsByDay).forEach(([day, tutorials]) => {
  for (let i = 0; i < tutorials.length; i++) {
    for (let j = i + 1; j < tutorials.length; j++) {
      const tutorial1 = tutorials[i];
      const tutorial2 = tutorials[j];
      
      // Skip if same course
      if (tutorial1.CourseCode === tutorial2.CourseCode) continue;
      
      // ✅ NEW: Skip if different year levels (students in different years can't clash)
      const yearLevel1 = tutorial1.YearLevel || [];
      const yearLevel2 = tutorial2.YearLevel || [];
      const hasSharedYearLevel = yearLevel1.some(yl => yearLevel2.includes(yl));
      
      if (!hasSharedYearLevel) {
        console.log(`  ℹ️ Skipping ${tutorial1.CourseCode} vs ${tutorial2.CourseCode} - different year levels`);
        continue; // Different year levels = no conflict possible
      }
      
      // Check if time periods overlap
      const hasOverlap = !(tutorial1.endTimeIdx < tutorial2.startTimeIdx || tutorial1.startTimeIdx > tutorial2.endTimeIdx);
      
      if (hasOverlap) {
        // Check if they share any departments
        const sharedDepartments = tutorial1.Departments.filter(dept => 
          tutorial2.Departments.includes(dept)
        );
        
        if (sharedDepartments.length > 0) {
          // Create unique conflict ID
          const sortedCourses = [tutorial1.CourseCode, tutorial2.CourseCode].sort();
          const sortedDepts = sharedDepartments.sort();
          const sortedYears = yearLevel1.filter(yl => yearLevel2.includes(yl)).sort(); // ✅ ADD shared years to conflict ID
          const conflictId = `dept-${day}-${sortedDepts.join('-')}-${sortedYears.join('-')}-${sortedCourses.join('-')}`;
          
          if (!departmentTutorialConflicts.has(conflictId)) {
            const overlapStart = Math.max(tutorial1.startTimeIdx, tutorial2.startTimeIdx);
            const overlapTimeSlot = TIMES[overlapStart];
            
            const tutorial1OccText = tutorial1.OccNumber 
              ? Array.isArray(tutorial1.OccNumber) 
                ? ` (Occ ${tutorial1.OccNumber.join(", ")})` 
                : ` (Occ ${tutorial1.OccNumber})`
              : "";
              
            const tutorial2OccText = tutorial2.OccNumber 
              ? Array.isArray(tutorial2.OccNumber) 
                ? ` (Occ ${tutorial2.OccNumber.join(", ")})` 
                : ` (Occ ${tutorial2.OccNumber})`
              : "";
            
            // ✅ NEW: Add year level info to conflict description
            const sharedYearText = sortedYears.length > 0 ? ` (Year ${sortedYears.join(', ')})` : '';
            
            departmentTutorialConflicts.set(conflictId, {
              Year: year,
              Semester: semester,
              Type: 'Department Tutorial Clash',
              Description: `Department(s) ${sharedDepartments.join(', ')}${sharedYearText} have conflicting tutorials: ${tutorial1.CourseCode}${tutorial1OccText} and ${tutorial2.CourseCode}${tutorial2OccText} on ${day} at ${overlapTimeSlot}`,
              CourseCode: tutorial1.CourseCode,
              Day: day,
              StartTime: overlapTimeSlot,
              Priority: 'High',
              Status: 'Pending'
            });
            
            console.log(`📚 Department clash detected: ${sharedDepartments.join(', ')} Year ${sortedYears.join(', ')} - ${tutorial1.CourseCode} vs ${tutorial2.CourseCode}`);
          }
        }
      }
    }
  }
});

// Add department tutorial conflicts to the main conflicts array
conflicts.push(...Array.from(departmentTutorialConflicts.values()));
console.log(`Department tutorial clashes found: ${departmentTutorialConflicts.size}`);

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

    case 'Department Tutorial Clash':
      return await validateDepartmentTutorialClashConflict(conflict, currentSchedules);
    
    case 'Lecture-Tutorial Clash':
      return await validateLectureTutorialClashConflict(conflict, currentSchedules);
    
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
  
  const specificEvent = schedules.find(sch => 
    sch.CourseCode === CourseCode && 
    sch.RoomID?.toString() === RoomID?.toString() &&
    sch.Day === Day &&
    sch.StartTime === StartTime
  );

  if (!specificEvent) {
    console.log(`Room capacity conflict auto-resolved: Course ${CourseCode} no longer scheduled in room ${RoomID} at ${Day} ${StartTime}`);
    return false;
  }

  const room = await Room.findById(RoomID);
  
  if (!room) {
    console.log(`Room capacity conflict auto-resolved: Room not found for ${CourseCode}`);
    return false;
  }

  // ✅ FIX: Always prioritize EstimatedStudents from the schedule
  let requiredCapacity;
  
  if (specificEvent.EstimatedStudents !== undefined && specificEvent.EstimatedStudents !== null) {
    requiredCapacity = specificEvent.EstimatedStudents;
    console.log(`Using EstimatedStudents from schedule: ${requiredCapacity}`);
  } else {
    // ✅ NEW FIX: If EstimatedStudents is missing, get it from the course's groupings
    const course = await Course.findOne({ code: CourseCode });
    if (!course) {
      console.log(`Room capacity conflict auto-resolved: Course not found for ${CourseCode}`);
      return false;
    }
    
    // Get the specific occurrence number(s)
    const occNumbers = Array.isArray(specificEvent.OccNumber) 
      ? specificEvent.OccNumber 
      : [specificEvent.OccNumber];
    
    if (specificEvent.OccType === "Lecture" && course.lectureGroupings) {
      // Find the matching lecture grouping
      const matchingGrouping = course.lectureGroupings.find(group => 
        occNumbers.includes(group.occNumber)
      );
      
      if (matchingGrouping) {
        requiredCapacity = matchingGrouping.estimatedStudents;
        console.log(`Found lecture grouping capacity: ${requiredCapacity} for Occ ${occNumbers.join(', ')}`);
      } else {
        // Fallback to simple division if grouping not found
        requiredCapacity = Math.ceil(course.targetStudent / (course.lectureOccurrence || 1));
        console.log(`Fallback lecture capacity calculation: ${requiredCapacity}`);
      }
    } else if (specificEvent.OccType === "Tutorial" && course.tutorialGroupings) {
      // Find the matching tutorial grouping
      const matchingGrouping = course.tutorialGroupings.find(group => 
        occNumbers.includes(group.occNumber)
      );
      
      if (matchingGrouping) {
        requiredCapacity = matchingGrouping.estimatedStudents;
        console.log(`Found tutorial grouping capacity: ${requiredCapacity} for Occ ${occNumbers.join(', ')}`);
      } else {
        // Fallback to simple division if grouping not found
        requiredCapacity = Math.ceil(course.targetStudent / (course.tutorialOcc || 1));
        console.log(`Fallback tutorial capacity calculation: ${requiredCapacity}`);
      }
    } else {
      // Last resort fallback
      requiredCapacity = course.targetStudent;
      console.log(`Using full target student count: ${requiredCapacity}`);
    }
  }

  const stillHasCapacityIssue = room.capacity < requiredCapacity;
  
  if (!stillHasCapacityIssue) {
    console.log(`Room capacity conflict auto-resolved: Capacity issue resolved for ${CourseCode} in room ${room.code}`);
  } else {
    console.log(`Room capacity conflict still valid: ${CourseCode} needs ${requiredCapacity} seats but room ${room.code} only has ${room.capacity}`);
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

const validateDepartmentTutorialClashConflict = async (conflict, schedules) => {
  const { Day, Description, StartTime } = conflict;
  
  console.log("\n=== VALIDATING DEPARTMENT CLASH ===");
  console.log("Conflict Description:", Description);
  console.log("Conflict Day:", Day);
  console.log("Conflict StartTime:", StartTime);
  
  // Extract course codes from description
  const courseMatches = Description.match(/([A-Z]{3}\d{4}(?:-\d+)?)/g);
  
  if (!courseMatches || courseMatches.length < 2) {
    console.log('❌ Could not extract course codes from department clash description');
    return true; // Keep conflict if we can't parse it
  }
  
  const course1Code = courseMatches[0];
  const course2Code = courseMatches[1];
  
  console.log(`Extracted courses: ${course1Code} vs ${course2Code}`);
  
  // Extract departments - handle both old and new format
  let departments = [];
  
  // Try new format first: "Department(s) X (Year 1) have conflicting"
  const newDeptMatch = Description.match(/Department\(s\)\s+(.+?)\s+\(Year\s+[\d,\s]+\)\s+have\s+conflicting/);
  if (newDeptMatch && newDeptMatch[1]) {
    departments = newDeptMatch[1]
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);
  } else {
    // Fall back to old format: "Department(s) X have conflicting"
    const oldDeptMatch = Description.match(/Department\(s\)\s+(.+?)\s+have\s+conflicting/);
    if (oldDeptMatch && oldDeptMatch[1]) {
      departments = oldDeptMatch[1]
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);
    }
  }
  
  if (departments.length === 0) {
    console.log('❌ No departments found after parsing');
    return true;
  }
  
  console.log(`Extracted departments: ${departments.join(', ')}`);
  
  // ✅ NEW: Extract year level from description
  const yearMatch = Description.match(/\(Year\s+([\d,\s]+)\)/);
  let conflictYearLevels = [];
  if (yearMatch && yearMatch[1]) {
    conflictYearLevels = yearMatch[1]
      .split(',')
      .map(y => y.trim())
      .filter(y => y.length > 0);
    console.log(`Extracted year levels from conflict: ${conflictYearLevels.join(', ')}`);
  } else {
    console.log('⚠️ No year level found in conflict description - this is an old conflict, will check all years');
  }
  
  // 🔧 FIX: Check conflicts in BOTH directions since they could be recorded either way
  const checkConflictPair = (code1, code2) => {
    const tutorial1Events = schedules.filter(sch => 
      sch.CourseCode === code1 && 
      sch.Day === Day && 
      sch.OccType === 'Tutorial'
    );
    
    const tutorial2Events = schedules.filter(sch => 
      sch.CourseCode === code2 && 
      sch.Day === Day && 
      sch.OccType === 'Tutorial'
    );
    
    console.log(`Found ${tutorial1Events.length} tutorial(s) for ${code1}`);
    console.log(`Found ${tutorial2Events.length} tutorial(s) for ${code2}`);
    
    if (tutorial1Events.length === 0 || tutorial2Events.length === 0) {
      return false; // One course no longer has tutorials
    }
    
    // Check each combination for conflicts
    for (const tutorial1 of tutorial1Events) {
      for (const tutorial2 of tutorial2Events) {
        const tutorial1Depts = tutorial1.Departments || [];
        const tutorial2Depts = tutorial2.Departments || [];
        const tutorial1YearLevels = tutorial1.YearLevel || [];
        const tutorial2YearLevels = tutorial2.YearLevel || [];
        
        console.log(`  Checking: ${code1} (Depts: ${tutorial1Depts.join(',')}, Years: ${tutorial1YearLevels.join(',')}) vs ${code2} (Depts: ${tutorial2Depts.join(',')}, Years: ${tutorial2YearLevels.join(',')})`);
        
        // ✅ CRITICAL: Check if they share year levels
        const hasSharedYearLevel = tutorial1YearLevels.some(yl => tutorial2YearLevels.includes(yl));
        
        if (!hasSharedYearLevel) {
          console.log(`  ℹ️ No shared year levels - no conflict possible`);
          continue; // Different year levels = no conflict
        }
        
        console.log(`  ✓ Shared year levels: ${tutorial1YearLevels.filter(yl => tutorial2YearLevels.includes(yl)).join(', ')}`);
        
        // Check if they share departments (case-insensitive)
        const sharedDepts = departments.filter(dept => 
          tutorial1Depts.some(t1Dept => t1Dept.toLowerCase() === dept.toLowerCase()) && 
          tutorial2Depts.some(t2Dept => t2Dept.toLowerCase() === dept.toLowerCase())
        );
        
        if (sharedDepts.length === 0) continue;
        
        console.log(`  ✓ Shared departments found: ${sharedDepts.join(', ')}`);
        
        // Check time overlap
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
        
        const tutorial1Start = TIMES.indexOf(tutorial1.StartTime);
        const tutorial1Duration = tutorial1.Duration || 1;
        const tutorial1End = tutorial1Start + tutorial1Duration - 1;
        
        const tutorial2Start = TIMES.indexOf(tutorial2.StartTime);
        const tutorial2Duration = tutorial2.Duration || 1;
        const tutorial2End = tutorial2Start + tutorial2Duration - 1;
        
        const hasOverlap = !(tutorial1End < tutorial2Start || tutorial1Start > tutorial2End);
        
        console.log(`  Time check: ${tutorial1.StartTime} vs ${tutorial2.StartTime} = ${hasOverlap ? 'OVERLAP' : 'NO OVERLAP'}`);
        
        if (hasOverlap) {
          console.log(`✅ CONFLICT STILL VALID: ${code1} and ${code2} clash for ${sharedDepts.join(', ')} at Year ${tutorial1YearLevels.filter(yl => tutorial2YearLevels.includes(yl)).join(', ')}`);
          return true;
        }
      }
    }
    
    return false;
  };
  
  // 🔧 FIX: Check BOTH possible orderings of the courses
  const conflictExists = checkConflictPair(course1Code, course2Code) || 
                        checkConflictPair(course2Code, course1Code);
  
  if (!conflictExists) {
    console.log(`✅ Department clash auto-resolved: No overlapping tutorials with shared year levels found`);
  }
  
  return conflictExists;
};

const validateLectureTutorialClashConflict = async (conflict, schedules) => {
  const { Day, Description, StartTime } = conflict;
  
  console.log("\n=== VALIDATING LECTURE-TUTORIAL CLASH ===");
  console.log("Conflict Description:", Description);
  console.log("Conflict Day:", Day);
  console.log("Conflict StartTime:", StartTime);
  
  // Extract course codes from description (tutorial course first, then lecture course)
  const courseMatches = Description.match(/([A-Z]{3}\d{4}(?:-\d+)?)/g);
  
  if (!courseMatches || courseMatches.length < 2) {
    console.log('❌ Could not extract course codes from lecture-tutorial clash description');
    return true; // Keep conflict if we can't parse it
  }
  
  const tutorialCourseCode = courseMatches[0];
  const lectureCourseCode = courseMatches[1];
  
  console.log(`Extracted courses: ${tutorialCourseCode} (Tutorial) vs ${lectureCourseCode} (Lecture)`);
  
  // Extract occurrence numbers from description
  const tutorialOccMatch = Description.match(/\(Tutorial Occ ([\d,\s]+)\)/);
  const lectureOccMatch = Description.match(/\(Lecture Occ ([\d,\s]+)\)/);
  
  let tutorialOccNumbers = [];
  let lectureOccNumbers = [];
  
  if (tutorialOccMatch && tutorialOccMatch[1]) {
    tutorialOccNumbers = tutorialOccMatch[1].split(',').map(n => parseInt(n.trim()));
    console.log(`Extracted tutorial occurrence numbers: ${tutorialOccNumbers.join(', ')}`);
  }
  
  if (lectureOccMatch && lectureOccMatch[1]) {
    lectureOccNumbers = lectureOccMatch[1].split(',').map(n => parseInt(n.trim()));
    console.log(`Extracted lecture occurrence numbers: ${lectureOccNumbers.join(', ')}`);
  }
  
  // Extract year levels from description
  const yearMatch = Description.match(/year level\(s\):\s+([\d,\s]+)/i);
  let conflictYearLevels = [];
  if (yearMatch && yearMatch[1]) {
    conflictYearLevels = yearMatch[1]
      .split(',')
      .map(y => y.trim())
      .filter(y => y.length > 0);
    console.log(`Extracted year levels: ${conflictYearLevels.join(', ')}`);
  } else {
    console.log('⚠️ No year level found in conflict description');
    return true; // Keep conflict if we can't determine year levels
  }
  
  // ⭐ KEY FIX: Get the conflict time slot index
  const conflictTimeIdx = TIMES.indexOf(StartTime);
  if (conflictTimeIdx === -1) {
    console.log('⚠️ Invalid conflict StartTime');
    return true; // Keep conflict if we can't parse the time
  }
  console.log(`Conflict time slot index: ${conflictTimeIdx} (${StartTime})`);
  
  // Find tutorial events for the first course
  let tutorialEvents = schedules.filter(sch => 
    sch.CourseCode === tutorialCourseCode && 
    sch.Day === Day && 
    sch.OccType === 'Tutorial'
  );
  
  // If we have specific occurrence numbers, filter by them
  if (tutorialOccNumbers.length > 0) {
    tutorialEvents = tutorialEvents.filter(sch => {
      const occNum = Array.isArray(sch.OccNumber) ? sch.OccNumber : [sch.OccNumber];
      return occNum.some(num => tutorialOccNumbers.includes(num));
    });
    console.log(`Filtered to ${tutorialEvents.length} tutorial(s) matching occurrence numbers`);
  }
  
  // Find lecture events for the second course
  let lectureEvents = schedules.filter(sch => 
    sch.CourseCode === lectureCourseCode && 
    sch.Day === Day && 
    sch.OccType === 'Lecture'
  );
  
  // If we have specific occurrence numbers, filter by them
  if (lectureOccNumbers.length > 0) {
    lectureEvents = lectureEvents.filter(sch => {
      const occNum = Array.isArray(sch.OccNumber) ? sch.OccNumber : [sch.OccNumber];
      return occNum.some(num => lectureOccNumbers.includes(num));
    });
    console.log(`Filtered to ${lectureEvents.length} lecture(s) matching occurrence numbers`);
  }
  
  console.log(`Found ${tutorialEvents.length} tutorial(s) for ${tutorialCourseCode}`);
  console.log(`Found ${lectureEvents.length} lecture(s) for ${lectureCourseCode}`);
  
  if (tutorialEvents.length === 0 || lectureEvents.length === 0) {
    console.log(`✅ Lecture-Tutorial clash auto-resolved: One of the events no longer exists`);
    return false; // One course no longer has the event
  }
  
  // ⭐ KEY FIX: Check if events overlap AT THE SPECIFIC CONFLICT TIME SLOT
  for (const tutorial of tutorialEvents) {
    for (const lecture of lectureEvents) {
      const tutorialYearLevels = tutorial.YearLevel || [];
      const lectureYearLevels = lecture.YearLevel || [];
      
      console.log(`  Checking: ${tutorialCourseCode} Tutorial (Years: ${tutorialYearLevels.join(',')}, Time: ${tutorial.StartTime}) vs ${lectureCourseCode} Lecture (Years: ${lectureYearLevels.join(',')}, Time: ${lecture.StartTime})`);
      
      // Check if they share year levels that match the conflict
      const hasSharedYearLevel = tutorialYearLevels.some(yl => 
        lectureYearLevels.includes(yl) && conflictYearLevels.includes(yl.toString())
      );
      
      if (!hasSharedYearLevel) {
        console.log(`  ℹ️ No matching year levels - no conflict`);
        continue;
      }
      
      const sharedYearLevels = tutorialYearLevels.filter(yl => 
        lectureYearLevels.includes(yl) && conflictYearLevels.includes(yl.toString())
      );
      console.log(`  ✓ Shared year levels matching conflict: ${sharedYearLevels.join(', ')}`);
      
      // ⭐ THE CRITICAL FIX: Check if BOTH events occupy the conflict time slot
      const tutorialStart = TIMES.indexOf(tutorial.StartTime);
      const tutorialDuration = tutorial.Duration || 1;
      const tutorialEnd = tutorialStart + tutorialDuration - 1;
      
      const lectureStart = TIMES.indexOf(lecture.StartTime);
      const lectureDuration = lecture.Duration || 1;
      const lectureEnd = lectureStart + lectureDuration - 1;
      
      // Check if BOTH events occupy the conflict time slot
      const tutorialOccupiesConflictSlot = tutorialStart <= conflictTimeIdx && conflictTimeIdx <= tutorialEnd;
      const lectureOccupiesConflictSlot = lectureStart <= conflictTimeIdx && conflictTimeIdx <= lectureEnd;
      
      console.log(`  Tutorial occupies conflict slot (${StartTime}): ${tutorialOccupiesConflictSlot}`);
      console.log(`  Lecture occupies conflict slot (${StartTime}): ${lectureOccupiesConflictSlot}`);
      
      if (tutorialOccupiesConflictSlot && lectureOccupiesConflictSlot) {
        console.log(`✅ CONFLICT STILL VALID: Both events still occupy the conflict time slot ${StartTime}`);
        return true;
      }
    }
  }
  
  console.log(`✅ Lecture-Tutorial clash auto-resolved: Events no longer overlap at the conflict time slot ${StartTime}`);
  return false;
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