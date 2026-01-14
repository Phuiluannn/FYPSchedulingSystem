import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from './SideBar';
import ProtectedRoute from './ProtectedRoute';
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BiExport, BiSearch, BiX } from "react-icons/bi";
import Papa from "papaparse";
import html2canvas from "html2canvas";
import { useNavigate } from 'react-router-dom';
import { useAlert } from "./AlertContext";

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

function Home() {
  const [rooms, setRooms] = useState([]);
  const [roomsReady, setRoomsReady] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [selectedYear, setSelectedYear] = useState("2025/2026");
  const [selectedSemester, setSelectedSemester] = useState("1");
  const [timetable, setTimetable] = useState({});
  const [isGenerated, setIsGenerated] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [instructors, setInstructors] = useState([]);
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [targetDay, setTargetDay] = useState(selectedDay);
  const [targetTime, setTargetTime] = useState(TIMES[0]);
  const [targetRoom, setTargetRoom] = useState("");
  const [contextItem, setContextItem] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const tableRef = useRef(null);
  const allDaysTableRef = useRef(null);
  const [exportModalPosition, setExportModalPosition] = useState({ x: 0, y: 0 });
  const exportButtonRef = useRef(null);
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [originalEventElement, setOriginalEventElement] = useState(null);
  const containerRef = useRef(null);
  const [selectedStudentYears, setSelectedStudentYears] = useState(["All"]);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [conflictSummary, setConflictSummary] = useState({
  total: 0,
  roomCapacity: 0,
  roomDoubleBooking: 0,
  instructorConflict: 0,
  timeSlotExceeded: 0,
  departmentTutorialClash: 0,
  lectureTutorialClash: 0
});
const navigate = useNavigate();
const { showAlert, showConfirm } = useAlert();


// const isEventMatchingSearch = (item) => {
//   if (!searchQuery.trim()) return true; // Show all if no search query
//   return item.code.toLowerCase().includes(searchQuery.toLowerCase());
// };

const isEventMatchingYearFilter = (item) => {
  if (selectedStudentYears.includes("All")) return true;
  
  // Find the course that matches this event
  const course = courses.find(c => c.code === item.code);
  if (!course) return true; // Show if course not found
  
  // Check if any of the selected years is in the course's year array
  return course.year && selectedStudentYears.some(selectedYear => 
    course.year.includes(selectedYear)
  );
};

// Update the existing isEventMatchingSearch function to also include year filter
const isEventMatchingAllFilters = (item) => {
  const matchesSearch = !searchQuery.trim() || item.code.toLowerCase().includes(searchQuery.toLowerCase());
  const matchesYear = isEventMatchingYearFilter(item);
  return matchesSearch && matchesYear;
};

// 4. Add this function to get unique courses from timetable
const getUniqueCoursesFromTimetable = () => {
  const uniqueCourses = new Set();
  
  DAYS.forEach(day => {
    if (timetable[day]) {
      Object.values(timetable[day]).forEach(roomSlots => {
        roomSlots.forEach(slot => {
          slot.forEach(item => {
            if (item && item.code) {
              uniqueCourses.add(item.code);
            }
          });
        });
      });
    }
  });
  
  return Array.from(uniqueCourses).sort();
};

const checkInstructorConflicts = (timetable, movedEvent, targetDay, targetTimeIdx, targetDuration, sourceDay = null, sourceRoomId = null, sourceTimeIdx = null) => {
  const conflicts = [];
  
  // Skip if no instructor assigned to the moved event
  if (!movedEvent.selectedInstructorId || movedEvent.selectedInstructorId.trim() === "") {
    return conflicts;
  }
  
  const movedInstructorId = movedEvent.selectedInstructorId;
  const movedInstructorName = movedEvent.selectedInstructor || "Unknown Instructor";
  const movedStartIdx = targetTimeIdx;
  const movedEndIdx = targetTimeIdx + targetDuration - 1;
  
  // Check all rooms and time slots on the target day
  Object.entries(timetable[targetDay] || {}).forEach(([roomId, roomSlots]) => {
    roomSlots.forEach((slot, timeIdx) => {
      slot.forEach(event => {
        // Skip if this is the same event (self-conflict)
        if (event.id === movedEvent.id) return;
        
        // Skip if this is the source position (when moving within same day)
        if (sourceDay === targetDay && roomId === sourceRoomId && timeIdx === sourceTimeIdx) return;
        
        // Check if conflicting event has the same instructor
        const conflictingHasInstructor = event.selectedInstructorId && event.selectedInstructorId.trim() !== "";
        if (!conflictingHasInstructor) return;
        
        if (event.selectedInstructorId === movedInstructorId) {
          // Calculate the time range for the conflicting event
          const conflictingDuration = event.raw?.Duration || 1;
          const conflictingStartIdx = TIMES.findIndex(t => t === event.raw.StartTime);
          const conflictingEndIdx = conflictingStartIdx + conflictingDuration - 1;
          
          // Check if time periods overlap
          const hasOverlap = !(movedEndIdx < conflictingStartIdx || movedStartIdx > conflictingEndIdx);
          
          if (hasOverlap) {
            const conflictingRoomObj = rooms.find(r => r._id === roomId);
            
            // FIXED: Calculate the full overlapping time range
            const overlapStart = Math.max(movedStartIdx, conflictingStartIdx);
            const overlapEnd = Math.min(movedEndIdx, conflictingEndIdx);
            
            // Create the proper time range string
            const overlapStartTime = TIMES[overlapStart];
            const overlapEndTime = TIMES[overlapEnd];
            
            const overlapTimeSlot = overlapStartTime.includes(' - ') 
              ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
              : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;
            
            conflicts.push({
              type: 'Instructor Conflict',
              instructorName: movedInstructorName,
              instructorId: movedInstructorId,
              conflictingCourse: event.code,
              conflictingCourseType: event.raw?.OccType || 'Unknown',
              conflictingOccNumber: event.raw?.OccNumber,
              conflictingRoomCode: conflictingRoomObj?.code || 'Unknown Room',
              timeSlot: overlapTimeSlot, // Now contains the full overlap range
              conflictingEvent: event
            });
          }
        }
      });
    });
  });
  
  return conflicts;
};

// NEW: Check for lecture-tutorial clashes based on year level
const checkLectureTutorialClash = (timetable, movedEvent, targetDay, targetTimeIdx, targetDuration) => {
  const conflicts = [];
  
  // Only check if the moved event is a tutorial
  if (movedEvent.raw?.OccType !== 'Tutorial') {
    return conflicts;
  }
  
  const movedYearLevels = movedEvent.raw.YearLevel || [];
  const movedDepartments = movedEvent.raw.Departments || [];
  const movedStartIdx = targetTimeIdx;
  const movedEndIdx = targetTimeIdx + targetDuration - 1;
  
  // Check all lectures on the target day for clashes
  Object.entries(timetable[targetDay] || {}).forEach(([checkRoomId, roomSlots]) => {
    roomSlots.forEach((slot) => {
      slot.forEach(otherEvent => {
        // Skip self
        if (!otherEvent || otherEvent.id === movedEvent.id) return;
        
        // Only check against lectures
        if (otherEvent.raw?.OccType !== 'Lecture') return;
        
        // ✅ FIX: Check if they share BOTH year levels AND departments
        const otherYearLevels = otherEvent.raw.YearLevel || [];
        const otherDepartments = otherEvent.raw.Departments || [];
        
        const hasSharedYearLevel = movedYearLevels.some(yl => otherYearLevels.includes(yl));
        const hasSharedDepartment = movedDepartments.some(dept => otherDepartments.includes(dept));
        
        if (!hasSharedYearLevel) {
          console.log(`  ℹ️ No lecture-tutorial clash: ${movedEvent.code} Tutorial (Years: ${movedYearLevels.join(',')}) vs ${otherEvent.code} Lecture (Years: ${otherYearLevels.join(',')}) - different year levels`);
          return; // Different year levels = no conflict
        }
        
        if (!hasSharedDepartment) {
          console.log(`  ℹ️ No lecture-tutorial clash: ${movedEvent.code} Tutorial (Depts: ${movedDepartments.join(',')}) vs ${otherEvent.code} Lecture (Depts: ${otherDepartments.join(',')}) - different departments`);
          return; // Different departments = no conflict
        }
        
        // Check time overlap
        const otherStartIdx = TIMES.findIndex(t => t === otherEvent.raw.StartTime);
        const otherDuration = otherEvent.raw?.Duration || 1;
        const otherEndIdx = otherStartIdx + otherDuration - 1;
        
        const hasOverlap = !(movedEndIdx < otherStartIdx || movedStartIdx > otherEndIdx);
        
        if (hasOverlap) {
          const overlapStart = Math.max(movedStartIdx, otherStartIdx);
          const overlapEnd = Math.min(movedEndIdx, otherEndIdx);
          const overlapStartTime = TIMES[overlapStart];
          const overlapEndTime = TIMES[overlapEnd];
          
          const overlapTimeSlot = overlapStartTime.includes(' - ') 
            ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
            : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;
          
          const otherRoomObj = rooms.find(r => r._id === checkRoomId);
          const sharedYears = movedYearLevels.filter(yl => otherYearLevels.includes(yl));
          const sharedDepts = movedDepartments.filter(dept => otherDepartments.includes(dept));
          
          conflicts.push({
            type: 'Lecture-Tutorial Clash',
            tutorialCourse: movedEvent.code,
            tutorialOccNumber: movedEvent.raw.OccNumber,
            lectureCourse: otherEvent.code,
            lectureOccNumber: otherEvent.raw.OccNumber,
            yearLevels: sharedYears,
            departments: sharedDepts, // ✅ ADD THIS
            conflictingRoomCode: otherRoomObj?.code || 'Unknown Room',
            timeSlot: overlapTimeSlot
          });
          
          console.log(`🎓 Lecture-Tutorial clash detected: ${movedEvent.code} Tutorial vs ${otherEvent.code} Lecture for Year ${sharedYears.join(', ')} ${sharedDepts.join(', ')} students at ${overlapTimeSlot}`);
        }
      });
    });
  });
  
  return conflicts;
};

  const recordDragDropConflict = async (conflictData) => {
  try {
    const token = localStorage.getItem('token');
    
    await axios.post(
      "https://atss-backend.onrender.com/analytics/record-conflict",
      conflictData, // Use original conflictData without modification
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Conflict recorded successfully:", conflictData);
  } catch (error) {
    console.error("Error recording conflict:", error);
  }
};

const handlePublish = async () => {
  try {
    const token = localStorage.getItem("token");
    await axios.post("https://atss-backend.onrender.com/home/publish-timetable", 
      { year: selectedYear, semester: selectedSemester },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    showAlert("Timetable published successfully!", "success");
    
    // Re-fetch the timetable to show updated instructor assignments
    const response = await axios.get(
      `https://atss-backend.onrender.com/home/get-timetable?year=${selectedYear}&semester=${selectedSemester}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const schedules = response.data.schedules;
    
    const allTimetables = {};
    DAYS.forEach(day => {
      allTimetables[day] = {};
      rooms.forEach(room => {
        allTimetables[day][room._id] = TIMES.map(() => []);
      });
    });
    
    schedules.forEach(sch => {
      const roomId = sch.RoomID;
      const day = sch.Day;
      const timeIdx = TIMES.findIndex(t => t === sch.StartTime);
      const duration = sch.Duration || 1;
      
      if (roomId && timeIdx !== -1 && allTimetables[day]) {
        let selectedInstructor = "";
        let selectedInstructorId = "";

        // Handle instructor assignment properly
        if (sch.InstructorID) {
          selectedInstructorId = sch.InstructorID;
          const foundInstructor = instructors.find(inst => inst._id === sch.InstructorID);
          selectedInstructor = foundInstructor ? foundInstructor.name : "";
        }
        else if (sch.Instructors && Array.isArray(sch.Instructors) && sch.Instructors.length === 1) {
          selectedInstructor = sch.Instructors[0];
          const foundInstructor = instructors.find(inst => inst.name === selectedInstructor);
          selectedInstructorId = foundInstructor ? foundInstructor._id : "";
        }

        const scheduleItem = {
          id: String(sch._id),
          code: sch.CourseCode,
          instructors: sch.OriginalInstructors || sch.Instructors || [],
          selectedInstructor: selectedInstructor,
          selectedInstructorId: selectedInstructorId,
          raw: {
            ...sch,
          },
        };

        allTimetables[day][roomId][timeIdx].push(scheduleItem);
      }
    });
    
    setTimetable(allTimetables);
  } catch (error) {
    console.error("Error publishing timetable:", error);
    showAlert("Failed to publish timetable", "error");
  }
};

// Add this helper function to Home.jsx after the existing helper functions

/**
 * Get available instructors for a specific event based on occurrence restrictions
 * An instructor can only teach tutorials for occurrences they're assigned to in lectures
 */
// const getAvailableInstructorsForEvent = (event, timetable, selectedDay) => {
//   const { code: courseCode, raw } = event;
//   const { OccType, OccNumber } = raw;
  
//   // If this is a lecture, return all course instructors (no restrictions)
//   if (OccType === "Lecture") {
//     return instructors.filter(inst => 
//       (Array.isArray(event.instructors) ? event.instructors : [event.instructors])
//         .includes(inst.name)
//     );
//   }
  
//   // If this is a tutorial, filter instructors based on lecture assignments
//   if (OccType === "Tutorial") {
//     const tutorialOccurrences = Array.isArray(OccNumber) ? OccNumber : [OccNumber];
//     const availableInstructors = [];
    
//     // Find all lecture events for this course
//     const lectureEvents = [];
//     DAYS.forEach(day => {
//       if (timetable[day]) {
//         Object.values(timetable[day]).forEach(roomSlots => {
//           roomSlots.forEach(slot => {
//             slot.forEach(item => {
//               if (item && 
//                   item.code === courseCode && 
//                   item.raw?.OccType === "Lecture" &&
//                   item.selectedInstructor && 
//                   item.selectedInstructorId) {
//                 lectureEvents.push(item);
//               }
//             });
//           });
//         });
//       }
//     });
    
//     // For each instructor in the course, check if they teach lectures that cover these tutorial occurrences
//     instructors
//       .filter(inst => 
//         (Array.isArray(event.instructors) ? event.instructors : [event.instructors])
//           .includes(inst.name)
//       )
//       .forEach(instructor => {
//         // Find lecture events taught by this instructor for this course
//         const instructorLectures = lectureEvents.filter(lecture => 
//           lecture.selectedInstructorId === instructor._id
//         );
        
//         if (instructorLectures.length === 0) {
//           // No lecture restriction - instructor can teach any tutorial
//           availableInstructors.push(instructor);
//         } else {
//           // Check if any of the instructor's lectures cover these tutorial occurrences
//           const canTeachTutorial = instructorLectures.some(lecture => {
//             const lectureOccurrences = Array.isArray(lecture.raw.OccNumber) 
//               ? lecture.raw.OccNumber 
//               : [lecture.raw.OccNumber];
            
//             // Check if there's any overlap between lecture occurrences and tutorial occurrences
//             return tutorialOccurrences.some(tutOcc => 
//               lectureOccurrences.includes(tutOcc)
//             );
//           });
          
//           if (canTeachTutorial) {
//             availableInstructors.push(instructor);
//           }
//         }
//       });
    
//     return availableInstructors;
//   }
  
//   // Default: return all course instructors
//   return instructors.filter(inst => 
//     (Array.isArray(event.instructors) ? event.instructors : [event.instructors])
//       .includes(inst.name)
//   );
// };

// /**
//  * Check if an instructor assignment would violate occurrence restrictions
//  */
// const checkOccurrenceRestriction = (event, selectedInstructorId, timetable) => {
//   const { code: courseCode, raw } = event;
//   const { OccType, OccNumber } = raw;
  
//   // Only apply restrictions to tutorials
//   if (OccType !== "Tutorial") return null;
  
//   const selectedInstructor = instructors.find(inst => inst._id === selectedInstructorId);
//   if (!selectedInstructor) return null;
  
//   const tutorialOccurrences = Array.isArray(OccNumber) ? OccNumber : [OccNumber];
  
//   // Find all lecture events for this course taught by this instructor
//   const instructorLectures = [];
//   DAYS.forEach(day => {
//     if (timetable[day]) {
//       Object.values(timetable[day]).forEach(roomSlots => {
//         roomSlots.forEach(slot => {
//           slot.forEach(item => {
//             if (item && 
//                 item.code === courseCode && 
//                 item.raw?.OccType === "Lecture" &&
//                 item.selectedInstructorId === selectedInstructorId) {
//               instructorLectures.push(item);
//             }
//           });
//         });
//       });
//     }
//   });
  
//   if (instructorLectures.length === 0) {
//     // No lecture assignments - no restrictions
//     return null;
//   }
  
//   // Check if any lecture covers these tutorial occurrences
//   const validLectures = instructorLectures.filter(lecture => {
//     const lectureOccurrences = Array.isArray(lecture.raw.OccNumber) 
//       ? lecture.raw.OccNumber 
//       : [lecture.raw.OccNumber];
    
//     return tutorialOccurrences.some(tutOcc => 
//       lectureOccurrences.includes(tutOcc)
//     );
//   });
  
//   if (validLectures.length === 0) {
//     return {
//       isViolation: true,
//       message: `${selectedInstructor.name} cannot teach tutorial for occurrences [${tutorialOccurrences.join(', ')}] because they are not assigned to teach lectures covering these occurrences.`,
//       instructorLectures: instructorLectures.map(lec => ({
//         occurrences: Array.isArray(lec.raw.OccNumber) ? lec.raw.OccNumber : [lec.raw.OccNumber],
//         day: lec.raw.Day,
//         time: lec.raw.StartTime
//       }))
//     };
//   }
  
//   return null; // No violation
// };

const detectAllConflicts = (currentTimetable, currentCourses, currentRooms) => {
  console.log("=== DETECTING ALL CONFLICTS ===");
  
  const conflicts = {
    roomCapacity: [],
    roomDoubleBooking: [],
    instructorConflict: [],
    timeSlotExceeded: [],
    departmentTutorialClash: [],
    lectureTutorialClash: []
  };

  // Helper function to get events from all days/rooms
  const getAllEvents = () => {
    const allEvents = [];
    DAYS.forEach(day => {
      Object.entries(currentTimetable[day] || {}).forEach(([roomId, slots]) => {
        slots.forEach((slot, timeIdx) => {
          slot.forEach(event => {
            if (event && event.raw) {
              allEvents.push({
                ...event,
                day,
                roomId,
                timeIdx
              });
            }
          });
        });
      });
    });
    return allEvents;
  };

  const allEvents = getAllEvents();
  console.log(`Found ${allEvents.length} events to check for conflicts`);

  // 1. Check Room Capacity Conflicts
// 1. Check Room Capacity Conflicts
allEvents.forEach(event => {
  const room = currentRooms.find(r => r._id === event.roomId);
  if (room && event.raw) {
    // ✅ FIX: Pass EstimatedStudents from the event
    const requiredCapacity = calculateRequiredCapacity(
      event.code,
      event.raw.OccType,
      event.raw.OccNumber,
      currentCourses,
      event.raw.EstimatedStudents  // ✅ CRITICAL FIX: Pass this parameter
    );
    
    if (room.capacity < requiredCapacity) {
      conflicts.roomCapacity.push({
        id: `capacity-${event.id}`,
        eventId: event.id,
        courseCode: event.code,
        roomCode: room.code,
        roomCapacity: room.capacity,
        requiredCapacity,
        day: event.day,
        time: TIMES[event.timeIdx],
        occType: event.raw.OccType,
        occNumber: event.raw.OccNumber
      });
    }
  }
});

  // 2. FIXED: Check Room Double Booking Conflicts - Group by conflicting event pairs
  const roomConflictGroups = new Map();

// Find all overlapping event pairs in the same room
allEvents.forEach(event1 => {
  allEvents.forEach(event2 => {
    if (event1.id >= event2.id) return;
    if (event1.roomId !== event2.roomId || event1.day !== event2.day) return;

    const event1Start = event1.timeIdx;
    const event1Duration = event1.raw?.Duration || 1;
    const event1End = event1Start + event1Duration - 1;

    const event2Start = event2.timeIdx;
    const event2Duration = event2.raw?.Duration || 1;
    const event2End = event2Start + event2Duration - 1;

    const hasOverlap = !(event1End < event2Start || event1Start > event2End);

    if (hasOverlap) {
      const conflictKey = `${event1.roomId}-${event1.day}-${[event1.id, event2.id].sort().join('-')}`;
      
      if (!roomConflictGroups.has(conflictKey)) {
        const room = currentRooms.find(r => r._id === event1.roomId);
        const overlapStart = Math.max(event1Start, event2Start);
        const overlapEnd = Math.min(event1End, event2End);
        
        // ✅ FIX: Create proper full time range for the overlap
        const overlapStartTime = TIMES[overlapStart];
        const overlapEndTime = TIMES[overlapEnd];
        
        const fullTimeRange = overlapStartTime.includes(' - ') 
          ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
          : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;
        
        roomConflictGroups.set(conflictKey, {
          id: `double-${conflictKey}`,
          type: 'Room Double Booking',
          roomCode: room?.code || 'Unknown',
          day: event1.day,
          time: fullTimeRange, // ✅ CRITICAL: Store the full overlap time range here
          overlapStart,
          overlapEnd,
          conflictingEvents: [
            {
              id: event1.id,
              courseCode: event1.code,
              occType: event1.raw.OccType,
              occNumber: event1.raw.OccNumber
            },
            {
              id: event2.id,
              courseCode: event2.code,
              occType: event2.raw.OccType,
              occNumber: event2.raw.OccNumber
            }
          ],
          description: `${event1.code} and ${event2.code} overlap in ${room?.code || 'Unknown'} on ${event1.day}`
        });
      }
    }
  });
});

conflicts.roomDoubleBooking = Array.from(roomConflictGroups.values());

  // 3. Check Instructor Conflicts - Group by instructor-day-timeslot
  const instructorConflictGroups = new Map();

// Find all overlapping event pairs with same instructor
allEvents.forEach(event1 => {
  allEvents.forEach(event2 => {
    if (event1.id >= event2.id) return; // Avoid duplicates and self-comparison
    
    // Only check events with assigned instructors
    if (!event1.selectedInstructorId || !event2.selectedInstructorId) return;
    if (event1.selectedInstructorId !== event2.selectedInstructorId) return;
    if (event1.day !== event2.day) return; // Must be same day
    
    // Calculate time ranges
    const event1Start = TIMES.findIndex(t => t === event1.raw.StartTime);
    const event1Duration = event1.raw?.Duration || 1;
    const event1End = event1Start + event1Duration - 1;
    
    const event2Start = TIMES.findIndex(t => t === event2.raw.StartTime);
    const event2Duration = event2.raw?.Duration || 1;
    const event2End = event2Start + event2Duration - 1;
    
    // Check if they overlap
    const hasOverlap = !(event1End < event2Start || event1Start > event2End);
    
    if (hasOverlap) {
      // Create a unique key for this conflict pair (sorted event IDs)
      const conflictKey = `${event1.selectedInstructorId}-${event1.day}-${[event1.id, event2.id].sort().join('-')}`;
      
      if (!instructorConflictGroups.has(conflictKey)) {
        const overlapStart = Math.max(event1Start, event2Start);
        const overlapEnd = Math.min(event1End, event2End);
        const overlapStartTime = TIMES[overlapStart];
        const overlapEndTime = TIMES[overlapEnd];
        
        // Create proper time range string
        const overlapTimeRange = overlapStartTime.includes(' - ') 
          ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
          : overlapStartTime;
        
        instructorConflictGroups.set(conflictKey, {
          id: `instructor-${conflictKey}`,
          type: 'Instructor Conflict',
          instructorId: event1.selectedInstructorId,
          instructorName: event1.selectedInstructor,
          day: event1.day,
          time: overlapStartTime,
          timeRange: overlapTimeRange,
          conflictingEvents: [
            {
              id: event1.id,
              courseCode: event1.code,
              roomCode: currentRooms.find(r => r._id === event1.roomId)?.code || 'Unknown',
              occType: event1.raw.OccType,
              occNumber: event1.raw.OccNumber
            },
            {
              id: event2.id,
              courseCode: event2.code,
              roomCode: currentRooms.find(r => r._id === event2.roomId)?.code || 'Unknown',
              occType: event2.raw.OccType,
              occNumber: event2.raw.OccNumber
            }
          ],
          description: `${event1.selectedInstructor} assigned to ${event1.code} and ${event2.code} at ${overlapTimeRange} on ${event1.day}`
        });
      }
    }
  });
});

// Convert map to array
conflicts.instructorConflict = Array.from(instructorConflictGroups.values());

  // 4. Check Time Slot Exceeded Conflicts
  allEvents.forEach(event => {
    const startTimeIdx = TIMES.findIndex(t => t === event.raw.StartTime);
    if (startTimeIdx === -1) return;
    
    const duration = event.raw?.Duration || 1;
    
    if (startTimeIdx + duration > TIMES.length) {
      conflicts.timeSlotExceeded.push({
        id: `time-exceeded-${event.id}`,
        eventId: event.id,
        courseCode: event.code,
        occType: event.raw.OccType,
        occNumber: event.raw.OccNumber,
        day: event.day,
        startTime: TIMES[startTimeIdx],
        duration,
        availableSlots: TIMES.length - startTimeIdx
      });
    }
  });

  // 5. NEW: Check Department Tutorial Clash Conflicts
console.log("=== CHECKING DEPARTMENT TUTORIAL CLASHES ===");
const departmentTutorialConflicts = new Map();

// Get all tutorial events
const tutorialEvents = allEvents.filter(event => 
  event.raw?.OccType === 'Tutorial' && 
  event.raw?.Departments && 
  event.raw.Departments.length > 0
);

console.log(`Found ${tutorialEvents.length} tutorials to check for department clashes`);

// Check for department clashes
for (let i = 0; i < tutorialEvents.length; i++) {
  for (let j = i + 1; j < tutorialEvents.length; j++) {
    const tutorial1 = tutorialEvents[i];
    const tutorial2 = tutorialEvents[j];
    
    // Skip if same course
    if (tutorial1.code === tutorial2.code) continue;
    
    // Must be on same day
    if (tutorial1.day !== tutorial2.day) continue;
    
    // ✅ CRITICAL FIX: Check if they share year levels
    const yearLevel1 = tutorial1.raw.YearLevel || [];
    const yearLevel2 = tutorial2.raw.YearLevel || [];
    const hasSharedYearLevel = yearLevel1.some(yl => yearLevel2.includes(yl));
    
    if (!hasSharedYearLevel) {
      console.log(`  ℹ️ Skipping ${tutorial1.code} vs ${tutorial2.code} - different year levels (${yearLevel1.join(',')} vs ${yearLevel2.join(',')})`);
      continue; // Different year levels = no conflict possible
    }
    
    console.log(`  ✓ Shared year levels: ${yearLevel1.filter(yl => yearLevel2.includes(yl)).join(', ')} - ${tutorial1.code} vs ${tutorial2.code}`);
    
    // Check if time periods overlap
    const tutorial1Start = TIMES.findIndex(t => t === tutorial1.raw.StartTime);
    const tutorial1Duration = tutorial1.raw?.Duration || 1;
    const tutorial1End = tutorial1Start + tutorial1Duration - 1;
    
    const tutorial2Start = TIMES.findIndex(t => t === tutorial2.raw.StartTime);
    const tutorial2Duration = tutorial2.raw?.Duration || 1;
    const tutorial2End = tutorial2Start + tutorial2Duration - 1;
    
    const hasOverlap = !(tutorial1End < tutorial2Start || tutorial1Start > tutorial2End);
    
    if (hasOverlap) {
      // Check if they share any departments
      const sharedDepartments = tutorial1.raw.Departments.filter(dept => 
        tutorial2.raw.Departments.includes(dept)
      );
      
      if (sharedDepartments.length > 0) {
        // Create unique conflict ID including year levels
        const sortedCourses = [tutorial1.code, tutorial2.code].sort();
        const sortedDepts = sharedDepartments.sort();
        const sortedYears = yearLevel1.filter(yl => yearLevel2.includes(yl)).sort();
        const conflictId = `dept-clash-${tutorial1.day}-${sortedDepts.join('-')}-${sortedYears.join('-')}-${sortedCourses.join('-')}`;
        
        if (!departmentTutorialConflicts.has(conflictId)) {
          const overlapStart = Math.max(tutorial1Start, tutorial2Start);
          const overlapEnd = Math.min(tutorial1End, tutorial2End);
          const overlapStartTime = TIMES[overlapStart];
          const overlapEndTime = TIMES[overlapEnd];
          
          const fullTimeRange = overlapStartTime.includes(' - ') 
            ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
            : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;
          
          departmentTutorialConflicts.set(conflictId, {
            id: conflictId,
            type: 'Department Tutorial Clash',
            departments: sharedDepartments,
            yearLevels: sortedYears, // ✅ ADD THIS
            day: tutorial1.day,
            time: fullTimeRange,
            conflictingEvents: [
              {
                id: tutorial1.id,
                courseCode: tutorial1.code,
                occType: tutorial1.raw.OccType,
                occNumber: tutorial1.raw.OccNumber,
                departments: tutorial1.raw.Departments,
                yearLevels: yearLevel1, // ✅ ADD THIS
                roomCode: currentRooms.find(r => r._id === tutorial1.roomId)?.code || 'Unknown'
              },
              {
                id: tutorial2.id,
                courseCode: tutorial2.code,
                occType: tutorial2.raw.OccType,
                occNumber: tutorial2.raw.OccNumber,
                departments: tutorial2.raw.Departments,
                yearLevels: yearLevel2, // ✅ ADD THIS
                roomCode: currentRooms.find(r => r._id === tutorial2.roomId)?.code || 'Unknown'
              }
            ],
            description: `Department(s) ${sharedDepartments.join(', ')} (Year ${sortedYears.join(', ')}) have conflicting tutorials: ${tutorial1.code} and ${tutorial2.code} on ${tutorial1.day}`
          });
          
          console.log(`📚 Department clash: ${sharedDepartments.join(', ')} Year ${sortedYears.join(', ')} - ${tutorial1.code} vs ${tutorial2.code} at ${fullTimeRange}`);
        }
      }
    }
  }
}

conflicts.departmentTutorialClash = Array.from(departmentTutorialConflicts.values());
console.log(`Department tutorial clashes found: ${conflicts.departmentTutorialClash.length}`);

// 6. NEW: Check Lecture-Tutorial Clashes (based on year level)
console.log("=== CHECKING LECTURE-TUTORIAL CLASHES ===");
const lectureTutorialConflicts = new Map();

// Get all tutorial and lecture events
const tutorialEventsForLT = allEvents.filter(event => event.raw?.OccType === 'Tutorial');
const lectureEvents = allEvents.filter(event => event.raw?.OccType === 'Lecture');

console.log(`Found ${tutorialEventsForLT.length} tutorials and ${lectureEvents.length} lectures to check for lecture-tutorial clashes`);

// Check each tutorial against each lecture
tutorialEventsForLT.forEach(tutorial => {
  lectureEvents.forEach(lecture => {
    // Must be on same day
    if (tutorial.day !== lecture.day) return;
    
    // ✅ FIX: Check if they share BOTH year levels AND departments
    const tutorialYears = tutorial.raw.YearLevel || [];
    const lectureYears = lecture.raw.YearLevel || [];
    const tutorialDepts = tutorial.raw.Departments || [];
    const lectureDepts = lecture.raw.Departments || [];
    
    const hasSharedYearLevel = tutorialYears.some(yl => lectureYears.includes(yl));
    const hasSharedDepartment = tutorialDepts.some(dept => lectureDepts.includes(dept));
    
    if (!hasSharedYearLevel) {
      console.log(`  ℹ️ No shared year: ${tutorial.code} Tutorial (Years: ${tutorialYears.join(',')}) vs ${lecture.code} Lecture (Years: ${lectureYears.join(',')})`);
      return; // Different year levels = no conflict
    }
    
    if (!hasSharedDepartment) {
      console.log(`  ℹ️ No shared department: ${tutorial.code} Tutorial (Depts: ${tutorialDepts.join(',')}) vs ${lecture.code} Lecture (Depts: ${lectureDepts.join(',')})`);
      return; // Different departments = no conflict
    }
    
    const sharedYears = tutorialYears.filter(yl => lectureYears.includes(yl));
    const sharedDepts = tutorialDepts.filter(dept => lectureDepts.includes(dept));
    console.log(`  ✓ Shared year levels AND departments: Year ${sharedYears.join(', ')}, Depts ${sharedDepts.join(', ')} - ${tutorial.code} Tutorial vs ${lecture.code} Lecture`);
    
    // Check if time periods overlap
    const tutorialStart = TIMES.findIndex(t => t === tutorial.raw.StartTime);
    const tutorialDuration = tutorial.raw?.Duration || 1;
    const tutorialEnd = tutorialStart + tutorialDuration - 1;
    
    const lectureStart = TIMES.findIndex(t => t === lecture.raw.StartTime);
    const lectureDuration = lecture.raw?.Duration || 1;
    const lectureEnd = lectureStart + lectureDuration - 1;
    
    const hasOverlap = !(tutorialEnd < lectureStart || tutorialStart > lectureEnd);
    
    if (hasOverlap) {
      // Create unique conflict ID including occurrence numbers AND departments
      const sortedCourses = [tutorial.code, lecture.code].sort();
      const sortedYears = sharedYears.sort();
      const sortedDepts = sharedDepts.sort();
      
      // Include occurrence numbers to make each clash unique
      const tutorialOcc = Array.isArray(tutorial.raw.OccNumber) 
        ? tutorial.raw.OccNumber.join('-') 
        : tutorial.raw.OccNumber || 'unknown';
      const lectureOcc = Array.isArray(lecture.raw.OccNumber) 
        ? lecture.raw.OccNumber.join('-') 
        : lecture.raw.OccNumber || 'unknown';
      
      const conflictId = `lecture-tutorial-${tutorial.day}-${sortedYears.join('-')}-${sortedDepts.join('-')}-${tutorial.code}-Occ${tutorialOcc}-${lecture.code}-Occ${lectureOcc}`;
      
      if (!lectureTutorialConflicts.has(conflictId)) {
        const overlapStart = Math.max(tutorialStart, lectureStart);
        const overlapEnd = Math.min(tutorialEnd, lectureEnd);
        const overlapStartTime = TIMES[overlapStart];
        const overlapEndTime = TIMES[overlapEnd];
        
        const fullTimeRange = overlapStartTime.includes(' - ') 
          ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
          : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;
        
        lectureTutorialConflicts.set(conflictId, {
          id: conflictId,
          type: 'Lecture-Tutorial Clash',
          yearLevels: sortedYears,
          departments: sortedDepts, // ✅ ADD THIS
          day: tutorial.day,
          time: fullTimeRange,
          conflictingEvents: [
            {
              id: tutorial.id,
              courseCode: tutorial.code,
              occType: tutorial.raw.OccType,
              occNumber: tutorial.raw.OccNumber,
              yearLevels: tutorialYears,
              departments: tutorialDepts, // ✅ ADD THIS
              roomCode: currentRooms.find(r => r._id === tutorial.roomId)?.code || 'Unknown'
            },
            {
              id: lecture.id,
              courseCode: lecture.code,
              occType: lecture.raw.OccType,
              occNumber: lecture.raw.OccNumber,
              yearLevels: lectureYears,
              departments: lectureDepts, // ✅ ADD THIS
              roomCode: currentRooms.find(r => r._id === lecture.roomId)?.code || 'Unknown'
            }
          ],
          description: `${tutorial.code} Tutorial clashes with ${lecture.code} Lecture for Year ${sortedYears.join(', ')} ${sortedDepts.join(', ')} students on ${tutorial.day}`
        });
        
        console.log(`🎓 Lecture-Tutorial clash: ${tutorial.code} vs ${lecture.code} for Year ${sortedYears.join(', ')} ${sortedDepts.join(', ')} at ${fullTimeRange}`);
      }
    }
  });
});

conflicts.lectureTutorialClash = Array.from(lectureTutorialConflicts.values());
console.log(`Lecture-tutorial clashes found: ${conflicts.lectureTutorialClash.length}`);

const summary = {
  total: conflicts.roomCapacity.length + 
         conflicts.roomDoubleBooking.length + 
         conflicts.instructorConflict.length + 
         conflicts.timeSlotExceeded.length +
         conflicts.departmentTutorialClash.length +
         conflicts.lectureTutorialClash.length,
  roomCapacity: conflicts.roomCapacity.length,
  roomDoubleBooking: conflicts.roomDoubleBooking.length,
  instructorConflict: conflicts.instructorConflict.length,
  timeSlotExceeded: conflicts.timeSlotExceeded.length,
  departmentTutorialClash: conflicts.departmentTutorialClash.length,
  lectureTutorialClash: conflicts.lectureTutorialClash.length
};

console.log("Conflict Summary:", summary);
console.log("Room double booking conflicts found:", conflicts.roomDoubleBooking.length);
console.log("Room conflicts detail:", conflicts.roomDoubleBooking);
console.log("Department tutorial clashes found:", conflicts.departmentTutorialClash.length);  // ADD THIS
  
  return { summary, details: conflicts };
};

const recordFrontendConflicts = async (conflictDetails) => {
  if (!conflictDetails || !conflictDetails.details) return;
  
  const { details } = conflictDetails;
  const conflictsToRecord = [];

  try {
    // Process Room Double Booking conflicts
    details.roomDoubleBooking.forEach(conflict => {
      const conflictData = {
        Year: selectedYear,
        Semester: selectedSemester,
        Type: 'Room Double Booking',
        Description: `Room double booking detected: ${conflict.conflictingEvents.map(e => 
          `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''})`
        ).join(' and ')} in ${conflict.roomCode} on ${conflict.day} at ${conflict.time}`,
        CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
        RoomID: rooms.find(r => r.code === conflict.roomCode)?._id || null,
        Day: conflict.day,
        StartTime: conflict.time,
        Priority: 'High',
        Status: 'Pending'
      };
      conflictsToRecord.push(conflictData);
    });

    // // Process Instructor Conflicts
    // details.instructorConflict.forEach(conflict => {
    //   const conflictData = {
    //     Year: selectedYear,
    //     Semester: selectedSemester,
    //     Type: 'Instructor Conflict',
    //     Description: `Instructor conflict detected: ${conflict.instructorName} assigned to multiple events (${conflict.conflictingEvents.map(e => 
    //       `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''}) in ${e.roomCode}`
    //     ).join(' and ')}) on ${conflict.day} at ${conflict.time}`,
    //     CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
    //     InstructorID: conflict.instructorId,
    //     Day: conflict.day,
    //     StartTime: conflict.time,
    //     Priority: 'High',
    //     Status: 'Pending'
    //   };
    //   conflictsToRecord.push(conflictData);
    // });

    // Process Room Capacity conflicts
    details.roomCapacity.forEach(conflict => {
      const conflictData = {
        Year: selectedYear,
        Semester: selectedSemester,
        Type: 'Room Capacity',
        Description: `Room capacity exceeded: ${conflict.courseCode} (${conflict.occType}${conflict.occNumber ? ` Occ ${Array.isArray(conflict.occNumber) ? conflict.occNumber.join(', ') : conflict.occNumber}` : ''}) requires ${conflict.requiredCapacity} seats but ${conflict.roomCode} only has ${conflict.roomCapacity}`,
        CourseCode: conflict.courseCode,
        RoomID: rooms.find(r => r.code === conflict.roomCode)?._id || null,
        Day: conflict.day,
        StartTime: conflict.time,
        Priority: 'High',
        Status: 'Pending'
      };
      conflictsToRecord.push(conflictData);
    });

    // Process Time Slot Exceeded conflicts
    details.timeSlotExceeded.forEach(conflict => {
      const conflictData = {
        Year: selectedYear,
        Semester: selectedSemester,
        Type: 'Time Slot Exceeded',
        Description: `Time slot exceeded: ${conflict.courseCode} (${conflict.occType}${conflict.occNumber ? ` Occ ${Array.isArray(conflict.occNumber) ? conflict.occNumber.join(', ') : conflict.occNumber}` : ''}) extends beyond available time slots (requires ${conflict.duration} hours but only ${conflict.availableSlots} slots available)`,
        CourseCode: conflict.courseCode,
        Day: conflict.day,
        StartTime: conflict.startTime,
        Priority: 'Medium',
        Status: 'Pending'
      };
      conflictsToRecord.push(conflictData);
    });

    // NEW: Process Department Tutorial Clash conflicts
details.departmentTutorialClash.forEach(conflict => {
  const conflictData = {
    Year: selectedYear,
    Semester: selectedSemester,
    Type: 'Department Tutorial Clash',
    Description: `Department(s) ${conflict.departments.join(', ')} have conflicting tutorials: ${conflict.conflictingEvents.map(e => 
      `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''})`
    ).join(' and ')} on ${conflict.day} at ${conflict.time}`,
    CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
    Day: conflict.day,
    StartTime: conflict.time,
    Priority: 'High',
    Status: 'Pending'
  };
  conflictsToRecord.push(conflictData);
});

    // NEW: Process Lecture-Tutorial Clash conflicts
    details.lectureTutorialClash.forEach(conflict => {
      const conflictData = {
        Year: selectedYear,
        Semester: selectedSemester,
        Type: 'Lecture-Tutorial Clash',
        Description: `Lecture-Tutorial Clash: ${conflict.conflictingEvents.map(e => 
          `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''})`
        ).join(' and ')} for year level(s): ${conflict.yearLevels.join(', ')} on ${conflict.day} at ${conflict.time}`,
        CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
        Day: conflict.day,
        StartTime: conflict.time,
        Priority: 'Medium',
        Status: 'Pending'
      };
      conflictsToRecord.push(conflictData);
    });

    // Record all conflicts in batch
    if (conflictsToRecord.length > 0) {
      const token = localStorage.getItem('token');
      
      // Record each conflict
      const recordPromises = conflictsToRecord.map(conflictData => 
        axios.post(
          "https://atss-backend.onrender.com/analytics/record-conflict",
          conflictData,
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(error => {
          console.error("Error recording conflict:", error);
          return null; // Continue with other conflicts
        })
      );
      
      const results = await Promise.all(recordPromises);
      const successCount = results.filter(result => result !== null).length;
      
      console.log(`Successfully recorded ${successCount} out of ${conflictsToRecord.length} frontend-detected conflicts`);
    }
    
  } catch (error) {
    console.error("Error in recordFrontendConflicts:", error);
  }
};

useEffect(() => {
  if (searchQuery.trim()) {
    const availableCourses = getUniqueCoursesFromTimetable();
    const filtered = availableCourses.filter(course => 
      course.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCourses(filtered);
    setShowSearchDropdown(filtered.length > 0);
  } else {
    setFilteredCourses([]);
    setShowSearchDropdown(false);
  }
}, [searchQuery, timetable]);

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get("https://atss-backend.onrender.com/instructors", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInstructors(response.data);
      } catch (error) {
        setInstructors([]);
      }
    };
    fetchInstructors();
  }, []);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get("https://atss-backend.onrender.com/rooms", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRooms(response.data);
        setRoomsReady(true);
      } catch (error) {
        setRooms([]);
        setRoomsReady(true);
      }
    };
    fetchRooms();
  }, []);

  // Fetch courses data
