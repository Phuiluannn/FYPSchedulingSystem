import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from './SideBar';
import ProtectedRoute from './ProtectedRoute';
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BiExport } from "react-icons/bi";
import Papa from "papaparse";
import html2canvas from "html2canvas";

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

function Home() {
  const [rooms, setRooms] = useState([]);
  const [roomsReady, setRoomsReady] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [selectedYear, setSelectedYear] = useState("2024/2025");
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

  const recordDragDropConflict = async (conflictData) => {
  try {
    const token = localStorage.getItem('token');
    
    // Format OccNumber for the description
    const occNumberText = conflictData.OccNumber
      ? Array.isArray(conflictData.OccNumber)
        ? ` (Occ ${conflictData.OccNumber.join(", ")})`
        : ` (Occ ${conflictData.OccNumber})`
      : "";

    // Update the conflict description to include OccNumber
    const updatedConflictData = {
      ...conflictData,
      Description: `${conflictData.Description}${occNumberText}`
    };

    await axios.post(
      "http://localhost:3001/analytics/record-conflict",
      updatedConflictData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Conflict recorded successfully:", updatedConflictData);
  } catch (error) {
    console.error("Error recording conflict:", error);
  }
};

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:3001/instructors", {
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
        const response = await axios.get("http://localhost:3001/rooms", {
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
        `http://localhost:3001/courses?year=${selectedYear}&semester=${selectedSemester}`,
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
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:3001/home/get-timetable?year=${selectedYear}&semester=${selectedSemester}`,
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
    }
  };
  fetchAllTimetables();
}, [roomsReady, rooms, selectedYear, selectedSemester, instructors]);

  useEffect(() => {
  if (showExportModal) {
    const position = calculateModalPosition();
    setExportModalPosition(position);
  }
}, [timetable, showExportModal]);

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

  const handleContextMenu = (e, item, roomId, timeIdx, index) => {
  e.preventDefault();
  e.stopPropagation(); // Add this to prevent event bubbling
  
  const rect = e.currentTarget.getBoundingClientRect();
  const modalWidth = 250;
  const modalHeight = 280;
  
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  let x = rect.left + scrollX;
  let y = rect.bottom + scrollY + 8;
  
  if (rect.left + modalWidth > window.innerWidth) {
    x = rect.right + scrollX - modalWidth;
  }
  
  if (rect.left < 15) {
    x = 15 + scrollX;
  }
  
  const bottomSpace = window.innerHeight - rect.bottom;
  if (bottomSpace < modalHeight + 15) {
    y = rect.top + scrollY - modalHeight - 8;
    if (rect.top < modalHeight + 15) {
      y = scrollY + 15;
    }
  }
  
  setModalPosition({ x, y });
  setContextItem({ item, roomId, timeIdx, index, sourceDay: selectedDay });
  setTargetDay(selectedDay);
  setTargetTime(TIMES[timeIdx]);
  setTargetRoom(roomId);
  setShowDaySelector(true);
};

  // Helper function to calculate required capacity for an event
// FIXED VERSION: Now properly uses occNumber to determine capacity calculation
const calculateRequiredCapacity = (courseCode, occType, occNumber, courses) => {
  console.log("=== CAPACITY CALCULATION DEBUG ===");
  console.log("Parameters:", { courseCode, occType, occNumber, coursesLength: courses.length });
  
  const course = courses.find(c => c.code === courseCode);
  if (!course) {
    console.log("❌ Course not found");
    return 0;
  }
  
  const targetStudent = course.targetStudent || 0;
  console.log("Course data:", {
    targetStudent,
    lectureOccurrence: course.lectureOccurrence,
    tutorialOcc: course.tutorialOcc
  });
  
  if (occType === "Lecture") {
    const lectureOccurrence = course.lectureOccurrence || 1;
    const capacityPerLecture = Math.ceil(targetStudent / lectureOccurrence);
    console.log(`✅ Lecture: ${targetStudent} / ${lectureOccurrence} = ${capacityPerLecture}`);
    return capacityPerLecture;
  } 
  else if (occType === "Tutorial") {
    const tutorialOcc = course.tutorialOcc || 1;
    
    // KEY FIX: Use occNumber to determine capacity calculation approach
    if (Array.isArray(occNumber)) {
      // Multiple occurrences in one event - capacity per occurrence
      const capacityPerTutorial = Math.ceil(targetStudent / tutorialOcc);
      console.log(`✅ Tutorial (multiple occ): ${targetStudent} / ${tutorialOcc} = ${capacityPerTutorial}`);
      return capacityPerTutorial;
    } else {
      // Single occurrence - still capacity per occurrence
      const capacityPerTutorial = Math.ceil(targetStudent / tutorialOcc);
      console.log(`✅ Tutorial (single occ): ${targetStudent} / ${tutorialOcc} = ${capacityPerTutorial}`);
      return capacityPerTutorial;
    }
  }
  
  // This fallback might be returning 300!
  // console.log(`⚠️ FALLBACK CASE HIT! Returning full targetStudent: ${targetStudent}`);
  // console.log("This might be where 300 is coming from!");
  return targetStudent;
};

// Alternative version that's more explicit about the issue
const calculateRequiredCapacityV2 = (courseCode, occType, occNumber, courses) => {
  const course = courses.find(c => c.code === courseCode);
  if (!course) return 0;
  
  const targetStudent = course.targetStudent || 0;
  
  // EXPLICIT CHECK: Log when fallback case would be hit
  if (occType !== "Lecture" && occType !== "Tutorial") {
    console.error(`🔴 PROBLEM FOUND: occType is "${occType}" - not "Lecture" or "Tutorial"`);
    console.error("This will trigger the fallback case and return full targetStudent!");
    console.error(`Course: ${courseCode}, targetStudent: ${targetStudent}`);
    // Return 0 instead of targetStudent to avoid capacity issues
    return 0;
  }
  
  if (occType === "Lecture") {
    const lectureOccurrence = course.lectureOccurrence || 1;
    return Math.ceil(targetStudent / lectureOccurrence);
  } 
  
  if (occType === "Tutorial") {
    const tutorialOcc = course.tutorialOcc || 1;
    return Math.ceil(targetStudent / tutorialOcc);
  }
  
  // This should never be reached now
  return 0;
};

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
  if (!result.destination) return;

  const { source, destination } = result;
  const [sourceRoom, sourceTime] = source.droppableId.split("-");
  const [destRoom, destTime] = destination.droppableId.split("-");
  const sourceTimeIdx = Number(sourceTime);
  const destTimeIdx = Number(destTime);

  const newTimetable = JSON.parse(JSON.stringify(timetable));
  
  // Get the moved item
  const sourceSlot = newTimetable[selectedDay][sourceRoom][sourceTimeIdx];
  if (!sourceSlot || sourceSlot.length === 0) return;
  
  const [moved] = sourceSlot.splice(source.index, 1);
  const duration = moved.raw.Duration || 1;

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

  // Check for room capacity conflict FIRST
  const destRoomObj = rooms.find(r => r._id === destRoom);
  if (destRoomObj) {
    const requiredCapacity = calculateRequiredCapacity(
      moved.code, 
      moved.raw.OccType, 
      moved.raw.OccNumber, 
      courses
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
  for (let i = 0; i < duration; i++) {
    if (destTimeIdx + i < TIMES.length) {
      const destSlot = newTimetable[selectedDay][destRoom][destTimeIdx + i];
      if (destSlot.length > 0) {
        const conflictingEvent = destSlot[0];
        const timeSlot = TIMES[destTimeIdx + i];
        
        // Handle OccNumber for conflicting event
        let conflictingOccNumber = conflictingEvent.raw?.OccNumber || conflictingEvent.OccNumber;
        let formattedOccNumber = '';

        if (conflictingOccNumber) {
          formattedOccNumber = Array.isArray(conflictingOccNumber)
            ? `(Occ ${conflictingOccNumber.join(", ")})`
            : `(Occ ${conflictingOccNumber})`;
        } else {
          formattedOccNumber = '(Occ Unknown)';
        }

        conflicts.push({
          type: 'Room Double Booking',
          conflictingCourse: conflictingEvent.code,
          conflictingCourseOcc: conflictingOccNumber,
          conflictingCouseType: conflictingEvent.raw?.OccType || conflictingEvent.OccType,
          formattedOccNumber: formattedOccNumber,
          timeSlot: timeSlot,
          roomCode: destRoomObj?.code || 'Unknown Room',
          conflictingEvent: conflictingEvent
        });
      }
    }
  }

  // NEW: Check for instructor conflicts
  if (moved.selectedInstructorId && moved.selectedInstructorId.trim() !== "" && 
  moved.selectedInstructor && moved.selectedInstructor.trim() !== "") {
const movedInstructorName = moved.selectedInstructor;

// Calculate the time range for the moved event
const movedStartIdx = destTimeIdx;
const movedEndIdx = destTimeIdx + duration - 1;

// Check ALL time slots in the selected day for overlapping events with same instructor
Object.entries(newTimetable[selectedDay]).forEach(([checkRoomId, roomSlots]) => {
  if (checkRoomId === destRoom) return; // Skip destination room as we're moving there
  if (checkRoomId === sourceRoom) return; // Skip source room to avoid self-conflict
  
  // Check each time slot for events with the same instructor
  roomSlots.forEach((conflictingSlot, conflictingTimeIdx) => {
    if (conflictingSlot && conflictingSlot.length > 0) {
      conflictingSlot.forEach(conflictingEvent => {
        // Skip if this is the same event (self-conflict)
        if (conflictingEvent.id === moved.id) return;
        
        // Only check for instructor conflicts if the conflicting event has an instructor assigned
        const conflictingHasInstructor = (conflictingEvent.selectedInstructorId && 
                                        conflictingEvent.selectedInstructorId.trim() !== "") ||
                                       (conflictingEvent.selectedInstructor && 
                                        conflictingEvent.selectedInstructor.trim() !== "");
        
        if (!conflictingHasInstructor) return;
        
        // Check if the conflicting event has the same instructor
        if (conflictingEvent.selectedInstructorId === moved.selectedInstructorId ||
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
            
            // FIXED: Ensure valid time range calculation
            const overlapStartTime = TIMES[overlapStart] || TIMES[movedStartIdx];
            const overlapEndTime = TIMES[overlapEnd] || TIMES[movedEndIdx];
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
              // FIXED: Add the missing day and timeSlot properties
              conflictingDay: selectedDay, // This was missing!
              timeSlot: overlapStartTime // This was also missing!
            });
          }
        }
      });
    }
  });
});
}

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
        alertMessage += `${index + 1}. Instructor Conflict: ${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) (Occ ${conflict.movedCourseOccNumber}) in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${selectedDay} at ${conflict.timeSlot}\n`;
      }
    });
    alertMessage += "\nThe move will still be performed, and conflicts will be recorded in the analytics section.";
    alert(alertMessage);
  }

  // ALWAYS PERFORM THE MOVE (even with conflicts)
  // Remove the item from ALL slots it was occupying at the source
  const eventStartTime = moved.raw.StartTime;
  const eventStartTimeIdx = TIMES.findIndex(t => t === eventStartTime);
  
  if (eventStartTimeIdx !== -1) {
    for (let i = 0; i < duration; i++) {
      if (eventStartTimeIdx + i < TIMES.length) {
        newTimetable[selectedDay][sourceRoom][eventStartTimeIdx + i] = 
          newTimetable[selectedDay][sourceRoom][eventStartTimeIdx + i].filter(
            item => item.id !== moved.id
          );
      }
    }
  }

  // Update the event's start time to match the new position
  const updatedEvent = {
    ...moved,
    raw: {
      ...moved.raw,
      StartTime: TIMES[destTimeIdx],
      EndTime: destTimeIdx + duration - 1 < TIMES.length 
        ? TIMES[destTimeIdx + duration - 1].split(" - ")[1]
        : TIMES[TIMES.length - 1].split(" - ")[1]
    }
  };
  
  // Place the event ONLY in the starting destination slot
  newTimetable[selectedDay][destRoom][destTimeIdx].push(updatedEvent);
  
  // Update the timetable state
  setTimetable(newTimetable);
  setIsModified(true);

  // Record conflicts if any exist
  if (conflicts.length > 0) {
    // Record each type of conflict
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
        await recordDragDropConflict(conflictData);
        
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
        await recordDragDropConflict(conflictData);
        
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
        await recordDragDropConflict(conflictData);
        
      } else if (conflict.type === 'Instructor Conflict') {
        // NEW: Record instructor conflicts
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
          } in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${selectedDay} at ${conflict.timeSlot}`,
          CourseCode: moved.code,
          InstructorID: conflict.instructorId,
          RoomID: destRoom,
          Day: selectedDay,
          StartTime: conflict.timeSlot,
          Priority: 'High',
          Status: 'Pending'
        };
        await recordDragDropConflict(conflictData);
      }
    }
  }
};

  
const handleModalConfirm = async () => {
  if (!contextItem || !targetRoom) {
    alert("Please select a room.");
    return;
  }

  const { item, roomId, timeIdx, index, sourceDay } = contextItem;
  const targetTimeIdx = TIMES.indexOf(targetTime);
  const duration = item.raw.Duration || 1;

  if (targetTimeIdx === -1) {
    alert("Invalid time slot selected.");
    return;
  }

  // Calculate required capacity for this event
  const requiredCapacity = calculateRequiredCapacity(
    item.code, 
    item.raw.OccType, 
    item.raw.OccNumber, 
    courses
  );

  // Find target room details
  const targetRoomObj = rooms.find(r => r._id === targetRoom);
  if (!targetRoomObj) {
    alert("Target room not found.");
    return;
  }

  const newTimetable = JSON.parse(JSON.stringify(timetable));
  let conflicts = [];

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
    
    try {
      await recordDragDropConflict(capacityConflictData);
    } catch (error) {
      console.error("Failed to record capacity conflict:", error);
    }
  }
  
  // Check if destination slots are occupied
  let conflictingEvents = [];
