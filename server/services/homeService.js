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

  // Debug: Log raw room data to verify roomType values
  console.log("Raw room data from database:", rooms.map(r => ({ name: r.name, type: r.roomType, capacity: r.capacity })));

  // Clear previous schedules for this year/semester
  await Schedule.deleteMany({ Year: year, Semester: semester });

  // Track room usage per day/time (removed instructor tracking since we're not auto-assigning)
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
    const { lectureOccurrence, tutorialOcc, roomTypes, instructors, targetStudent, code, _id, hasTutorial, creditHour, lectureHour } = course;

    // Calculate durations based on credit hours
    const lectureDuration = lectureHour || 1; // Default to 1 hour if not specified
    const tutorialDuration = Math.max(1, (creditHour || 1) - (lectureHour || 1)); // Tutorial = Credit - Lecture, minimum 1

    console.log(`Course ${code}: creditHour=${creditHour}, lectureHour=${lectureHour}, lectureDuration=${lectureDuration}h, tutorialDuration=${tutorialDuration}h`);

    // Ensure roomTypes is an array
    const courseRoomTypes = Array.isArray(roomTypes) ? roomTypes : [roomTypes].filter(Boolean);

    // Schedule lectures
    if (lectureOccurrence && lectureOccurrence > 0) {
      // Calculate required capacity per lecture occurrence
      const requiredCapacityPerOccurrence = Math.ceil(targetStudent / lectureOccurrence);

      // FIXED: For lectures, ignore room types - just find rooms with sufficient capacity
      const suitableLectureRooms = rooms.filter(
        room => room.capacity >= requiredCapacityPerOccurrence
      );

      console.log(`Course ${code}: targetStudent=${targetStudent}, lectureOccurrence=${lectureOccurrence}, requiredCapacity=${requiredCapacityPerOccurrence}`);
      console.log("Suitable lecture rooms (capacity-based only):", suitableLectureRooms.map(r => ({ name: r.name || r.code, type: r.roomType, capacity: r.capacity })));

      if (suitableLectureRooms.length < lectureOccurrence) {
        // Generate detailed error report before throwing
        generateDetailedErrorReport(course, lectureOccurrence, lectureDuration, rooms);
        throw new Error(`Not enough suitable rooms for lecture of course ${code} (requires ${lectureOccurrence} rooms with capacity >= ${requiredCapacityPerOccurrence}, found ${suitableLectureRooms.length})`);
      }

      // Try to schedule with improved algorithm
      let lectureAssigned = false;
      let lectureAttempts = 0;
      const maxAttempts = DAYS.length * TIMES.length * 3; // Increased attempts

      // Create all possible time slots and shuffle them
      const allPossibleSlots = [];
      DAYS.forEach(day => {
        for (let timeIdx = 0; timeIdx <= TIMES.length - lectureDuration; timeIdx++) {
          allPossibleSlots.push({ day, timeIdx });
        }
      });
      shuffleArray(allPossibleSlots);

      for (const slot of allPossibleSlots) {
        if (lectureAssigned) break;
        
        const { day, timeIdx } = slot;
        
        // Check available rooms for this time slot
        const availableRooms = shuffleArray(
          suitableLectureRooms.filter(
            room => areConsecutiveSlotsAvailable(day, timeIdx, lectureDuration, room._id)
          )
        );

        if (availableRooms.length >= lectureOccurrence) {
          const groupsPerLecture = Math.ceil(tutorialOcc / lectureOccurrence);

          for (let i = 0; i < lectureOccurrence; i++) {
            const room = availableRooms[i];
            const startOcc = i * groupsPerLecture + 1;
            const endOcc = Math.min((i + 1) * groupsPerLecture, tutorialOcc);
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
            });

            markConsecutiveSlotsAsUsed(day, timeIdx, lectureDuration, room._id);
          }
          lectureAssigned = true;
        }
        
        lectureAttempts++;
        if (lectureAttempts >= maxAttempts) break;
      }

      if (!lectureAssigned) {
        // Generate detailed error report before throwing
        generateDetailedErrorReport(course, lectureOccurrence, lectureDuration, rooms);
        throw new Error(`Could not schedule ${lectureOccurrence} lecture occurrence(s) for course ${code} (duration: ${lectureDuration}h each). Check console for detailed analysis.`);
      }
    }

    // Schedule tutorials if hasTutorial is "Yes" and tutorialOcc is set
    if (hasTutorial === "Yes" && tutorialOcc && tutorialOcc > 0) {
      // Calculate required capacity per tutorial occurrence
      const requiredCapacityPerTutorial = Math.ceil(targetStudent / tutorialOcc);

      // FIXED: For tutorials, apply room type filtering if specified
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
        const roomTypeMsg = courseRoomTypes.length > 0 
          ? ` with room types [${courseRoomTypes.join(', ')}]`
          : '';
        throw new Error(`No suitable rooms found for tutorial of course ${code} with capacity >= ${requiredCapacityPerTutorial}${roomTypeMsg}`);
      }

      // Calculate total available time slots considering tutorial duration
      const totalTimeSlots = suitableTutorialRooms.length * DAYS.length * (TIMES.length - tutorialDuration + 1);
      
      console.log(`Course ${code}: needs ${tutorialOcc} tutorial slots (${tutorialDuration}h each), total available slots: ${totalTimeSlots}`);

      // Schedule each tutorial occurrence independently with improved algorithm
      let tutorialsScheduled = 0;
      let tutorialAttempts = 0;
      const maxAttempts = DAYS.length * TIMES.length * suitableTutorialRooms.length * 2; // Increased attempts

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
              StartTime: TIMES[timeIdx], // Start time of the event
              EndTime: getEndTime(timeIdx, tutorialDuration), // End time based on duration
              Duration: tutorialDuration, // Duration in hours
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
        const roomTypeMsg = courseRoomTypes.length > 0 
          ? ` (room types: [${courseRoomTypes.join(', ')}])`
          : '';
        throw new Error(`Could not schedule all ${tutorialOcc} tutorial occurrences for course ${code} (scheduled ${tutorialsScheduled}, duration: ${tutorialDuration}h each)${roomTypeMsg}`);
      }
    }
  }

  console.log("Courses found:", courses.length);
  console.log("Rooms found:", rooms.length);
  console.log("Schedules generated:", schedules.length);
  if (schedules.length > 0) {
    console.log("First schedule:", schedules[0]);
  }

  // Do NOT save schedules to database here
  // Saving should only happen in saveTimetable

  const schedulesWithStringIds = schedules.map(sch => ({
    ...sch,
    _id: sch._id?.toString?.() ?? sch._id,
    CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
    RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
  }));

  return { schedules: schedulesWithStringIds };
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

export const getTimetable = async (year, semester) => {
  console.log("=== BACKEND GET TIMETABLE DEBUG ===");
  console.log(`Fetching timetable for year: ${year}, semester: ${semester}`);
  
  const schedules = await Schedule.find({ Year: year, Semester: semester }).lean();
  
  console.log(`Found ${schedules.length} schedules in database`);
  schedules.forEach((sch, index) => {
    console.log(`DB Schedule ${index}: CourseCode=${sch.CourseCode}, Duration=${sch.Duration}, StartTime=${sch.StartTime}`);
  });

  const schedulesWithStringIds = schedules.map(sch => ({
    ...sch,
    _id: sch._id?.toString?.() ?? sch._id,
    CourseID: sch.CourseID?.toString?.() ?? sch.CourseID,
    RoomID: sch.RoomID?.toString?.() ?? sch.RoomID,
    // Ensure Duration is properly included
    Duration: sch.Duration || 1,
  }));

  console.log("=== RETURNING TO FRONTEND ===");
  schedulesWithStringIds.forEach((sch, index) => {
    console.log(`Returning ${index}: CourseCode=${sch.CourseCode}, Duration=${sch.Duration}, StartTime=${sch.StartTime}`);
  });

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