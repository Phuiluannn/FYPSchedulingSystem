import Course from '../models/Course.js';
import Room from '../models/Room.js';
import Schedule from '../models/Home.js';
import Conflict from '../models/Conflict.js'; // Add this import
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

const clearPreviousConflicts = async (year, semester) => {
  try {
    const result = await Conflict.deleteMany({ 
      Year: year, 
      Semester: semester 
    });
    console.log(`âœ… Cleared ${result.deletedCount} previous conflicts for ${year} Semester ${semester}`);
    return result.deletedCount;
  } catch (error) {
    console.error("âŒ Error clearing previous conflicts:", error);
    throw error;
  }
};

// FIXED: Replace fetch() with direct database insertion
// FIXED: Replace the recordGenerationConflict function in homeService.js
const recordGenerationConflict = async (conflictData) => {
  try {
    // Validate and map conflict types to schema enum values
    const validConflictTypes = [
      'Room Capacity', 
      'Room Double Booking', 
      'Instructor Conflict', 
      'Course Overlap', 
      'Time Slot Exceeded'
    ];

    // Map generation conflict types to valid schema types
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
    
    console.log("âœ… Generation conflict recorded successfully:", {
      id: savedConflict._id,
      type: savedConflict.Type,
      course: savedConflict.CourseCode
    });
    
    return savedConflict;
  } catch (error) {
    console.error("âŒ Error recording generation conflict:", error);
    console.error("Conflict data that failed:", conflictData);
    
    // Log validation errors specifically
    if (error.name === 'ValidationError') {
      console.error("Validation errors:");
      Object.keys(error.errors).forEach(key => {
        console.error(`- ${key}: ${error.errors[key].message}`);
      });
    }
    
    throw error; // Re-throw to handle upstream if needed
  }
};