for (let i = 0; i < duration; i++) {
  if (targetTimeIdx + i >= TIMES.length) {
    conflicts.push({
      type: 'Time Slot Exceeded',
      message: 'Event extends beyond available time slots'
    });
    break;
  }

  const destSlot = newTimetable[targetDay][targetRoom][targetTimeIdx + i];
  if (destSlot.length > 0) {
    const conflictingEvent = destSlot[0];

    // 🚫 Skip self-conflict (same event being moved)
    if (conflictingEvent.id === item.id) continue;

    // Handle OccNumber formatting
    let conflictingOccNumber = conflictingEvent.raw?.OccNumber || conflictingEvent.OccNumber;
    let formattedOccNumber = '';
    if (conflictingOccNumber) {
      formattedOccNumber = Array.isArray(conflictingOccNumber)
        ? `(Occ ${conflictingOccNumber.join(", ")})`
        : `(Occ ${conflictingOccNumber})`;
    } else {
      formattedOccNumber = '(Occ Unknown)';
    }

    conflicts.push({
      type: 'Room Double Booking',
      conflictingCourse: conflictingEvent.code,
      conflictingCourseOcc: conflictingOccNumber,
      conflictingCourseType: conflictingEvent.raw?.OccType || conflictingEvent.OccType,
      formattedOccNumber: formattedOccNumber,
      timeSlot: TIMES[targetTimeIdx + i],
      roomCode: targetRoomObj.code
    });

    conflictingEvents.push(conflictingEvent);
  }
}

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
            
            // FIXED: Ensure valid time range calculation  
            const overlapStartTime = TIMES[overlapStart] || TIMES[movedStartIdx];
            const overlapEndTime = TIMES[overlapEnd] || TIMES[movedEndIdx];
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
              // FIXED: Add the missing day and timeSlot properties
              conflictingDay: targetDay, // This was missing!
              timeSlot: overlapStartTime // This was also missing!
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
        
        try {
          await recordDragDropConflict(conflictData);
        } catch (error) {
          console.error("Failed to record double booking conflict:", error);
        }
      }
    }
  }

  // NEW: Record instructor conflicts
  for (const conflict of conflicts) {
    if (conflict.type === 'Instructor Conflict') {
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
        } in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${targetDay} at ${conflict.timeSlot}`,
        CourseCode: item.code,
        InstructorID: conflict.instructorId,
        RoomID: targetRoom,
        Day: targetDay,
        StartTime: conflict.timeSlot,
        Priority: 'High',
        Status: 'Pending'
      };
      
      try {
        await recordDragDropConflict(instructorConflictData);
      } catch (error) {
        console.error("Failed to record instructor conflict:", error);
      }
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
        alertMessage += `${index + 1}. Instructor Conflict: ${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) (Occ ${conflict.movedCourseOccNumber}) in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${targetDay} at ${conflict.timeSlot}\n`;
      }
    });
    alertMessage += "\nThe move will still be performed, and conflicts will be recorded in the analytics section.";
    alert(alertMessage);
  } 
  // else {
    // alert(`Event moved successfully! Room ${targetRoomObj.code} (capacity: ${targetRoomObj.capacity}) can accommodate ${requiredCapacity} required seats.`);
  // }

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
  };

  const handleGenerateTimetable = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        "http://localhost:3001/home/generate-timetable",
        { year: selectedYear, semester: selectedSemester },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const schedules = response.data.schedules;
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
          for (let i = 0; i < duration; i++) {
            if (timeIdx + i < TIMES.length) {
              newTimetable[sch.Day][roomId][timeIdx + i].push({
                id: String(sch._id),
                code: sch.CourseCode,
                instructors: sch.OriginalInstructors || sch.Instructors,
                selectedInstructor: Array.isArray(sch.Instructors) && sch.Instructors.length === 1
                  ? sch.Instructors[0]
                  : "",
                selectedInstructorId: sch.InstructorID || "",
                raw: {
                  ...sch,
                  Duration: duration,
                },
              });
            }
          }
        }
      });
      setTimetable(newTimetable);
      setIsGenerated(true);
      setIsModified(true);
      alert("Timetable generated successfully!");
    } catch (error) {
      alert("Failed to generate timetable.");
      console.error(error);
    }
  };

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
              });
            }
          });
        });
      });
    }

    const token = localStorage.getItem('token');
    await axios.post(
      "http://localhost:3001/home/save-timetable",
      { year: selectedYear, semester: selectedSemester, timetable: timetableArr },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    alert("Timetable saved to database!");
    setIsModified(false);
    setIsGenerated(true);
  } catch (error) {
    alert("Failed to save timetable.");
    console.error(error);
  }
};

  const handleExportTimetable = async (format) => {
  if (!timetable || Object.keys(timetable).length === 0) {
    alert("No timetable data available to export.");
    return;
  }

  if (format === "csv") {
    const csvData = [];
    const headers = ["Day", "Time Slot", "End Time", "Duration (Hours)", "Room Code", "Room Capacity", "Course Code", "Occurrence Type", "Occurrence Number", "Instructors"];
    csvData.push(headers);

    DAYS.forEach(day => {
      Object.entries(timetable[day] || {}).forEach(([roomId, slots]) => {
        const room = rooms.find(r => r._id === roomId);
        const roomCode = room ? room.code : "Unknown";
        const roomCapacity = room && room.capacity ? room.capacity : "N/A";

        slots.forEach((slot, timeIdx) => {
          slot.forEach(item => {
            if (item && item.raw) {
              // Only export events that start at this time slot
              const eventStartTimeIdx = TIMES.findIndex(t => t === item.raw.StartTime);
              
              if (eventStartTimeIdx === timeIdx) {
                // CRITICAL FIX: Improved instructor handling
                let instructorName = "No Instructor Assigned";
                
                // Priority 1: Check selectedInstructor (directly assigned)
                if (item.selectedInstructor && item.selectedInstructor.trim() !== "") {
                  instructorName = item.selectedInstructor;
                }
                // Priority 2: Check selectedInstructorId and find name from instructors array
                else if (item.selectedInstructorId && item.selectedInstructorId.trim() !== "") {
                  const foundInstructor = instructors.find(inst => inst._id === item.selectedInstructorId);
                  if (foundInstructor) {
                    instructorName = foundInstructor.name;
                  }
                }
                // Priority 3: Check if there's only one instructor in the raw data
                else if (item.raw.Instructors && Array.isArray(item.raw.Instructors) && item.raw.Instructors.length === 1) {
                  instructorName = item.raw.Instructors[0];
                }
                // Priority 4: Check OriginalInstructors if available
                else if (item.raw.OriginalInstructors && Array.isArray(item.raw.OriginalInstructors) && item.raw.OriginalInstructors.length === 1) {
                  instructorName = item.raw.OriginalInstructors[0];
                }

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
                  instructorName,
                ]);
              }
            }
          });
        });
      });
    });
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = `timetable_${selectedYear.replace("/", "-")}_sem${selectedSemester}_all_days.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Image export logic remains the same since it uses the display logic
    // which already handles multi-hour events correctly
    if (!allDaysTableRef.current) {
      alert("All days table element not found.");
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
    mainHeaderCell.textContent = `Timetable - ${selectedYear}, Semester ${selectedSemester}`;
    mainHeaderRow.appendChild(mainHeaderCell);
    mainHeader.appendChild(mainHeaderRow);
    allDaysTable.appendChild(mainHeader);

    DAYS.forEach(day => {
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
        const row = document.createElement("tr");
        const roomCell = document.createElement("td");
        roomCell.style.padding = "8px 12px";
        roomCell.style.border = "1px solid #ccc";
        roomCell.style.fontWeight = "600";
        roomCell.innerHTML = `${room.code} ${room.capacity ? `(${room.capacity})` : ""}<br /><span style="font-weight: 400; font-size: 13px; color: #555">${room.building || room.block}</span>`;
        row.appendChild(roomCell);

        TIMES.forEach((_, tIdx) => {
          const slotData = (timetable[day] && timetable[day][room._id] && timetable[day][room._id][tIdx]) || [];
          
          // CRITICAL FIX: Only render events that start at this time slot
          if (slotData.length > 0 && slotData[0].raw.StartTime === TIMES[tIdx]) {
            const duration = slotData[0].raw.Duration || 1;
            const cell = document.createElement("td");
            cell.style.border = "1px solid #ccc";
            cell.style.height = `${48 * duration}px`;
            cell.colSpan = duration; // Set colspan for multi-hour events

            const div = document.createElement("div");
            div.style.padding = "6px 10px";
            div.style.margin = "0 0 4px 0";
            div.style.minHeight = `${32 * duration}px`;
            div.style.backgroundColor = slotData[0].raw.OccType === "Lecture" ? "#e2e8f0" : "#d4f4e2";
            div.style.color = "#222";
            div.style.borderRadius = "6px";
            div.style.fontWeight = "500";
            div.style.fontSize = "15px";
            div.innerHTML = `<div><strong>${slotData[0].code} (${slotData[0].raw.OccType})${duration > 1 ? ` (${duration}h)` : ""}</strong></div><div style="font-size: 13px">${slotData[0].raw.OccNumber ? (Array.isArray(slotData[0].raw.OccNumber) ? `(Occ ${slotData[0].raw.OccNumber.join(", ")})` : `(Occ ${slotData[0].raw.OccNumber})`) : ""}${slotData[0].selectedInstructor || "No Instructor Assigned"}</div>`;
            cell.appendChild(div);

            row.appendChild(cell);
          } else {
            // Check if this slot is part of a multi-hour event from a previous slot
            let isPartOfMultiHourEvent = false;
            for (let prevIdx = 0; prevIdx < tIdx; prevIdx++) {
              const prevSlotData = (timetable[day] && timetable[day][room._id] && timetable[day][room._id][prevIdx]) || [];
              if (prevSlotData.length > 0 && prevSlotData[0].raw.StartTime === TIMES[prevIdx]) {
                const prevDuration = prevSlotData[0].raw.Duration || 1;
                if (prevIdx + prevDuration > tIdx) {
                  isPartOfMultiHourEvent = true;
                  break;
                }
              }
            }
            
            // Only create empty cell if not part of multi-hour event
            if (!isPartOfMultiHourEvent) {
              const cell = document.createElement("td");
              cell.style.border = "1px solid #ccc";
              cell.style.height = "48px";
              row.appendChild(cell);
            }
          }
        });
        tbody.appendChild(row);
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
      const filename = `timetable_${selectedYear.replace("/", "-")}_sem${selectedSemester}_all_days.${format}`;
      link.href = imageData;
      link.download = filename;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`Timetable exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error("Error exporting timetable as image:", error);
      alert("Failed to export timetable as image.");
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
  // Get the export button's position
  const buttonRect = e.currentTarget.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  // Calculate modal position
  const modalWidth = 250;
  const modalHeight = 120; // Approximate height of the export modal
  
  // Position below the button by default
  let x = buttonRect.left + scrollX;
  let y = buttonRect.bottom + scrollY + 8; // 8px gap below button
  
  // Adjust if modal would go off the right edge of the screen
  if (buttonRect.left + modalWidth > window.innerWidth) {
    x = buttonRect.right + scrollX - modalWidth;
  }
  
  // Adjust if modal would go off the bottom edge of the screen
  const bottomSpace = window.innerHeight - buttonRect.bottom;
  if (bottomSpace < modalHeight + 15) {
    y = buttonRect.top + scrollY - modalHeight - 8; // Position above button instead
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

  return (
    <ProtectedRoute>
      <SideBar>
        <div style={{ maxWidth: 1700, margin: "0 auto 0 auto", padding: "0 10px 0 30px", paddingLeft: "70px" }}>
          <h2 className="fw-bold mb-4">Timetable</h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <select
                className='form-select'
                style={{ width: 130, borderRadius: 8 }}
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
              >
                <option value="">Year</option>
                <option value="2024/2025">2024/2025</option>
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
              <button
  ref={exportButtonRef}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 24px",
    borderRadius: 8,
    background: "#015551",
    fontWeight: 500,
    fontSize: 16,
    color: "#fff",
    cursor: "pointer"
  }}
  onClick={handleExportClick} // Make sure this passes the event
>
  <BiExport style={{ fontSize: 20}} />
  Export
</button>
            </div>
          </div>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            padding: "30px",
            maxWidth: 1800,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
          }}>
            <h2 style={{ fontWeight: 700, fontSize: 27, marginBottom: 23 }}>
              {selectedDay} Timetable
            </h2>
            <div className="table-responsive" style={{ flex: 1, overflowY: "auto"}}>
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
  {rooms.map((room, rIdx) => (
    <tr key={room._id || rIdx}>
      <td style={{ padding: "8px 12px", border: "1px solid #ccc", fontWeight: 600 }}>
        {room.code} {room.capacity ? `(${room.capacity})` : ""}<br />
        <span style={{ fontWeight: 400, fontSize: 13, color: "#555" }}>{room.building || room.block}</span>
      </td>
      {TIMES.map((_, tIdx) => {
        const slotData = (timetable[selectedDay] && timetable[selectedDay][room._id] && timetable[selectedDay][room._id][tIdx]) || [];
        
        // CRITICAL FIX: Check if this time slot should be skipped because it's part of a multi-hour event
        // Look for any event that started earlier and would span into this slot
        let shouldSkipSlot = false;
        for (let prevIdx = 0; prevIdx < tIdx; prevIdx++) {
          const prevSlotData = (timetable[selectedDay] && timetable[selectedDay][room._id] && timetable[selectedDay][room._id][prevIdx]) || [];
          if (prevSlotData.length > 0) {
            const prevItem = prevSlotData[0];
            const prevDuration = prevItem.raw.Duration || 1;
            const prevStartTime = TIMES.findIndex(t => t === prevItem.raw.StartTime);
            
            // If the previous event spans into this current slot, skip it
            if (prevStartTime !== -1 && prevStartTime <= prevIdx && prevStartTime + prevDuration > tIdx) {
              shouldSkipSlot = true;
              break;
            }
          }
        }
        
        // Skip rendering if this slot is occupied by a previous multi-hour event
        if (shouldSkipSlot) {
          return null;
        }
        
        // Determine colspan for current slot
        let colSpan = 1;
        if (slotData.length > 0) {
          const item = slotData[0];
          colSpan = item.raw.Duration || 1;
        }
        
        return (
          <td
            key={tIdx}
            colSpan={colSpan}
            style={{ 
              border: "1px solid #ccc", 
              height: 48, 
              minWidth: colSpan > 1 ? `${120 * colSpan}px` : 120, 
              verticalAlign: "top" 
            }}
          >
            <Droppable droppableId={`${room._id}-${tIdx}`}>
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
                  {slotData.map((item, idx) => (
                    item && item.id && (
                      <Draggable key={item.id} draggableId={String(item.id)} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onContextMenu={(e) => handleContextMenu(e, item, room._id, tIdx, idx)}
                            style={{
                              userSelect: "none",
                              padding: "6px 10px",
                              margin: "0 0 4px 0",
                              minHeight: "32px",
                              backgroundColor: snapshot.isDragging
                                ? item.raw.OccType === "Lecture" ? "#015551" : "#1a664e"
                                : item.raw.OccType === "Lecture" ? "#e2e8f0" : "#d4f4e2",
                              color: snapshot.isDragging ? "#fff" : "#222",
                              borderRadius: 6,
                              fontWeight: 500,
                              fontSize: 15,
                              ...provided.draggableProps.style,
                            }}
                          >
                            {/* <div><strong>{item.code} ({item.raw.OccType}) {item.raw.Duration > 1 ? `(${item.raw.Duration}h)` : ""}</strong></div> */}
                            <div><strong>{item.code} ({item.raw.OccType})</strong></div>
                            <div style={{ fontSize: 13 }}>
                              {item.raw.OccNumber && (
                                Array.isArray(item.raw.OccNumber)
                                  ? `(Occ ${item.raw.OccNumber.join(", ")})`
                                  : `(Occ ${item.raw.OccNumber})`
                              )}
                              <select
  value={item.selectedInstructorId || ""}
  onChange={async (e) => {
    const selectedId = e.target.value;
    const selectedInstructorObj = instructors.find(inst => inst._id === selectedId);
    const selectedName = selectedInstructorObj ? selectedInstructorObj.name : "";
    
    // NEW: Check for instructor conflicts before applying the change
    if (selectedId && selectedId.trim() !== "" && selectedName && selectedName.trim() !== "") {
let instructorConflicts = [];
const currentDuration = item.raw.Duration || 1;
const currentStartTimeIdx = TIMES.findIndex(t => t === item.raw.StartTime);
const currentEndIdx = currentStartTimeIdx + currentDuration - 1;

// Check ALL time slots in the selected day for overlapping events with same instructor
Object.entries(timetable[selectedDay] || {}).forEach(([checkRoomId, roomSlots]) => {
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
        if (conflictingEvent.selectedInstructorId === selectedId ||
            (conflictingEvent.selectedInstructor && 
             conflictingEvent.selectedInstructor === selectedName)) {
          
          // Calculate the time range for the conflicting event
          const conflictingDuration = conflictingEvent.raw.Duration || 1;
          const conflictingStartIdx = TIMES.findIndex(t => t === conflictingEvent.raw.StartTime);
          const conflictingEndIdx = conflictingStartIdx + conflictingDuration - 1;
          
          // Check if time periods overlap
          const hasOverlap = !(currentEndIdx < conflictingStartIdx || currentStartTimeIdx > conflictingEndIdx);
          
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
            const overlapStart = Math.max(currentStartTimeIdx, conflictingStartIdx);
            const overlapEnd = Math.min(currentEndIdx, conflictingEndIdx);
            
            // FIXED: Ensure valid time range calculation
            const overlapStartTime = TIMES[overlapStart] || TIMES[currentStartTimeIdx];
            const overlapEndTime = TIMES[overlapEnd] || TIMES[currentEndIdx];
            const overlapTimeRange = overlapStartTime.includes(' - ') 
              ? `${overlapStartTime.split(' - ')[0]} - ${overlapEndTime.split(' - ')[1]}`
              : overlapStartTime;

            instructorConflicts.push({
              instructorName: selectedName,
              instructorId: selectedId,
              conflictingCourse: conflictingEvent.code,
              conflictingCourseType: conflictingEvent.raw?.OccType || conflictingEvent.OccType,
              conflictingFormattedOccNumber: conflictingFormattedOccNumber,
              conflictingRoomCode: conflictingRoomCode,
              overlapTimeRange: overlapTimeRange,
              currentCourse: item.code,
              currentCourseType: item.raw.OccType,
              currentRoomCode: room.code || 'Unknown Room',
              currentTimeRange: `${TIMES[currentStartTimeIdx]} - ${TIMES[currentEndIdx].split(" - ")[1]}`,
              conflictingTimeRange: `${TIMES[conflictingStartIdx]} - ${TIMES[conflictingEndIdx].split(" - ")[1]}`,
              // FIXED: Add the missing day and timeSlot properties
              conflictingDay: selectedDay, // This was missing!
              timeSlot: overlapStartTime // This was also missing!
            });
          }
        }
      });
    }
  });
});


      // Display conflict alert if any conflicts found
      if (instructorConflicts.length > 0) {
        let alertMessage = `⚠️ INSTRUCTOR CONFLICT DETECTED!\n\n`;
        alertMessage += `Assigning ${selectedName} to ${item.code} (${item.raw.OccType}) (Occ ${item.raw.OccNumber}) will create the following conflicts:\n\n`;
        
        instructorConflicts.forEach((conflict, index) => {
          alertMessage += `${index + 1}. ${conflict.instructorName} is already assigned to ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${conflict.conflictingDay} at ${conflict.timeSlot}\n`;
        });
        
        alertMessage += `\nThe assignment will still be made, and conflicts will be recorded in the analytics section.`;
        alert(alertMessage);

        // Record instructor conflicts
        for (const conflict of instructorConflicts) {
          const conflictData = {
            Year: selectedYear,
            Semester: selectedSemester,
            Type: 'Instructor Conflict',
            Description: `${conflict.instructorName} assigned to both ${conflict.currentCourse} (${conflict.currentCourseType}) ${
              item.raw.OccNumber
                ? Array.isArray(item.raw.OccNumber)
                  ? `(Occ ${item.raw.OccNumber.join(", ")})`
                  : `(Occ ${item.raw.OccNumber})`
                : ""
            } in ${conflict.currentRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${conflict.conflictingDay} at ${conflict.timeSlot}`,
            CourseCode: item.code,
            InstructorID: conflict.instructorId,
            RoomID: room._id,
            Day: selectedDay,
            StartTime: conflict.timeSlot,
            Priority: 'High',
            Status: 'Pending'
          };
          
          try {
            await recordDragDropConflict(conflictData);
          } catch (error) {
            console.error("Failed to record instructor conflict:", error);
          }
        }
      }
    }
    
    // Apply the instructor selection (regardless of conflicts)
    const newTimetable = JSON.parse(JSON.stringify(timetable));
    newTimetable[selectedDay][room._id][tIdx][idx].selectedInstructorId = selectedId;
    newTimetable[selectedDay][room._id][tIdx][idx].selectedInstructor = selectedName;
    setTimetable(newTimetable);
    setIsModified(true);
  }}
>
  <option value="">Select Instructor</option>
  {instructors
    .filter(inst => (Array.isArray(item.instructors) ? item.instructors : [item.instructors]).includes(inst.name))
    .map(inst => (
      <option key={inst._id} value={inst._id}>{inst.name}</option>
    ))}
</select>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    )
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </td>
        );
      })}
    </tr>
  ))}
</tbody>
                </table>
              </DragDropContext>
            </div>
            {showDaySelector && (
              <div style={{
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
  <div style={{
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
            </div>
          </div>
          <table ref={allDaysTableRef} style={{ display: "none" }}></table>
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default Home;