useEffect(() => {
  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `https://atss-backend.onrender.com/courses?year=${selectedYear}&semester=${selectedSemester}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCourses(response.data);
    } catch (error) {
      console.error("Error fetching courses:", error);
      setCourses([]);
    }
  };
  
  if (selectedYear && selectedSemester) {
    fetchCourses();
  }
}, [selectedYear, selectedSemester]);

useEffect(() => {
  if (!roomsReady) return;

  const fetchAllTimetables = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `https://atss-backend.onrender.com/home/get-timetable?year=${selectedYear}&semester=${selectedSemester}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const schedules = response.data.schedules;
      
      console.log("Raw schedules from backend:", schedules);
      
      const allTimetables = {};
      
      DAYS.forEach(day => {
        allTimetables[day] = {};
        rooms.forEach(room => {
          allTimetables[day][room._id] = TIMES.map(() => []);
        });
      });
      
      schedules.forEach(sch => {
        console.log(`Schedule ${sch.CourseCode}: Duration = ${sch.Duration}, Type = ${typeof sch.Duration}`);
        console.log(`Schedule instructors:`, sch.Instructors, `InstructorID:`, sch.InstructorID);
        
        const roomId = sch.RoomID;
        const day = sch.Day;
        const timeIdx = TIMES.findIndex(t => t === sch.StartTime);
        const duration = sch.Duration || 1;
        
        if (roomId && timeIdx !== -1 && allTimetables[day]) {
          // FIXED: Better instructor assignment restoration
          let selectedInstructor = "";
          let selectedInstructorId = "";

          // CRITICAL FIX: Handle instructor assignment properly
          // Priority 1: If InstructorID exists, use it (manually assigned instructor)
          if (sch.InstructorID) {
            selectedInstructorId = sch.InstructorID;
            // Find the instructor name by ID
            const foundInstructor = instructors.find(inst => inst._id === sch.InstructorID);
            selectedInstructor = foundInstructor ? foundInstructor.name : "";
            
            console.log(`Restored instructor from ID: ${selectedInstructorId} -> ${selectedInstructor}`);
          }
          // Priority 2: If there's exactly one instructor in Instructors array (and no ID)
          else if (sch.Instructors && Array.isArray(sch.Instructors) && sch.Instructors.length === 1) {
            selectedInstructor = sch.Instructors[0];
            // Try to find the instructor ID by name
            const foundInstructor = instructors.find(inst => inst.name === selectedInstructor);
            selectedInstructorId = foundInstructor ? foundInstructor._id : "";
            
            console.log(`Restored instructor from Instructors array: ${selectedInstructor} -> ${selectedInstructorId}`);
          }
          // Priority 3: If Instructors array has multiple instructors, it means no specific assignment
          else {
            console.log(`No specific instructor assignment found for ${sch.CourseCode}`);
          }

          const scheduleItem = {
            id: String(sch._id),
            code: sch.CourseCode,
            instructors: sch.OriginalInstructors || sch.Instructors || [],
            selectedInstructor: selectedInstructor,
            selectedInstructorId: selectedInstructorId,
            raw: {
              ...sch,
            },
          };

          console.log(`Created schedule item for ${sch.CourseCode}:`, {
            selectedInstructor: selectedInstructor,
            selectedInstructorId: selectedInstructorId,
            instructors: scheduleItem.instructors
          });

          // CRITICAL FIX: Only place the item in the STARTING time slot
          // The rendering logic will handle the colspan
          allTimetables[day][roomId][timeIdx].push(scheduleItem);
        }
      });
      
      console.log("Final timetable structure:", allTimetables);
      
      setTimetable(allTimetables);
      setIsModified(false);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching timetables:", error);
      const initial = {};
      DAYS.forEach(day => {
        initial[day] = {};
        rooms.forEach(room => {
          initial[day][room._id] = TIMES.map(() => []);
        });
      });
      setTimetable(initial);
      setIsModified(false);
      setLoading(false);
    }
  };
  fetchAllTimetables();
}, [roomsReady, rooms, selectedYear, selectedSemester, instructors]);

  useEffect(() => {
  if (showExportModal) {
    const handleClickOutside = (event) => {
      // Check if the click is outside the export modal
      const modal = document.querySelector('[data-modal="export"]');
      if (modal && !modal.contains(event.target)) {
        setShowExportModal(false);
      }
    };
    
    const handleScroll = () => {
      // Close export modal on scroll
      setShowExportModal(false);
    };
    
    // Add event listeners
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }
}, [showExportModal]);

