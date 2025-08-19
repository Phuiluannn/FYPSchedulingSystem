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
    console.log(`✅ Cleared ${result.deletedCount} previous conflicts for ${year} Semester ${semester}`);
    return result.deletedCount;
  } catch (error) {
    console.error("❌ Error clearing previous conflicts:", error);
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
    
    console.log("✅ Generation conflict recorded successfully:", {
      id: savedConflict._id,
      type: savedConflict.Type,
      course: savedConflict.CourseCode
    });
    
    return savedConflict;
  } catch (error) {
    console.error("❌ Error recording generation conflict:", error);
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
    // Continue with generation even if conflict clearing fails
  }
  
  // Clear previous schedules for this year/semester
  // FIXED: Only clear draft schedules, keep published ones
await Schedule.deleteMany({ 
  Year: year, 
  Semester: semester, 
  Published: { $ne: true } // Only delete non-published schedules
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

  // Helper function to check if consecutive time slots are available
  const areConsecutiveSlotsAvailable = (day, startTimeIdx, duration, roomId) => {
    for (let i = 0; i < duration; i++) {
      if (startTimeIdx + i >= TIMES.length) return false; // Not enough slots
      if (usage[day][startTimeIdx + i].rooms.has(roomId.toString())) return false; // Slot occupied
    }
    return true;
  };

  // Helper function to mark consecutive time slots as used
  const markConsecutiveSlotsAsUsed = (day, startTimeIdx, duration, roomId) => {
    for (let i = 0; i < duration; i++) {
      usage[day][startTimeIdx + i].rooms.add(roomId.toString());
    }
  };

  // Helper function to get end time for multi-hour sessions
  const getEndTime = (startTimeIdx, duration) => {
    const endTimeIdx = startTimeIdx + duration - 1;
    if (endTimeIdx >= TIMES.length) return TIMES[TIMES.length - 1].split(" - ")[1];
    return TIMES[endTimeIdx].split(" - ")[1];
  };

  // Shuffle courses to process in random order
  const shuffledCourses = shuffleArray([...courses]);
  // Shuffle DAYS and TIMES for random time slot selection
  const shuffledDays = shuffleArray([...DAYS]);
  const shuffledTimes = shuffleArray([...TIMES]);

  for (const course of shuffledCourses) {
    console.log(`Processing course: ${course.code}`);
    
    const { lectureOccurrence, tutorialOcc, roomTypes, instructors, targetStudent, code, _id, hasTutorial, creditHour, lectureHour } = course;

    // Calculate durations based on credit hours
    const lectureDuration = lectureHour || 1; // Default to 1 hour if not specified
    const tutorialDuration = Math.max(1, (creditHour || 1) - (lectureHour || 1)); // Tutorial = Credit - Lecture, minimum 1

    console.log(`Course ${code}: creditHour=${creditHour}, lectureHour=${lectureHour}, lectureDuration=${lectureDuration}h, tutorialDuration=${tutorialDuration}h`);

    // Ensure roomTypes is an array
    const courseRoomTypes = Array.isArray(roomTypes) ? roomTypes : [roomTypes].filter(Boolean);

    // Schedule lectures
    if (lectureOccurrence && lectureOccurrence > 0) {
      console.log(`Scheduling ${lectureOccurrence} lectures for ${code}`);
      
      // Calculate required capacity per lecture occurrence
      const requiredCapacityPerOccurrence = Math.ceil(targetStudent / lectureOccurrence);

      // FIXED: For lectures, ignore room types - just find rooms with sufficient capacity
      const suitableLectureRooms = rooms.filter(
        room => room.capacity >= requiredCapacityPerOccurrence
      );

      console.log(`Course ${code}: targetStudent=${targetStudent}, lectureOccurrence=${lectureOccurrence}, requiredCapacity=${requiredCapacityPerOccurrence}`);
      console.log("Suitable lecture rooms (capacity-based only):", suitableLectureRooms.map(r => ({ name: r.name || r.code, type: r.roomType, capacity: r.capacity })));

      if (suitableLectureRooms.length < lectureOccurrence) {
        // Record conflict using direct database insertion
        const conflictData = {
  Year: year,
  Semester: semester,
  Type: 'Room Capacity', // ✅ Valid enum value
  Description: `Course ${code} requires ${lectureOccurrence} lecture rooms with capacity >= ${requiredCapacityPerOccurrence}, but only ${suitableLectureRooms.length} suitable rooms found`,
  CourseCode: code,
  RoomID: null, // or specific room ID if applicable
  InstructorID: null, // or specific instructor ID if applicable
  Day: null, // or specific day if applicable
  StartTime: null, // or specific time if applicable
  Priority: 'High',
  Status: 'Pending'
};
        await recordGenerationConflict(conflictData);
        
        // Continue with available rooms instead of failing
        console.warn(`WARNING: Insufficient rooms for ${code} lectures. Continuing with ${suitableLectureRooms.length} available rooms.`);
      }

      // Try to schedule with improved algorithm
      let lectureAssigned = false;
      let lectureAttempts = 0;
      const maxAttempts = DAYS.length * TIMES.length * 3;

      // Create all possible time slots and shuffle them
      const allPossibleSlots = [];
      DAYS.forEach(day => {
        for (let timeIdx = 0; timeIdx <= TIMES.length - lectureDuration; timeIdx++) {
          allPossibleSlots.push({ day, timeIdx });
        }
      });
      shuffleArray(allPossibleSlots);

      const actualLectureOccurrence = Math.min(lectureOccurrence, suitableLectureRooms.length);
      let lecturesScheduled = 0;

      for (const slot of allPossibleSlots) {
        if (lecturesScheduled >= actualLectureOccurrence) break;
        
        const { day, timeIdx } = slot;
        
        // Check available rooms for this time slot
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

            schedules.push({
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
  Published: false // ✅ Mark as draft
});

            markConsecutiveSlotsAsUsed(day, timeIdx, lectureDuration, room._id);
            lecturesScheduled++;
          }
          
          if (lecturesScheduled >= actualLectureOccurrence) {
            lectureAssigned = true;
            break;
          }
        }
        
        lectureAttempts++;
        if (lectureAttempts >= maxAttempts) break;
      }

      if (!lectureAssigned && actualLectureOccurrence > 0) {
        // Record scheduling conflict using direct database insertion
        const conflictData = {
          Year: year,
          Semester: semester,
          Type: 'Scheduling Conflict',
          Description: `Could not schedule ${actualLectureOccurrence} lecture occurrence(s) for course ${code} (duration: ${lectureDuration}h each) due to time slot conflicts`,
          CourseCode: code,
          Priority: 'High',
          Status: 'Pending'
        };
        await recordGenerationConflict(conflictData);
        console.warn(`WARNING: Could not schedule lectures for ${code}. Continuing with other courses.`);
      } else if (lecturesScheduled < lectureOccurrence) {
        // Record partial scheduling conflict
        const conflictData = {
          Year: year,
          Semester: semester,
          Type: 'Partial Scheduling',
          Description: `Course ${code} required ${lectureOccurrence} lecture occurrences but only ${lecturesScheduled} were scheduled due to room/time constraints`,
          CourseCode: code,
          Priority: 'Medium',
          Status: 'Pending'
        };
        await recordGenerationConflict(conflictData);
      }
      
      console.log(`Lectures scheduled for ${code}: ${lecturesScheduled}/${lectureOccurrence}`);
    }

    // Schedule tutorials if hasTutorial is "Yes" and tutorialOcc is set
    if (hasTutorial === "Yes" && tutorialOcc && tutorialOcc > 0) {
      console.log(`Scheduling ${tutorialOcc} tutorials for ${code}`);
      
      // Calculate required capacity per tutorial occurrence
      const requiredCapacityPerTutorial = Math.ceil(targetStudent / tutorialOcc);

      // For tutorials, apply room type filtering if specified
      let suitableTutorialRooms;
      
      if (courseRoomTypes.length > 0) {
        // If room types are specified, filter by room type AND capacity
        suitableTutorialRooms = rooms.filter(
          room => room.capacity >= requiredCapacityPerTutorial && courseRoomTypes.includes(room.roomType)
        );
        console.log(`Course ${code}: Room types specified [${courseRoomTypes.join(', ')}] - filtering tutorials by room type`);
      } else {
        // If no room types specified, prefer non-lecture halls but allow all rooms as backup
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
          
        console.log(`Course ${code}: No room types specified - using ${suitableNonLectureHallRooms.length >= tutorialOcc ? 'non-lecture halls' : 'all available rooms'} for tutorials`);
      }

      console.log(`Course ${code}: targetStudent=${targetStudent}, tutorialOcc=${tutorialOcc}, requiredCapacity=${requiredCapacityPerTutorial}`);
      console.log("Suitable tutorial rooms:", suitableTutorialRooms.map(r => ({ name: r.name, type: r.roomType, capacity: r.capacity })));

      if (suitableTutorialRooms.length === 0) {
        // Record conflict using direct database insertion
        const roomTypeMsg = courseRoomTypes.length > 0 
          ? ` with room types [${courseRoomTypes.join(', ')}]`
          : '';
        const conflictData = {
          Year: year,
          Semester: semester,
          Type: 'No Suitable Rooms',
          Description: `No suitable rooms found for tutorial of course ${code} with capacity >= ${requiredCapacityPerTutorial}${roomTypeMsg}`,
          CourseCode: code,
          Priority: 'High',
          Status: 'Pending'
        };
        await recordGenerationConflict(conflictData);
        console.warn(`WARNING: No suitable tutorial rooms for ${code}. Skipping tutorial scheduling.`);
      } else {
        // Calculate total available time slots considering tutorial duration
        const totalTimeSlots = suitableTutorialRooms.length * DAYS.length * (TIMES.length - tutorialDuration + 1);
        
        console.log(`Course ${code}: needs ${tutorialOcc} tutorial slots (${tutorialDuration}h each), total available slots: ${totalTimeSlots}`);

        // Schedule each tutorial occurrence independently with improved algorithm
        let tutorialsScheduled = 0;
        let tutorialAttempts = 0;
        const maxAttempts = DAYS.length * TIMES.length * suitableTutorialRooms.length * 2;

        // Create a list of all possible time slots (day, time, room combinations) considering duration
        const allTimeSlots = [];
        DAYS.forEach(day => {
          for (let timeIdx = 0; timeIdx <= TIMES.length - tutorialDuration; timeIdx++) {
            suitableTutorialRooms.forEach(room => {
              allTimeSlots.push({ day, timeIdx, room });
            });
          }
        });

        // Shuffle the time slots for random assignment
        shuffleArray(allTimeSlots);

        while (tutorialsScheduled < tutorialOcc && tutorialAttempts < maxAttempts) {
          let slotFound = false;

          for (const slot of allTimeSlots) {
            const { day, timeIdx, room } = slot;
            
            // Check if consecutive time slots are available
            if (areConsecutiveSlotsAvailable(day, timeIdx, tutorialDuration, room._id)) {
              // CREATE ONLY ONE SCHEDULE RECORD PER TUTORIAL (even if it's multi-hour)
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
  Published: false // ✅ Mark as draft
});

              // Mark consecutive time slots as used for scheduling purposes
              markConsecutiveSlotsAsUsed(day, timeIdx, tutorialDuration, room._id);
              
              tutorialsScheduled++;
              slotFound = true;
              break;
            }
          }

          // If still no slot found, break to avoid infinite loop
          if (!slotFound) {
            break;
          }

          tutorialAttempts++;
        }

        if (tutorialsScheduled < tutorialOcc) {
          // Record conflict using direct database insertion
          const roomTypeMsg = courseRoomTypes.length > 0 
            ? ` (room types: [${courseRoomTypes.join(', ')}])`
            : '';
          const conflictData = {
            Year: year,
            Semester: semester,
            Type: 'Partial Tutorial Scheduling',
            Description: `Could not schedule all ${tutorialOcc} tutorial occurrences for course ${code} (scheduled ${tutorialsScheduled}, duration: ${tutorialDuration}h each)${roomTypeMsg}`,
            CourseCode: code,
            Priority: 'Medium',
            Status: 'Pending'
          };
          await recordGenerationConflict(conflictData);
          console.warn(`WARNING: Could not schedule all tutorials for ${code}. Scheduled ${tutorialsScheduled} out of ${tutorialOcc}.`);
        }
        
        console.log(`Tutorials scheduled for ${code}: ${tutorialsScheduled}/${tutorialOcc}`);
      }
    }
    
    console.log(`Finished processing course: ${course.code}`);
  }

  console.log("=== GENERATION COMPLETE ===");
  console.log("Courses processed:", courses.length);
  console.log("Rooms available:", rooms.length);
  console.log("Total schedules generated:", schedules.length);
  
  if (schedules.length > 0) {
    console.log("Sample schedules:", schedules.slice(0, 3));
  }

  // Count conflicts that may have occurred
  const expectedSchedules = courses.reduce((total, course) => {
    let expected = 0;
    if (course.lectureOccurrence > 0) expected += course.lectureOccurrence;
    if (course.hasTutorial === "Yes" && course.tutorialOcc > 0) expected += course.tutorialOcc;
    return total + expected;
  }, 0);

  const conflictsOccurred = schedules.length < expectedSchedules;

  console.log(`Expected schedules: ${expectedSchedules}, Generated: ${schedules.length}`);

  if (conflictsOccurred) {
    console.warn("⚠️  Some conflicts occurred during timetable generation. Check the analytics section for details.");
  }

  const schedulesWithStringIds = schedules.map(sch => ({
    ...sch,
    _id: sch._id?.toString?.() ?? sch._id,
    CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
    RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
  }));

  return { 
    schedules: schedulesWithStringIds,
    conflictsDetected: conflictsOccurred,
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