// Utility function to shuffle an array
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
  
  // Debug: Log raw room data to verify roomType values
  console.log("Raw room data from database:", rooms.map(r => ({ name: r.name, type: r.roomType, capacity: r.capacity })));

  try {
    const clearedCount = await clearPreviousConflicts(year, semester);
    console.log(`Cleared ${clearedCount} previous conflicts before generation`);
  } catch (error) {
    console.warn("Warning: Could not clear previous conflicts, but continuing with generation:", error.message);
  }
  
  // Clear previous schedules for this year/semester (only draft schedules)
  await Schedule.deleteMany({ 
    Year: year, 
    Semester: semester, 
    Published: { $ne: true }
  });
  console.log("âœ… Cleared only draft schedules, keeping published timetables");

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

  // NEW HELPER: Force placement even with conflicts
  const forceScheduleWithConflicts = async (course, occType, occurrences, duration, allowedRooms, year, semester) => {
  console.log(`🔴 FORCE SCHEDULING: ${course.code} - ${occurrences} ${occType}(s) with ${duration}h each`);
  
  let scheduledCount = 0;
  const maxAttempts = occurrences * 10;
  let attempts = 0;

  while (scheduledCount < occurrences && attempts < maxAttempts) {
    let placed = false;
    
    for (const day of shuffleArray([...DAYS])) {
      for (let timeIdx = 0; timeIdx <= TIMES.length - duration; timeIdx++) {
        for (const room of shuffleArray([...allowedRooms])) {
          
          const conflicts = [];
          
          // Check time slot availability - DON'T RECORD, just check
          const slotsAvailable = areConsecutiveSlotsAvailable(day, timeIdx, duration, room._id);
          if (!slotsAvailable) {
            // REMOVED: No longer recording Room Double Booking here
            // Frontend detectAllConflicts() will handle this
            console.log(`⚠️ Slots occupied in ${room.name || room.code} - will be detected by frontend`);
          }

          // Still record Room Capacity conflicts (these are important)
          const requiredCapacity = occType === "Lecture"
            ? Math.ceil(course.targetStudent / (course.lectureOccurrence || 1))
            : Math.ceil(course.targetStudent / (course.tutorialOcc || 1));
          
          if (room.capacity < requiredCapacity) {
            conflicts.push({
              type: 'Room Capacity',
              description: `${course.code} (${occType}) requires ${requiredCapacity} capacity but ${room.name || room.code} only has ${room.capacity}`
            });
          }

          // Still record Time Slot Exceeded conflicts
          if (timeIdx + duration > TIMES.length) {
            conflicts.push({
              type: 'Time Slot Exceeded',
              description: `${course.code} (${occType}) extends beyond available time slots`
            });
          }

          // FORCE PLACEMENT REGARDLESS OF CONFLICTS
          const groupsPerOccurrence = occType === "Lecture"
            ? Math.ceil((course.tutorialOcc || 1) / occurrences)
            : 1;
          
          const startOcc = scheduledCount * groupsPerOccurrence + 1;
          const endOcc = occType === "Lecture"
            ? Math.min((scheduledCount + 1) * groupsPerOccurrence, course.tutorialOcc || 1)
            : scheduledCount + 1;
          const occNumbers = Array.from({ length: endOcc - startOcc + 1 }, (_, j) => startOcc + j);

          const newSchedule = {
            _id: new mongoose.Types.ObjectId().toString(),
            CourseID: course._id,
            CourseCode: course.code,
            Instructors: [],
            OriginalInstructors: course.instructors,
            InstructorID: null,
            RoomID: room._id,
            OccNumber: occNumbers,
            OccType: occType,
            Year: year,
            Semester: semester,
            Day: day,
            StartTime: TIMES[timeIdx],
            EndTime: getEndTime(timeIdx, duration),
            Duration: duration,
            Published: false
          };

          schedules.push(newSchedule);
          
          // Mark slots as used (even if there were conflicts)
          markConsecutiveSlotsAsUsed(day, timeIdx, duration, room._id);
          
          // Record ONLY non-double-booking conflicts
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

          scheduledCount++;
          placed = true;
          console.log(`✅ FORCE PLACED: ${course.code} ${occType} ${scheduledCount}/${occurrences} with ${conflicts.length} non-double-booking conflicts`);
          break;
        }
        if (placed) break;
      }
      if (placed) break;
    }
    
    if (!placed) {
      console.warn(`⚠️ Could not force place ${course.code} ${occType} occurrence ${scheduledCount + 1}`);
      break;
    }
    
    attempts++;
  }

  console.log(`🔴 FORCE SCHEDULING COMPLETE: ${course.code} - ${scheduledCount}/${occurrences} ${occType}(s) scheduled`);
  return scheduledCount;
};

  // Two-phase scheduling approach
  // Phase 1: Schedule ALL lectures first (beginning of week priority)
  // Phase 2: Schedule ALL tutorials after their lectures

  const shuffledCourses = shuffleArray([...courses]);
  const lecturePriorityDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
  // Store all lecture schedules globally to reference during tutorial scheduling
  const allLectureSchedules = new Map(); // courseId -> lecture schedules array

  console.log("=== PHASE 1: SCHEDULING ALL LECTURES ===");
  
  for (const course of shuffledCourses) {
    console.log(`Processing course: ${course.code}`);
    
    let lecturesScheduled = 0;
    const { lectureOccurrence, tutorialOcc, roomTypes, instructors, targetStudent, code, _id, hasTutorial, creditHour, lectureHour } = course;

    // Calculate durations based on credit hours
    const lectureDuration = lectureHour || 1;
    const tutorialDuration = Math.max(1, (creditHour || 1) - (lectureHour || 1));

    console.log(`Course ${code}: creditHour=${creditHour}, lectureHour=${lectureHour}, lectureDuration=${lectureDuration}h, tutorialDuration=${tutorialDuration}h`);

    const courseRoomTypes = Array.isArray(roomTypes) ? roomTypes : [roomTypes].filter(Boolean);

    // PHASE 1: Schedule ONLY lectures for this course
    if (lectureOccurrence && lectureOccurrence > 0) {
      console.log(`Scheduling ${lectureOccurrence} lectures for ${code}`);
      
      const requiredCapacityPerOccurrence = Math.ceil(targetStudent / lectureOccurrence);
      const suitableLectureRooms = rooms.filter(
        room => room.capacity >= requiredCapacityPerOccurrence
      );

      console.log(`Suitable lecture rooms found: ${suitableLectureRooms.length}`);

      if (suitableLectureRooms.length === 0) {
        // If no suitable rooms by capacity, use ALL rooms and force with capacity conflicts
        console.warn(`No suitable capacity rooms for ${code} lectures. Using all rooms with capacity conflicts.`);
        await forceScheduleWithConflicts(course, "Lecture", lectureOccurrence, lectureDuration, rooms, year, semester);
      } else {
        // Create time slots prioritizing early days of the week
        const lectureTimeSlots = [];
        lecturePriorityDays.forEach(day => {
          for (let timeIdx = 0; timeIdx <= TIMES.length - lectureDuration; timeIdx++) {
            lectureTimeSlots.push({ day, timeIdx });
          }
        });

        const actualLectureOccurrence = Math.min(lectureOccurrence, suitableLectureRooms.length);
        
        const courseLectureSchedules = []; // Store this course's lectures

        // Try to schedule lectures in priority order (early in the week)
        for (const slot of lectureTimeSlots) {
          if (lecturesScheduled >= actualLectureOccurrence) break;
          
          const { day, timeIdx } = slot;
          
          const availableRooms = shuffleArray(
            suitableLectureRooms.filter(
              room => areConsecutiveSlotsAvailable(day, timeIdx, lectureDuration, room._id)
            )
          );

          const roomsNeeded = actualLectureOccurrence - lecturesScheduled;
          if (availableRooms.length >= roomsNeeded) {
            const groupsPerLecture = Math.ceil(tutorialOcc / actualLectureOccurrence);

            for (let i = 0; i < roomsNeeded && lecturesScheduled < actualLectureOccurrence; i++) {
              const room = availableRooms[i];
              const startOcc = lecturesScheduled * groupsPerLecture + 1;
              const endOcc = Math.min((lecturesScheduled + 1) * groupsPerLecture, tutorialOcc);
              const occNumbers = Array.from({ length: endOcc - startOcc + 1 }, (_, j) => startOcc + j);

              const lectureSchedule = {
                _id: new mongoose.Types.ObjectId().toString(),
                CourseID: _id,
                CourseCode: code,
                Instructors: [],
                OriginalInstructors: instructors,
                InstructorID: null,
                RoomID: room._id,
                OccNumber: occNumbers,
                OccType: "Lecture",
                Year: year,
                Semester: semester,
                Day: day,
                StartTime: TIMES[timeIdx],
                EndTime: getEndTime(timeIdx, lectureDuration),
                Duration: lectureDuration,
                Published: false
              };

              schedules.push(lectureSchedule);
              courseLectureSchedules.push({
                ...lectureSchedule,
                timeIdx,
                endTimeIdx: timeIdx + lectureDuration - 1,
                occNumbers
              });

              markConsecutiveSlotsAsUsed(day, timeIdx, lectureDuration, room._id);
              lecturesScheduled++;
            }
            
            if (lecturesScheduled >= actualLectureOccurrence) {
              break;
            }
          }
        }

        // If normal scheduling didn't schedule all lectures, force the remaining
        const remainingLectures = lectureOccurrence - lecturesScheduled;
        if (remainingLectures > 0) {
          console.warn(`âš ï¸ Normal scheduling only placed ${lecturesScheduled}/${lectureOccurrence} lectures for ${code}. Force scheduling remaining ${remainingLectures}.`);
          const forcedCount = await forceScheduleWithConflicts(course, "Lecture", remainingLectures, lectureDuration, suitableLectureRooms, year, semester);
          lecturesScheduled += forcedCount;
        }

        // Store this course's lecture schedules for tutorial phase
        if (courseLectureSchedules.length > 0) {
          allLectureSchedules.set(course._id.toString(), courseLectureSchedules);
        }
      }
      
      console.log(`Lectures scheduled for ${code}: ${lecturesScheduled}/${lectureOccurrence}`);
    }
    
    console.log(`Finished processing lectures for course: ${course.code}`);
  }

  console.log("=== PHASE 2: SCHEDULING ALL TUTORIALS ===");

  // Phase 2: Now schedule ALL tutorials after their corresponding lectures
  for (const course of courses) {
    const { tutorialOcc, roomTypes, instructors, targetStudent, code, _id, hasTutorial, creditHour, lectureHour } = course;
    
    if (hasTutorial !== "Yes" || !tutorialOcc || tutorialOcc <= 0) {
      continue; // Skip if no tutorials needed
    }

    console.log(`Scheduling tutorials for course: ${course.code}`);
    
    const tutorialDuration = Math.max(1, (creditHour || 1) - (lectureHour || 1));
    const courseRoomTypes = Array.isArray(roomTypes) ? roomTypes : [roomTypes].filter(Boolean);

    // Get this course's lecture schedules from the schedules array
    const courseLectureSchedules = schedules.filter(schedule => 
      schedule.CourseID.toString() === _id.toString() && 
      schedule.OccType === "Lecture"
    );
    
    console.log(`Found ${courseLectureSchedules.length} lecture schedules for course ${code}`);
    
    if (courseLectureSchedules.length > 0) {
      // Debug: Log all lectures for this course
      courseLectureSchedules.forEach((lecture, idx) => {
        console.log(`  Lecture ${idx + 1}: ${lecture.Day} ${lecture.StartTime}`);
      });
    }

    const requiredCapacityPerTutorial = Math.ceil(targetStudent / tutorialOcc);

    // Get suitable tutorial rooms
    let suitableTutorialRooms;
    if (courseRoomTypes.length > 0) {
      suitableTutorialRooms = rooms.filter(
        room => room.capacity >= requiredCapacityPerTutorial && courseRoomTypes.includes(room.roomType)
      );
    } else {
      const suitableNonLectureHallRooms = rooms.filter(
        room =>
          room.capacity >= requiredCapacityPerTutorial &&
          (room.roomType !== "Lecture Hall" || room.roomType === undefined)
      );
      
      const suitableAllRooms = rooms.filter(
        room => room.capacity >= requiredCapacityPerTutorial
      );
      
      suitableTutorialRooms = suitableNonLectureHallRooms.length >= tutorialOcc 
        ? suitableNonLectureHallRooms 
        : suitableAllRooms;
    }

    if (suitableTutorialRooms.length === 0) {
      // If no suitable rooms, use ALL rooms and force with conflicts
      console.warn(`No suitable rooms for ${code} tutorials. Using all rooms with conflicts.`);
      await forceScheduleWithConflicts(course, "Tutorial", tutorialOcc, tutorialDuration, rooms, year, semester);
      continue;
    }

    let tutorialsScheduled = 0;

    // Schedule tutorials based on lecture schedule
    if (courseLectureSchedules.length > 0) {
      console.log(`Scheduling tutorials for ${code} to follow its lectures`);
      
      // Find the chronologically LATEST lecture
      let latestLectureDayIdx = -1;
      let latestLectureEndTimeIdx = -1;
      let latestLectureInfo = null;

      courseLectureSchedules.forEach(lecture => {
        const lectureDayIdx = DAYS.indexOf(lecture.Day);
        const lectureTimeIdx = TIMES.findIndex(time => time === lecture.StartTime);
        const lectureDuration = lecture.Duration || 1;
        const lectureEndTimeIdx = lectureTimeIdx + lectureDuration;
        
        // Compare chronological position (day first, then time)
        const isLater = lectureDayIdx > latestLectureDayIdx || 
                       (lectureDayIdx === latestLectureDayIdx && lectureEndTimeIdx > latestLectureEndTimeIdx);
        
        if (isLater) {
          latestLectureDayIdx = lectureDayIdx;
          latestLectureEndTimeIdx = lectureEndTimeIdx;
          latestLectureInfo = {
            day: lecture.Day,
            dayIdx: lectureDayIdx,
            startTimeIdx: lectureTimeIdx,
            endTimeIdx: lectureEndTimeIdx,
            duration: lectureDuration
          };
        }
      });

      console.log(`Latest lecture for ${code} ends: ${latestLectureInfo.day} after time slot ${latestLectureEndTimeIdx - 1}`);

      // Create tutorial time slots starting from after the latest lecture
      const availableTutorialSlots = [];
      
      // Search from the latest lecture day onwards (NEVER go to earlier days)
      for (let dayIdx = latestLectureDayIdx; dayIdx < DAYS.length; dayIdx++) {
        const currentDay = DAYS[dayIdx];
        
        // Determine starting time for this day
        let startTimeIdx = 0;
        if (dayIdx === latestLectureDayIdx) {
          // Same day as latest lecture - start after it ends
          startTimeIdx = latestLectureEndTimeIdx;
          if (startTimeIdx >= TIMES.length) {
            continue; // No time left on this day
          }
        }
        // For subsequent days, start from beginning (startTimeIdx = 0)
        
        console.log(`Checking ${currentDay} for tutorials starting from time index ${startTimeIdx}`);
        
        for (let timeIdx = startTimeIdx; timeIdx <= TIMES.length - tutorialDuration; timeIdx++) {
          // Check if this time slot conflicts with any lecture of the same course
          let conflictsWithOwnLecture = false;
          
          for (const lecture of courseLectureSchedules) {
            if (lecture.Day === currentDay) {
              const lectureStartIdx = TIMES.findIndex(time => time === lecture.StartTime);
              const lectureEndIdx = lectureStartIdx + (lecture.Duration || 1) - 1;
              const tutorialStartIdx = timeIdx;
              const tutorialEndIdx = timeIdx + tutorialDuration - 1;
              
              // Check for time overlap
              if (!(tutorialEndIdx < lectureStartIdx || tutorialStartIdx > lectureEndIdx)) {
                conflictsWithOwnLecture = true;
                break;
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

      // Shuffle the available tutorial slots to add randomization while maintaining chronological constraint
      shuffleArray(availableTutorialSlots);

      console.log(`Available tutorial slots for ${code}: ${availableTutorialSlots.length}`);
      if (availableTutorialSlots.length > 0) {
        console.log(`Tutorial slots are randomized but all come after lectures chronologically`);
      }

      // Schedule tutorials
      for (const slot of availableTutorialSlots) {
        if (tutorialsScheduled >= tutorialOcc) break;
        
        const { day, timeIdx, room } = slot;
        
        if (areConsecutiveSlotsAvailable(day, timeIdx, tutorialDuration, room._id)) {
          const tutorialOccNumber = tutorialsScheduled + 1;

          const tutorialSchedule = {
            _id: new mongoose.Types.ObjectId().toString(),
            CourseID: _id,
            CourseCode: code,
            Instructors: [],
            OriginalInstructors: instructors,
            InstructorID: null,
            RoomID: room._id,
            OccNumber: [tutorialOccNumber],
            OccType: "Tutorial",
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

          console.log(`âœ… Tutorial ${tutorialsScheduled} scheduled for ${code}: ${day} ${TIMES[timeIdx]} (after latest lecture on ${latestLectureInfo.day})`);
        }
      }

      // If normal scheduling didn't schedule all tutorials, force the remaining
      const remainingTutorials = tutorialOcc - tutorialsScheduled;
      if (remainingTutorials > 0) {
        console.warn(`âš ï¸ Normal scheduling only placed ${tutorialsScheduled}/${tutorialOcc} tutorials for ${code}. Force scheduling remaining ${remainingTutorials}.`);
        const forcedCount = await forceScheduleWithConflicts(course, "Tutorial", remainingTutorials, tutorialDuration, suitableTutorialRooms, year, semester);
        tutorialsScheduled += forcedCount;
      }
    } else {
      // No lectures scheduled, schedule tutorials normally (anywhere in the week)
      console.log(`No lectures scheduled for ${code}, using standard tutorial scheduling`);
      
      const allTimeSlots = [];
      DAYS.forEach(day => {
        for (let timeIdx = 0; timeIdx <= TIMES.length - tutorialDuration; timeIdx++) {
          suitableTutorialRooms.forEach(room => {
            allTimeSlots.push({ day, timeIdx, room });
          });
        }
      });

      shuffleArray(allTimeSlots);

      for (const slot of allTimeSlots) {
        if (tutorialsScheduled >= tutorialOcc) break;
        
        const { day, timeIdx, room } = slot;
        
        if (areConsecutiveSlotsAvailable(day, timeIdx, tutorialDuration, room._id)) {
          schedules.push({
            _id: new mongoose.Types.ObjectId().toString(),
            CourseID: _id,
            CourseCode: code,
            Instructors: [],
            OriginalInstructors: instructors,
            InstructorID: null,
            RoomID: room._id,
            OccNumber: [tutorialsScheduled + 1],
            OccType: "Tutorial",
            Year: year,
            Semester: semester,
            Day: day,
            StartTime: TIMES[timeIdx],
            EndTime: getEndTime(timeIdx, tutorialDuration),
            Duration: tutorialDuration,
            Published: false
          });

          markConsecutiveSlotsAsUsed(day, timeIdx, tutorialDuration, room._id);
          tutorialsScheduled++;
        }
      }

      // If normal scheduling didn't schedule all tutorials, force the remaining
      const remainingTutorials = tutorialOcc - tutorialsScheduled;
      if (remainingTutorials > 0) {
        console.warn(`âš ï¸ Normal scheduling only placed ${tutorialsScheduled}/${tutorialOcc} tutorials for ${code}. Force scheduling remaining ${remainingTutorials}.`);
        const forcedCount = await forceScheduleWithConflicts(course, "Tutorial", remainingTutorials, tutorialDuration, suitableTutorialRooms, year, semester);
        tutorialsScheduled += forcedCount;
      }
    }
    
    console.log(`Tutorials scheduled for ${code}: ${tutorialsScheduled}/${tutorialOcc}`);
    console.log(`Finished processing tutorials for course: ${course.code}`);
  }

  console.log("=== GENERATION COMPLETE ===");
  console.log("Courses processed:", courses.length);
  console.log("Rooms available:", rooms.length);
  console.log("Total schedules generated:", schedules.length);
  
  if (schedules.length > 0) {
    console.log("Sample schedules:", schedules.slice(0, 3));
  }

  // Calculate expected vs actual schedules
  const expectedSchedules = courses.reduce((total, course) => {
    let expected = 0;
    if (course.lectureOccurrence > 0) expected += course.lectureOccurrence;
    if (course.hasTutorial === "Yes" && course.tutorialOcc > 0) expected += course.tutorialOcc;
    return total + expected;
  }, 0);

  console.log(`Expected schedules: ${expectedSchedules}, Generated: ${schedules.length}`);
  console.log("âœ… All courses have been scheduled (with conflicts recorded where necessary)");

  const schedulesWithStringIds = schedules.map(sch => ({
    ...sch,
    _id: sch._id?.toString?.() ?? sch._id,
    CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
    RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
  }));

  return { 
    schedules: schedulesWithStringIds,
    conflictsDetected: true, // Always true since we're allowing conflicts when needed
    totalSchedules: schedules.length
  };
};

// Add this function in homeService.js, above the generateTimetable function
const generateDetailedErrorReport = (course, lectureOccurrence, lectureDuration, rooms) => {
  console.log("=== Detailed Error Report ===");
  console.log("Course Details:");
  console.log(`  Code: ${course.code}`);
  console.log(`  Academic Year: ${course.academicYear}`);
  console.log(`  Semester: ${course.semester}`);
  console.log(`  Target Students: ${course.targetStudent}`);
  console.log(`  Lecture Occurrences Required: ${lectureOccurrence}`);
  console.log(`  Lecture Duration: ${lectureDuration} hour(s)`);
  console.log(`  Required Room Types: ${Array.isArray(course.roomTypes) ? course.roomTypes.join(', ') : course.roomTypes || 'None'}`);
  console.log(`  Required Capacity per Lecture: ${Math.ceil(course.targetStudent / lectureOccurrence)}`);

  console.log("Available Rooms:");
  rooms.forEach(room => {
    console.log(`  Room: ${room.name || room.code}, Type: ${room.roomType}, Capacity: ${room.capacity}`);
  });

  console.log("Room Availability Analysis:");
  const suitableRooms = rooms.filter(room => room.capacity >= Math.ceil(course.targetStudent / lectureOccurrence));
  console.log(`  Suitable Rooms Found: ${suitableRooms.length}`);
  suitableRooms.forEach(room => {
    console.log(`    - ${room.name || room.code} (Capacity: ${room.capacity})`);
  });

  console.log("Scheduling Constraints:");
  console.log(`  Total Time Slots Available: ${DAYS.length * (TIMES.length - lectureDuration + 1)}`);
  console.log("  Days: ", DAYS);
  console.log("  Time Slots: ", TIMES);
  console.log("============================");
};

export const getTimetable = async (year, semester, onlyPublished = false) => {
  console.log("=== BACKEND GET TIMETABLE DEBUG ===");
  console.log(`Fetching timetable for year: ${year}, semester: ${semester}, onlyPublished=${onlyPublished}`);

  const filter = { Year: year, Semester: semester };
  
  // CRITICAL FIX: Only add Published filter when onlyPublished is true
  if (onlyPublished === true) {
    filter.Published = true;
    console.log("Adding Published=true filter for user-side request");
  } else {
    console.log("No Published filter applied - fetching all schedules for admin");
  }

  console.log("Database filter being used:", filter);

  const schedules = await Schedule.find(filter).lean();

  console.log(`Found ${schedules.length} schedules in database`);
  console.log("Sample schedules with Published status:");
  schedules.slice(0, 3).forEach((sch, index) => {
    console.log(`DB Schedule ${index}: CourseCode=${sch.CourseCode}, Published=${sch.Published}, Duration=${sch.Duration}`);
  });

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
  
  // Debug: Log each item's Duration before processing
  timetable.forEach((item, index) => {
    console.log(`Item ${index}: CourseCode=${item.CourseCode}, Duration=${item.Duration}, Type=${typeof item.Duration}`);
  });

  await Schedule.deleteMany({ Year: year, Semester: semester });

  const timetableWithObjectIds = timetable.map((item, index) => {
    // IMPROVED: Better Duration handling
    let duration = 1; // Default value
    if (item.Duration !== undefined && item.Duration !== null && item.Duration !== '') {
      const parsedDuration = parseInt(item.Duration);
      if (!isNaN(parsedDuration) && parsedDuration > 0) {
        duration = parsedDuration;
      }
    }

    const processedItem = {
      ...item,
      CourseID: mongoose.Types.ObjectId(item.CourseID),
      RoomID: mongoose.Types.ObjectId(item.RoomID),
      InstructorID: item.InstructorID && item.InstructorID.length === 24
        ? mongoose.Types.ObjectId(item.InstructorID)
        : null,
      Duration: duration, // Now properly preserved with schema support
      Year: year,
      Semester: semester,
    };

    console.log(`Processed item ${index}: CourseCode=${processedItem.CourseCode}, Duration=${processedItem.Duration} (type: ${typeof processedItem.Duration})`);
    return processedItem;
  });

  console.log("=== FINAL DATA BEING SAVED TO DATABASE ===");
  timetableWithObjectIds.forEach((item, index) => {
    console.log(`Final item ${index}: CourseCode=${item.CourseCode}, Duration=${item.Duration}, StartTime=${item.StartTime}`);
  });

  try {
    await Schedule.insertMany(timetableWithObjectIds);
    
    console.log("=== VERIFYING SAVED DATA ===");
    // Immediately fetch what was just saved to verify
    const savedData = await Schedule.find({ Year: year, Semester: semester }).lean();
    savedData.forEach((item, index) => {
      console.log(`Verified in DB ${index}: CourseCode=${item.CourseCode}, Duration=${item.Duration}, StartTime=${item.StartTime}`);
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving timetable:", error);
    throw error;
  }
};