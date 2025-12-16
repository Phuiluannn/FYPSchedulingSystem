import Course from '../models/Course.js';
import Room from '../models/Room.js';
import Schedule from '../models/Home.js';
import Conflict from '../models/Conflict.js';
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
  "5.00 PM - 6.00 PM",
  "6.00 PM - 7.00 PM",
  "7.00 PM - 8.00 PM",
  "8.00 PM - 9.00 PM",
  "9.00 PM - 10.00 PM"
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const clearPreviousConflicts = async (year, semester) => {
  try {
    const result = await Conflict.deleteMany({ 
      Year: year, 
      Semester: semester 
    });
    console.log(`✅ Cleared ${result.deletedCount} previous conflicts for ${year} Semester ${semester}`);
    return result.deletedCount;
  } catch (error) {
    console.error("❌ Error clearing previous conflicts:", error);
    throw error;
  }
};

const recordGenerationConflict = async (conflictData) => {
  try {
    const validConflictTypes = [
      'Room Capacity', 
      'Room Double Booking', 
      'Instructor Conflict', 
      'Course Overlap', 
      'Time Slot Exceeded',
      'Department Tutorial Clash'
    ];

    let mappedType = conflictData.Type;
    switch (conflictData.Type) {
      case 'Insufficient Rooms':
      case 'No Suitable Rooms':
        mappedType = 'Room Capacity';
        break;
      case 'Scheduling Conflict':
      case 'Partial Scheduling':
      case 'Partial Tutorial Scheduling':
        mappedType = 'Course Overlap';
        break;
      default:
        if (!validConflictTypes.includes(conflictData.Type)) {
          console.warn(`Unknown conflict type: ${conflictData.Type}, defaulting to 'Course Overlap'`);
          mappedType = 'Course Overlap';
        }
    }

    const validatedConflictData = {
      ...conflictData,
      Type: mappedType
    };

    console.log("Recording generation conflict with validated data:", validatedConflictData);
    
    const conflict = new Conflict(validatedConflictData);
    const savedConflict = await conflict.save();
    
    console.log("✅ Generation conflict recorded successfully:", {
      id: savedConflict._id,
      type: savedConflict.Type,
      course: savedConflict.CourseCode
    });
    
    return savedConflict;
  } catch (error) {
    console.error("❌ Error recording generation conflict:", error);
    console.error("Conflict data that failed:", conflictData);
    
    if (error.name === 'ValidationError') {
      console.error("Validation errors:");
      Object.keys(error.errors).forEach(key => {
        console.error(`- ${key}: ${error.errors[key].message}`);
      });
    }
    
    throw error;
  }
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export const generateTimetable = async (req) => {
  const { year, semester } = req.body;
  const courses = await Course.find({ academicYear: year, semester });
  const rooms = await Room.find();

  console.log(`Starting timetable generation for ${courses.length} courses`);
  console.log("Raw room data from database:", rooms.map(r => ({ name: r.name, type: r.roomType, capacity: r.capacity })));

  try {
    const clearedCount = await clearPreviousConflicts(year, semester);
    console.log(`Cleared ${clearedCount} previous conflicts before generation`);
  } catch (error) {
    console.warn("Warning: Could not clear previous conflicts, but continuing with generation:", error.message);
  }
  
  await Schedule.deleteMany({ 
    Year: year, 
    Semester: semester, 
    Published: { $ne: true }
  });
  console.log("✅ Cleared only draft schedules, keeping published timetables");

  // Track room usage per day/time
  let usage = {};
  DAYS.forEach(day => {
    usage[day] = {};
    TIMES.forEach((_, timeIdx) => {
      usage[day][timeIdx] = { rooms: new Set() };
    });
  });

  let schedules = [];

  // Helper functions
  const areConsecutiveSlotsAvailable = (day, startTimeIdx, duration, roomId) => {
    for (let i = 0; i < duration; i++) {
      if (startTimeIdx + i >= TIMES.length) return false;
      if (usage[day][startTimeIdx + i].rooms.has(roomId.toString())) return false;
    }
    return true;
  };

  const markConsecutiveSlotsAsUsed = (day, startTimeIdx, duration, roomId) => {
    for (let i = 0; i < duration; i++) {
      usage[day][startTimeIdx + i].rooms.add(roomId.toString());
    }
  };

  const getEndTime = (startTimeIdx, duration) => {
    const endTimeIdx = startTimeIdx + duration - 1;
    if (endTimeIdx >= TIMES.length) return TIMES[TIMES.length - 1].split(" - ")[1];
    return TIMES[endTimeIdx].split(" - ")[1];
  };

  // Force placement with conflicts - UPDATED for department-based occurrences
  const forceScheduleWithConflicts = async (course, occType, grouping, duration, allowedRooms, year, semester) => {
    console.log(`🔴 FORCE SCHEDULING: ${course.code} - ${occType} Occ${grouping.occNumber} (Depts: ${grouping.departments.join(', ')}) with ${duration}h`);
    
    let placed = false;
    const maxAttempts = 100;
    let attempts = 0;

    while (!placed && attempts < maxAttempts) {
      for (const day of shuffleArray([...DAYS])) {
        for (let timeIdx = 0; timeIdx <= TIMES.length - duration; timeIdx++) {
          for (const room of shuffleArray([...allowedRooms])) {
            
            const conflicts = [];
            
            // Check room capacity for this specific grouping
            if (room.capacity < grouping.estimatedStudents) {
              conflicts.push({
                type: 'Room Capacity',
                description: `${course.code} (${occType} Occ${grouping.occNumber}) requires ${grouping.estimatedStudents} capacity but ${room.name || room.code} only has ${room.capacity}`
              });
            }

            // Check time slot exceeded
            if (timeIdx + duration > TIMES.length) {
              conflicts.push({
                type: 'Time Slot Exceeded',
                description: `${course.code} (${occType} Occ${grouping.occNumber}) extends beyond available time slots`
              });
            }

            // FORCE PLACEMENT
            const newSchedule = {
              _id: new mongoose.Types.ObjectId().toString(),
              CourseID: course._id,
              CourseCode: course.code,
              Instructors: [],
              OriginalInstructors: course.instructors,
              InstructorID: null,
              RoomID: room._id,
              OccNumber: [grouping.occNumber],
              OccType: occType,
              Departments: grouping.departments, // NEW: Track which departments this is for
              EstimatedStudents: grouping.estimatedStudents, // NEW: Track estimated students
              Year: year,
              Semester: semester,
              Day: day,
              StartTime: TIMES[timeIdx],
              EndTime: getEndTime(timeIdx, duration),
              Duration: duration,
              Published: false
            };

            schedules.push(newSchedule);
            markConsecutiveSlotsAsUsed(day, timeIdx, duration, room._id);
            
            // Record non-double-booking conflicts
            for (const conflict of conflicts) {
              const conflictData = {
                Year: year,
                Semester: semester,
                Type: conflict.type,
                Description: conflict.description,
                CourseCode: course.code,
                RoomID: room._id,
                Day: day,
                StartTime: TIMES[timeIdx],
                Priority: 'High',
                Status: 'Pending'
              };
              await recordGenerationConflict(conflictData);
            }

            placed = true;
            console.log(`✅ FORCE PLACED: ${course.code} ${occType} Occ${grouping.occNumber} with ${conflicts.length} conflicts`);
            return 1; // Successfully placed
          }
          if (placed) break;
        }
        if (placed) break;
      }
      attempts++;
    }

    console.warn(`⚠️ Could not force place ${course.code} ${occType} Occ${grouping.occNumber}`);
    return 0;
  };

  // Continue in Part 2...

  // Two-phase scheduling approach
  // Phase 1: Schedule ALL lectures first (beginning of week priority)
  // Phase 2: Schedule ALL tutorials after their lectures

// PHASE 1: SCHEDULE ALL LECTURES (by department groupings)
  const shuffledCourses = shuffleArray([...courses]);
const lecturePriorityDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
// PHASE 1: SCHEDULE ALL LECTURES (DEPARTMENT-BASED)
// KEY FIX: All occurrences of the same course must be at the same time

console.log("=== PHASE 1: SCHEDULING ALL LECTURES (DEPARTMENT-BASED) ===");

for (const course of shuffledCourses) {
  console.log(`Processing course: ${course.code}`);
  
  const { lectureOccurrence, lectureGroupings, roomTypes, instructors, code, _id, hasTutorial, creditHour, lectureHour } = course;

  if (!lectureOccurrence || lectureOccurrence === 0 || !lectureGroupings || lectureGroupings.length === 0) {
    console.log(`Skipping ${code} - no lectures to schedule`);
    continue;
  }

  const lectureDuration = lectureHour || 1;
  console.log(`Course ${code}: ${lectureGroupings.length} lecture groupings, duration=${lectureDuration}h`);

  // CRITICAL: Check if course requires CCNA Lab
  const courseRoomTypes = Array.isArray(roomTypes) ? roomTypes : [roomTypes].filter(Boolean);
  const requiresCCNALab = courseRoomTypes.includes("CCNA Lab");
  
  if (requiresCCNALab) {
    console.log(`  ⚠️ ${code} requires CCNA Lab - lectures MUST be in CCNA Lab rooms`);
  }

  // Find rooms that can accommodate ALL lecture groupings
  const roomsNeeded = lectureGroupings.length;
  
  // Create time slots prioritizing early days
  const lectureTimeSlots = [];
  lecturePriorityDays.forEach(day => {
    for (let timeIdx = 0; timeIdx <= TIMES.length - lectureDuration; timeIdx++) {
      lectureTimeSlots.push({ day, timeIdx });
    }
  });

  let allOccurrencesPlaced = false;

  // Try to find ONE time slot where ALL occurrences can be scheduled
  for (const slot of lectureTimeSlots) {
    if (allOccurrencesPlaced) break;
    
    const { day, timeIdx } = slot;
    
    // Find available rooms for THIS time slot that can fit each grouping
    const availableRoomsForSlot = [];
    
    for (const grouping of lectureGroupings) {
      let suitableRooms;
      
      // CRITICAL FIX: If course requires CCNA Lab, ONLY use CCNA Lab rooms
      if (requiresCCNALab) {
        suitableRooms = rooms.filter(
          room => 
            room.roomType === "CCNA Lab" &&
            room.capacity >= grouping.estimatedStudents &&
            areConsecutiveSlotsAvailable(day, timeIdx, lectureDuration, room._id)
        );
        
        if (suitableRooms.length === 0) {
          console.log(`    ⚠️ No available CCNA Lab rooms for grouping ${grouping.occNumber} at ${day} ${TIMES[timeIdx]}`);
        }
      } else {
        // Normal room selection for other courses
        suitableRooms = rooms.filter(
          room => 
            room.capacity >= grouping.estimatedStudents &&
            areConsecutiveSlotsAvailable(day, timeIdx, lectureDuration, room._id)
        );
      }
      
      if (suitableRooms.length === 0) {
        // Can't place all occurrences at this time slot
        availableRoomsForSlot.length = 0;
        break;
      }
      
      availableRoomsForSlot.push({
        grouping,
        rooms: suitableRooms
      });
    }
    
    // If we found enough rooms for ALL occurrences at this time slot
    if (availableRoomsForSlot.length === lectureGroupings.length) {
      console.log(`✅ Found time slot for all ${lectureGroupings.length} occurrences: ${day} ${TIMES[timeIdx]}`);
      
      // Track which rooms have been assigned to avoid duplicates
      const usedRoomsForThisCourse = new Set();
      let canPlaceAllOccurrences = true;
      const tentativeSchedules = [];
      
      // Schedule ALL occurrences at the SAME time but DIFFERENT rooms
      for (const { grouping, rooms: suitableRooms } of availableRoomsForSlot) {
        // Filter out rooms already used for this course at this time
        const availableUniqueRooms = suitableRooms.filter(
          room => !usedRoomsForThisCourse.has(room._id.toString())
        );
        
        if (availableUniqueRooms.length === 0) {
          // Can't place this occurrence - no unique room available
          canPlaceAllOccurrences = false;
          break;
        }
        
        const room = shuffleArray([...availableUniqueRooms])[0];
        usedRoomsForThisCourse.add(room._id.toString());
        
        const lectureSchedule = {
          _id: new mongoose.Types.ObjectId().toString(),
          CourseID: _id,
          CourseCode: code,
          Instructors: [],
          OriginalInstructors: instructors,
          InstructorID: null,
          RoomID: room._id,
          OccNumber: [grouping.occNumber],
          OccType: "Lecture",
          Departments: grouping.departments,
          EstimatedStudents: grouping.estimatedStudents,
          Year: year,
          Semester: semester,
          Day: day,
          StartTime: TIMES[timeIdx],
          EndTime: getEndTime(timeIdx, lectureDuration),
          Duration: lectureDuration,
          Published: false
        };

        tentativeSchedules.push({ schedule: lectureSchedule, room, grouping });
      }
      
      // Only commit if ALL occurrences can be placed in different rooms
      if (canPlaceAllOccurrences) {
        for (const { schedule, room, grouping } of tentativeSchedules) {
          schedules.push(schedule);
          markConsecutiveSlotsAsUsed(day, timeIdx, lectureDuration, room._id);
          console.log(`  → Scheduled Lecture Occ${grouping.occNumber} in room ${room.name || room.code}`);
        }
        allOccurrencesPlaced = true;
      }
    }
  }

  // If normal scheduling failed for ALL occurrences together, force schedule them
  if (!allOccurrencesPlaced) {
    console.warn(`⚠️ Could not find time slot for all ${lectureGroupings.length} occurrences of ${code}. Force scheduling.`);
    
    // Force schedule all occurrences at the SAME arbitrary time slot with DIFFERENT rooms
    const forcedDay = lecturePriorityDays[0];
    const forcedTimeIdx = 0;
    const usedForcedRooms = new Set();
    
    for (const grouping of lectureGroupings) {
      let suitableRooms;
      
      // CRITICAL FIX: If course requires CCNA Lab, force schedule ONLY in CCNA Lab rooms
      if (requiresCCNALab) {
        suitableRooms = rooms.filter(
          room => 
            room.roomType === "CCNA Lab" &&
            room.capacity >= grouping.estimatedStudents && 
            !usedForcedRooms.has(room._id.toString())
        );
        
        if (suitableRooms.length === 0) {
          console.error(`  🔴 CRITICAL: No CCNA Lab rooms available for ${code}! Using any CCNA Lab regardless of capacity.`);
          suitableRooms = rooms.filter(
            room => 
              room.roomType === "CCNA Lab" &&
              !usedForcedRooms.has(room._id.toString())
          );
        }
      } else {
        // Normal force scheduling for other courses
        suitableRooms = rooms.filter(
          room => room.capacity >= grouping.estimatedStudents && 
                  !usedForcedRooms.has(room._id.toString())
        );
      }
      
      if (suitableRooms.length === 0) {
        // Use any available room that hasn't been used yet (respecting CCNA Lab requirement)
        let anyUnusedRoom;
        
        if (requiresCCNALab) {
          anyUnusedRoom = rooms.find(
            room => room.roomType === "CCNA Lab" && !usedForcedRooms.has(room._id.toString())
          );
          
          if (!anyUnusedRoom) {
            console.error(`  🔴 ABSOLUTE CRITICAL: All CCNA Labs exhausted for ${code}!`);
            // Last resort: reuse a CCNA Lab (will create double booking conflict)
            anyUnusedRoom = rooms.find(room => room.roomType === "CCNA Lab");
          }
        } else {
          anyUnusedRoom = rooms.find(
            room => !usedForcedRooms.has(room._id.toString())
          );
        }
        
        if (anyUnusedRoom) {
          usedForcedRooms.add(anyUnusedRoom._id.toString());
          
          const lectureSchedule = {
            _id: new mongoose.Types.ObjectId().toString(),
            CourseID: _id,
            CourseCode: code,
            Instructors: [],
            OriginalInstructors: instructors,
            InstructorID: null,
            RoomID: anyUnusedRoom._id,
            OccNumber: [grouping.occNumber],
            OccType: "Lecture",
            Departments: grouping.departments,
            EstimatedStudents: grouping.estimatedStudents,
            Year: year,
            Semester: semester,
            Day: forcedDay,
            StartTime: TIMES[forcedTimeIdx],
            EndTime: getEndTime(forcedTimeIdx, lectureDuration),
            Duration: lectureDuration,
            Published: false
          };

          schedules.push(lectureSchedule);
          markConsecutiveSlotsAsUsed(forcedDay, forcedTimeIdx, lectureDuration, anyUnusedRoom._id);
          
          // Record capacity conflict if applicable
          if (anyUnusedRoom.capacity < grouping.estimatedStudents) {
            await recordGenerationConflict({
              Year: year,
              Semester: semester,
              Type: 'Room Capacity',
              Description: `${code} (Lecture Occ${grouping.occNumber}) requires ${grouping.estimatedStudents} capacity but ${anyUnusedRoom.name || anyUnusedRoom.code} only has ${anyUnusedRoom.capacity}`,
              CourseCode: code,
              RoomID: anyUnusedRoom._id,
              Day: forcedDay,
              StartTime: TIMES[forcedTimeIdx],
              Priority: 'High',
              Status: 'Pending'
            });
          }
          
          console.log(`  🔴 FORCE: Lecture Occ${grouping.occNumber} at ${forcedDay} ${TIMES[forcedTimeIdx]} in ${anyUnusedRoom.name || anyUnusedRoom.code} ${anyUnusedRoom.capacity < grouping.estimatedStudents ? '(capacity conflict)' : ''}`);
        } else {
          // Absolute last resort - use the generic force function
          await forceScheduleWithConflicts(course, "Lecture", grouping, lectureDuration, requiresCCNALab ? rooms.filter(r => r.roomType === "CCNA Lab") : rooms, year, semester);
        }
      } else {
        // Force at the same time with a unique room
        const room = shuffleArray([...suitableRooms])[0];
        usedForcedRooms.add(room._id.toString());
        
        const lectureSchedule = {
          _id: new mongoose.Types.ObjectId().toString(),
          CourseID: _id,
          CourseCode: code,
          Instructors: [],
          OriginalInstructors: instructors,
          InstructorID: null,
          RoomID: room._id,
          OccNumber: [grouping.occNumber],
          OccType: "Lecture",
          Departments: grouping.departments,
          EstimatedStudents: grouping.estimatedStudents,
          Year: year,
          Semester: semester,
          Day: forcedDay,
          StartTime: TIMES[forcedTimeIdx],
          EndTime: getEndTime(forcedTimeIdx, lectureDuration),
          Duration: lectureDuration,
          Published: false
        };

        schedules.push(lectureSchedule);
        markConsecutiveSlotsAsUsed(forcedDay, forcedTimeIdx, lectureDuration, room._id);
        
        console.log(`  🔴 FORCE: Lecture Occ${grouping.occNumber} at ${forcedDay} ${TIMES[forcedTimeIdx]} in ${room.name || room.code}`);
      }
    }
  }
  
  console.log(`Lectures scheduled for ${code}: ${lectureGroupings.length}/${lectureGroupings.length}`);
}

console.log("=== PHASE 2: SCHEDULING ALL TUTORIALS (DEPARTMENT-BASED) ===");

// PHASE 2: Schedule tutorials based on tutorial groupings
for (const course of courses) {
  const { tutorialOcc, tutorialGroupings, roomTypes, instructors, code, _id, hasTutorial, creditHour, lectureHour } = course;
  
  // CRITICAL FIX: Schedule tutorials for ANY course that has tutorial occurrences
  // This includes:
  // 1. Courses with hasTutorial === "Yes" (has both lectures and tutorials)
  // 2. Courses with hasTutorial === "No" (has ONLY tutorials, no separate lectures)
  if (!tutorialOcc || tutorialOcc <= 0 || !tutorialGroupings || tutorialGroupings.length === 0) {
    console.log(`Skipping ${code} - no tutorials to schedule (tutorialOcc=${tutorialOcc})`);
    continue;
  }

  console.log(`Scheduling tutorials for course: ${code} (hasTutorial=${hasTutorial})`);
  
  // FIXED: For tutorial-only courses (hasTutorial === "No"), duration equals creditHour
  // For courses with both (hasTutorial === "Yes"), duration = creditHour - lectureHour
  let tutorialDuration;
  if (hasTutorial === "No") {
    // Tutorial-only courses: duration = credit hour (e.g., 2 credit hours = 2 hours of tutorial)
    tutorialDuration = creditHour || 1;
    console.log(`  ➡ Tutorial-only course: duration = ${tutorialDuration}h (credit hour)`);
  } else {
    // Courses with both lectures and tutorials
    tutorialDuration = Math.max(1, (creditHour || 1) - (lectureHour || 1));
    console.log(`  ➡ Course with lectures: duration = ${tutorialDuration}h (creditHour ${creditHour} - lectureHour ${lectureHour})`);
  }
  
  const courseRoomTypes = Array.isArray(roomTypes) ? roomTypes : [roomTypes].filter(Boolean);

  // Get this course's lecture schedules (will be empty for tutorial-only courses)
  const courseLectureSchedules = schedules.filter(schedule => 
    schedule.CourseID.toString() === _id.toString() && 
    schedule.OccType === "Lecture"
  );
  
  console.log(`  Found ${courseLectureSchedules.length} lecture schedules for course ${code}`);

  let tutorialsScheduled = 0;

  // Schedule each tutorial grouping separately
  for (const grouping of tutorialGroupings) {
    console.log(`  Scheduling Tutorial Occ${grouping.occNumber} for ${code}: Depts=[${grouping.departments.join(', ')}], Students=${grouping.estimatedStudents}`);
    
    // CRITICAL: Check if course requires CCNA Lab
    const requiresCCNALab = courseRoomTypes.includes("CCNA Lab");
    
    // Find suitable rooms for this specific grouping
    let suitableTutorialRooms;
    
    if (requiresCCNALab) {
      // CRITICAL FIX: If course requires CCNA Lab, tutorials MUST also be in CCNA Lab
      console.log(`    ⚠️ ${code} requires CCNA Lab - tutorials MUST be in CCNA Lab rooms`);
      suitableTutorialRooms = rooms.filter(
        room => 
          room.roomType === "CCNA Lab" &&
          room.capacity >= grouping.estimatedStudents
      );
      
      if (suitableTutorialRooms.length === 0) {
        console.warn(`    ⚠️ No CCNA Lab rooms meet capacity requirement. Using all CCNA Labs regardless of capacity.`);
        suitableTutorialRooms = rooms.filter(room => room.roomType === "CCNA Lab");
      }
    } else if (courseRoomTypes.length > 0) {
      // Normal room type filtering for non-CCNA courses
      suitableTutorialRooms = rooms.filter(
        room => room.capacity >= grouping.estimatedStudents && courseRoomTypes.includes(room.roomType)
      );
    } else {
      // Default room selection logic
      const suitableNonLectureHallRooms = rooms.filter(
        room =>
          room.capacity >= grouping.estimatedStudents &&
          (room.roomType !== "Lecture Hall" || room.roomType === undefined)
      );
      
      const suitableAllRooms = rooms.filter(
        room => room.capacity >= grouping.estimatedStudents
      );
      
      suitableTutorialRooms = suitableNonLectureHallRooms.length > 0
        ? suitableNonLectureHallRooms 
        : suitableAllRooms;
    }

    if (suitableTutorialRooms.length === 0) {
      console.warn(`  ⚠️ No suitable rooms for ${code} Tutorial Occ${grouping.occNumber}. ${requiresCCNALab ? 'Using CCNA Labs' : 'Using all rooms'} with conflicts.`);
      await forceScheduleWithConflicts(
        course, 
        "Tutorial", 
        grouping, 
        tutorialDuration, 
        requiresCCNALab ? rooms.filter(r => r.roomType === "CCNA Lab") : rooms, 
        year, 
        semester
      );
      tutorialsScheduled++;
      continue;
    }

    // FIXED: For tutorial-only courses, no need to avoid lecture conflicts
    let latestLectureDayIdx = -1;
    let latestLectureEndTimeIdx = -1;

    if (courseLectureSchedules.length > 0) {
      // Only calculate lecture constraints if this course has lectures
      courseLectureSchedules.forEach(lecture => {
        const lectureDayIdx = DAYS.indexOf(lecture.Day);
        const lectureTimeIdx = TIMES.findIndex(time => time === lecture.StartTime);
        const lectureDuration = lecture.Duration || 1;
        const lectureEndTimeIdx = lectureTimeIdx + lectureDuration;
        
        const isLater = lectureDayIdx > latestLectureDayIdx || 
                       (lectureDayIdx === latestLectureDayIdx && lectureEndTimeIdx > latestLectureEndTimeIdx);
        
        if (isLater) {
          latestLectureDayIdx = lectureDayIdx;
          latestLectureEndTimeIdx = lectureEndTimeIdx;
        }
      });

      console.log(`  Latest lecture for ${code} ends at day index ${latestLectureDayIdx}, time index ${latestLectureEndTimeIdx - 1}`);
    } else {
      console.log(`  No lectures for ${code} - tutorial-only course, can schedule anywhere`);
    }

    // Create tutorial time slots
    const availableTutorialSlots = [];
    
    // FIXED: For tutorial-only courses, start from the beginning of the week
    const startDayIdx = (hasTutorial === "Yes" && latestLectureDayIdx >= 0) ? latestLectureDayIdx : 0;
    
    for (let dayIdx = startDayIdx; dayIdx < DAYS.length; dayIdx++) {
      const currentDay = DAYS[dayIdx];
      
      let startTimeIdx = 0;
      
      // Only apply lecture end time constraints if this course has lectures
      if (hasTutorial === "Yes" && dayIdx === latestLectureDayIdx && latestLectureEndTimeIdx > 0) {
        startTimeIdx = latestLectureEndTimeIdx;
        if (startTimeIdx >= TIMES.length) continue;
      }
      
      for (let timeIdx = startTimeIdx; timeIdx <= TIMES.length - tutorialDuration; timeIdx++) {
        let conflictsWithOwnLecture = false;
        
        // Only check lecture conflicts if this course has lectures
        if (hasTutorial === "Yes") {
          for (const lecture of courseLectureSchedules) {
            if (lecture.Day === currentDay) {
              const lectureStartIdx = TIMES.findIndex(time => time === lecture.StartTime);
              const lectureEndIdx = lectureStartIdx + (lecture.Duration || 1) - 1;
              const tutorialStartIdx = timeIdx;
              const tutorialEndIdx = timeIdx + tutorialDuration - 1;
              
              if (!(tutorialEndIdx < lectureStartIdx || tutorialStartIdx > lectureEndIdx)) {
                conflictsWithOwnLecture = true;
                break;
              }
            }
          }
        }
        
        if (!conflictsWithOwnLecture) {
          suitableTutorialRooms.forEach(room => {
            availableTutorialSlots.push({ 
              day: currentDay, 
              timeIdx, 
              room
            });
          });
        }
      }
    }

    shuffleArray(availableTutorialSlots);

    let placed = false;

    // Try to schedule this tutorial occurrence
    for (const slot of availableTutorialSlots) {
      if (placed) break;
      
      const { day, timeIdx, room } = slot;
      
      if (areConsecutiveSlotsAvailable(day, timeIdx, tutorialDuration, room._id)) {
        const tutorialSchedule = {
          _id: new mongoose.Types.ObjectId().toString(),
          CourseID: _id,
          CourseCode: code,
          Instructors: [],
          OriginalInstructors: instructors,
          InstructorID: null,
          RoomID: room._id,
          OccNumber: [grouping.occNumber],
          OccType: "Tutorial",
          Departments: grouping.departments,
          EstimatedStudents: grouping.estimatedStudents,
          Year: year,
          Semester: semester,
          Day: day,
          StartTime: TIMES[timeIdx],
          EndTime: getEndTime(timeIdx, tutorialDuration),
          Duration: tutorialDuration,
          Published: false
        };

        schedules.push(tutorialSchedule);
        markConsecutiveSlotsAsUsed(day, timeIdx, tutorialDuration, room._id);
        tutorialsScheduled++;
        placed = true;

        console.log(`  ✅ Scheduled Tutorial Occ${grouping.occNumber} for ${code} on ${day} ${TIMES[timeIdx]} in ${room.name || room.code}`);
      }
    }

    // If normal scheduling failed, force schedule
    if (!placed) {
      console.warn(`  ⚠️ Normal scheduling failed for ${code} Tutorial Occ${grouping.occNumber}. Force scheduling.`);
      const forcedCount = await forceScheduleWithConflicts(
        course, 
        "Tutorial", 
        grouping, 
        tutorialDuration, 
        requiresCCNALab ? suitableTutorialRooms : suitableTutorialRooms, 
        year, 
        semester
      );
      tutorialsScheduled += forcedCount;
    }
  }
  
  console.log(`Tutorials scheduled for ${code}: ${tutorialsScheduled}/${tutorialGroupings.length}`);
}

console.log("=== GENERATION COMPLETE ===");
console.log("Total schedules generated:", schedules.length);

  const schedulesWithStringIds = schedules.map(sch => ({
    ...sch,
    _id: sch._id?.toString?.() ?? sch._id,
    CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
    RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
  }));

  return { 
    schedules: schedulesWithStringIds,
    conflictsDetected: true,
    totalSchedules: schedules.length
  };
};

// Keep the existing getTimetable and saveTimetable functions...
export const getTimetable = async (year, semester, onlyPublished = false) => {
  console.log("=== BACKEND GET TIMETABLE DEBUG ===");
  console.log(`Fetching timetable for year: ${year}, semester: ${semester}, onlyPublished=${onlyPublished}`);

  const filter = { Year: year, Semester: semester };
  
  if (onlyPublished === true) {
    filter.Published = true;
    console.log("Adding Published=true filter for user-side request");
  } else {
    console.log("No Published filter applied - fetching all schedules for admin");
  }

  const schedules = await Schedule.find(filter).lean();
  console.log(`Found ${schedules.length} schedules in database`);

  const schedulesWithStringIds = schedules.map(sch => ({
    ...sch,
    _id: sch._id?.toString?.() ?? sch._id,
    CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
    RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
    Duration: sch.Duration || 1,
  }));

  return { schedules: schedulesWithStringIds };
};

export const saveTimetable = async (year, semester, timetable) => {
  console.log("=== BACKEND SAVE TIMETABLE DEBUG ===");
  console.log(`Saving timetable for year: ${year}, semester: ${semester}`);
  console.log(`Received ${timetable.length} items`);

  await Schedule.deleteMany({ Year: year, Semester: semester });

  const timetableWithObjectIds = timetable.map((item) => {
    let duration = 1;
    if (item.Duration !== undefined && item.Duration !== null && item.Duration !== '') {
      const parsedDuration = parseInt(item.Duration);
      if (!isNaN(parsedDuration) && parsedDuration > 0) {
        duration = parsedDuration;
      }
    }

    return {
      ...item,
      CourseID: mongoose.Types.ObjectId(item.CourseID),
      RoomID: mongoose.Types.ObjectId(item.RoomID),
      InstructorID: item.InstructorID && item.InstructorID.length === 24
        ? mongoose.Types.ObjectId(item.InstructorID)
        : null,
      Duration: duration,
      Year: year,
      Semester: semester,
    };
  });

  await Schedule.insertMany(timetableWithObjectIds);
  return { success: true };
};