// Add window resize and scroll listeners
useEffect(() => {
  const updateModalPosition = () => {
    if (showExportModal) {
      const position = calculateModalPosition();
      setExportModalPosition(position);
    }
  };

  if (showExportModal) {
    window.addEventListener('resize', updateModalPosition);
    window.addEventListener('scroll', updateModalPosition);
    
    return () => {
      window.removeEventListener('resize', updateModalPosition);
      window.removeEventListener('scroll', updateModalPosition);
    };
  }
}, [showExportModal]);

useEffect(() => {
  if (showDaySelector && originalEventElement) {
    const handleScroll = () => {
      // Close the modal when scrolling
      setShowDaySelector(false);
      setContextItem(null);
      setOriginalEventElement(null);
    };
    
    const handleResize = () => updateModalPosition();
    
    const handleClickOutside = (event) => {
      // Check if the click is outside the modal
      const modal = document.querySelector('[data-modal="day-selector"]');
      if (modal && !modal.contains(event.target)) {
        setShowDaySelector(false);
        setContextItem(null);
        setOriginalEventElement(null);
      }
    };
    
    // Add event listeners
    window.addEventListener('scroll', handleScroll, true); // Use capture phase
    window.addEventListener('resize', handleResize);
    window.addEventListener('click', handleClickOutside);
    
    // Also listen to scroll on the table container if it has its own scroll
    const tableContainer = document.querySelector('.table-responsive');
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleClickOutside);
      if (tableContainer) {
        tableContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }
}, [showDaySelector, originalEventElement]);

