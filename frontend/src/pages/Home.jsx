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
  const [conflictSummary, setConflictSummary] = useState({
  total: 0,
  roomCapacity: 0,
  roomDoubleBooking: 0,
  instructorConflict: 0,
  timeSlotExceeded: 0
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

  const recordDragDropConflict = async (conflictData) => {
  try {
    const token = localStorage.getItem('token');
    
    await axios.post(
      "http://localhost:3001/analytics/record-conflict",
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
    await axios.post("http://localhost:3001/home/publish-timetable", 
      { year: selectedYear, semester: selectedSemester },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    showAlert("Timetable published successfully!", "success");
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
const getAvailableInstructorsForEvent = (event, timetable, selectedDay) => {
  const { code: courseCode, raw } = event;
  const { OccType, OccNumber } = raw;
  
  // If this is a lecture, return all course instructors (no restrictions)
  if (OccType === "Lecture") {
    return instructors.filter(inst => 
      (Array.isArray(event.instructors) ? event.instructors : [event.instructors])
        .includes(inst.name)
    );
  }
  
  // If this is a tutorial, filter instructors based on lecture assignments
  if (OccType === "Tutorial") {
    const tutorialOccurrences = Array.isArray(OccNumber) ? OccNumber : [OccNumber];
    const availableInstructors = [];
    
    // Find all lecture events for this course
    const lectureEvents = [];
    DAYS.forEach(day => {
      if (timetable[day]) {
        Object.values(timetable[day]).forEach(roomSlots => {
          roomSlots.forEach(slot => {
            slot.forEach(item => {
              if (item && 
                  item.code === courseCode && 
                  item.raw?.OccType === "Lecture" &&
                  item.selectedInstructor && 
                  item.selectedInstructorId) {
                lectureEvents.push(item);
              }
            });
          });
        });
      }
    });
    
    // For each instructor in the course, check if they teach lectures that cover these tutorial occurrences
    instructors
      .filter(inst => 
        (Array.isArray(event.instructors) ? event.instructors : [event.instructors])
          .includes(inst.name)
      )
      .forEach(instructor => {
        // Find lecture events taught by this instructor for this course
        const instructorLectures = lectureEvents.filter(lecture => 
          lecture.selectedInstructorId === instructor._id
        );
        
        if (instructorLectures.length === 0) {
          // No lecture restriction - instructor can teach any tutorial
          availableInstructors.push(instructor);
        } else {
          // Check if any of the instructor's lectures cover these tutorial occurrences
          const canTeachTutorial = instructorLectures.some(lecture => {
            const lectureOccurrences = Array.isArray(lecture.raw.OccNumber) 
              ? lecture.raw.OccNumber 
              : [lecture.raw.OccNumber];
            
            // Check if there's any overlap between lecture occurrences and tutorial occurrences
            return tutorialOccurrences.some(tutOcc => 
              lectureOccurrences.includes(tutOcc)
            );
          });
          
          if (canTeachTutorial) {
            availableInstructors.push(instructor);
          }
        }
      });
    
    return availableInstructors;
  }
  
  // Default: return all course instructors
  return instructors.filter(inst => 
    (Array.isArray(event.instructors) ? event.instructors : [event.instructors])
      .includes(inst.name)
  );
};

/**
 * Check if an instructor assignment would violate occurrence restrictions
 */
const checkOccurrenceRestriction = (event, selectedInstructorId, timetable) => {
  const { code: courseCode, raw } = event;
  const { OccType, OccNumber } = raw;
  
  // Only apply restrictions to tutorials
  if (OccType !== "Tutorial") return null;
  
  const selectedInstructor = instructors.find(inst => inst._id === selectedInstructorId);
  if (!selectedInstructor) return null;
  
  const tutorialOccurrences = Array.isArray(OccNumber) ? OccNumber : [OccNumber];
  
  // Find all lecture events for this course taught by this instructor
  const instructorLectures = [];
  DAYS.forEach(day => {
    if (timetable[day]) {
      Object.values(timetable[day]).forEach(roomSlots => {
        roomSlots.forEach(slot => {
          slot.forEach(item => {
            if (item && 
                item.code === courseCode && 
                item.raw?.OccType === "Lecture" &&
                item.selectedInstructorId === selectedInstructorId) {
              instructorLectures.push(item);
            }
          });
        });
      });
    }
  });
  
  if (instructorLectures.length === 0) {
    // No lecture assignments - no restrictions
    return null;
  }
  
  // Check if any lecture covers these tutorial occurrences
  const validLectures = instructorLectures.filter(lecture => {
    const lectureOccurrences = Array.isArray(lecture.raw.OccNumber) 
      ? lecture.raw.OccNumber 
      : [lecture.raw.OccNumber];
    
    return tutorialOccurrences.some(tutOcc => 
      lectureOccurrences.includes(tutOcc)
    );
  });
  
  if (validLectures.length === 0) {
    return {
      isViolation: true,
      message: `${selectedInstructor.name} cannot teach tutorial for occurrences [${tutorialOccurrences.join(', ')}] because they are not assigned to teach lectures covering these occurrences.`,
      instructorLectures: instructorLectures.map(lec => ({
        occurrences: Array.isArray(lec.raw.OccNumber) ? lec.raw.OccNumber : [lec.raw.OccNumber],
        day: lec.raw.Day,
        time: lec.raw.StartTime
      }))
    };
  }
  
  return null; // No violation
};

const detectAllConflicts = (currentTimetable, currentCourses, currentRooms) => {
  console.log("=== DETECTING ALL CONFLICTS ===");
  
  const conflicts = {
    roomCapacity: [],
    roomDoubleBooking: [],
    instructorConflict: [],
    timeSlotExceeded: []
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
  allEvents.forEach(event => {
    const room = currentRooms.find(r => r._id === event.roomId);
    if (room && event.raw) {
      const requiredCapacity = calculateRequiredCapacity(
        event.code,
        event.raw.OccType,
        event.raw.OccNumber,
        currentCourses
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
      if (event1.id >= event2.id) return; // Avoid duplicates and self-comparison
      if (event1.roomId !== event2.roomId || event1.day !== event2.day) return;

      // Calculate overlap between the two events
      const event1Start = event1.timeIdx;
      const event1Duration = event1.raw?.Duration || 1;
      const event1End = event1Start + event1Duration - 1;

      const event2Start = event2.timeIdx;
      const event2Duration = event2.raw?.Duration || 1;
      const event2End = event2Start + event2Duration - 1;

      // Check if they overlap
      const hasOverlap = !(event1End < event2Start || event1Start > event2End);

      if (hasOverlap) {
        // Create a unique key for this conflict group (sorted event IDs)
        const conflictKey = `${event1.roomId}-${event1.day}-${[event1.id, event2.id].sort().join('-')}`;
        
        if (!roomConflictGroups.has(conflictKey)) {
          const room = currentRooms.find(r => r._id === event1.roomId);
          const overlapStart = Math.max(event1Start, event2Start);
          const overlapEnd = Math.min(event1End, event2End);
          
          roomConflictGroups.set(conflictKey, {
            id: `double-${conflictKey}`,
            type: 'Room Double Booking',
            roomCode: room?.code || 'Unknown',
            day: event1.day,
            time: TIMES[overlapStart] || `Time ${overlapStart}`,
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

  // Convert map to array
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

  const summary = {
    total: conflicts.roomCapacity.length + 
           conflicts.roomDoubleBooking.length + 
           conflicts.instructorConflict.length + 
           conflicts.timeSlotExceeded.length,
    roomCapacity: conflicts.roomCapacity.length,
    roomDoubleBooking: conflicts.roomDoubleBooking.length,
    instructorConflict: conflicts.instructorConflict.length,
    timeSlotExceeded: conflicts.timeSlotExceeded.length
  };

  console.log("Conflict Summary:", summary);
  console.log("Room double booking conflicts found:", conflicts.roomDoubleBooking.length);
  console.log("Room conflicts detail:", conflicts.roomDoubleBooking);
  
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

    // Record all conflicts in batch
    if (conflictsToRecord.length > 0) {
      const token = localStorage.getItem('token');
      
      // Record each conflict
      const recordPromises = conflictsToRecord.map(conflictData => 
        axios.post(
          "http://localhost:3001/analytics/record-conflict",
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
  if (!timetable || Object.keys(timetable).length === 0 || !courses.length || !rooms.length) {
    setConflictSummary({
      total: 0,
      roomCapacity: 0,
      roomDoubleBooking: 0,
      instructorConflict: 0,
      timeSlotExceeded: 0
    });
    return;
  }

  console.log("Detecting conflicts after timetable change...");
  const conflictResults = detectAllConflicts(timetable, courses, rooms);
  const { summary, details } = conflictResults;
  
  setConflictSummary(summary);
  
  // AUTO-RECORD FRONTEND CONFLICTS
  // if (summary.total > 0) {
  //   recordFrontendConflicts(conflictResults);
  // }
  
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
  alertMessage += `${index + 1}. Instructor Conflict: ${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) (Occ ${conflict.movedCourseOccNumber}) in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${targetDay} at ${conflict.overlapTimeRange}\n`; // FIXED: Use overlapTimeRange
}
    });
    alertMessage += "\nThe move will still be performed, and conflicts will be recorded in the analytics section.";

    // const confirmed = await new Promise(resolve => {
    //     showConfirm(
    //       alertMessage,
    //       "Conflicts Detected",
    //       () => resolve(true),
    //       () => resolve(false)
    //     );
    //   });
      
    //   if (!confirmed) return;

      if (!confirm(alertMessage)) {
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
    courses
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
  alertMessage += `${index + 1}. Instructor Conflict: ${conflict.instructorName} assigned to both ${conflict.movedCourse} (${conflict.movedCourseType}) (Occ ${conflict.movedCourseOccNumber}) in ${conflict.movedRoomCode} and ${conflict.conflictingCourse} (${conflict.conflictingCourseType}) ${conflict.conflictingFormattedOccNumber} in ${conflict.conflictingRoomCode} on ${targetDay} at ${conflict.overlapTimeRange}\n`; // FIXED: Use overlapTimeRange
}
    });
    alertMessage += "\nThe move will still be performed, and conflicts will be recorded in the analytics section.";
    
    // const confirmed = await new Promise(resolve => {
    //     showConfirm(
    //       alertMessage,
    //       "Conflicts Detected",
    //       () => resolve(true),
    //       () => resolve(false)
    //     );
    //   });
      
    //   if (!confirmed) return;

    if (!confirm(alertMessage)) {
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
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      "http://localhost:3001/home/generate-timetable",
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
        // Only place in the starting slot, let UI handle colspan for multi-hour events
        newTimetable[sch.Day][roomId][timeIdx].push({
          id: String(sch._id),
          code: sch.CourseCode,
          instructors: sch.OriginalInstructors || sch.Instructors || [],
          selectedInstructor:
            Array.isArray(sch.Instructors) && sch.Instructors.length === 1
              ? sch.Instructors[0]
              : "",
          selectedInstructorId: sch.InstructorID || "",
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
        `http://localhost:3001/analytics/clear-frontend-conflicts`,
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
      showAlert(
        `Timetable generated with ${totalSchedules} scheduled events.\n\n⚠️ ${totalConflicts} conflict${totalConflicts !== 1 ? 's' : ''} detected and recorded in the Analytics section. Please review the conflict reports for details.`,
        "warning",
        8000
      );
    } else {
      showAlert(
        `Timetable generated successfully with ${totalSchedules} scheduled events and no conflicts detected!`,
        "success"
      );
    }
    
  } catch (error) {
    showAlert("Failed to generate timetable.", "error");
    console.error(error);
  }
};

const generateConflictId = (conflict, conflictType) => {
  switch (conflictType) {
    case 'Room Capacity':
      return `capacity_${conflict.courseCode}_${conflict.roomCode}_${conflict.day}_${conflict.time}`;
    
    case 'Room Double Booking':
      // Sort course codes to ensure consistent ID regardless of order
      const sortedCourses = conflict.conflictingEvents.map(e => e.courseCode).sort();
      return `double_${sortedCourses.join('_')}_${conflict.roomCode}_${conflict.day}_${conflict.time}`;
    
    case 'Instructor Conflict':
      // Sort course codes to ensure consistent ID regardless of order
      const sortedInstructorCourses = conflict.conflictingEvents.map(e => e.courseCode).sort();
      return `instructor_${conflict.instructorId}_${sortedInstructorCourses.join('_')}_${conflict.day}_${conflict.timeRange || conflict.time}`;
    
    case 'Time Slot Exceeded':
      return `timeslot_${conflict.courseCode}_${conflict.day}_${conflict.startTime}`;
    
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
      `http://localhost:3001/analytics/conflicts?year=${selectedYear}&semester=${selectedSemester}&status=active`,
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
        // Only process if conflict has required properties and is not resolved
        if (!conflict || !conflict.Type || 
            conflict.Status === 'Resolved' || 
            conflict.Status === 'Closed' || 
            conflict.Status === 'Dismissed') {
          console.log("Skipping resolved or invalid conflict:", conflict);
          return;
        }
        
        // Generate ID based on the conflict data from database
        let conflictId;
        try {
          switch (conflict.Type) {
            case 'Room Capacity':
              conflictId = `capacity_${conflict.CourseCode}_${rooms.find(r => r._id === conflict.RoomID)?.code || 'Unknown'}_${conflict.Day}_${conflict.StartTime}`;
              break;
            case 'Room Double Booking':
              // For existing conflicts, we need to parse the description to get course codes
              const courseMatches = conflict.Description ? conflict.Description.match(/([A-Z]{3}\d{4})/g) : null;
              if (courseMatches && courseMatches.length >= 2) {
                const sortedCourses = courseMatches.slice(0, 2).sort();
                conflictId = `double_${sortedCourses.join('_')}_${rooms.find(r => r._id === conflict.RoomID)?.code || 'Unknown'}_${conflict.Day}_${conflict.StartTime}`;
              } else {
                conflictId = `double_unknown_${conflict.Day}_${conflict.StartTime}`;
              }
              break;
            case 'Instructor Conflict':
              // Similar parsing for instructor conflicts
              const instrCourseMatches = conflict.Description ? conflict.Description.match(/([A-Z]{3}\d{4})/g) : null;
              if (instrCourseMatches && instrCourseMatches.length >= 2) {
                const sortedInstrCourses = instrCourseMatches.slice(0, 2).sort();
                conflictId = `instructor_${conflict.InstructorID}_${sortedInstrCourses.join('_')}_${conflict.Day}_${conflict.StartTime}`;
              } else {
                conflictId = `instructor_${conflict.InstructorID}_unknown_${conflict.Day}_${conflict.StartTime}`;
              }
              break;
            case 'Time Slot Exceeded':
              conflictId = `timeslot_${conflict.CourseCode}_${conflict.Day}_${conflict.StartTime}`;
              break;
            default:
              conflictId = `existing_${conflict._id}`;
          }
          
          if (conflictId) {
            existingActiveConflictIds.add(conflictId);
            console.log(`Active conflict ID: ${conflictId} (Status: ${conflict.Status})`);
          }
        } catch (err) {
          console.error("Error processing existing active conflict:", conflict, err);
        }
      });
    }
    
    console.log(`Generated ${existingActiveConflictIds.size} existing active conflict IDs`);



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
      
      console.log(`Successfully recorded ${newConflictsCount} new conflicts. ${existingActiveConflicts.length} existing active conflicts were preserved.`);
    }

    // STEP 7: Save the timetable
    await axios.post(
      "http://localhost:3001/home/save-timetable",
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
    const headers = ["Day", "Time Slot", "End Time", "Duration (Hours)", "Room Code", "Room Capacity", "Course Code", "Occurrence Type", "Occurrence Number", "Instructors"];
    csvData.push(headers);

    // FIXED: Add Set to track exported events and prevent duplicates
    const exportedEvents = new Set();

    DAYS.forEach(day => {
      Object.entries(timetable[day] || {}).forEach(([roomId, slots]) => {
        const room = rooms.find(r => r._id === roomId);
        const roomCode = room ? room.code : "Unknown";
        const roomCapacity = room && room.capacity ? room.capacity : "N/A";

        slots.forEach((slot, timeIdx) => {
          slot.forEach(item => {
            // CRITICAL FIX: Only export events that match current filters
            if (item && item.raw && !exportedEvents.has(item.id) && isEventMatchingAllFilters(item)) {
              exportedEvents.add(item.id); // Mark as exported
              
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
              div.innerHTML = `<div><strong>${event.code} (${event.raw.OccType})${duration > 1 ? ` (${duration}h)` : ""}</strong></div>
                <div style="font-size: 13px">${event.raw.OccNumber ? (Array.isArray(event.raw.OccNumber) ? `(Occ ${event.raw.OccNumber.join(", ")})` : `(Occ ${event.raw.OccNumber})`) : ""} ${event.selectedInstructor || "No Instructor Assigned"}</div>`;

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
      onClick={handleExportClick}
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
                                    {event.raw.OccNumber && (
                                      Array.isArray(event.raw.OccNumber)
                                        ? `(Occ ${event.raw.OccNumber.join(", ")})`
                                        : `(Occ ${event.raw.OccNumber})`
                                    )}
                                    <select
  value={event.selectedInstructorId || ""}
  onChange={async (e) => {
  const selectedId = e.target.value;
  const selectedInstructorObj = instructors.find(inst => inst._id === selectedId);
  const selectedName = selectedInstructorObj ? selectedInstructorObj.name : "";
  
  // Check for occurrence restriction violations
  if (selectedId && selectedId.trim() !== "") {
    const occurrenceViolation = checkOccurrenceRestriction(event, selectedId, timetable);
    
    if (occurrenceViolation && occurrenceViolation.isViolation) {
      let violationMessage = `Occurrence Restriction Violation:\n\n${occurrenceViolation.message}\n\n`;
      
      if (occurrenceViolation.instructorLectures.length > 0) {
        violationMessage += "This instructor teaches lectures for the following occurrences:\n";
        occurrenceViolation.instructorLectures.forEach((lecture, index) => {
          violationMessage += `${index + 1}. Occurrences [${lecture.occurrences.join(', ')}] on ${lecture.day} at ${lecture.time}\n`;
        });
        violationMessage += "\nTo assign this instructor to this tutorial, they must also teach a lecture covering the same occurrences.";
      }
      
      violationMessage += "\n\nDo you want to proceed anyway? This will create a scheduling violation that will be recorded when you save the timetable.";
      
      if (!confirm(violationMessage)) {
        return; // Don't apply the change
      }
      
      // NOTE: Removed recordDragDropConflict call - conflicts will be recorded on save
    }
    
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
  {getAvailableInstructorsForEvent(event, timetable, selectedDay)
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
  data-modal="day-selector"
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
    background: isModified ? "#ccc" : "#08CB00",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 36px",
    fontWeight: 500,
    fontSize: 16,
    cursor: isModified ? "not-allowed" : "pointer",
    opacity: isModified ? 0.6 : 1,
    transition: "all 0.2s ease"
  }}
  onClick={handlePublish}
  disabled={isModified}
  title={isModified ? "Please save your changes before publishing" : "Publish the current timetable"}
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