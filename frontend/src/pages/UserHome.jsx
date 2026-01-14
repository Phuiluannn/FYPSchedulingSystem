import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from './SideBar';
import ProtectedRoute from './ProtectedRoute';
import { BiExport, BiSearch, BiX } from "react-icons/bi";
import Papa from "papaparse";
import html2canvas from "html2canvas";
import { useAlert } from './AlertContext';
import { useSearchParams, useLocation } from 'react-router-dom';

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

function UserHome() {
  const [rooms, setRooms] = useState([]);
  const [roomsReady, setRoomsReady] = useState(false);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [selectedYear, setSelectedYear] = useState("2025/2026");
  const [selectedSemester, setSelectedSemester] = useState("1");
  const [timetable, setTimetable] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("png");
  const [exportModalPosition, setExportModalPosition] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [instructors, setInstructors] = useState([]);
  const [selectedStudentYear, setSelectedStudentYear] = useState("All");
  const [courses, setCourses] = useState([]);
  const [selectedStudentYears, setSelectedStudentYears] = useState(["All"]);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  
  const tableRef = useRef(null);
  const allDaysTableRef = useRef(null);
  const exportButtonRef = useRef(null);
  const role = localStorage.getItem('role') || 'student';
  const { showAlert, showConfirm } = useAlert();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const containerRef = useRef(null);
  
  useEffect(() => {
    // Check navigation state first (from notification click)
    const stateYear = location.state?.year;
    const stateSemester = location.state?.semester;
    
    // Then check URL params (for direct links)
    const yearFromUrl = searchParams.get('year');
    const semesterFromUrl = searchParams.get('semester');
    
    // Prioritize state over URL params
    const targetYear = stateYear || yearFromUrl;
    const targetSemester = stateSemester || semesterFromUrl;
    
    if (targetYear) {
      console.log('📅 Year from notification:', targetYear);
      setSelectedYear(targetYear);
    }
    
    if (targetSemester) {
      console.log('📅 Semester from notification:', targetSemester);
      setSelectedSemester(targetSemester);
    }
    
    // Clear state after using it
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [searchParams, location.state]);

  // Check if event matches search query
  const isEventMatchingSearch = (item) => {
    if (!searchQuery.trim()) return true;
    return item.code.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Check if event matches student year filter
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

// Combined filter function
const isEventMatchingAllFilters = (item) => {
  const matchesSearch = !searchQuery.trim() || item.code.toLowerCase().includes(searchQuery.toLowerCase());
  const matchesYear = isEventMatchingYearFilter(item);
  return matchesSearch && matchesYear;
};

  // Get unique courses from timetable for search
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

  // Update filtered courses when search query changes
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

  // Fetch rooms
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
        console.error("Error fetching rooms:", error);
        setRooms([]);
        setRoomsReady(true);
      }
    };
    fetchRooms();
  }, []);

  // Fetch published timetable
  useEffect(() => {
  if (!roomsReady || instructors.length === 0) return;

  const fetchPublishedTimetable = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // CRITICAL FIX: Ensure publishedOnly=true is properly sent as boolean
      const response = await axios.get(
        `http://localhost:3001/home/get-timetable?year=${selectedYear}&semester=${selectedSemester}&publishedOnly=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const schedules = response.data.schedules;
      console.log("=== USER SIDE FETCH DEBUG ===");
      console.log("Raw schedules received:", schedules.length);
      console.log("Sample schedules with Published status:");
      schedules.slice(0, 3).forEach((sch, index) => {
        console.log(`Schedule ${index}: CourseCode=${sch.CourseCode}, Published=${sch.Published}`);
      });
      
      // CRITICAL FIX: Double-check that all received schedules are actually published
      const unpublishedSchedules = schedules.filter(sch => !sch.Published);
      if (unpublishedSchedules.length > 0) {
        console.error("❌ ERROR: Received unpublished schedules from backend!");
        console.error("Unpublished schedules:", unpublishedSchedules.map(s => ({
          courseCode: s.CourseCode,
          published: s.Published
        })));
        // You might want to filter these out or show an error
      }
      
      if (schedules.length === 0) {
        console.log("No published schedules found");
        setIsPublished(false);
        setTimetable({});
        setLoading(false);
        return;
      }

      setIsPublished(true);
      
      const allTimetables = {};
      
      DAYS.forEach(day => {
        allTimetables[day] = {};
        rooms.forEach(room => {
          allTimetables[day][room._id] = TIMES.map(() => []);
        });
      });
      
      schedules.forEach((sch, index) => {
        console.log(`Processing schedule ${index}:`, {
          courseCode: sch.CourseCode,
          instructors: sch.Instructors,
          instructorID: sch.InstructorID,
          originalInstructors: sch.OriginalInstructors,
          published: sch.Published
        });
        
        const roomId = sch.RoomID;
        const day = sch.Day;
        const timeIdx = TIMES.findIndex(t => t === sch.StartTime);
        const duration = sch.Duration || 1;
        
        if (roomId && timeIdx !== -1 && allTimetables[day]) {
          // Improved instructor name resolution for user side
          let instructorName = "No Instructor Assigned";

// ONLY show instructor if explicitly assigned (InstructorID exists)
if (sch.InstructorID && instructors.length > 0) {
  const foundInstructor = instructors.find(inst => inst._id === sch.InstructorID);
  if (foundInstructor) {
    instructorName = foundInstructor.name;
    console.log(`Found instructor by ID: ${sch.InstructorID} -> ${instructorName}`);
  } else {
    console.log(`InstructorID exists but instructor not found: ${sch.InstructorID}`);
  }
} else {
  console.log(`No instructor assignment for ${sch.CourseCode} (InstructorID: ${sch.InstructorID})`);
}

          const scheduleItem = {
            id: String(sch._id),
            code: sch.CourseCode,
            instructorName: instructorName,
            raw: {
              ...sch,
              Duration: duration,
            },
          };

          console.log(`Created schedule item for ${sch.CourseCode}: instructor = ${instructorName}, published = ${sch.Published}`);

          // Only place the item in the starting time slot
          allTimetables[day][roomId][timeIdx].push(scheduleItem);
        }
      });
      
      setTimetable(allTimetables);
      
    } catch (error) {
      console.error("Error fetching published timetable:", error);
      setIsPublished(false);
      const initial = {};
      DAYS.forEach(day => {
        initial[day] = {};
        rooms.forEach(room => {
          initial[day][room._id] = TIMES.map(() => []);
        });
      });
      setTimetable(initial);
    }
    setLoading(false);
  };

  fetchPublishedTimetable();
}, [roomsReady, rooms, selectedYear, selectedSemester, instructors, courses]);

  useEffect(() => {
  const fetchInstructors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get("http://localhost:3001/instructors", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInstructors(response.data);
      console.log("Fetched instructors for user side:", response.data.length);
    } catch (error) {
      console.error("Error fetching instructors:", error);
      setInstructors([]);
    }
  };
  fetchInstructors();
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

  // Handle export modal positioning
  const calculateModalPosition = () => {
  if (!exportButtonRef.current) return { x: 100, y: 100 };
  
  const buttonRect = exportButtonRef.current.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  const modalWidth = 250;
  const modalHeight = 120;
  const padding = 10;
  
  // Position to the right of button, but ensure it stays in viewport
  let x = buttonRect.right + scrollX - modalWidth; // Align right edge of modal with right edge of button
  let y = buttonRect.bottom + scrollY + 8;
  
  // Ensure modal stays within viewport bounds
  x = Math.max(padding, Math.min(x, window.innerWidth - modalWidth - padding));
  y = Math.max(padding, Math.min(y, window.innerHeight - modalHeight - padding));
  
  return { x, y };
};

  // Handle export button click
const handleExportClick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (!isPublished) {
    showAlert("No published timetable available to export.", "warning");
    return;
  }
  
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

  // Handle export functionality
  const handleExportTimetable = async (format) => {
  if (!timetable || Object.keys(timetable).length === 0) {
    showAlert("No timetable data available to export.", "warning");
    return;
  }

  if (format === "csv") {
    const csvData = [];
    // ✅ ADD "Departments" to headers
    const headers = ["Day", "Time Slot", "End Time", "Duration (Hours)", "Room Code", "Room Capacity", "Course Code", "Occurrence Type", "Occurrence Number", "Departments", "Estimated Students", "Instructor"];
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
              
              // ✅ ADD: Extract departments
              const departments = item.raw.Departments && Array.isArray(item.raw.Departments) && item.raw.Departments.length > 0
                ? item.raw.Departments.join(", ")
                : "N/A";
              
              const estimatedStudents = item.raw.EstimatedStudents || "N/A";
              
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
                departments,  // ✅ ADD this
                estimatedStudents,  // ✅ ADD this
                item.instructorName || "No Instructor Assigned",
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
    
    const filename = `published_timetable_${selectedYear.replace("/", "-")}_sem${selectedSemester}_all_days${filterSuffix}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Image export logic with filtering
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
    let headerText = `Published Timetable - ${selectedYear}, Semester ${selectedSemester}`;
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
        
        // Build lanes but only with filtered events
        const lanes = [];
        for (let timeIdx = 0; timeIdx < TIMES.length; timeIdx++) {
          const slotEvents = daySlots[timeIdx] || [];
          slotEvents.forEach(event => {
            // CRITICAL: Only include events that match the current filters
            if (!isEventMatchingAllFilters(event)) return;
            
            const duration = event.raw?.Duration || 1;
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

        for (let laneIdx = 0; laneIdx < maxLanes; laneIdx++) {
          const row = document.createElement("tr");

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

              // ✅ ADD: Extract departments for display
              const departments = event.raw.Departments && Array.isArray(event.raw.Departments) && event.raw.Departments.length > 0
                ? event.raw.Departments.join(", ")
                : "";

              const departmentDisplay = departments 
                ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">${departments}</div>` 
                : "";

              div.innerHTML = `
                <div><strong>${event.code} (${event.raw.OccType})${duration > 1 ? ` (${duration}h)` : ""}</strong></div>
                <div style="font-size: 13px">
                  ${event.raw.OccNumber ? (Array.isArray(event.raw.OccNumber) ? `(Occ ${event.raw.OccNumber.join(", ")})` : `(Occ ${event.raw.OccNumber})`) : ""} 
                  ${event.instructorName}
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
      
      const filename = `published_timetable_${selectedYear.replace("/", "-")}_sem${selectedSemester}_all_days${filterSuffix}.${format}`;
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

  // Handle day change
  const handleDayChange = (e) => {
    setSelectedDay(e.target.value);
  };

  // Handle export modal close
  useEffect(() => {
    if (showExportModal) {
    //   const handleClickOutside = (event) => {
    //     const modal = document.querySelector('[data-modal="export"]');
    //     if (modal && !modal.contains(event.target)) {
    //       setShowExportModal(false);
    //     }
    //   };
      
    //   const handleScroll = () => {
    //     setShowExportModal(false);
    //   };
      
    //   window.addEventListener('click', handleClickOutside);
    //   window.addEventListener('scroll', handleScroll, true);
      
    //   return () => {
    //     window.removeEventListener('click', handleClickOutside);
    //     window.removeEventListener('scroll', handleScroll, true);
    //   };
    }
  }, [showExportModal]);

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
  if (showExportModal) {
    const handleClickOutside = (event) => {
      const modal = document.querySelector('[data-modal="export"]');
      if (modal && !modal.contains(event.target)) {
        setShowExportModal(false);
      }
    };
    
    const handleScroll = () => {
      setShowExportModal(false);
    };
    
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }
}, [showExportModal]);

useEffect(() => {
  const updateModalPosition = () => {
    if (showExportModal && exportButtonRef.current && containerRef.current) {
      const buttonRect = exportButtonRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      const modalWidth = 250;
      const modalHeight = 120;
      
      let x = buttonRect.left - containerRect.left;
      let y = buttonRect.bottom - containerRect.top + 8;
      
      const containerWidth = containerRef.current.offsetWidth;
      if (x + modalWidth > containerWidth) {
        x = buttonRect.right - containerRect.left - modalWidth;
      }
      
      if (x < 15) {
        x = 15;
      }
      
      const containerHeight = containerRef.current.offsetHeight;
      if (y + modalHeight > containerHeight) {
        y = buttonRect.top - containerRect.top - modalHeight - 8;
        if (y < 15) {
          y = 15;
        }
      }
      
      setExportModalPosition({ x, y });
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

  const handleExportConfirm = () => {
    handleExportTimetable(selectedExportFormat);
    setShowExportModal(false);
  };

  const handleExportCancel = () => {
    setShowExportModal(false);
  };

  return (
    <ProtectedRoute>
      <SideBar role={role}>
        <div style={{ maxWidth: 1700, margin: "0 auto 0 auto", padding: "0 10px 0 30px", paddingLeft: "10px" }}>
          <h2 className="fw-bold mb-4">Timetable</h2>
          
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}>
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
                  background: isPublished ? "#015551" : "#ccc",
                  fontWeight: 500,
                  fontSize: 16,
                  color: "#fff",
                  cursor: isPublished ? "pointer" : "not-allowed"
                }}
                onClick={handleExportClick}
                disabled={!isPublished}
              >
                <BiExport style={{ fontSize: 20}} />
                Export
              </button>
            </div>
          </div>

          <div 
          ref={containerRef}
          style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            padding: "30px",
            maxWidth: 1800,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            position: "relative", // MAKE SURE THIS EXISTS
          }}>
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

            {loading ? (
              <div style={{ textAlign: "center", padding: "50px", fontSize: "16px", color: "#666" }}>
                Loading timetable...
              </div>
            ) : !isPublished ? (
              <div style={{ textAlign: "center", padding: "50px", fontSize: "16px", color: "#666" }}>
                No published timetable available for {selectedYear}, Semester {selectedSemester}.
              </div>
            ) : (
              <div className="table-responsive" style={{ flex: 1, overflowY: "auto"}}>
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
                      if (!room || !room._id) return null;

                      if (!timetable[selectedDay] || !timetable[selectedDay][room._id]) {
                        return (
                          <tr key={room._id || rIdx}>
                            <td style={{ padding: "8px 12px", border: "1px solid #ccc", fontWeight: 600 }}>
                              {room.code} {room.capacity ? `(${room.capacity})` : ""}<br />
                              <span style={{ fontWeight: 400, fontSize: 13, color: "#555" }}>
                                {room.building || room.block}
                              </span>
                            </td>
                            {TIMES.map((_, tIdx) => (
                              <td key={tIdx} style={{ border: "1px solid #ccc", height: 48, minWidth: 120 }}></td>
                            ))}
                          </tr>
                        );
                      }

                      const daySlots = timetable[selectedDay][room._id] || [];
                      
                      // Build lanes for display
                      const lanes = [];
                      for (let timeIdx = 0; timeIdx < TIMES.length; timeIdx++) {
                        const slotEvents = daySlots[timeIdx] || [];
                        slotEvents.forEach(event => {
                          const duration = event.raw?.Duration || 1;
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
                          if (!placed) {
                            const newLane = Array(TIMES.length).fill(null);
                            for (let d = 0; d < duration; d++) {
                              newLane[timeIdx + d] = event;
                            }
                            lanes.push(newLane);
                          }
                        });
                      }

                      const maxLanes = Math.max(lanes.length, 1);

                      // Render each lane as a separate row
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
                            
                            {/* Render time slots for this lane */}
                            {TIMES.map((_, timeIdx) => {
                              const event = lanes[laneIdx]?.[timeIdx];
                              
                              if (event) {
                                // Check if this is the START of the event
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
                                      {isEventMatchingAllFilters(event) && (
  <div
    style={{
      padding: "6px 10px",
      margin: "2px",
      minHeight: "32px",
      backgroundColor: event.raw.OccType === "Lecture" ? "#e2e8f0" : "#d4f4e2",
      borderRadius: 6,
      fontWeight: 500,
      fontSize: 15,
      border: (searchQuery.trim() && event.code.toLowerCase().includes(searchQuery.toLowerCase())) || 
              (!selectedStudentYears.includes("All") && !isEventMatchingYearFilter(event))
        ? "2px solid #015551" 
        : "2px solid transparent",
      opacity: isEventMatchingAllFilters(event) ? 1 : 0.3,
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
       {event.raw.Departments && event.raw.Departments.length > 0 && (
    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
      {event.raw.Departments.join(", ")}
    </div>
  )}{event.instructorName}
    </div>
  </div>
)}
                                    </td>
                                  );
                                } else {
                                  // This is a continuation slot, don't render a cell
                                  return null;
                                }
                              } else {
                                // Empty slot
                                return (
                                  <td
                                    key={`${room._id}-${laneIdx}-${timeIdx}`}
                                    style={{ 
                                      border: "1px solid #ccc", 
                                      height: 48, 
                                      minWidth: 120 
                                    }}
                                  >
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
              </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
            <div 
              data-modal="export"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",  // CHANGED from "fixed"
                top: `${exportModalPosition.y}px`,
                left: `${exportModalPosition.x}px`,
                background: "#fff",
                padding: "20px",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                zIndex: 1000,
                width: "250px",
                border: "1px solid #e0e0e0"
              }}
            >
              <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>Select Export Format</h3>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "14px", marginBottom: "5px" }}>Format</label>
                <select
                  value={selectedExportFormat}
                  onChange={(e) => setSelectedExportFormat(e.target.value)}
                  style={{ width: "100%", padding: "8px", fontSize: "14px" }}
                >
                  {/* <option value="csv">CSV</option> */}
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
          </div>
          
          {/* Hidden table for image export */}
          <table ref={allDaysTableRef} style={{ display: "none" }}></table>
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default UserHome;