useEffect(() => {
  if (showYearDropdown) {
    const handleClickOutside = (event) => {
      const dropdown = event.target.closest('[data-dropdown="year-filter"]');
      if (!dropdown) {
        setShowYearDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }
}, [showYearDropdown]);

useEffect(() => {
  const fetchAndCalculateConflicts = async () => {
    if (!timetable || Object.keys(timetable).length === 0 || !courses.length || !rooms.length) {
      setConflictSummary({
        total: 0,
        roomCapacity: 0,
        roomDoubleBooking: 0,
        instructorConflict: 0,
        timeSlotExceeded: 0,
        departmentTutorialClash: 0,
        lectureTutorialClash: 0
      });
      return;
    }

    console.log("Detecting conflicts after timetable change...");
    const conflictResults = detectAllConflicts(timetable, courses, rooms);
    const { summary: rawSummary, details } = conflictResults;
    
    // Fetch resolved conflicts from database to exclude them
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `https://atss-backend.onrender.com/analytics/conflicts?year=${selectedYear}&semester=${selectedSemester}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const resolvedConflicts = response.data.conflicts.filter(c => c.Status === 'Resolved');
      console.log(`Found ${resolvedConflicts.length} resolved conflicts in database`);
      
      // Create a Set of resolved conflict IDs for quick lookup
      const resolvedConflictIds = new Set();
      resolvedConflicts.forEach(conflict => {
        const conflictId = generateConflictId(conflict, conflict.Type);
        resolvedConflictIds.add(conflictId);
      });
      
      // Filter out resolved conflicts from each category
      const filterResolvedConflicts = (conflictArray, conflictType) => {
        return conflictArray.filter(conflict => {
          const conflictId = generateConflictId(conflict, conflictType);
          return !resolvedConflictIds.has(conflictId);
        });
      };
      
      const filteredDetails = {
        roomCapacity: filterResolvedConflicts(details.roomCapacity, 'Room Capacity'),
        roomDoubleBooking: filterResolvedConflicts(details.roomDoubleBooking, 'Room Double Booking'),
        instructorConflict: filterResolvedConflicts(details.instructorConflict, 'Instructor Conflict'),
        timeSlotExceeded: filterResolvedConflicts(details.timeSlotExceeded, 'Time Slot Exceeded'),
        departmentTutorialClash: filterResolvedConflicts(details.departmentTutorialClash, 'Department Tutorial Clash'),
        lectureTutorialClash: filterResolvedConflicts(details.lectureTutorialClash, 'Lecture-Tutorial Clash')
      };
      
      const adjustedSummary = {
        total: filteredDetails.roomCapacity.length + 
               filteredDetails.roomDoubleBooking.length + 
               filteredDetails.instructorConflict.length + 
               filteredDetails.timeSlotExceeded.length +
               filteredDetails.departmentTutorialClash.length +
               filteredDetails.lectureTutorialClash.length,
        roomCapacity: filteredDetails.roomCapacity.length,
        roomDoubleBooking: filteredDetails.roomDoubleBooking.length,
        instructorConflict: filteredDetails.instructorConflict.length,
        timeSlotExceeded: filteredDetails.timeSlotExceeded.length,
        departmentTutorialClash: filteredDetails.departmentTutorialClash.length,
        lectureTutorialClash: filteredDetails.lectureTutorialClash.length
      };
      
      console.log(`Adjusted conflict summary (excluding ${resolvedConflicts.length} resolved):`, adjustedSummary);
      setConflictSummary(adjustedSummary);
    } catch (error) {
      console.error("Error fetching resolved conflicts:", error);
      // Fallback to raw summary if fetch fails
      setConflictSummary(rawSummary);
    }
  };
  
  fetchAndCalculateConflicts();
}, [timetable, courses, rooms, selectedYear, selectedSemester]);

  const handleContextMenu = (e, item, roomId, timeIdx, index) => {
  e.preventDefault();
  e.stopPropagation();
  
  setOriginalEventElement(e.currentTarget);
  
  const rect = e.currentTarget.getBoundingClientRect();
  const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
  
  const modalWidth = 250;
  const modalHeight = 280;
  
  // Calculate position relative to the container
  let x = rect.left - containerRect.left;
  let y = rect.bottom - containerRect.top + 8;
  
  // Adjust if modal would go off the right edge of container
  const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
  if (x + modalWidth > containerWidth) {
    x = rect.right - containerRect.left - modalWidth;
  }
  
  // Keep modal within container bounds
  if (x < 15) {
    x = 15;
  }
  
  // Adjust if modal would go off the bottom edge
  const containerHeight = containerRef.current?.offsetHeight || window.innerHeight;
  if (y + modalHeight > containerHeight) {
    y = rect.top - containerRect.top - modalHeight - 8;
    if (y < 15) {
      y = 15;
    }
  }
  
  setModalPosition({ x, y });
  setContextItem({ item, roomId, timeIdx, index, sourceDay: selectedDay });
  setTargetDay(selectedDay);
  
  if (TIMES[timeIdx]) {
    setTargetTime(TIMES[timeIdx]);
  } else {
    console.warn("Invalid timeIdx passed to context menu:", timeIdx);
    setTargetTime(TIMES[0]);
  }

  setTargetRoom(roomId);
  setShowDaySelector(true);
};

// 3. Add these functions after your existing handleContextMenu
const updateModalPosition = () => {
  if (!originalEventElement || !showDaySelector || !containerRef.current) return;
  
  const rect = originalEventElement.getBoundingClientRect();
  const containerRect = containerRef.current.getBoundingClientRect();
  
  const modalWidth = 250;
  const modalHeight = 280;
  
  // Calculate position relative to the container
  let x = rect.left - containerRect.left;
  let y = rect.bottom - containerRect.top + 8;
  
  // Adjust if modal would go off the right edge of container
  const containerWidth = containerRef.current.offsetWidth;
  if (x + modalWidth > containerWidth) {
    x = rect.right - containerRect.left - modalWidth;
  }
  
  // Keep modal within container bounds
  if (x < 15) {
    x = 15;
  }
  
  // Adjust if modal would go off the bottom edge
  const containerHeight = containerRef.current.offsetHeight;
  if (y + modalHeight > containerHeight) {
    y = rect.top - containerRect.top - modalHeight - 8;
    if (y < 15) {
      y = 15;
    }
  }
  
  setModalPosition({ x, y });
};
  // Helper function to calculate required capacity for an event
// FIXED VERSION: Now properly uses occNumber to determine capacity calculation
const calculateRequiredCapacity = (courseCode, occType, occNumber, courses, estimatedStudents = null) => {
  console.log("=== CAPACITY CALCULATION DEBUG ===");
  console.log("Parameters:", { 
    courseCode, 
    occType, 
    occNumber, 
    coursesLength: courses.length,
    estimatedStudents
  });
  
  // CRITICAL FIX: If we have EstimatedStudents from the schedule, use it directly
  if (estimatedStudents !== null && estimatedStudents !== undefined && estimatedStudents > 0) {
    console.log(`✅ Using pre-calculated EstimatedStudents: ${estimatedStudents}`);
    return estimatedStudents;
  }
  
  const course = courses.find(c => c.code === courseCode);
  if (!course) {
    console.log("❌ Course not found");
    return 0;
  }
  
  // ✅ NEW: Try to find the specific grouping for this occurrence
  const occNumbers = Array.isArray(occNumber) ? occNumber : [occNumber];
  
  if (occType === "Lecture" && course.lectureGroupings) {
    const matchingGrouping = course.lectureGroupings.find(group => 
      occNumbers.includes(group.occNumber)
    );
    
    if (matchingGrouping && matchingGrouping.estimatedStudents) {
      console.log(`✅ Using lecture grouping capacity: ${matchingGrouping.estimatedStudents}`);
      return matchingGrouping.estimatedStudents;
    }
    
    // Fallback to simple division
    const lectureOccurrence = course.lectureOccurrence || 1;
    const capacityPerLecture = Math.ceil((course.targetStudent || 0) / lectureOccurrence);
    console.log(`✅ Lecture fallback: ${course.targetStudent} / ${lectureOccurrence} = ${capacityPerLecture}`);
    return capacityPerLecture;
  } 
  else if (occType === "Tutorial" && course.tutorialGroupings) {
    const matchingGrouping = course.tutorialGroupings.find(group => 
      occNumbers.includes(group.occNumber)
    );
    
    if (matchingGrouping && matchingGrouping.estimatedStudents) {
      console.log(`✅ Using tutorial grouping capacity: ${matchingGrouping.estimatedStudents}`);
      return matchingGrouping.estimatedStudents;
    }
    
    // Fallback to simple division
    const tutorialOcc = course.tutorialOcc || 1;
    const capacityPerTutorial = Math.ceil((course.targetStudent || 0) / tutorialOcc);
    console.log(`✅ Tutorial fallback: ${course.targetStudent} / ${tutorialOcc} = ${capacityPerTutorial}`);
    return capacityPerTutorial;
  }
  
  return course.targetStudent || 0;
};

// Alternative version that's more explicit about the issue
// const calculateRequiredCapacityV2 = (courseCode, occType, occNumber, courses) => {
//   const course = courses.find(c => c.code === courseCode);
//   if (!course) return 0;
  
//   const targetStudent = course.targetStudent || 0;
  
//   // EXPLICIT CHECK: Log when fallback case would be hit
//   if (occType !== "Lecture" && occType !== "Tutorial") {
//     console.error(`🔴 PROBLEM FOUND: occType is "${occType}" - not "Lecture" or "Tutorial"`);
//     console.error("This will trigger the fallback case and return full targetStudent!");
//     console.error(`Course: ${courseCode}, targetStudent: ${targetStudent}`);
//     // Return 0 instead of targetStudent to avoid capacity issues
//     return 0;
//   }
  
//   if (occType === "Lecture") {
//     const lectureOccurrence = course.lectureOccurrence || 1;
//     return Math.ceil(targetStudent / lectureOccurrence);
//   } 
  
//   if (occType === "Tutorial") {
//     const tutorialOcc = course.tutorialOcc || 1;
//     return Math.ceil(targetStudent / tutorialOcc);
//   }
  
//   // This should never be reached now
//   return 0;
// };

// Debug helper to check the actual data
// const debugWIX1002Data = (courses) => {
//   console.log("=== WIX1002 DEBUG ===");
//   const wix1002 = courses.find(c => c.code === 'WIX1002');
//   if (wix1002) {
//     console.log("WIX1002 found:", wix1002);
//     console.log("targetStudent:", wix1002.targetStudent);
//     console.log("tutorialOcc:", wix1002.tutorialOcc);
    
//     // Test the calculation
//     if (wix1002.tutorialOcc) {
//       const calc = Math.ceil(wix1002.targetStudent / wix1002.tutorialOcc);
//       console.log(`Calculation: ${wix1002.targetStudent} / ${wix1002.tutorialOcc} = ${calc}`);
//     }
//   } else {
//     console.log("❌ WIX1002 not found in courses array");
//     console.log("Available courses:", courses.map(c => c.code));
//   }
// };

  const onDragEnd = async (result) => {
  console.log("=== DRAG END DEBUG ===");
  console.log("Result:", result);
  
  if (!result.destination) {
    console.log("No destination, returning");
    return;
  }

  const { source, destination } = result;
  const [sourceRoom, sourceTime] = source.droppableId.split("-");
  const [destRoom, destTime] = destination.droppableId.split("-");
  const sourceTimeIdx = Number(sourceTime);
  const destTimeIdx = Number(destTime);

  // CHECK: If dropping to the exact same position, do nothing
  if (sourceRoom === destRoom && sourceTimeIdx === destTimeIdx && source.index === destination.index) {
    console.log("Dropped at same position, no action needed");
    return;
  }

  console.log("Source:", { room: sourceRoom, time: sourceTimeIdx, index: source.index });
  console.log("Destination:", { room: destRoom, time: destTimeIdx, index: destination.index });

  // Create a deep copy of the current timetable
  const newTimetable = JSON.parse(JSON.stringify(timetable));
  
  // CRITICAL FIX: Find the event in the current lane system instead of just the source slot
  let moved = null;
  let originalTimeIdx = -1;
  let originalRoomId = null;
  
  // Search through all time slots and all lanes to find the dragged item
  DAYS.forEach(day => {
    if (day !== selectedDay) return;
    
    Object.keys(newTimetable[day]).forEach(roomId => {
      newTimetable[day][roomId].forEach((slot, timeIdx) => {
        slot.forEach((item, itemIndex) => {
          if (item && item.id === result.draggableId) {
            // Find which lane this item is in based on the drag index
            const daySlots = newTimetable[selectedDay][roomId] || [];
            
            // Build lanes for this room to find the correct event
            const lanes = [];
            for (let tIdx = 0; tIdx < TIMES.length; tIdx++) {
              const slotEvents = daySlots[tIdx] || [];
              slotEvents.forEach(event => {
                const duration = event.raw?.Duration || 1;
                
                let placed = false;
                for (let lane of lanes) {
                  let canPlace = true;
                  for (let d = 0; d < duration; d++) {
                    if (lane[tIdx + d]) {
                      canPlace = false;
                      break;
                    }
                  }
                  if (canPlace) {
                    for (let d = 0; d < duration; d++) {
                      lane[tIdx + d] = event;
                    }
                    placed = true;
                    break;
                  }
                }
                
                if (!placed) {
                  const newLane = Array(TIMES.length).fill(null);
                  for (let d = 0; d < duration; d++) {
                    newLane[tIdx + d] = event;
                  }
                  lanes.push(newLane);
                }
              });
            }
            
            // Find the event in the lanes that matches our drag index
            if (lanes[source.index]) {
              const foundEvent = lanes[source.index].find(e => e && e.id === result.draggableId);
              if (foundEvent) {
                moved = foundEvent;
                originalTimeIdx = TIMES.findIndex(t => t === foundEvent.raw.StartTime);
                originalRoomId = roomId;
                console.log("Found moved item:", { moved, originalTimeIdx, originalRoomId });
                return;
              }
            }
          }
        });
      });
    });
  });
  
  if (!moved || originalTimeIdx === -1 || !originalRoomId) {
    console.error("Could not find the dragged item");
    return;
  }
  
  const duration = moved.raw?.Duration || 1;
  console.log("Duration:", duration);

  // CRITICAL FIX: Validate destination exists
  if (!newTimetable[selectedDay] || !newTimetable[selectedDay][destRoom] || !newTimetable[selectedDay][destRoom][destTimeIdx]) {
    console.error("Destination location does not exist in timetable");
    return;
  }

  // Check for conflicts but don't block the move
  let conflicts = [];
  
  // Check if destination time slots extend beyond available time
  for (let i = 0; i < duration; i++) {
    if (destTimeIdx + i >= TIMES.length) {
      conflicts.push({
        type: 'Time Slot Exceeded',
        message: `Event extends beyond available time slots (slot ${destTimeIdx + i} exceeds ${TIMES.length - 1})`,
        timeSlotIndex: destTimeIdx + i,
        maxTimeSlots: TIMES.length
      });
      break;
    }
  }

  // Check for room capacity conflict
const destRoomObj = rooms.find(r => r._id === destRoom);
if (destRoomObj) {
  // ✅ FIX: Pass EstimatedStudents from the moved event
  const requiredCapacity = calculateRequiredCapacity(
    moved.code, 
    moved.raw.OccType, 
    moved.raw.OccNumber, 
    courses,
    moved.raw.EstimatedStudents  // ✅ CRITICAL FIX: Pass this parameter
  );
  
  if (destRoomObj.capacity < requiredCapacity) {
    conflicts.push({
      type: 'Room Capacity',
      message: `Room ${destRoomObj.code} has capacity of ${destRoomObj.capacity}, but event requires ${requiredCapacity} seats`,
      roomCode: destRoomObj.code,
      roomCapacity: destRoomObj.capacity,
      requiredCapacity: requiredCapacity
    });
  }
}

  // Check for room double booking conflicts
  rooms
  .filter(r => r._id === destRoom)
  .forEach(roomObj => {
    newTimetable[selectedDay][roomObj._id].forEach((slotEvents, slotIdx) => {
      slotEvents.forEach(event => {
        if (!event || event.id === moved.id) return;

        const eventStartIdx = TIMES.findIndex(t => t === event.raw.StartTime);
        const eventDuration = event.raw?.Duration || 1;
        const eventEndIdx = eventStartIdx + eventDuration - 1;

        const movedStartIdx = destTimeIdx;
        const movedEndIdx = destTimeIdx + duration - 1;

        const hasOverlap = !(movedEndIdx < eventStartIdx || movedStartIdx > eventEndIdx);

        if (hasOverlap) {
          let occNum = event.raw?.OccNumber || event.OccNumber;
          let formattedOccNum = occNum
            ? Array.isArray(occNum)
              ? `(Occ ${occNum.join(", ")})`
              : `(Occ ${occNum})`
            : '(Occ Unknown)';

          // FIXED: Calculate the full overlapping time range
          const overlapStart = Math.max(movedStartIdx, eventStartIdx);
          const overlapEnd = Math.min(movedEndIdx, eventEndIdx);
          
          // Create the proper time range string
          const overlapStartTime = TIMES[overlapStart];
          const overlapEndTime = TIMES[overlapEnd];
          
          const overlapTimeSlot = overlapStartTime.includes(' - ') 
            ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
            : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;

          conflicts.push({
            type: 'Room Double Booking',
            conflictingCourse: event.code,
            conflictingCourseOcc: occNum,
            conflictingCouseType: event.raw?.OccType || event.OccType,
            formattedOccNumber: formattedOccNum,
            timeSlot: overlapTimeSlot, // FIXED: Now shows full overlap range
            roomCode: roomObj.code,
            conflictingEvent: event
          });
        }
      });
    });
  });

    // NEW: Check for Department Tutorial Clash conflicts
if (moved.raw?.OccType === 'Tutorial' && moved.raw?.Departments && moved.raw.Departments.length > 0) {
  const movedDepartments = moved.raw.Departments;
  const movedYearLevels = moved.raw.YearLevel || []; // ✅ ADD THIS
  const movedStartIdx = destTimeIdx;
  const movedEndIdx = destTimeIdx + duration - 1;

  // Check all other tutorials on the target day
  Object.entries(newTimetable[selectedDay]).forEach(([checkRoomId, roomSlots]) => {
    roomSlots.forEach((slot, slotIdx) => {
      slot.forEach(otherEvent => {
        // Skip self, skip non-tutorials, skip events without departments
        if (!otherEvent || otherEvent.id === moved.id) return;
        if (otherEvent.raw?.OccType !== 'Tutorial') return;
        if (!otherEvent.raw?.Departments || otherEvent.raw.Departments.length === 0) return;

        // ✅ CRITICAL FIX: Skip if same course code (different occurrences of the same course are NOT a conflict)
        if (otherEvent.code === moved.code) {
          console.log(`  ℹ️ Skipping department clash check: ${moved.code} vs ${otherEvent.code} - same course, different occurrences are allowed`);
          return;
        }

        // ✅ CRITICAL FIX: Check if they share year levels
        const otherYearLevels = otherEvent.raw.YearLevel || [];
        const hasSharedYearLevel = movedYearLevels.some(yl => otherYearLevels.includes(yl));
        
        if (!hasSharedYearLevel) {
          console.log(`  ℹ️ Skipping department clash check: ${moved.code} (Years: ${movedYearLevels.join(',')}) vs ${otherEvent.code} (Years: ${otherYearLevels.join(',')}) - different year levels`);
          return; // Different year levels = no conflict possible
        }

        // Check for shared departments
        const sharedDepartments = movedDepartments.filter(dept => 
          otherEvent.raw.Departments.includes(dept)
        );

        if (sharedDepartments.length === 0) return;

        // Check time overlap
        const otherStartIdx = TIMES.findIndex(t => t === otherEvent.raw.StartTime);
        const otherDuration = otherEvent.raw?.Duration || 1;
        const otherEndIdx = otherStartIdx + otherDuration - 1;

        const hasOverlap = !(movedEndIdx < otherStartIdx || movedStartIdx > otherEndIdx);

        if (hasOverlap) {
          const overlapStart = Math.max(movedStartIdx, otherStartIdx);
          const overlapEnd = Math.min(movedEndIdx, otherEndIdx);
          const overlapStartTime = TIMES[overlapStart];
          const overlapEndTime = TIMES[overlapEnd];
          
          const overlapTimeSlot = overlapStartTime.includes(' - ') 
            ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
            : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;

          const otherRoomObj = rooms.find(r => r._id === checkRoomId);
          
          const sharedYears = movedYearLevels.filter(yl => otherYearLevels.includes(yl));

          conflicts.push({
            type: 'Department Tutorial Clash',
            departments: sharedDepartments,
            yearLevels: sharedYears, // ✅ ADD THIS
            conflictingCourse: otherEvent.code,
            conflictingCourseType: otherEvent.raw?.OccType,
            conflictingOccNumber: otherEvent.raw?.OccNumber,
            conflictingRoomCode: otherRoomObj?.code || 'Unknown Room',
            timeSlot: overlapTimeSlot,
            movedCourse: moved.code,
            movedOccNumber: moved.raw.OccNumber
          });
          
          console.log(`📚 Department clash detected (drag): ${sharedDepartments.join(', ')} Year ${sharedYears.join(', ')} - ${moved.code} vs ${otherEvent.code}`);
        }
      });
    });
  });
}

  // NEW: Check for lecture-tutorial clashes based on year level
  const lectureTutorialClashes = checkLectureTutorialClash(newTimetable, moved, selectedDay, destTimeIdx, duration);
  conflicts.push(...lectureTutorialClashes);

  // Check for instructor conflicts (keeping existing logic)
  if (moved.selectedInstructorId && moved.selectedInstructorId.trim() !== "" && 
      moved.selectedInstructor && moved.selectedInstructor.trim() !== "") {
    const movedInstructorName = moved.selectedInstructor;
    const movedStartIdx = destTimeIdx;
    const movedEndIdx = destTimeIdx + duration - 1;

    Object.entries(newTimetable[selectedDay]).forEach(([checkRoomId, roomSlots]) => {
      if (checkRoomId === destRoom) return;
      
      roomSlots.forEach((conflictingSlot, conflictingTimeIdx) => {
        if (conflictingSlot && conflictingSlot.length > 0) {
          conflictingSlot.forEach(conflictingEvent => {
            if (conflictingEvent.id === moved.id) return;
            
            const conflictingHasInstructor = (conflictingEvent.selectedInstructorId && 
                                            conflictingEvent.selectedInstructorId.trim() !== "") ||
                                           (conflictingEvent.selectedInstructor && 
                                            conflictingEvent.selectedInstructor.trim() !== "");
            
            if (!conflictingHasInstructor) return;
            
            if (conflictingEvent.selectedInstructorId === moved.selectedInstructorId ||
                (conflictingEvent.selectedInstructor && 
                 conflictingEvent.selectedInstructor === movedInstructorName)) {
              
              const conflictingDuration = conflictingEvent.raw.Duration || 1;
              const conflictingStartIdx = TIMES.findIndex(t => t === conflictingEvent.raw.StartTime);
              const conflictingEndIdx = conflictingStartIdx + conflictingDuration - 1;
              
              const hasOverlap = !(movedEndIdx < conflictingStartIdx || movedStartIdx > conflictingEndIdx);
              
              if (hasOverlap) {
                const conflictingRoomObj = rooms.find(r => r._id === checkRoomId);
                const conflictingRoomCode = conflictingRoomObj?.code || 'Unknown Room';
                
                let conflictingOccNumber = conflictingEvent.raw?.OccNumber || conflictingEvent.OccNumber;
                let conflictingFormattedOccNumber = '';
                if (conflictingOccNumber) {
                  conflictingFormattedOccNumber = Array.isArray(conflictingOccNumber)
                    ? `(Occ ${conflictingOccNumber.join(", ")})`
                    : `(Occ ${conflictingOccNumber})`;
                }

                const overlapStart = Math.max(movedStartIdx, conflictingStartIdx);
const overlapEnd = Math.min(movedEndIdx, conflictingEndIdx);
const overlapStartTime = TIMES[overlapStart] || TIMES[movedStartIdx];
const overlapEndTime = TIMES[overlapEnd] || TIMES[movedEndIdx];

// FIXED: Create proper time range for the overlap
const overlapTimeRange = overlapStartTime.includes(' - ') 
  ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
  : overlapStartTime;

conflicts.push({
  type: 'Instructor Conflict',
  instructorName: movedInstructorName,
  instructorId: moved.selectedInstructorId,
  conflictingCourse: conflictingEvent.code,
  conflictingCourseType: conflictingEvent.raw?.OccType || conflictingEvent.OccType,
  conflictingFormattedOccNumber: conflictingFormattedOccNumber,
  conflictingRoomCode: conflictingRoomCode,
  overlapTimeRange: overlapTimeRange,
  movedCourse: moved.code,
  movedCourseType: moved.raw.OccType,
  movedCourseOccNumber: moved.raw.OccNumber,
  movedRoomCode: destRoomObj?.code || 'Unknown Room',
  movedTimeRange: `${TIMES[movedStartIdx]} - ${TIMES[movedEndIdx].split(" - ")[1]}`,
  conflictingTimeRange: `${TIMES[conflictingStartIdx]} - ${TIMES[conflictingEndIdx].split(" - ")[1]}`,
  conflictingDay: selectedDay,
  timeSlot: overlapTimeRange // FIXED: Use full overlap range instead of just start time
});
              }
            }
          });
        }
      });
    });
  }

  // Display alert if conflicts are detected
  // Display alert if conflicts are detected
  if (conflicts.length > 0) {
    let alertMessage = "The following conflicts were detected:\n\n";
    conflicts.forEach((conflict, index) => {
      if (conflict.type === 'Room Capacity') {
        alertMessage += `${index + 1}. Room Capacity Conflict: ${conflict.message}\n`;
      } else if (conflict.type === 'Room Double Booking') {
        alertMessage += `${index + 1}. Double Booking Conflict: ${moved.code} (${moved.raw.OccType}) ${
          moved.raw.OccNumber
            ? Array.isArray(moved.raw.OccNumber)
              ? `(Occ ${moved.raw.OccNumber.join(", ")})`
              : `(Occ ${moved.raw.OccNumber})`
            : ""
        } moved to ${conflict.roomCode} on ${selectedDay} at ${conflict.timeSlot}, conflicts with ${conflict.conflictingCourse} (${conflict.conflictingCouseType}) ${conflict.formattedOccNumber}\n`;
      } else if (conflict.type === 'Time Slot Exceeded') {
        alertMessage += `${index + 1}. Time Slot Exceeded: ${conflict.message}\n`;
      } else if (conflict.type === 'Instructor Conflict') {
        alertMessage += `${index + 1}. Instructor Conflict: ${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) (Occ ${conflict.movedCourseOccNumber}) in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${conflict.conflictingDay} at ${conflict.overlapTimeRange}\n`;
      } else if (conflict.type === 'Department Tutorial Clash') {
        alertMessage += `${index + 1}. Department Tutorial Clash: Department(s) ${conflict.departments.join(', ')} have conflicting tutorials - ${conflict.movedCourse} (Tutorial ${
          moved.raw.OccNumber
            ? Array.isArray(moved.raw.OccNumber)
              ? `Occ ${moved.raw.OccNumber.join(", ")}`
              : `Occ ${moved.raw.OccNumber}`
            : ""
        }) moved to ${destRoomObj?.code || 'Unknown'} conflicts with ${conflict.conflictingCourse} (${conflict.conflictingCourseType} ${
          conflict.conflictingOccNumber
            ? Array.isArray(conflict.conflictingOccNumber)
              ? `Occ ${conflict.conflictingOccNumber.join(", ")}`
              : `Occ ${conflict.conflictingOccNumber}`
            : ""
        }) in ${conflict.conflictingRoomCode} at ${conflict.timeSlot}\n`;
      } else if (conflict.type === 'Lecture-Tutorial Clash') {
        alertMessage += `${index + 1}. Lecture-Tutorial Clash: ${conflict.tutorialCourse} Tutorial ${
          conflict.tutorialOccNumber
            ? Array.isArray(conflict.tutorialOccNumber)
              ? `(Occ ${conflict.tutorialOccNumber.join(", ")})`
              : `(Occ ${conflict.tutorialOccNumber})`
            : ""
        } clashes with ${conflict.lectureCourse} Lecture ${
          conflict.lectureOccNumber
            ? Array.isArray(conflict.lectureOccNumber)
              ? `(Occ ${conflict.lectureOccNumber.join(", ")})`
              : `(Occ ${conflict.lectureOccNumber})`
            : ""
        } for Year ${conflict.yearLevels.join(', ')} students in ${conflict.conflictingRoomCode} at ${conflict.timeSlot}\n`;
      }
    });
    alertMessage += "\nThe move will still be performed, and conflicts will be recorded in the analytics section.";

    const confirmed = await showConfirm(
      alertMessage,
      "Conflicts Detected"
    );
    
    if (!confirmed) {
      return;
    }
  }

  console.log("=== BEFORE REMOVAL ===");
  
  // STEP 1: Create the updated event first (before any removal)
  const updatedEvent = {
    ...moved,
    raw: {
      ...moved.raw,
      StartTime: TIMES[destTimeIdx],
      EndTime: destTimeIdx + duration - 1 < TIMES.length 
        ? TIMES[destTimeIdx + duration - 1].split(" - ")[1]
        : TIMES[TIMES.length - 1].split(" - ")[1],
      Day: selectedDay,
      RoomID: destRoom
    }
  };
  
  console.log("=== CREATED UPDATED EVENT ===");
  console.log("Updated event:", JSON.stringify(updatedEvent, null, 2));
  
  // STEP 2: Place the event in destination FIRST
  console.log("=== PLACING EVENT FIRST ===");
  
  // Ensure destination slot is an array
  if (!Array.isArray(newTimetable[selectedDay][destRoom][destTimeIdx])) {
    newTimetable[selectedDay][destRoom][destTimeIdx] = [];
  }
  
  newTimetable[selectedDay][destRoom][destTimeIdx].push(updatedEvent);
  
  console.log("Destination slot after placement:", JSON.stringify(newTimetable[selectedDay][destRoom][destTimeIdx], null, 2));
  
  // STEP 3: Now remove from source (ONLY if different from destination)
  console.log("=== NOW REMOVING FROM SOURCE ===");
  
  // CRITICAL FIX: Only remove from source if it's different from destination
  if (!(originalRoomId === destRoom && originalTimeIdx === destTimeIdx)) {
    // Remove from ALL time slots the event was originally occupying
    if (originalTimeIdx !== -1) {
      for (let i = 0; i < duration; i++) {
        const timeSlotToClean = originalTimeIdx + i;
        if (timeSlotToClean < TIMES.length && newTimetable[selectedDay][originalRoomId][timeSlotToClean]) {
          const originalLength = newTimetable[selectedDay][originalRoomId][timeSlotToClean].length;
          newTimetable[selectedDay][originalRoomId][timeSlotToClean] = 
            newTimetable[selectedDay][originalRoomId][timeSlotToClean].filter(item => item.id !== moved.id);
          const removedCount = originalLength - newTimetable[selectedDay][originalRoomId][timeSlotToClean].length;
          
          if (removedCount > 0) {
            console.log(`Removed ${removedCount} instance(s) of event ${moved.id} from source time slot ${timeSlotToClean}`);
          }
        }
      }
    }
    
    // STEP 4: Clean up any other duplicate instances (but be very careful)
    console.log("=== CLEANING UP OTHER INSTANCES ===");
    let cleanupCount = 0;
    
    Object.keys(newTimetable[selectedDay]).forEach(roomId => {
      newTimetable[selectedDay][roomId].forEach((slot, timeIdx) => {
        // Skip the destination slot we just filled AND skip source slots we just cleaned
        if (roomId === destRoom && timeIdx === destTimeIdx) {
          return;
        }
        if (roomId === originalRoomId && timeIdx >= originalTimeIdx && timeIdx < originalTimeIdx + duration) {
          return;
        }
        
        const originalLength = slot.length;
        newTimetable[selectedDay][roomId][timeIdx] = slot.filter(item => item.id !== moved.id);
        const removedCount = originalLength - newTimetable[selectedDay][roomId][timeIdx].length;
        cleanupCount += removedCount;
        
        if (removedCount > 0) {
          console.log(`Cleaned up ${removedCount} duplicate(s) from room ${roomId} at time ${timeIdx}`);
        }
      });
    });
    
    console.log(`Total cleanup count: ${cleanupCount}`);
  } else {
    console.log("Source and destination are the same, skipping removal");
  }
  
  // STEP 5: Final verification
  console.log("=== FINAL VERIFICATION ===");
  console.log("Final destination slot:", JSON.stringify(newTimetable[selectedDay][destRoom][destTimeIdx], null, 2));
  console.log("Event should be in destination:", newTimetable[selectedDay][destRoom][destTimeIdx].some(item => item.id === moved.id));
  
  // Update the timetable state
  console.log("=== UPDATING STATE ===");
  setTimetable(newTimetable);
  setIsModified(true);
  
  console.log("=== DRAG END COMPLETE ===");

  // Record conflicts if any exist (keeping your existing conflict recording logic)
  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      if (conflict.type === 'Room Capacity') {
        const conflictData = {
          Year: selectedYear,
          Semester: selectedSemester,
          Type: 'Room Capacity',
          Description: `${moved.code} (${moved.raw.OccType}) ${
            moved.raw.OccNumber
              ? Array.isArray(moved.raw.OccNumber)
                ? `(Occ ${moved.raw.OccNumber.join(", ")})`
                : `(Occ ${moved.raw.OccNumber})`
              : ""
          } moved to ${conflict.roomCode} (capacity ${conflict.roomCapacity}), but event requires ${conflict.requiredCapacity} seats`,
          CourseCode: moved.code,
          RoomID: destRoom,
          Day: selectedDay,
          StartTime: TIMES[destTimeIdx],
          Priority: 'High',
          Status: 'Pending'
        };
        // await recordDragDropConflict(conflictData);
        
      } else if (conflict.type === 'Room Double Booking') {
        const conflictData = {
          Year: selectedYear,
          Semester: selectedSemester,
          Type: 'Room Double Booking',
          Description: `${moved.code} (${moved.raw.OccType}) ${
            moved.raw.OccNumber
              ? Array.isArray(moved.raw.OccNumber)
                ? `(Occ ${moved.raw.OccNumber.join(", ")})`
                : `(Occ ${moved.raw.OccNumber})`
              : ""
          } moved to ${conflict.roomCode} on ${selectedDay} at ${conflict.timeSlot}, creating double booking with ${conflict.conflictingCourse} (${conflict.conflictingCouseType}) ${conflict.formattedOccNumber}`,
          CourseCode: moved.code,
          RoomID: destRoom,
          Day: selectedDay,
          StartTime: conflict.timeSlot,
          Priority: 'High',
          Status: 'Pending'
        };
        // await recordDragDropConflict(conflictData);
        
      } else if (conflict.type === 'Time Slot Exceeded') {
        const conflictData = {
          Year: selectedYear,
          Semester: selectedSemester,
          Type: 'Time Slot Exceeded',
          Description: `${moved.code} (${moved.raw.OccType}) ${
            moved.raw.OccNumber
              ? Array.isArray(moved.raw.OccNumber)
                ? `(Occ ${moved.raw.OccNumber.join(", ")})`
                : `(Occ ${moved.raw.OccNumber})`
              : ""
          } moved to ${destRoomObj?.code || 'Unknown Room'} on ${selectedDay} at ${TIMES[destTimeIdx]}, event extends beyond available time slots (requires ${duration} hours, but only ${TIMES.length - destTimeIdx} slots available)`,
          CourseCode: moved.code,
          RoomID: destRoom,
          Day: selectedDay,
          StartTime: TIMES[destTimeIdx],
          Priority: 'High',
          Status: 'Pending'
        };
        // await recordDragDropConflict(conflictData);
        
      } else if (conflict.type === 'Instructor Conflict') {
  // FIXED: Calculate proper time range for overlap
  const movedStartTime = TIMES[destTimeIdx];
  const movedEndTime = destTimeIdx + duration - 1 < TIMES.length 
    ? TIMES[destTimeIdx + duration - 1].split(" - ")[1]
    : TIMES[TIMES.length - 1].split(" - ")[1];
  
  // Create proper time range string
  const movedTimeRange = movedStartTime.includes(' - ') 
    ? `${movedStartTime.split(' - ')[0]} - ${movedEndTime}`
    : `${movedStartTime} - ${movedEndTime}`;

  const conflictData = {
    Year: selectedYear,
    Semester: selectedSemester,
    Type: 'Instructor Conflict',
    Description: `${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) ${
      moved.raw.OccNumber
        ? Array.isArray(moved.raw.OccNumber)
          ? `(Occ ${moved.raw.OccNumber.join(", ")})`
          : `(Occ ${moved.raw.OccNumber})`
        : ""
    } in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${selectedDay} at ${movedTimeRange}`, // FIXED: Use full time range
    CourseCode: moved.code,
    InstructorID: conflict.instructorId,
    RoomID: destRoom,
    Day: selectedDay,
    StartTime: movedTimeRange, // FIXED: Use full time range instead of just start time
    Priority: 'High',
    Status: 'Pending'
  };
  // await recordDragDropConflict(conflictData);
} else if (conflict.type === 'Department Tutorial Clash') {
        const movedStartTime = TIMES[destTimeIdx];
        const movedEndTime = destTimeIdx + duration - 1 < TIMES.length 
          ? TIMES[destTimeIdx + duration - 1].split(" - ")[1]
          : TIMES[TIMES.length - 1].split(" - ")[1];
        
        const movedTimeRange = movedStartTime.includes(' - ') 
          ? `${movedStartTime.split(' - ')[0]} - ${movedEndTime}`
          : `${movedStartTime} - ${movedEndTime}`;

        const conflictData = {
          Year: selectedYear,
          Semester: selectedSemester,
          Type: 'Department Tutorial Clash',
          Description: `Department(s) ${conflict.departments.join(', ')} have conflicting tutorials: ${conflict.movedCourse} (Tutorial ${
            moved.raw.OccNumber
              ? Array.isArray(moved.raw.OccNumber)
                ? `Occ ${moved.raw.OccNumber.join(", ")}`
                : `Occ ${moved.raw.OccNumber}`
              : ""
          }) moved to ${destRoomObj?.code || 'Unknown'} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType} ${
            conflict.conflictingOccNumber
              ? Array.isArray(conflict.conflictingOccNumber)
                ? `Occ ${conflict.conflictingOccNumber.join(", ")}`
                : `Occ ${conflict.conflictingOccNumber}`
              : ""
          }) in ${conflict.conflictingRoomCode} on ${selectedDay} at ${conflict.timeSlot}`,
          CourseCode: moved.code,
          Day: selectedDay,
          StartTime: conflict.timeSlot,
          Priority: 'High',
          Status: 'Pending'
        };
        // await recordDragDropConflict(conflictData);
      } else if (conflict.type === 'Lecture-Tutorial Clash') {
        const movedStartTime = TIMES[destTimeIdx];
        const movedEndTime = destTimeIdx + duration - 1 < TIMES.length 
          ? TIMES[destTimeIdx + duration - 1].split(" - ")[1]
          : TIMES[TIMES.length - 1].split(" - ")[1];
        
        const movedTimeRange = movedStartTime.includes(' - ') 
          ? `${movedStartTime.split(' - ')[0]} - ${movedEndTime}`
          : `${movedStartTime} - ${movedEndTime}`;

        const conflictData = {
          Year: selectedYear,
          Semester: selectedSemester,
          Type: 'Lecture-Tutorial Clash',
          Description: `${conflict.tutorialCourse} (Tutorial ${
            conflict.tutorialOccNumber
              ? Array.isArray(conflict.tutorialOccNumber)
                ? `Occ ${conflict.tutorialOccNumber.join(", ")}`
                : `Occ ${conflict.tutorialOccNumber}`
              : ""
          }) clashes with ${conflict.lectureCourse} (Lecture ${
            conflict.lectureOccNumber
              ? Array.isArray(conflict.lectureOccNumber)
                ? `Occ ${conflict.lectureOccNumber.join(", ")}`
                : `Occ ${conflict.lectureOccNumber}`
              : ""
          }) for year level(s): ${conflict.yearLevels.join(', ')} in ${conflict.conflictingRoomCode} on ${selectedDay} at ${conflict.timeSlot}`,
          CourseCode: moved.code,
          Day: selectedDay,
          StartTime: conflict.timeSlot,
          Priority: 'Medium',
          Status: 'Pending'
        };
        // await recordDragDropConflict(conflictData);
      }
    }
  }
};

  
const handleModalConfirm = async () => {
  if (!contextItem || !targetRoom) {
    showAlert("Please select a room.", "error");
    return;
  }

  const { item, roomId, timeIdx, index, sourceDay } = contextItem;
  const targetTimeIdx = TIMES.indexOf(targetTime);
  if (targetTimeIdx === -1) {
    showAlert(`Invalid time slot selected: ${targetTime || '(none)'}`, "error");
    return;
  }
  const duration = item.raw.Duration || 1;

  // Calculate required capacity for this event
const requiredCapacity = calculateRequiredCapacity(
  item.code, 
  item.raw.OccType, 
  item.raw.OccNumber, 
  courses,
  item.raw.EstimatedStudents  // ✅ CRITICAL FIX: Pass this parameter
);

  // Find target room details
  const targetRoomObj = rooms.find(r => r._id === targetRoom);
  if (!targetRoomObj) {
    showAlert("Target room not found.", "error");
    return;
  }

  const newTimetable = JSON.parse(JSON.stringify(timetable));
  let conflicts = [];

  // ✅ ADD THIS: Check if destination time slots extend beyond available time
  for (let i = 0; i < duration; i++) {
    if (targetTimeIdx + i >= TIMES.length) {
      conflicts.push({
        type: 'Time Slot Exceeded',
        message: `Event extends beyond available time slots (slot ${targetTimeIdx + i} exceeds ${TIMES.length - 1})`,
        timeSlotIndex: targetTimeIdx + i,
        maxTimeSlots: TIMES.length
      });
      break;
    }
  }

  // Check room capacity conflict
  if (targetRoomObj.capacity < requiredCapacity) {
    conflicts.push({
      type: 'Room Capacity',
      message: `Room ${targetRoomObj.code} has capacity of ${targetRoomObj.capacity}, but event requires ${requiredCapacity} seats`,
      roomCode: targetRoomObj.code,
      roomCapacity: targetRoomObj.capacity,
      requiredCapacity: requiredCapacity
    });
    
    // Record capacity conflict
    const capacityConflictData = {
      Year: selectedYear,
      Semester: selectedSemester,
      Type: 'Room Capacity',
      Description: `${item.code} (${item.raw.OccType}) ${
        item.raw.OccNumber
          ? Array.isArray(item.raw.OccNumber)
            ? `(Occ ${item.raw.OccNumber.join(", ")})`
            : `(Occ ${item.raw.OccNumber})`
          : ""
      } moved to ${targetRoomObj.code} (capacity ${targetRoomObj.capacity}), but event requires ${requiredCapacity} seats`,
      CourseCode: item.code,
      RoomID: targetRoom,
      Day: targetDay,
      StartTime: targetTime,
      Priority: 'High',
      Status: 'Pending'
    };
    
    // try {
    //   await recordDragDropConflict(capacityConflictData);
    // } catch (error) {
    //   console.error("Failed to record capacity conflict:", error);
    // }
  }

  // ✅ ADD THIS: Record Time Slot Exceeded conflicts
  for (const conflict of conflicts) {
    if (conflict.type === 'Time Slot Exceeded') {
      const timeSlotConflictData = {
        Year: selectedYear,
        Semester: selectedSemester,
        Type: 'Time Slot Exceeded',
        Description: `${item.code} (${item.raw.OccType}) ${
          item.raw.OccNumber
            ? Array.isArray(item.raw.OccNumber)
              ? `(Occ ${item.raw.OccNumber.join(", ")})`
              : `(Occ ${item.raw.OccNumber})`
            : ""
        } moved to ${targetRoomObj.code} on ${targetDay} at ${targetTime}, event extends beyond available time slots (requires ${duration} hours, but only ${TIMES.length - targetTimeIdx} slots available)`,
        CourseCode: item.code,
        RoomID: targetRoom,
        Day: targetDay,
        StartTime: targetTime,
        Priority: 'High',
        Status: 'Pending'
      };
      
      // try {
      //   await recordDragDropConflict(timeSlotConflictData);
      // } catch (error) {
      //   console.error("Failed to record time slot exceeded conflict:", error);
      // }
    }
  }
  
  // Check if destination slots are occupied
  let conflictingEvents = [];
  rooms
    .filter(r => r._id === targetRoom) // only this room
    .forEach(roomObj => {
      newTimetable[targetDay][roomObj._id].forEach((slotEvents) => {
        slotEvents.forEach(event => {
          if (!event || event.id === item.id) return;

          const eventStartIdx = TIMES.findIndex(t => t === event.raw.StartTime);
          const eventDuration = event.raw?.Duration || 1;
          const eventEndIdx = eventStartIdx + eventDuration - 1;

          const movedStartIdx = targetTimeIdx;
          const movedEndIdx = targetTimeIdx + duration - 1;

          const hasOverlap = !(movedEndIdx < eventStartIdx || movedStartIdx > eventEndIdx);

          if (hasOverlap) {
            let occNum = event.raw?.OccNumber || event.OccNumber;
            let formattedOccNum = occNum
              ? Array.isArray(occNum)
                ? `(Occ ${occNum.join(", ")})`
                : `(Occ ${occNum})`
              : '(Occ Unknown)';

            conflicts.push({
              type: 'Room Double Booking',
              conflictingCourse: event.code,
              conflictingCourseOcc: occNum,
              conflictingCourseType: event.raw?.OccType || event.OccType,
              formattedOccNumber: formattedOccNum,
              timeSlot: TIMES[Math.max(movedStartIdx, eventStartIdx)],
              roomCode: roomObj.code
            });

            conflictingEvents.push(event);
          }
        });
      });
    });

    // NEW: Check for Department Tutorial Clash conflicts
  if (item.raw?.OccType === 'Tutorial' && item.raw?.Departments && item.raw.Departments.length > 0) {
  const movedDepartments = item.raw.Departments;
  const movedYearLevels = item.raw.YearLevel || []; // ✅ ADD THIS
  const movedStartIdx = targetTimeIdx;
  const movedEndIdx = targetTimeIdx + duration - 1;

  // Check all other tutorials on the target day
  Object.entries(newTimetable[targetDay]).forEach(([checkRoomId, roomSlots]) => {
    roomSlots.forEach((slot) => {
      slot.forEach(otherEvent => {
        // Skip self, skip non-tutorials, skip events without departments
        if (!otherEvent || otherEvent.id === item.id) return;
        if (otherEvent.raw?.OccType !== 'Tutorial') return;
        if (!otherEvent.raw?.Departments || otherEvent.raw.Departments.length === 0) return;

        // ✅ CRITICAL FIX: Skip if same course code (different occurrences of the same course are NOT a conflict)
        if (otherEvent.code === item.code) {
          console.log(`  ℹ️ Skipping department clash check: ${item.code} vs ${otherEvent.code} - same course, different occurrences are allowed`);
          return;
        }

        // ✅ CRITICAL FIX: Check if they share year levels
        const otherYearLevels = otherEvent.raw.YearLevel || [];
        const hasSharedYearLevel = movedYearLevels.some(yl => otherYearLevels.includes(yl));
        
        if (!hasSharedYearLevel) {
          console.log(`  ℹ️ Skipping department clash check: ${item.code} (Years: ${movedYearLevels.join(',')}) vs ${otherEvent.code} (Years: ${otherYearLevels.join(',')}) - different year levels`);
          return; // Different year levels = no conflict possible
        }

        // Check for shared departments
        const sharedDepartments = movedDepartments.filter(dept => 
          otherEvent.raw.Departments.includes(dept)
        );

        if (sharedDepartments.length === 0) return;

        // Check time overlap
        const otherStartIdx = TIMES.findIndex(t => t === otherEvent.raw.StartTime);
        const otherDuration = otherEvent.raw?.Duration || 1;
        const otherEndIdx = otherStartIdx + otherDuration - 1;

        const hasOverlap = !(movedEndIdx < otherStartIdx || movedStartIdx > otherEndIdx);

        if (hasOverlap) {
          const overlapStart = Math.max(movedStartIdx, otherStartIdx);
          const overlapEnd = Math.min(movedEndIdx, otherEndIdx);
          const overlapStartTime = TIMES[overlapStart];
          const overlapEndTime = TIMES[overlapEnd];
          
          const overlapTimeSlot = overlapStartTime.includes(' - ') 
            ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
            : `${overlapStartTime} - ${overlapEndTime.split(' - ')[1]}`;

          const otherRoomObj = rooms.find(r => r._id === checkRoomId);
          
          const sharedYears = movedYearLevels.filter(yl => otherYearLevels.includes(yl));

          conflicts.push({
            type: 'Department Tutorial Clash',
            departments: sharedDepartments,
            yearLevels: sharedYears, // ✅ ADD THIS
            conflictingCourse: otherEvent.code,
            conflictingCourseType: otherEvent.raw?.OccType,
            conflictingOccNumber: otherEvent.raw?.OccNumber,
            conflictingRoomCode: otherRoomObj?.code || 'Unknown Room',
            timeSlot: overlapTimeSlot,
            movedCourse: item.code,
            movedOccNumber: item.raw.OccNumber
          });
          
          console.log(`📚 Department clash detected (modal): ${sharedDepartments.join(', ')} Year ${sharedYears.join(', ')} - ${item.code} vs ${otherEvent.code}`);
        }
      });
    });
  });
}

  // NEW: Check for lecture-tutorial clashes based on year level
  const lectureTutorialClashes = checkLectureTutorialClash(newTimetable, item, targetDay, targetTimeIdx, duration);
  conflicts.push(...lectureTutorialClashes);

  // NEW: Check for instructor conflicts
  if (item.selectedInstructorId && item.selectedInstructorId.trim() !== "" && 
      item.selectedInstructor && item.selectedInstructor.trim() !== "") {
    const movedInstructorName = item.selectedInstructor;

    // Calculate the time range for the moved event
    const movedStartIdx = targetTimeIdx;
    const movedEndIdx = targetTimeIdx + duration - 1;

    // Check ALL time slots in the target day for overlapping events with same instructor
    Object.entries(newTimetable[targetDay] || {}).forEach(([checkRoomId, roomSlots]) => {
      // Skip target room as we're moving there
      if (checkRoomId === targetRoom) return;
      
      // Skip the source location to avoid self-conflict detection
      if (targetDay === sourceDay && checkRoomId === roomId) return;
      
      // Check each time slot for events with the same instructor
      roomSlots.forEach((conflictingSlot, conflictingTimeIdx) => {
        if (conflictingSlot && conflictingSlot.length > 0) {
          conflictingSlot.forEach(conflictingEvent => {
            // Skip if this is the same event (self-conflict)
            if (conflictingEvent.id === item.id) return;
            
            // Only check for instructor conflicts if the conflicting event has an instructor assigned
            const conflictingHasInstructor = (conflictingEvent.selectedInstructorId && 
                                            conflictingEvent.selectedInstructorId.trim() !== "") ||
                                           (conflictingEvent.selectedInstructor && 
                                            conflictingEvent.selectedInstructor.trim() !== "");
            
            if (!conflictingHasInstructor) return;
            
            // Check if the conflicting event has the same instructor
            if (conflictingEvent.selectedInstructorId === item.selectedInstructorId ||
                (conflictingEvent.selectedInstructor && 
                 conflictingEvent.selectedInstructor === movedInstructorName)) {
              
              // Calculate the time range for the conflicting event
              const conflictingDuration = conflictingEvent.raw.Duration || 1;
              const conflictingStartIdx = TIMES.findIndex(t => t === conflictingEvent.raw.StartTime);
              const conflictingEndIdx = conflictingStartIdx + conflictingDuration - 1;
              
              // Check if time periods overlap
              const hasOverlap = !(movedEndIdx < conflictingStartIdx || movedStartIdx > conflictingEndIdx);
              
              if (hasOverlap) {
                const conflictingRoomObj = rooms.find(r => r._id === checkRoomId);
                const conflictingRoomCode = conflictingRoomObj?.code || 'Unknown Room';
                
                // Format OccNumber for conflicting event
                let conflictingOccNumber = conflictingEvent.raw?.OccNumber || conflictingEvent.OccNumber;
                let conflictingFormattedOccNumber = '';
                if (conflictingOccNumber) {
                  conflictingFormattedOccNumber = Array.isArray(conflictingOccNumber)
                    ? `(Occ ${conflictingOccNumber.join(", ")})`
                    : `(Occ ${conflictingOccNumber})`;
                }

                // FIXED: Calculate overlapping time period properly
                const overlapStart = Math.max(movedStartIdx, conflictingStartIdx);
const overlapEnd = Math.min(movedEndIdx, conflictingEndIdx);
const overlapStartTime = TIMES[overlapStart] || TIMES[movedStartIdx];
const overlapEndTime = TIMES[overlapEnd] || TIMES[movedEndIdx];

// FIXED: Create proper time range for the overlap
const overlapTimeRange = overlapStartTime.includes(' - ') 
  ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
  : overlapStartTime;

conflicts.push({
  type: 'Instructor Conflict',
  instructorName: movedInstructorName,
  instructorId: item.selectedInstructorId,
  conflictingCourse: conflictingEvent.code,
  conflictingCourseType: conflictingEvent.raw?.OccType || conflictingEvent.OccType,
  conflictingFormattedOccNumber: conflictingFormattedOccNumber,
  conflictingRoomCode: conflictingRoomCode,
  overlapTimeRange: overlapTimeRange,
  movedCourse: item.code,
  movedCourseType: item.raw.OccType,
  movedCourseOccNumber: item.raw.OccNumber,
  movedRoomCode: targetRoomObj.code,
  movedTimeRange: `${TIMES[movedStartIdx]} - ${TIMES[movedEndIdx].split(" - ")[1]}`,
  conflictingTimeRange: `${TIMES[conflictingStartIdx]} - ${TIMES[conflictingEndIdx].split(" - ")[1]}`,
  conflictingDay: targetDay,
  timeSlot: overlapTimeRange // FIXED: Use full overlap range
});
              }
            }
          });
        }
      });
    });
  }

  // Record room double booking conflicts
  if (conflictingEvents.length > 0) {
    for (const conflict of conflicts) {
      if (conflict.type === 'Room Double Booking') {
        const conflictData = {
          Year: selectedYear,
          Semester: selectedSemester,
          Type: 'Room Double Booking',
          Description: `${item.code} (${item.raw.OccType}) ${
            item.raw.OccNumber
              ? Array.isArray(item.raw.OccNumber)
                ? `(Occ ${item.raw.OccNumber.join(", ")})`
                : `(Occ ${item.raw.OccNumber})`
              : ""
          } moved to ${conflict.roomCode} on ${targetDay} at ${conflict.timeSlot}, creating double booking with ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.formattedOccNumber}`,
          CourseCode: item.code,
          RoomID: targetRoom,
          Day: targetDay,
          StartTime: conflict.timeSlot,
          Priority: 'High',
          Status: 'Pending'
        };
        
        // try {
        //   await recordDragDropConflict(conflictData);
        // } catch (error) {
        //   console.error("Failed to record double booking conflict:", error);
        // }
      }
    }
  }

   // NEW: Record instructor conflicts
  for (const conflict of conflicts) {
  if (conflict.type === 'Instructor Conflict') {
    // FIXED: Calculate proper time range for the moved event
    const movedStartTime = targetTime;
    const movedEndTime = targetTimeIdx + duration - 1 < TIMES.length 
      ? TIMES[targetTimeIdx + duration - 1].split(" - ")[1]
      : TIMES[TIMES.length - 1].split(" - ")[1];
    
    // Create proper time range string
    const movedTimeRange = movedStartTime.includes(' - ') 
      ? `${movedStartTime.split(' - ')[0]} - ${movedEndTime}`
      : `${movedStartTime} - ${movedEndTime}`;

    const instructorConflictData = {
      Year: selectedYear,
      Semester: selectedSemester,
      Type: 'Instructor Conflict',
      Description: `${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) ${
        item.raw.OccNumber
          ? Array.isArray(item.raw.OccNumber)
            ? `(Occ ${item.raw.OccNumber.join(", ")})`
            : `(Occ ${item.raw.OccNumber})`
          : ""
      } in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${targetDay} at ${movedTimeRange}`, // FIXED: Use full time range
      CourseCode: item.code,
      InstructorID: conflict.instructorId,
      RoomID: targetRoom,
      Day: targetDay,
      StartTime: movedTimeRange, // FIXED: Use full time range instead of just overlap start
      Priority: 'High',
      Status: 'Pending'
    };
    
    // try {
    //   await recordDragDropConflict(instructorConflictData);
    // } catch (error) {
    //   console.error("Failed to record instructor conflict:", error);
    // }
  } else if (conflict.type === 'Department Tutorial Clash') {
    const movedStartTime = targetTime;
    const movedEndTime = targetTimeIdx + duration - 1 < TIMES.length 
      ? TIMES[targetTimeIdx + duration - 1].split(" - ")[1]
      : TIMES[TIMES.length - 1].split(" - ")[1];
    
    const movedTimeRange = movedStartTime.includes(' - ') 
      ? `${movedStartTime.split(' - ')[0]} - ${movedEndTime}`
      : `${movedStartTime} - ${movedEndTime}`;

    const deptClashConflictData = {
      Year: selectedYear,
      Semester: selectedSemester,
      Type: 'Department Tutorial Clash',
      Description: `Department(s) ${conflict.departments.join(', ')} have conflicting tutorials: ${conflict.movedCourse} (Tutorial ${
        item.raw.OccNumber
          ? Array.isArray(item.raw.OccNumber)
            ? `Occ ${item.raw.OccNumber.join(", ")}`
            : `Occ ${item.raw.OccNumber}`
          : ""
      }) moved to ${targetRoomObj.code} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType} ${
        conflict.conflictingOccNumber
          ? Array.isArray(conflict.conflictingOccNumber)
            ? `Occ ${conflict.conflictingOccNumber.join(", ")}`
            : `Occ ${conflict.conflictingOccNumber}`
          : ""
      }) in ${conflict.conflictingRoomCode} on ${targetDay} at ${conflict.timeSlot}`,
      CourseCode: item.code,
      Day: targetDay,
      StartTime: conflict.timeSlot,
      Priority: 'High',
      Status: 'Pending'
    };
    
    // try {
    //   await recordDragDropConflict(deptClashConflictData);
    // } catch (error) {
    //   console.error("Failed to record department tutorial clash conflict:", error);
    // }
  } else if (conflict.type === 'Lecture-Tutorial Clash') {
    const movedStartTime = targetTime;
    const movedEndTime = targetTimeIdx + duration - 1 < TIMES.length 
      ? TIMES[targetTimeIdx + duration - 1].split(" - ")[1]
      : TIMES[TIMES.length - 1].split(" - ")[1];
    
    const movedTimeRange = movedStartTime.includes(' - ') 
      ? `${movedStartTime.split(' - ')[0]} - ${movedEndTime}`
      : `${movedStartTime} - ${movedEndTime}`;

    const lectureClashConflictData = {
      Year: selectedYear,
      Semester: selectedSemester,
      Type: 'Lecture-Tutorial Clash',
      Description: `${conflict.tutorialCourse} (Tutorial ${
        conflict.tutorialOccNumber
          ? Array.isArray(conflict.tutorialOccNumber)
            ? `Occ ${conflict.tutorialOccNumber.join(", ")}`
            : `Occ ${conflict.tutorialOccNumber}`
          : ""
      }) clashes with ${conflict.lectureCourse} (Lecture ${
        conflict.lectureOccNumber
          ? Array.isArray(conflict.lectureOccNumber)
            ? `Occ ${conflict.lectureOccNumber.join(", ")}`
            : `Occ ${conflict.lectureOccNumber}`
          : ""
      }) for year level(s): ${conflict.yearLevels.join(', ')} in ${conflict.conflictingRoomCode} on ${targetDay} at ${conflict.timeSlot}`,
      CourseCode: item.code,
      Day: targetDay,
      StartTime: conflict.timeSlot,
      Priority: 'Medium',
      Status: 'Pending'
    };
    
    // try {
    //   await recordDragDropConflict(lectureClashConflictData);
    // } catch (error) {
    //   console.error("Failed to record lecture-tutorial clash conflict:", error);
    // }
  }
}

  // Display alert if conflicts are detected
  if (conflicts.length > 0) {
    let alertMessage = "The following conflicts were detected:\n\n";
    conflicts.forEach((conflict, index) => {
      if (conflict.type === 'Room Capacity') {
        alertMessage += `${index + 1}. Room Capacity Conflict: ${conflict.message}\n`;
      } else if (conflict.type === 'Room Double Booking') {
        alertMessage += `${index + 1}. Double Booking Conflict: ${item.code} (${item.raw.OccType}) ${
          item.raw.OccNumber
            ? Array.isArray(item.raw.OccNumber)
              ? `(Occ ${item.raw.OccNumber.join(", ")})`
              : `(Occ ${item.raw.OccNumber})`
            : ""
        } moved to ${conflict.roomCode} on ${targetDay} at ${conflict.timeSlot}, conflicts with ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.formattedOccNumber}\n`;
      } else if (conflict.type === 'Time Slot Exceeded') {
        alertMessage += `${index + 1}. Time Slot Exceeded: ${conflict.message}\n`;
      } else if (conflict.type === 'Instructor Conflict') {
        alertMessage += `${index + 1}. Instructor Conflict: ${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) (Occ ${conflict.movedCourseOccNumber}) in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${conflict.conflictingDay} at ${conflict.overlapTimeRange}\n`;
      } else if (conflict.type === 'Department Tutorial Clash') {
        alertMessage += `${index + 1}. Department Tutorial Clash: Department(s) ${conflict.departments.join(', ')} have conflicting tutorials - ${conflict.movedCourse} (Tutorial ${
          item.raw.OccNumber
            ? Array.isArray(item.raw.OccNumber)
              ? `Occ ${item.raw.OccNumber.join(", ")}`
              : `Occ ${item.raw.OccNumber}`
            : ""
        }) moved to ${targetRoomObj.code} conflicts with ${conflict.conflictingCourse} (${conflict.conflictingCourseType} ${
          conflict.conflictingOccNumber
            ? Array.isArray(conflict.conflictingOccNumber)
              ? `Occ ${conflict.conflictingOccNumber.join(", ")}`
              : `Occ ${conflict.conflictingOccNumber}`
            : ""
        }) in ${conflict.conflictingRoomCode} at ${conflict.timeSlot}\n`;
      } else if (conflict.type === 'Lecture-Tutorial Clash') {
        alertMessage += `${index + 1}. Lecture-Tutorial Clash: ${conflict.tutorialCourse} Tutorial ${
          conflict.tutorialOccNumber
            ? Array.isArray(conflict.tutorialOccNumber)
              ? `(Occ ${conflict.tutorialOccNumber.join(", ")})`
              : `(Occ ${conflict.tutorialOccNumber})`
            : ""
        } clashes with ${conflict.lectureCourse} Lecture ${
          conflict.lectureOccNumber
            ? Array.isArray(conflict.lectureOccNumber)
              ? `(Occ ${conflict.lectureOccNumber.join(", ")})`
              : `(Occ ${conflict.lectureOccNumber})`
            : ""
        } for Year ${conflict.yearLevels.join(', ')} students in ${conflict.conflictingRoomCode} at ${conflict.timeSlot}\n`;
      }
    });
    alertMessage += "\nThe move will still be performed, and conflicts will be recorded in the analytics section.";
    
    const confirmed = await showConfirm(
      alertMessage,
      "Conflicts Detected"
    );
    
    if (!confirmed) {
      return;
    }
  }

  // ALWAYS PERFORM THE MOVE (even with conflicts)
  // Remove the item from ALL slots it was occupying at the source
  const eventStartTime = item.raw.StartTime;
  const eventStartTimeIdx = TIMES.findIndex(t => t === eventStartTime);
  
  if (eventStartTimeIdx !== -1) {
    for (let i = 0; i < duration; i++) {
      if (eventStartTimeIdx + i < TIMES.length) {
        newTimetable[sourceDay][roomId][eventStartTimeIdx + i] = 
          newTimetable[sourceDay][roomId][eventStartTimeIdx + i].filter(
            it => it.id !== item.id
          );
      }
    }
  }

  // Update the event's start time and other details to match the new position
  const updatedEvent = {
    ...item,
    raw: {
      ...item.raw,
      StartTime: TIMES[targetTimeIdx],
      EndTime: targetTimeIdx + duration - 1 < TIMES.length 
        ? TIMES[targetTimeIdx + duration - 1].split(" - ")[1]
        : TIMES[TIMES.length - 1].split(" - ")[1],
      Day: targetDay,
      RoomID: targetRoom
    }
  };
  
  // Place the event ONLY in the starting time slot
  newTimetable[targetDay][targetRoom][targetTimeIdx].push(updatedEvent);
  
  setTimetable(newTimetable);
  setIsModified(true);
  setShowDaySelector(false);
  setContextItem(null);
  setSelectedDay(targetDay);
};

  const handleModalCancel = () => {
    setShowDaySelector(false);
    setContextItem(null);
    setOriginalEventElement(null); 
  };

const handleGenerateTimetable = async () => {
  setGenerating(true);
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      "https://atss-backend.onrender.com/home/generate-timetable",
      { year: selectedYear, semester: selectedSemester },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const { schedules, conflictsDetected, totalSchedules } = response.data;
    
    const newTimetable = {};
    DAYS.forEach(day => {
      newTimetable[day] = {};
      rooms.forEach(room => {
        newTimetable[day][room._id] = TIMES.map(() => []);
      });
    });

    schedules.forEach(sch => {
      const roomId = sch.RoomID;
      const timeIdx = TIMES.findIndex(t => t === sch.StartTime);
      const duration = sch.Duration || 1;
      
      if (roomId && timeIdx !== -1) {
        // ✅ FIX: Auto-assign instructor when there's only one available
        let selectedInstructor = "";
        let selectedInstructorId = "";
        
        const availableInstructors = sch.OriginalInstructors || sch.Instructors || [];
        
        // If there's exactly one instructor, auto-assign them
        if (Array.isArray(availableInstructors) && availableInstructors.length === 1) {
          selectedInstructor = availableInstructors[0];
          // Look up the instructor ID from the instructors list
          const foundInstructor = instructors.find(inst => inst.name === selectedInstructor);
          selectedInstructorId = foundInstructor ? foundInstructor._id : "";
          
          console.log(`Auto-assigned single instructor for ${sch.CourseCode}: ${selectedInstructor} (ID: ${selectedInstructorId})`);
        }
        // Otherwise, check if InstructorID was already set (from saved timetable)
        else if (sch.InstructorID) {
          selectedInstructorId = sch.InstructorID;
          const foundInstructor = instructors.find(inst => inst._id === sch.InstructorID);
          selectedInstructor = foundInstructor ? foundInstructor.name : "";
        }

        // Only place in the starting slot, let UI handle colspan for multi-hour events
        newTimetable[sch.Day][roomId][timeIdx].push({
          id: String(sch._id),
          code: sch.CourseCode,
          instructors: availableInstructors,
          selectedInstructor: selectedInstructor,
          selectedInstructorId: selectedInstructorId,
          raw: {
            ...sch,
            Duration: duration,
          },
        });
      }
    });

    // Update timetable state first
    setTimetable(newTimetable);
    setIsGenerated(true);
    setIsModified(true);

    // CLEAR EXISTING FRONTEND CONFLICTS BEFORE RECORDING NEW ONES
    try {
      await axios.delete(
        `https://atss-backend.onrender.com/analytics/clear-frontend-conflicts`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          data: { year: selectedYear, semester: selectedSemester }
        }
      );
      console.log("Cleared existing frontend conflicts after generation");
    } catch (clearError) {
      console.warn("Could not clear existing conflicts after generation:", clearError.message);
    }

    // DETECT AND RECORD FRONTEND CONFLICTS RIGHT AFTER GENERATION
    console.log("Detecting conflicts after timetable generation...");
    const conflictResults = detectAllConflicts(newTimetable, courses, rooms);
    const { summary } = conflictResults;
    
    // Update conflict summary in state
    setConflictSummary(summary);
    
    // Record frontend-detected conflicts if any exist
    if (summary.total > 0) {
      console.log(`Found ${summary.total} frontend conflicts after generation, recording them...`);
      await recordFrontendConflicts(conflictResults);
    }

    // Show appropriate success/warning message based on conflicts
    if (conflictsDetected || summary.total > 0) {
      const totalConflicts = summary.total;
      setGenerating(false);
      showAlert(
        `Timetable generated with ${totalSchedules} scheduled events.\n\n⚠️ ${totalConflicts} conflict${totalConflicts !== 1 ? 's' : ''} detected and recorded in the Analytics section. Please review the conflict reports for details.`,
        "warning",
        8000
      );
    } else {
      setGenerating(false);
      showAlert(
        `Timetable generated successfully with ${totalSchedules} scheduled events and no conflicts detected!`,
        "success"
      );
    }
    
  } catch (error) {
    setGenerating(false);
    showAlert("Failed to generate timetable.", "error");
    console.error(error);
  }
};

const generateConflictId = (conflict, conflictType) => {
  switch (conflictType) {
    case 'Room Capacity':
      // Handle both frontend-detected and database conflicts
      const capacityCourseCode = conflict.courseCode || conflict.CourseCode;
      const capacityRoomCode = conflict.roomCode || (rooms.find(r => r._id === conflict.RoomID)?.code) || 'Unknown';
      const capacityDay = conflict.day || conflict.Day;
      const capacityTime = conflict.time || conflict.StartTime;
      return `capacity_${capacityCourseCode}_${capacityRoomCode}_${capacityDay}_${capacityTime}`;
    
    case 'Room Double Booking':
      // For database conflicts, extract course codes from Description
      let sortedCourses;
      if (conflict.conflictingEvents) {
        // Frontend-detected conflict
        sortedCourses = conflict.conflictingEvents.map(e => e.courseCode).sort();
      } else if (conflict.Description) {
        // Database conflict - extract from description
        const courseMatches = conflict.Description.match(/[A-Z]{3}\d{4}(?:-\d+)?/g);
        if (courseMatches && courseMatches.length >= 2) {
          sortedCourses = [...new Set(courseMatches.slice(0, 2))].sort();
        } else {
          sortedCourses = [conflict.CourseCode, 'unknown'].sort();
        }
      } else {
        sortedCourses = [conflict.CourseCode || 'unknown', 'unknown'].sort();
      }
      
      const doubleRoomCode = conflict.roomCode || (rooms.find(r => r._id === conflict.RoomID)?.code) || 'Unknown';
      const doubleDay = conflict.day || conflict.Day;
      const doubleTime = conflict.time || conflict.StartTime;
      return `double_${sortedCourses.join('_')}_${doubleRoomCode}_${doubleDay}_${doubleTime}`;
    
    case 'Instructor Conflict':
      // For database conflicts, extract course codes from Description
      let sortedInstrCourses;
      if (conflict.conflictingEvents) {
        // Frontend-detected conflict
        sortedInstrCourses = conflict.conflictingEvents.map(e => e.courseCode).sort();
      } else if (conflict.Description) {
        // Database conflict - extract from description
        const instrCourseMatches = conflict.Description.match(/[A-Z]{3}\d{4}(?:-\d+)?/g);
        if (instrCourseMatches && instrCourseMatches.length >= 2) {
          sortedInstrCourses = [...new Set(instrCourseMatches.slice(0, 2))].sort();
        } else {
          sortedInstrCourses = [conflict.CourseCode, 'unknown'].sort();
        }
      } else {
        sortedInstrCourses = [conflict.CourseCode || 'unknown', 'unknown'].sort();
      }
      
      const instrId = conflict.instructorId || conflict.InstructorID;
      const instrDay = conflict.day || conflict.Day;
      const instrTime = conflict.timeRange || conflict.time || conflict.StartTime;
      return `instructor_${instrId}_${sortedInstrCourses.join('_')}_${instrDay}_${instrTime}`;
    
    case 'Time Slot Exceeded':
      const timeCourseCode = conflict.courseCode || conflict.CourseCode;
      const timeDay = conflict.day || conflict.Day;
      const timeStart = conflict.startTime || conflict.StartTime;
      return `timeslot_${timeCourseCode}_${timeDay}_${timeStart}`;

    case 'Department Tutorial Clash':
      // For database conflicts, extract from Description
      let sortedDeptCourses;
      let sortedDepts;
      
      if (conflict.conflictingEvents && conflict.departments) {
        // Frontend-detected conflict
        sortedDeptCourses = conflict.conflictingEvents.map(e => e.courseCode).sort();
        sortedDepts = conflict.departments.sort();
      } else if (conflict.Description) {
        // Database conflict - extract from description
        const deptCourseMatches = conflict.Description.match(/[A-Z]{3}\d{4}(?:-\d+)?/g);
        const deptMatch = conflict.Description.match(/Department\(s\)\s+(.+?)\s+have/);
        
        if (deptCourseMatches && deptCourseMatches.length >= 2) {
          sortedDeptCourses = [...new Set(deptCourseMatches.slice(0, 2))].sort();
        } else {
          sortedDeptCourses = [conflict.CourseCode, 'unknown'].sort();
        }
        
        if (deptMatch && deptMatch[1]) {
          sortedDepts = deptMatch[1].split(',').map(d => d.trim()).filter(d => d.length > 0).sort();
        } else {
          sortedDepts = ['unknown'];
        }
      } else {
        sortedDeptCourses = [conflict.CourseCode || 'unknown', 'unknown'].sort();
        sortedDepts = ['unknown'];
      }
      
      const deptDay = conflict.day || conflict.Day;
      const deptTime = conflict.time || conflict.StartTime;
      return `dept_clash_${sortedDepts.join('_')}_${sortedDeptCourses.join('_')}_${deptDay}_${deptTime}`;
    
    case 'Lecture-Tutorial Clash':
      // For database conflicts, extract from Description
      let sortedLTCourses;
      let sortedYears;
      let tutorialOcc = 'unknown';
      let lectureOcc = 'unknown';
      
      if (conflict.conflictingEvents && conflict.yearLevels) {
        // Frontend-detected conflict
        const tutorial = conflict.conflictingEvents.find(e => e.occType === 'Tutorial');
        const lecture = conflict.conflictingEvents.find(e => e.occType === 'Lecture');
        
        if (tutorial && lecture) {
          sortedLTCourses = [tutorial.courseCode, lecture.courseCode];
          sortedYears = conflict.yearLevels.sort();
          
          tutorialOcc = Array.isArray(tutorial.occNumber) 
            ? tutorial.occNumber.join('-') 
            : tutorial.occNumber || 'unknown';
          lectureOcc = Array.isArray(lecture.occNumber) 
            ? lecture.occNumber.join('-') 
            : lecture.occNumber || 'unknown';
        } else {
          sortedLTCourses = conflict.conflictingEvents.map(e => e.courseCode).sort();
          sortedYears = conflict.yearLevels.sort();
        }
      } else if (conflict.Description) {
        // Database conflict - extract from description
        const ltCourseMatches = conflict.Description.match(/[A-Z]{3}\d{4}(?:-\d+)?/g);
        const yearMatch = conflict.Description.match(/year level\(s\):\s*([\d,\s]+)/i);
        
        // Try to extract occurrence numbers from description
        // Format: "WIX2002 (Tutorial Occ 6) and WIA2001 (Lecture Occ 1)"
        const tutorialMatch = conflict.Description.match(/(\w+)\s*\(Tutorial\s+Occ\s+([\d,\s-]+)\)/i);
        const lectureMatch = conflict.Description.match(/(\w+)\s*\(Lecture\s+Occ\s+([\d,\s-]+)\)/i);
        
        if (tutorialMatch && lectureMatch) {
          sortedLTCourses = [tutorialMatch[1], lectureMatch[1]];
          tutorialOcc = tutorialMatch[2].replace(/[\s,]/g, '-');
          lectureOcc = lectureMatch[2].replace(/[\s,]/g, '-');
        } else if (ltCourseMatches && ltCourseMatches.length >= 2) {
          sortedLTCourses = [...new Set(ltCourseMatches.slice(0, 2))].sort();
        } else {
          sortedLTCourses = [conflict.CourseCode, 'unknown'].sort();
        }
        
        if (yearMatch && yearMatch[1]) {
          sortedYears = yearMatch[1].split(',').map(y => y.trim()).filter(y => y.length > 0).sort();
        } else {
          sortedYears = ['unknown'];
        }
      } else {
        sortedLTCourses = [conflict.CourseCode || 'unknown', 'unknown'].sort();
        sortedYears = ['unknown'];
      }
      
      const ltDay = conflict.day || conflict.Day;
      return `lecture-tutorial-${ltDay}-${sortedYears.join('-')}-${sortedLTCourses[0]}-Occ${tutorialOcc}-${sortedLTCourses[1]}-Occ${lectureOcc}`;
    
    default:
      return `unknown_${Date.now()}_${Math.random()}`;
  }
};

// Add a function to fetch existing ACTIVE conflicts from the backend
const fetchExistingActiveConflicts = async () => {
  try {
    const token = localStorage.getItem('token');
    
    // Fetch only active/pending conflicts, not resolved ones
    const response = await axios.get(
      `https://atss-backend.onrender.com/analytics/conflicts?year=${selectedYear}&semester=${selectedSemester}&status=active`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // Ensure we always return an array
    const data = response.data;
    console.log("Raw response from active conflicts API:", data);
    
    let conflicts = [];
    if (Array.isArray(data)) {
      conflicts = data;
    } else if (data && Array.isArray(data.conflicts)) {
      conflicts = data.conflicts;
    } else if (data && typeof data === 'object') {
      console.warn("Expected array but got object:", data);
      conflicts = [];
    } else {
      console.warn("Expected array but got:", typeof data, data);
      conflicts = [];
    }
    
    // Filter out resolved conflicts (in case backend doesn't support status filter)
    const activeConflicts = conflicts.filter(conflict => 
      conflict.Status !== 'Resolved' && 
      conflict.Status !== 'Closed' && 
      conflict.Status !== 'Dismissed'
    );
    
    console.log(`Found ${conflicts.length} total conflicts, ${activeConflicts.length} are active/pending`);
    return activeConflicts;
    
  } catch (error) {
    console.error("Error fetching existing active conflicts:", error);
    return [];
  }
};

// Modified handleSaveTimetable function
const handleSaveTimetable = async () => {
  try {
    const timetableArr = [];
    for (const day of DAYS) {
      Object.entries(timetable[day]).forEach(([roomId, slots]) => {
        slots.forEach((slot, timeIdx) => {
          slot.forEach(item => {
            if (item.raw && !timetableArr.some(s => s._id === item.raw._id)) {
              // IMPROVED: Better instructor handling in save
              let instructorsToSave = [];
              let instructorIdToSave = null;

              if (item.selectedInstructor && item.selectedInstructor.trim() !== "") {
                instructorsToSave = [item.selectedInstructor];
                instructorIdToSave = item.selectedInstructorId || null;
              } else if (item.instructors && Array.isArray(item.instructors)) {
                instructorsToSave = item.instructors;
              } else if (item.raw.OriginalInstructors) {
                instructorsToSave = item.raw.OriginalInstructors;
              }

              timetableArr.push({
  ...item.raw,
  RoomID: roomId,
  Day: day,
  StartTime: TIMES[timeIdx],
  EndTime: item.raw.EndTime || TIMES[Math.min(timeIdx + (item.raw.Duration || 1) - 1, TIMES.length - 1)].split(" - ")[1],
  Duration: item.raw.Duration || 1,
  Instructors: instructorsToSave,
  InstructorID: instructorIdToSave && instructorIdToSave.length === 24 ? instructorIdToSave : null,
  OriginalInstructors: item.instructors || item.raw.OriginalInstructors,
  // ✅ CRITICAL: Ensure these fields are preserved
  EstimatedStudents: item.raw.EstimatedStudents,
  Departments: item.raw.Departments,
  OccType: item.raw.OccType,
  OccNumber: item.raw.OccNumber,
});
            }
          });
        });
      });
    }

    const token = localStorage.getItem('token');
    
    // STEP 1: Fetch existing ACTIVE conflicts from the database (excluding resolved ones)
    console.log("Fetching existing active conflicts...");
    const existingActiveConflictsResponse = await fetchExistingActiveConflicts();
    
    // Ensure we have an array to work with
    const existingActiveConflicts = Array.isArray(existingActiveConflictsResponse) ? existingActiveConflictsResponse : [];
    console.log(`Found ${existingActiveConflicts.length} existing active conflicts`);
    
    // Create a set of existing ACTIVE conflict IDs for quick lookup
    const existingActiveConflictIds = new Set();
    
    if (existingActiveConflicts.length > 0) {
  existingActiveConflicts.forEach(conflict => {
    if (!conflict || !conflict.Type || 
        conflict.Status === 'Resolved' || 
        conflict.Status === 'Closed' || 
        conflict.Status === 'Dismissed') {
      return;
    }
    
    let conflictId;
    try {
      switch (conflict.Type) {
        case 'Room Capacity':
          conflictId = `capacity_${conflict.CourseCode}_${rooms.find(r => r._id === conflict.RoomID)?.code || 'Unknown'}_${conflict.Day}_${conflict.StartTime}`;
          break;
          
        case 'Room Double Booking':
          // CRITICAL FIX: Extract FULL course codes from description
          // Match patterns like "WIX2001-1", "WIX2001-2", or just "WIX2001"
          const courseMatches = conflict.Description ? 
            conflict.Description.match(/[A-Z]{3}\d{4}(?:-\d+)?/g) : null;
          
          if (courseMatches && courseMatches.length >= 2) {
            // Take first 2 unique course codes and sort
            const uniqueCourses = [...new Set(courseMatches.slice(0, 2))].sort();
            conflictId = `double_${uniqueCourses.join('_')}_${rooms.find(r => r._id === conflict.RoomID)?.code || 'Unknown'}_${conflict.Day}_${conflict.StartTime}`;
            
            console.log(`📋 Parsed existing Room Double Booking: ${uniqueCourses.join(' & ')} -> ID: ${conflictId}`);
          } else {
            conflictId = `double_unknown_${conflict.Day}_${conflict.StartTime}`;
          }
          break;
          
        case 'Instructor Conflict':
          // CRITICAL FIX: Extract FULL course codes from description
          const instrCourseMatches = conflict.Description ? 
            conflict.Description.match(/[A-Z]{3}\d{4}(?:-\d+)?/g) : null;
          
          if (instrCourseMatches && instrCourseMatches.length >= 2) {
            // Take first 2 unique course codes and sort
            const uniqueInstrCourses = [...new Set(instrCourseMatches.slice(0, 2))].sort();
            conflictId = `instructor_${conflict.InstructorID}_${uniqueInstrCourses.join('_')}_${conflict.Day}_${conflict.StartTime}`;
            
            console.log(`📋 Parsed existing Instructor Conflict: ${uniqueInstrCourses.join(' & ')} -> ID: ${conflictId}`);
          } else {
            conflictId = `instructor_${conflict.InstructorID}_unknown_${conflict.Day}_${conflict.StartTime}`;
          }
          break;
          
        case 'Time Slot Exceeded':
          conflictId = `timeslot_${conflict.CourseCode}_${conflict.Day}_${conflict.StartTime}`;
          break;

        case 'Department Tutorial Clash':
  // Extract course codes and departments from description
  const deptCourseMatches = conflict.Description ? 
    conflict.Description.match(/[A-Z]{3}\d{4}(?:-\d+)?/g) : null;
  
  const deptMatch = conflict.Description ? 
    conflict.Description.match(/Department\(s\) ([^have]+) have/) : null;
  
  if (deptCourseMatches && deptCourseMatches.length >= 2 && deptMatch) {
    const uniqueDeptCourses = [...new Set(deptCourseMatches.slice(0, 2))].sort();
    const departments = deptMatch[1].split(',').map(d => d.trim()).sort();
    
    conflictId = `dept_clash_${departments.join('_')}_${uniqueDeptCourses.join('_')}_${conflict.Day}_${conflict.StartTime}`;
    
    console.log(`📋 Parsed existing Department Tutorial Clash: ${departments.join(', ')} - ${uniqueDeptCourses.join(' & ')} -> ID: ${conflictId}`);
  } else {
    conflictId = `dept_clash_unknown_${conflict.Day}_${conflict.StartTime}`;
  }
  break;
          
        default:
          conflictId = `existing_${conflict._id}`;
      }
      
      if (conflictId) {
        existingActiveConflictIds.add(conflictId);
        console.log(`✅ Active conflict ID: ${conflictId}`);
      }
    } catch (err) {
      console.error("Error processing existing active conflict:", conflict, err);
    }
  });
}

console.log(`Generated ${existingActiveConflictIds.size} existing active conflict IDs`)



    // STEP 2: Detect current conflicts
    console.log("Detecting current conflicts...");
    const conflictResults = detectAllConflicts(timetable, courses, rooms);
    
    console.log("=== SAVE: CONFLICT RESULTS ===");
    console.log("Conflict Summary:", conflictResults.summary);
    
    let newConflictsCount = 0;
    
    if (conflictResults.summary.total > 0) {
      console.log(`Checking ${conflictResults.summary.total} detected conflicts for new ones...`);
      
      // STEP 3: Check Room Capacity Conflicts for new ones
      for (const conflict of conflictResults.details.roomCapacity) {
        const conflictId = generateConflictId(conflict, 'Room Capacity');
        
        if (!existingActiveConflictIds.has(conflictId)) {
          const conflictData = {
            Year: selectedYear,
            Semester: selectedSemester,
            Type: 'Room Capacity',
            Description: `Room capacity exceeded: ${conflict.courseCode} (${conflict.occType}${conflict.occNumber ? ` Occ ${Array.isArray(conflict.occNumber) ? conflict.occNumber.join(', ') : conflict.occNumber}` : ''}) requires ${conflict.requiredCapacity} seats but ${conflict.roomCode} only has ${conflict.roomCapacity}`,
            CourseCode: conflict.courseCode,
            RoomID: rooms.find(r => r.code === conflict.roomCode)?._id || null,
            Day: conflict.day,
            StartTime: conflict.time,
            Priority: 'High',
            Status: 'Pending'
          };
          
          try {
            await recordDragDropConflict(conflictData);
            newConflictsCount++;
            console.log(`NEW Room Capacity Conflict: ${conflictId}`);
          } catch (error) {
            console.error("Failed to record new room capacity conflict:", error);
          }
        } else {
          console.log(`EXISTING ACTIVE Room Capacity Conflict: ${conflictId}`);
        }
      }

      // STEP 4: Check Room Double Booking Conflicts for new ones
      for (const conflict of conflictResults.details.roomDoubleBooking) {
  const conflictId = generateConflictId(conflict, 'Room Double Booking');
  
  if (!existingActiveConflictIds.has(conflictId)) {
    // ✅ FIX: Use conflict.time which already contains the full overlap range
    // The detectAllConflicts function already calculates this correctly
    const timeRange = conflict.time; // This is already the full range like "4.00 PM - 5.00 PM"
    
    const conflictData = {
      Year: selectedYear,
      Semester: selectedSemester,
      Type: 'Room Double Booking',
      Description: `Room double booking detected: ${conflict.conflictingEvents.map(e => 
        `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''})`
      ).join(' and ')} in ${conflict.roomCode} on ${conflict.day} at ${timeRange}`,
      CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
      RoomID: rooms.find(r => r.code === conflict.roomCode)?._id || null,
      Day: conflict.day,
      StartTime: timeRange, // ✅ CRITICAL: Use the full time range, not just conflict.time
      Priority: 'High',
      Status: 'Pending'
    };
    
    try {
      await recordDragDropConflict(conflictData);
      newConflictsCount++;
      console.log(`NEW Room Double Booking Conflict: ${conflictId}`);
    } catch (error) {
      console.error("Failed to record new room double booking conflict:", error);
    }
  } else {
    console.log(`EXISTING ACTIVE Room Double Booking Conflict: ${conflictId}`);
  }
}

      // STEP 5: Check Instructor Conflicts for new ones
      for (const conflict of conflictResults.details.instructorConflict) {
        const conflictId = generateConflictId(conflict, 'Instructor Conflict');
        
        if (!existingActiveConflictIds.has(conflictId)) {
          const conflictTimeRange = conflict.timeRange || conflict.time;
          
          const conflictData = {
            Year: selectedYear,
            Semester: selectedSemester,
            Type: 'Instructor Conflict',
            Description: `Instructor conflict: ${conflict.instructorName} assigned to multiple events (${conflict.conflictingEvents.map(e => 
              `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''}) in ${e.roomCode}`
            ).join(' and ')}) on ${conflict.day} at ${conflictTimeRange}`,
            CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
            InstructorID: conflict.instructorId,
            Day: conflict.day,
            StartTime: conflictTimeRange,
            Priority: 'High',
            Status: 'Pending'
          };
          
          try {
            await recordDragDropConflict(conflictData);
            newConflictsCount++;
            console.log(`NEW Instructor Conflict: ${conflictId}`);
          } catch (error) {
            console.error("Failed to record new instructor conflict:", error);
          }
        } else {
          console.log(`EXISTING ACTIVE Instructor Conflict: ${conflictId}`);
        }
      }

      // STEP 6: Check Time Slot Exceeded Conflicts for new ones
      for (const conflict of conflictResults.details.timeSlotExceeded) {
        const conflictId = generateConflictId(conflict, 'Time Slot Exceeded');
        
        if (!existingActiveConflictIds.has(conflictId)) {
          const conflictData = {
            Year: selectedYear,
            Semester: selectedSemester,
            Type: 'Time Slot Exceeded',
            Description: `Time slot exceeded: ${conflict.courseCode} (${conflict.occType}${conflict.occNumber ? ` Occ ${Array.isArray(conflict.occNumber) ? conflict.occNumber.join(', ') : conflict.occNumber}` : ''}) extends beyond available time slots (requires ${conflict.duration} hours but only ${conflict.availableSlots} slots available)`,
            CourseCode: conflict.courseCode,
            Day: conflict.day,
            StartTime: conflict.startTime,
            Priority: 'Medium',
            Status: 'Pending'
          };
          
          try {
            await recordDragDropConflict(conflictData);
            newConflictsCount++;
            console.log(`NEW Time Slot Exceeded Conflict: ${conflictId}`);
          } catch (error) {
            console.error("Failed to record new time slot exceeded conflict:", error);
          }
        } else {
          console.log(`EXISTING ACTIVE Time Slot Exceeded Conflict: ${conflictId}`);
        }
      }

      // STEP 7: NEW - Check Department Tutorial Clash Conflicts for new ones
      for (const conflict of conflictResults.details.departmentTutorialClash) {
        const conflictId = generateConflictId(conflict, 'Department Tutorial Clash');
        
        if (!existingActiveConflictIds.has(conflictId)) {
          const conflictData = {
            Year: selectedYear,
            Semester: selectedSemester,
            Type: 'Department Tutorial Clash',
            Description: `Department(s) ${conflict.departments.join(', ')} have conflicting tutorials: ${conflict.conflictingEvents.map(e => 
              `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''})`
            ).join(' and ')} on ${conflict.day} at ${conflict.time}`,
            CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
            Day: conflict.day,
            StartTime: conflict.time,
            Priority: 'High',
            Status: 'Pending'
          };
          
          try {
            await recordDragDropConflict(conflictData);
            newConflictsCount++;
            console.log(`NEW Department Tutorial Clash Conflict: ${conflictId}`);
          } catch (error) {
            console.error("Failed to record new department tutorial clash conflict:", error);
          }
        } else {
          console.log(`EXISTING ACTIVE Department Tutorial Clash Conflict: ${conflictId}`);
        }
      }
      
      // STEP 6b: Check Lecture-Tutorial Clash Conflicts for new ones
      for (const conflict of conflictResults.details.lectureTutorialClash) {
        const conflictId = generateConflictId(conflict, 'Lecture-Tutorial Clash');
        
        if (!existingActiveConflictIds.has(conflictId)) {
          const conflictData = {
            Year: selectedYear,
            Semester: selectedSemester,
            Type: 'Lecture-Tutorial Clash',
            Description: `Lecture-Tutorial Clash: ${conflict.conflictingEvents.map(e => 
              `${e.courseCode} (${e.occType}${e.occNumber ? ` Occ ${Array.isArray(e.occNumber) ? e.occNumber.join(', ') : e.occNumber}` : ''})`
            ).join(' and ')} for year level(s): ${conflict.yearLevels.join(', ')} on ${conflict.day} at ${conflict.time}`,
            CourseCode: conflict.conflictingEvents[0]?.courseCode || 'Multiple',
            Day: conflict.day,
            StartTime: conflict.time,
            Priority: 'Medium',
            Status: 'Pending'
          };
          
          try {
            await recordDragDropConflict(conflictData);
            newConflictsCount++;
            console.log(`NEW Lecture-Tutorial Clash Conflict: ${conflictId}`);
          } catch (error) {
            console.error("Failed to record new lecture-tutorial clash conflict:", error);
          }
        } else {
          console.log(`EXISTING ACTIVE Lecture-Tutorial Clash Conflict: ${conflictId}`);
        }
      }
      
      console.log(`Successfully recorded ${newConflictsCount} new conflicts. ${existingActiveConflicts.length} existing active conflicts were preserved.`);
    }

    // STEP 7: Save the timetable
    await axios.post(
      "https://atss-backend.onrender.com/home/save-timetable",
      { year: selectedYear, semester: selectedSemester, timetable: timetableArr },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // STEP 8: Show appropriate message based on conflicts
    if (conflictResults.summary.total > 0) {
      if (newConflictsCount > 0) {
        showAlert(
          `Timetable saved successfully!\n\n${newConflictsCount} new conflict${newConflictsCount !== 1 ? 's' : ''} detected and recorded.`,
          "warning",
          6000
        );
      } else {
        // showAlert(
        //   `Timetable saved successfully!\n\nNo new conflicts detected. ${existingActiveConflicts.length} existing active conflicts were preserved.`,
        //   "success"
        // );
        showAlert(
          `Timetable saved successfully!`,
          "success"
        );
      }
    } else {
      if (existingActiveConflicts.length > 0) {
        // showAlert(
        //   `Timetable saved successfully!\n\nAll conflicts have been resolved! Previously there were ${existingActiveConflicts.length} active conflicts.`,
        //   "success"
        // );
        showAlert(
          `Timetable saved successfully!`,
          "success"
        );
      } else {
        showAlert("Timetable saved to database with no conflicts!", "success");
      }
    }
    
    setIsModified(false);
    setIsGenerated(true);
  } catch (error) {
    showAlert("Failed to save timetable.", "error");
    console.error(error);
  }
};

  const handleExportTimetable = async (format) => {
  if (!timetable || Object.keys(timetable).length === 0) {
    showAlert("No timetable data available to export.", "warning");
    return;
  }

  if (format === "csv") {
    const csvData = [];
    const headers = ["Day", "Time Slot", "End Time", "Duration (Hours)", "Room Code", "Room Capacity", "Course Code", "Occurrence Type", "Occurrence Number", "Departments", "Estimated Students", "Instructors"];
    csvData.push(headers);

    const exportedEvents = new Set();

    DAYS.forEach(day => {
      Object.entries(timetable[day] || {}).forEach(([roomId, slots]) => {
        const room = rooms.find(r => r._id === roomId);
        const roomCode = room ? room.code : "Unknown";
        const roomCapacity = room && room.capacity ? room.capacity : "N/A";

        slots.forEach((slot, timeIdx) => {
          slot.forEach(item => {
            if (item && item.raw && !exportedEvents.has(item.id) && isEventMatchingAllFilters(item)) {
              exportedEvents.add(item.id);
              
              let instructorName = "No Instructor Assigned";
              
              if (item.selectedInstructor && item.selectedInstructor.trim() !== "") {
                instructorName = item.selectedInstructor;
              } else if (item.selectedInstructorId && item.selectedInstructorId.trim() !== "") {
                const foundInstructor = instructors.find(inst => inst._id === item.selectedInstructorId);
                if (foundInstructor) {
                  instructorName = foundInstructor.name;
                }
              } else if (item.raw.Instructors && Array.isArray(item.raw.Instructors) && item.raw.Instructors.length === 1) {
                instructorName = item.raw.Instructors[0];
              } else if (item.raw.OriginalInstructors && Array.isArray(item.raw.OriginalInstructors) && item.raw.OriginalInstructors.length === 1) {
                instructorName = item.raw.OriginalInstructors[0];
              }

              // ✅ FIX: Properly extract departments
              const departments = item.raw.Departments && Array.isArray(item.raw.Departments) && item.raw.Departments.length > 0
                ? item.raw.Departments.join(", ")
                : "N/A";

              csvData.push([
                day,
                TIMES[timeIdx],
                item.raw.EndTime || TIMES[Math.min(timeIdx + (item.raw.Duration || 1) - 1, TIMES.length - 1)].split(" - ")[1],
                item.raw.Duration || 1,
                roomCode,
                roomCapacity,
                item.code || "N/A",
                item.raw.OccType || "N/A",
                Array.isArray(item.raw.OccNumber) ? item.raw.OccNumber.join(", ") : item.raw.OccNumber || "N/A",
                departments,  // ✅ Now properly included
                item.raw.EstimatedStudents || "N/A",
                instructorName,
              ]);
            }
          });
        });
      });
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Update filename to include filter info
    let filterSuffix = "";
    if (searchQuery.trim()) {
      filterSuffix += `_${searchQuery.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    if (!selectedStudentYears.includes("All")) {
      filterSuffix += `_Year${selectedStudentYears.join('_')}`;
    }
    
    const filename = `timetable_${selectedYear.replace("/", "-")}_sem${selectedSemester}_all_days${filterSuffix}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Image export logic - ALSO FIXED for filtering
    if (!allDaysTableRef.current) {
      showAlert("All days table element not found.", "error");
      return;
    }

    const allDaysTable = document.createElement("table");
    allDaysTable.style.width = "100%";
    allDaysTable.style.borderCollapse = "collapse";
    allDaysTable.style.position = "absolute";
    allDaysTable.style.top = "-9999px";

    const mainHeader = document.createElement("thead");
    const mainHeaderRow = document.createElement("tr");
    const mainHeaderCell = document.createElement("th");
    mainHeaderCell.colSpan = TIMES.length + 1;
    mainHeaderCell.style.padding = "15px";
    mainHeaderCell.style.textAlign = "center";
    mainHeaderCell.style.background = "#015551";
    mainHeaderCell.style.color = "#fff";
    mainHeaderCell.style.fontSize = "18px";
    
    // Update header to show filter info
    let headerText = `Timetable - ${selectedYear}, Semester ${selectedSemester}`;
    if (searchQuery.trim()) {
      headerText += ` (Course: ${searchQuery})`;
    }
    if (!selectedStudentYears.includes("All")) {
      headerText += ` (Year ${selectedStudentYears.join(", ")})`;
    }
    mainHeaderCell.textContent = headerText;
    
    mainHeaderRow.appendChild(mainHeaderCell);
    mainHeader.appendChild(mainHeaderRow);
    allDaysTable.appendChild(mainHeader);

    DAYS.forEach(day => {
      // Check if this day has any filtered events before creating the day section
      let dayHasFilteredEvents = false;
      rooms.forEach(room => {
        const daySlots = timetable[day][room._id] || [];
        daySlots.forEach(slot => {
          slot.forEach(event => {
            if (isEventMatchingAllFilters(event)) {
              dayHasFilteredEvents = true;
            }
          });
        });
      });

      // Only create day section if there are filtered events
      if (!dayHasFilteredEvents) return;

      const dayHeader = document.createElement("thead");
      const dayHeaderRow = document.createElement("tr");
      const dayHeaderCell = document.createElement("th");
      dayHeaderCell.colSpan = TIMES.length + 1;
      dayHeaderCell.style.padding = "10px";
      dayHeaderCell.style.textAlign = "center";
      dayHeaderCell.style.background = "#e2e8f0";
      dayHeaderCell.style.fontSize = "16px";
      dayHeaderCell.style.fontWeight = "bold";
      dayHeaderCell.textContent = `${day} Timetable`;
      dayHeaderRow.appendChild(dayHeaderCell);
      dayHeader.appendChild(dayHeaderRow);
      allDaysTable.appendChild(dayHeader);

      const timeHeader = document.createElement("thead");
      const timeHeaderRow = document.createElement("tr");
      const roomHeader = document.createElement("th");
      roomHeader.style.textAlign = "left";
      roomHeader.style.padding = "8px 12px";
      roomHeader.style.border = "1px solid #ccc";
      roomHeader.style.background = "#f8f8f8";
      roomHeader.textContent = "Room (Capacity)";
      timeHeaderRow.appendChild(roomHeader);
      TIMES.forEach((time, idx) => {
        const timeHeaderCell = document.createElement("th");
        timeHeaderCell.style.textAlign = "center";
        timeHeaderCell.style.padding = "8px 10px";
        timeHeaderCell.style.border = "1px solid #ccc";
        timeHeaderCell.style.background = "#f8f8f8";
        timeHeaderCell.textContent = time;
        timeHeaderRow.appendChild(timeHeaderCell);
      });
      timeHeader.appendChild(timeHeaderRow);
      allDaysTable.appendChild(timeHeader);

      const tbody = document.createElement("tbody");
      rooms.forEach((room) => {
        const daySlots = timetable[day][room._id] || [];
        
        // Step 1: Build lanes but only with filtered events
        const lanes = [];

        for (let timeIdx = 0; timeIdx < TIMES.length; timeIdx++) {
          const slotEvents = daySlots[timeIdx] || [];
          slotEvents.forEach(event => {
            // CRITICAL: Only include events that match the current filters
            if (!isEventMatchingAllFilters(event)) return;
            
            const duration = event.raw?.Duration || 1;

            // Find first lane that is free for this event's entire duration
            let placed = false;
            for (let lane of lanes) {
              let canPlace = true;
              for (let d = 0; d < duration; d++) {
                if (lane[timeIdx + d]) {
                  canPlace = false;
                  break;
                }
              }
              if (canPlace) {
                for (let d = 0; d < duration; d++) {
                  lane[timeIdx + d] = event;
                }
                placed = true;
                break;
              }
            }

            // If no lane found, create a new one
            if (!placed) {
              const newLane = Array(TIMES.length).fill(null);
              for (let d = 0; d < duration; d++) {
                newLane[timeIdx + d] = event;
              }
              lanes.push(newLane);
            }
          });
        }

        // Skip rooms that have no filtered events
        if (lanes.length === 0) return;

        const maxLanes = lanes.length;

        // Step 2: Render each lane row
        for (let laneIdx = 0; laneIdx < maxLanes; laneIdx++) {
          const row = document.createElement("tr");

          // First lane gets the room cell
          if (laneIdx === 0) {
            const roomCell = document.createElement("td");
            roomCell.rowSpan = maxLanes;
            roomCell.style.padding = "8px 12px";
            roomCell.style.border = "1px solid #ccc";
            roomCell.style.fontWeight = "600";
            roomCell.innerHTML = `${room.code} ${room.capacity ? `(${room.capacity})` : ""}<br /><span style="font-weight: 400; font-size: 13px; color: #555">${room.building || room.block}</span>`;
            row.appendChild(roomCell);
          }

          let timeIdx = 0;
          while (timeIdx < TIMES.length) {
            const event = lanes[laneIdx]?.[timeIdx];

            if (event) {
              const duration = event.raw?.Duration || 1;
              const cell = document.createElement("td");
              cell.colSpan = duration;
              cell.style.border = "1px solid #ccc";
              cell.style.height = `${48 * duration}px`;

              const div = document.createElement("div");
              div.style.padding = "6px 10px";
              div.style.minHeight = `${32 * duration}px`;
              div.style.backgroundColor = event.raw.OccType === "Lecture" ? "#e2e8f0" : "#d4f4e2";
              div.style.borderRadius = "6px";
              div.style.fontWeight = "500";
              div.style.fontSize = "15px";

              // ✅ FIX: Add departments to the display
              const departments = event.raw.Departments && Array.isArray(event.raw.Departments) && event.raw.Departments.length > 0
                ? event.raw.Departments.join(", ")
                : "";

              const departmentDisplay = departments ? `<div style="font-size: 12px; color: #666;">${departments}</div>` : "";

              div.innerHTML = `
                <div><strong>${event.code} (${event.raw.OccType})${duration > 1 ? ` (${duration}h)` : ""}</strong></div>
                <div style="font-size: 13px">
                  ${event.raw.OccNumber ? (Array.isArray(event.raw.OccNumber) ? `(Occ ${event.raw.OccNumber.join(", ")})` : `(Occ ${event.raw.OccNumber})`) : ""} 
                  ${event.selectedInstructor || "No Instructor Assigned"}
                </div>
                ${departmentDisplay}
              `;

              cell.appendChild(div);
              row.appendChild(cell);

              timeIdx += duration;
            } else {
              const emptyCell = document.createElement("td");
              emptyCell.style.border = "1px solid #ccc";
              emptyCell.style.height = "48px";
              row.appendChild(emptyCell);
              timeIdx++;
            }
          }

          tbody.appendChild(row);
        }
      });

      allDaysTable.appendChild(tbody);
    });

    document.body.appendChild(allDaysTable);

    try {
      const canvas = await html2canvas(allDaysTable, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: allDaysTable.scrollWidth,
        height: allDaysTable.scrollHeight,
      });

      document.body.removeChild(allDaysTable);

      const imageType = format === "png" ? "image/png" : "image/jpeg";
      const imageQuality = format === "png" ? 1 : 0.8;
      const imageData = canvas.toDataURL(imageType, imageQuality);
      const link = document.createElement("a");
      
      // Update filename to include filter info
      let filterSuffix = "";
      if (searchQuery.trim()) {
        filterSuffix += `_${searchQuery.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      if (!selectedStudentYears.includes("All")) {
        filterSuffix += `_Year${selectedStudentYears.join('_')}`;
      }
      
      const filename = `timetable_${selectedYear.replace("/", "-")}_sem${selectedSemester}_all_days${filterSuffix}.${format}`;
      link.href = imageData;
      link.download = filename;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Error exporting timetable as image:", error);
      showAlert("Failed to export timetable as image.", "error");
      document.body.removeChild(allDaysTable);
    }
  }
};

  const handleDayChange = (e) => {
    setSelectedDay(e.target.value);
  };

  const calculateModalPosition = () => {
  if (!exportButtonRef.current) return { x: 0, y: 0 };
  
  const buttonRect = exportButtonRef.current.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  const modalWidth = 250;
  const modalHeight = 120;
  
  // Position below the button by default
  let x = buttonRect.left + scrollX;
  let y = buttonRect.bottom + scrollY + 8;
  
  // Adjust if modal would go off the right edge
  if (buttonRect.left + modalWidth > window.innerWidth) {
    x = buttonRect.right + scrollX - modalWidth;
  }
  
  // Adjust if modal would go off the bottom edge
  const bottomSpace = window.innerHeight - buttonRect.bottom;
  if (bottomSpace < modalHeight + 15) {
    y = buttonRect.top + scrollY - modalHeight - 8;
  }
  
  return { x, y };
};

  const handleExportClick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Get the export button's position
  const buttonRect = e.currentTarget.getBoundingClientRect();
  const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
  
  // Calculate modal position relative to the container (not the viewport)
  const modalWidth = 250;
  const modalHeight = 120;
  
  // Position relative to container, not viewport
  let x = buttonRect.left - containerRect.left;
  let y = buttonRect.bottom - containerRect.top + 8; // 8px gap below button
  
  // Adjust if modal would go off the right edge of the container
  const containerWidth = containerRef.current?.offsetWidth || window.innerWidth;
  if (x + modalWidth > containerWidth) {
    x = buttonRect.right - containerRect.left - modalWidth;
  }
  
  // Keep modal within container bounds
  if (x < 15) {
    x = 15;
  }
  
  // Adjust if modal would go off the bottom edge of the container
  const containerHeight = containerRef.current?.offsetHeight || window.innerHeight;
  if (y + modalHeight > containerHeight) {
    y = buttonRect.top - containerRect.top - modalHeight - 8; // Position above button instead
    if (y < 15) {
      y = 15;
    }
  }
  
  setExportModalPosition({ x, y });
  setShowExportModal(true);
};

  const handleExportConfirm = () => {
    handleExportTimetable(selectedExportFormat);
    setShowExportModal(false);
  };

  const handleExportCancel = () => {
    setShowExportModal(false);
  };

  const ConflictIndicator = ({ conflictSummary, onViewDetails, isModified }) => {
  if (conflictSummary.total === 0) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        background: "#d4edda",
        border: "1px solid #c3e6cb",
        borderRadius: 6,
        color: "#155724",
        fontSize: 14,
        fontWeight: 500
      }}>
        <span style={{ color: "#28a745", fontSize: 16 }}>✓</span>
        No conflicts detected
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 16px",
      background: "#f8d7da",
      border: "1px solid #f5c6cb",
      borderRadius: 6,
      color: "#721c24",
      fontSize: 14
    }}>
      <span style={{ color: "#dc3545", fontSize: 16, fontWeight: "bold" }}>⚠</span>
      <div>
        <span style={{ fontWeight: 600 }}>
          {conflictSummary.total} conflict{conflictSummary.total !== 1 ? 's' : ''} detected
        </span>
        {isModified && (
          <div style={{ 
            fontSize: 12, 
            color: "#856404", 
            marginTop: 2,
            fontStyle: "italic"
          }}>
            Save changes to view details
          </div>
        )}
      </div>
      {onViewDetails && (
        <div style={{ position: "relative", marginLeft: "auto" }}>
          <button
            onClick={isModified ? undefined : onViewDetails}
            disabled={isModified}
            style={{
              background: isModified ? "#6c757d" : "#015551",
              color: "#fff",
              border: "none",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              cursor: isModified ? "not-allowed" : "pointer",
              opacity: isModified ? 0.6 : 1,
              transition: "all 0.2s ease"
            }}
            title={isModified ? "Please save your changes before viewing conflict details" : "View conflict details"}
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
};

  return (
    <ProtectedRoute>
      <SideBar>
        <div style={{ maxWidth: 1700, margin: "0 auto 0 auto", padding: "0 10px 0 30px", paddingLeft: "10px" }}>
          <h2 className="fw-bold mb-4">Timetable</h2>
          <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  }}
>
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <select
      className='form-select'
      style={{ width: 130, borderRadius: 8 }}
      value={selectedDay}
      onChange={handleDayChange}
    >
      {DAYS.map(day => (
        <option key={day} value={day}>{day}</option>
      ))}
    </select>
    
    {/* Search Input */}
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <BiSearch 
          style={{ 
            position: "absolute", 
            left: 10, 
            fontSize: 18, 
            color: "#666", 
            zIndex: 1 
          }} 
        />
        <input
          type="text"
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: 200,
            padding: "8px 35px 8px 35px",
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 14
          }}
        />
        {searchQuery && (
          <BiX 
            onClick={() => setSearchQuery("")}
            style={{ 
              position: "absolute", 
              right: 10, 
              fontSize: 18, 
              color: "#666", 
              cursor: "pointer",
              zIndex: 1
            }} 
          />
        )}
      </div>
      
      {/* Search Dropdown */}
      {showSearchDropdown && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#fff",
          border: "1px solid #ddd",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          maxHeight: "200px",
          overflowY: "auto",
          zIndex: 1000,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          {filteredCourses.map(course => (
            <div
              key={course}
              onClick={() => {
                setSearchQuery(course);
                setShowSearchDropdown(false);
              }}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #f0f0f0"
              }}
              onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
              onMouseLeave={(e) => e.target.style.background = "#fff"}
            >
              {course}
            </div>
          ))}
        </div>
      )}
    </div>
    <ConflictIndicator 
  conflictSummary={conflictSummary}
  isModified={isModified}
  onViewDetails={() => {
    navigate(`/analytics?tab=conflicts&year=${selectedYear}&semester=${selectedSemester}`);
  }}
/>
  </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <select
      className='form-select'
      style={{ width: 130, borderRadius: 8 }}
      value={selectedYear}
      onChange={e => setSelectedYear(e.target.value)}
    >
      <option value="" disabled>Academic Year</option>
      {/* <option value="2024/2025">2024/2025</option> */}
      <option value="2025/2026">2025/2026</option>
      <option value="2026/2027">2026/2027</option>
      <option value="2027/2028">2027/2028</option>
      <option value="2028/2029">2028/2029</option>
      <option value="2029/2030">2029/2030</option>
      <option value="2030/2031">2030/2031</option>
    </select>
    <select
      className='form-select'
      style={{ width: 140, borderRadius: 8 }}
      value={selectedSemester}
      onChange={e => setSelectedSemester(e.target.value)}
    >
      <option value="1">Semester 1</option>
      <option value="2">Semester 2</option>
    </select>
    <div style={{ position: "relative" }} data-dropdown="year-filter">
  <div
    onClick={() => setShowYearDropdown(!showYearDropdown)}
    style={{
      width: 140,
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid #ced4da",
      background: "#fff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: 14,
      fontFamily: 'inherit',
      lineHeight: '1.5'
    }}
  >
    <span>
      {selectedStudentYears.includes("All") 
        ? "All Years" 
        : selectedStudentYears.length === 1 
        ? `Year ${selectedStudentYears[0]}`
        : `${selectedStudentYears.length} Years Selected`
      }
    </span>
    <span style={{ 
      transform: showYearDropdown ? "rotate(180deg)" : "rotate(0deg)", 
      transition: "transform 0.2s ease",
      fontSize: 10,
      color: "#666"
    }}>
      ▼
    </span>
  </div>
  
  {showYearDropdown && (
    <div style={{
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      background: "#fff",
      border: "1px solid #ced4da",
      borderTop: "none",
      borderRadius: "0 0 8px 8px",
      zIndex: 1000,
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      maxHeight: "200px",
      overflowY: "auto"
    }}>
      {[
        { value: "All", label: "All Years" },
        { value: "1", label: "Year 1" },
        { value: "2", label: "Year 2" },
        { value: "3", label: "Year 3" },
        { value: "4", label: "Year 4" }
      ].map((option) => (
        <div
          key={option.value}
          onClick={(e) => {
            e.stopPropagation();
            
            if (option.value === "All") {
              setSelectedStudentYears(["All"]);
              setShowYearDropdown(false);
            } else {
              let newSelection;
              if (selectedStudentYears.includes(option.value)) {
                // Remove if already selected
                newSelection = selectedStudentYears.filter(y => y !== option.value && y !== "All");
                if (newSelection.length === 0) {
                  newSelection = ["All"];
                }
              } else {
                // Add to selection
                newSelection = selectedStudentYears.includes("All") 
                  ? [option.value]
                  : [...selectedStudentYears.filter(y => y !== "All"), option.value];
              }
              setSelectedStudentYears(newSelection);
            }
          }}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            background: selectedStudentYears.includes(option.value) ? "#f8f9fa" : "#fff"
          }}
          onMouseEnter={(e) => {
            if (!selectedStudentYears.includes(option.value)) {
              e.target.style.background = "#f5f5f5";
            }
          }}
          onMouseLeave={(e) => {
            if (!selectedStudentYears.includes(option.value)) {
              e.target.style.background = "#fff";
            }
          }}
        >
          <div style={{
            width: 16,
            height: 16,
            border: "2px solid #ddd",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: selectedStudentYears.includes(option.value) ? "#015551" : "#fff",
            borderColor: selectedStudentYears.includes(option.value) ? "#015551" : "#ddd"
          }}>
            {selectedStudentYears.includes(option.value) && (
              <span style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>✓</span>
            )}
          </div>
          <span>{option.label}</span>
        </div>
      ))}
    </div>
  )}
</div>
    <button
      ref={exportButtonRef}
      disabled={!timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 24px",
        borderRadius: 8,
        background: (!timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? "#ccc" : "#015551",
        fontWeight: 500,
        fontSize: 16,
        color: "#fff",
        cursor: (!timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? "not-allowed" : "pointer",
        opacity: (!timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? 0.6 : 1
      }}
      onClick={handleExportClick}
      title={(!timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? "Generate a timetable first to enable export" : "Export timetable"}
    >
      <BiExport style={{ fontSize: 20}} />
      Export
    </button>
  </div>
</div>
          <div 
          ref={containerRef} // Add this ref
          style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            padding: "30px",
            maxWidth: 1800,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            position: "relative", // Add this to make it a positioning context
          }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 23 }}>
  <h2 style={{ fontWeight: 700, fontSize: 27, margin: 0 }}>
    {selectedDay} Timetable
  </h2>
  {(searchQuery.trim() || !selectedStudentYears.includes("All")) && (
  <div style={{ 
    fontSize: 14, 
    color: "#666",
    background: "#f8f9fa",
    padding: "6px 16px",
    borderRadius: 20,
    border: "1px solid #e9ecef",
    display: "flex",
    alignItems: "center",
    gap: 12
  }}>
    {searchQuery.trim() && (
      <span>
        Course: <strong>{searchQuery}</strong>
      </span>
    )}
    {searchQuery.trim() && !selectedStudentYears.includes("All") && <span>•</span>}
    {!selectedStudentYears.includes("All") && (
      <span>
        Year{selectedStudentYears.length > 1 ? 's' : ''}: <strong>{selectedStudentYears.join(", ")}</strong>
      </span>
    )}
  </div>
)}
</div>
            <div className="table-responsive" style={{ flex: 1, overflowY: "auto"}}>
              {loading && (
                <div style={{ textAlign: "center", padding: "50px", fontSize: "16px", color: "#666" }}>
                  Loading timetable...
                </div>
              )}
              {generating && (
                <div style={{ textAlign: "center", padding: "50px", fontSize: "16px", color: "#666" }}>
                  Generating timetable...
                </div>
              )}
              {!loading && !generating && (!timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px 20px', 
                  color: '#666',
                  fontSize: '16px',
                  background: '#f9f9f9',
                  borderRadius: '8px',
                  border: '1px dashed #ddd',
                  margin: '20px 0'
                }}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>No timetable data available</p>
                  <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>Click "Generate" to create a timetable for this semester</p>
                </div>
              ) : !loading && !generating ? (
              <DragDropContext onDragEnd={onDragEnd}>
                <table ref={tableRef} style={{minWidth: "800px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 12px", border: "1px solid #ccc", background: "#f8f8f8" }}>Room<br />(Capacity)</th>
                      {TIMES.map((time, idx) => (
                        <th key={idx} style={{ textAlign: "center", padding: "8px 10px", border: "1px solid #ccc", background: "#f8f8f8" }}>{time}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
  {rooms.map((room, rIdx) => {
    // Add safety checks
    if (!room || !room._id) {
      console.log('Invalid room:', room);
      return null;
    }

    if (!timetable[selectedDay] || !timetable[selectedDay][room._id]) {
      console.log('No timetable data for room:', room._id, selectedDay);
      // Return a single empty row for this room with proper Droppable areas
      return (
        <tr key={room._id || rIdx}>
          <td style={{ padding: "8px 12px", border: "1px solid #ccc", fontWeight: 600 }}>
            {room.code} {room.capacity ? `(${room.capacity})` : ""}<br />
            <span style={{ fontWeight: 400, fontSize: 13, color: "#555" }}>
              {room.building || room.block}
            </span>
          </td>
          {TIMES.map((_, tIdx) => (
            <td key={tIdx} style={{ border: "1px solid #ccc", height: 48, minWidth: 120, verticalAlign: "top" }}>
              <Droppable droppableId={`${room._id}-${tIdx}`} key={`${room._id}-${tIdx}-empty`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      minHeight: 40,
                      background: snapshot.isDraggingOver ? "#e6f7ff" : "transparent",
                      padding: 2,
                    }}
                  >
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </td>
          ))}
        </tr>
      );
    }

    const daySlots = timetable[selectedDay][room._id] || [];
    
    // STEP 1: Build lanes using the same logic as export
    const lanes = [];

    for (let timeIdx = 0; timeIdx < TIMES.length; timeIdx++) {
      const slotEvents = daySlots[timeIdx] || [];
      slotEvents.forEach(event => {
        const duration = event.raw?.Duration || 1;

        // Find first lane that is free for this event's entire duration
        let placed = false;
        for (let lane of lanes) {
          let canPlace = true;
          for (let d = 0; d < duration; d++) {
            if (lane[timeIdx + d]) {
              canPlace = false;
              break;
            }
          }
          if (canPlace) {
            for (let d = 0; d < duration; d++) {
              lane[timeIdx + d] = event;
            }
            placed = true;
            break;
          }
        }

        // If no lane found, create a new one
        if (!placed) {
          const newLane = Array(TIMES.length).fill(null);
          for (let d = 0; d < duration; d++) {
            newLane[timeIdx + d] = event;
          }
          lanes.push(newLane);
        }
      });
    }

    // CRITICAL FIX: Always ensure at least one lane exists for empty rooms
    // This is the key fix - always provide droppable areas even for empty rooms
    const maxLanes = Math.max(lanes.length, 1);

    // STEP 2: Render each lane as a separate row
    const laneRows = [];
    
    for (let laneIdx = 0; laneIdx < maxLanes; laneIdx++) {
      const row = (
        <tr key={`${room._id}-lane-${laneIdx}`}>
          {/* First lane gets the room cell with rowspan */}
          {laneIdx === 0 && (
            <td 
              rowSpan={maxLanes} 
              style={{ 
                padding: "8px 12px", 
                border: "1px solid #ccc", 
                fontWeight: 600,
                verticalAlign: "top"
              }}
            >
              {room.code} {room.capacity ? `(${room.capacity})` : ""}<br />
              <span style={{ fontWeight: 400, fontSize: 13, color: "#555" }}>
                {room.building || room.block}
              </span>
            </td>
          )}
          
          {/* CRITICAL FIX: Render ALL time slots with consistent Droppable IDs */}
          {TIMES.map((_, timeIdx) => {
            const event = lanes[laneIdx]?.[timeIdx];
            
            // IMPORTANT: Always create a Droppable with consistent ID pattern
            // Use a combination that ensures uniqueness but consistency
            const droppableId = `${room._id}-${timeIdx}`;
            
            if (event) {
              // Check if this is the START of the event (not a continuation)
              const eventStartIdx = TIMES.findIndex(t => t === event.raw.StartTime);
              if (eventStartIdx === timeIdx) {
                // This is the starting slot of the event
                const duration = event.raw?.Duration || 1;
                
                return (
                  <td
                    key={`${room._id}-${laneIdx}-${timeIdx}`}
                    colSpan={duration}
                    style={{ 
                      border: "1px solid #ccc", 
                      height: 48, 
                      minWidth: 120, 
                      verticalAlign: "top" 
                    }}
                  >
                    <Droppable 
                      droppableId={droppableId} 
                      key={`${droppableId}-lane-${laneIdx}-with-event`}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            minHeight: 40,
                            background: snapshot.isDraggingOver ? "#e6f7ff" : "transparent",
                            padding: 2,
                          }}
                        >
                          {isEventMatchingAllFilters(event) && (
  <Draggable key={event.id} draggableId={String(event.id)} index={laneIdx}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        onContextMenu={(e) => handleContextMenu(e, event, room._id, timeIdx, laneIdx)}
        style={{
          userSelect: "none",
          padding: "6px 10px",
          margin: "0 0 4px 0",
          minHeight: "32px",
          backgroundColor: snapshot.isDragging
            ? event.raw.OccType === "Lecture" ? "#015551" : "#1a664e"
            : event.raw.OccType === "Lecture" ? "#e2e8f0" : "#d4f4e2",
          color: snapshot.isDragging ? "#fff" : "#222",
          borderRadius: 6,
          fontWeight: 500,
          fontSize: 15,
          border: (searchQuery.trim() && event.code.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (!selectedStudentYears.includes("All") && !isEventMatchingYearFilter(event))
  ? "2px solid #015551" 
  : "2px solid transparent",
          opacity: isEventMatchingAllFilters(event) ? 1 : 0.3, // Dim filtered out events
          ...provided.draggableProps.style,
        }}
      >
                                  <div>
  <strong>{event.code} ({event.raw.OccType})</strong>
  {duration > 1 && (
    <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>
      ({duration}h)
    </span>
  )}
</div>
<div style={{ fontSize: 13 }}>
  {/* Existing OccNumber display */}
  {event.raw.OccNumber && (
    Array.isArray(event.raw.OccNumber)
      ? `(Occ ${event.raw.OccNumber.join(", ")})`
      : `(Occ ${event.raw.OccNumber})`
  )}
  
  {/* NEW: Show departments if available */}
  {event.raw.Departments && event.raw.Departments.length > 0 && (
    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
      {event.raw.Departments.join(", ")}
    </div>
  )}
                                    <select
  value={event.selectedInstructorId || ""}
  onChange={async (e) => {
  const selectedId = e.target.value;
  const selectedInstructorObj = instructors.find(inst => inst._id === selectedId);
  const selectedName = selectedInstructorObj ? selectedInstructorObj.name : "";
  
  // Check for occurrence restriction violations
  if (selectedId && selectedId.trim() !== "") {
    // const occurrenceViolation = checkOccurrenceRestriction(event, selectedId, timetable);
    
    // if (occurrenceViolation && occurrenceViolation.isViolation) {
    //   let violationMessage = `Occurrence Restriction Violation:\n\n${occurrenceViolation.message}\n\n`;
      
    //   if (occurrenceViolation.instructorLectures.length > 0) {
    //     violationMessage += "This instructor teaches lectures for the following occurrences:\n";
    //     occurrenceViolation.instructorLectures.forEach((lecture, index) => {
    //       violationMessage += `${index + 1}. Occurrences [${lecture.occurrences.join(', ')}] on ${lecture.day} at ${lecture.time}\n`;
    //     });
    //     violationMessage += "\nTo assign this instructor to this tutorial, they must also teach a lecture covering the same occurrences.";
    //   }
      
    //   violationMessage += "\n\nDo you want to proceed anyway? This will create a scheduling violation that will be recorded when you save the timetable.";
      
    //   if (!confirm(violationMessage)) {
    //     return; // Don't apply the change
    //   }
      
    //   // NOTE: Removed recordDragDropConflict call - conflicts will be recorded on save
    // }
    
    // Check for standard instructor conflicts (existing logic)
    const eventStartIdx = TIMES.findIndex(t => t === event.raw.StartTime);
    const eventDuration = event.raw?.Duration || 1;
    
    const tempEvent = {
      ...event,
      selectedInstructorId: selectedId,
      selectedInstructor: selectedName
    };
    
    const timeConflicts = checkInstructorConflicts(
      timetable,
      tempEvent,
      selectedDay,
      eventStartIdx,
      eventDuration
    );
    
    if (timeConflicts.length > 0) {
      let conflictMessage = `Warning: ${selectedName} is already assigned to:\n\n`;
      timeConflicts.forEach((conflict, index) => {
        const occText = conflict.conflictingOccNumber 
          ? Array.isArray(conflict.conflictingOccNumber)
            ? ` (Occ ${conflict.conflictingOccNumber.join(", ")})`
            : ` (Occ ${conflict.conflictingOccNumber})`
          : "";
        conflictMessage += `${index + 1}. ${conflict.conflictingCourse} (${conflict.conflictingCourseType})${occText} in ${conflict.conflictingRoomCode} at ${conflict.timeSlot}\n`;
      });
      conflictMessage += "\nThis will create scheduling conflicts that will be recorded when you save the timetable. Do you want to proceed anyway?";
      
      const confirmed = await showConfirm(
        conflictMessage, 
        "Instructor Conflicts Detected"
      );
      if (!confirmed) {
        return;
      }
      
      // NOTE: Removed recordDragDropConflict loop - conflicts will be recorded on save
    }
  }
  
  // Update the event in all time slots it occupies
  const newTimetable = JSON.parse(JSON.stringify(timetable));
  
  // Find and update all instances of this event
  DAYS.forEach(day => {
    Object.keys(newTimetable[day] || {}).forEach(roomId => {
      newTimetable[day][roomId].forEach(slot => {
        slot.forEach(item => {
          if (item.id === event.id) {
            item.selectedInstructorId = selectedId;
            item.selectedInstructor = selectedName;
          }
        });
      });
    });
  });
  
  setTimetable(newTimetable);
  setIsModified(true);
}}
  style={{
    width: "100%",
    fontSize: "12px",
    padding: "2px 4px",
    border: "1px solid #ccc",
    borderRadius: "3px",
    marginTop: "2px"
  }}
>
  <option value="">Select Instructor</option>
  {/* Only show instructors who can teach this occurrence */}
{instructors
  .filter(inst => 
    (Array.isArray(event.instructors) ? event.instructors : [event.instructors])
      .includes(inst.name)
  )
  .map(inst => (
    <option key={inst._id} value={inst._id}>
      {inst.name}
    </option>
  ))}
</select>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </td>
                );
              } else {
                // This is a continuation slot, don't render a cell
                return null;
              }
            } else {
              // Empty slot - ALWAYS render a Droppable area with consistent ID
              return (
                <td
                  key={`${room._id}-${laneIdx}-${timeIdx}`}
                  style={{ 
                    border: "1px solid #ccc", 
                    height: 48, 
                    minWidth: 120, 
                    verticalAlign: "top" 
                  }}
                >
                  <Droppable 
                    droppableId={droppableId}
                    key={`${droppableId}-lane-${laneIdx}-empty`}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          minHeight: 40,
                          background: snapshot.isDraggingOver ? "#e6f7ff" : "transparent",
                          padding: 2,
                        }}
                      >
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </td>
              );
            }
          })}
        </tr>
      );
      
      laneRows.push(row);
    }
    
    return laneRows;
  })}
</tbody>
                </table>
              </DragDropContext>
              ) : null}
            </div>
            {showDaySelector && (
              <div 
              data-modal="day-selector"
    onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: `${modalPosition.x}px`,
                top: `${modalPosition.y}px`,
                background: "#fff",
                padding: "20px",
                borderRadius: 8,
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                zIndex: 1000,
                width: "250px",
                border: "1px solid #e0e0e0",
                maxHeight: "340px",
                overflow: "auto"
              }}>
                <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>Move Event</h3>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", fontSize: "14px", marginBottom: "5px" }}>Day</label>
                  <select
                    value={targetDay}
                    onChange={e => setTargetDay(e.target.value)}
                    style={{ width: "100%", padding: "8px", fontSize: "14px" }}
                  >
                    {DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", fontSize: "14px", marginBottom: "5px" }}>Time Slot</label>
                  <select
                    value={targetTime}
                    onChange={e => setTargetTime(e.target.value)}
                    style={{ width: "100%", padding: "8px", fontSize: "14px" }}
                  >
                    {TIMES.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", fontSize: "14px", marginBottom: "5px" }}>Room</label>
                  <select
                    value={targetRoom}
                    onChange={e => setTargetRoom(e.target.value)}
                    style={{ width: "100%", padding: "8px", fontSize: "14px" }}
                  >
                    <option value="">Select Room</option>
                    {rooms.map(room => (
                      <option key={room._id} value={room._id}>
                        {room.code} {room.capacity ? `(${room.capacity})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: "10px", padding: "2px" }}>
                  <button
                    onClick={handleModalConfirm}
                    style={{
                      background: "#015551",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 4,
                      cursor: "pointer",
                      flex: 1,
                      fontSize: "14px"
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={handleModalCancel}
                    style={{
                      background: "#dc3545",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 4,
                      cursor: "pointer",
                      flex: 1,
                      fontSize: "14px"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {showExportModal && (
  <div 
  data-modal="export"
    onClick={(e) => e.stopPropagation()}
  style={{
    position: "absolute",
    top: `${exportModalPosition.y}px`,
    left: `${exportModalPosition.x}px`,
    background: "#fff",
    padding: "20px",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    zIndex: 1000,
    width: "250px",
    border: "1px solid #e0e0e0"
  }}>
    <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>Select Export Format</h3>
    <div style={{ marginBottom: "10px" }}>
      <label style={{ display: "block", fontSize: "14px", marginBottom: "5px" }}>Format</label>
      <select
        value={selectedExportFormat}
        onChange={(e) => setSelectedExportFormat(e.target.value)}
        style={{ width: "100%", padding: "8px", fontSize: "14px" }}
      >
        <option value="csv">CSV</option>
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
    </div>
    <div style={{ display: "flex", gap: "10px", padding: "2px" }}>
      <button
        onClick={handleExportConfirm}
        style={{
          background: "#015551",
          color: "#fff",
          border: "none",
          padding: "8px 16px",
          borderRadius: 4,
          cursor: "pointer",
          flex: 1,
          fontSize: "14px"
        }}
      >
        Export
      </button>
      <button
        onClick={handleExportCancel}
        style={{
          background: "#dc3545",
          color: "#fff",
          border: "none",
          padding: "8px 16px",
          borderRadius: 4,
          cursor: "pointer",
          flex: 1,
          fontSize: "14px"
        }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 32, gap: 16 }}>
              <button
                style={{
                  background: "#015551",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 36px",
                  fontWeight: 500,
                  fontSize: 16,
                  cursor: "pointer"
                }}
                onClick={handleGenerateTimetable}
              >
                Generate
              </button>
              {isModified && (
                <button
                  style={{
                    background: "#007bff",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 36px",
                    fontWeight: 500,
                    fontSize: 16,
                    cursor: "pointer"
                  }}
                  onClick={handleSaveTimetable}
                >
                  Save
                </button>
              )}
              <button
  style={{
    background: (isModified || !timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? "#ccc" : "#08CB00",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 36px",
    fontWeight: 500,
    fontSize: 16,
    cursor: (isModified || !timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? "not-allowed" : "pointer",
    opacity: (isModified || !timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0) ? 0.6 : 1,
    transition: "all 0.2s ease"
  }}
  onClick={handlePublish}
  disabled={isModified || !timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0}
  title={
    isModified 
      ? "Please save your changes before publishing" 
      : (!timetable[selectedDay] || Object.keys(timetable[selectedDay]).length === 0)
        ? "Generate a timetable first to enable publishing"
        : "Publish the current timetable"
  }
>
  Publish
</button>
            </div>
          </div>
          <table ref={allDaysTableRef} style={{ display: "none" }}></table>
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default Home;