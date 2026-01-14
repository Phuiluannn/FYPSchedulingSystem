import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from './SideBar';
import ProtectedRoute from './ProtectedRoute';
import { BiExport, BiCalendar, BiTime, BiMapPin, BiUser, BiBook } from "react-icons/bi";
import Papa from "papaparse";
import html2canvas from "html2canvas";
import { useAlert } from './AlertContext';

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

function InstructorTimetable() {
  const [selectedYear, setSelectedYear] = useState("2025/2026");
  const [selectedSemester, setSelectedSemester] = useState("1");
  const [timetable, setTimetable] = useState({});
  const [instructorInfo, setInstructorInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noDataMessage, setNoDataMessage] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportModalPosition, setExportModalPosition] = useState({ x: 0, y: 0 });
  const exportButtonRef = useRef(null);
  const tableRef = useRef(null);
  const containerRef = useRef(null);
  const [hasSchedules, setHasSchedules] = useState(false);
  const { showAlert, showConfirm } = useAlert();

  // Get instructor info from localStorage or token
  useEffect(() => {
    const fetchInstructorInfo = async () => {
      try {
        console.log("🔍 Starting instructor info fetch...");
        
        // Get user data from localStorage (stored during login)
        const userName = localStorage.getItem('name');
        const userRole = localStorage.getItem('role');
        
        console.log("📦 Stored user data:", { userName, userRole });
        
        if (!userName || !userRole) {
          console.log("❌ No auth data found in localStorage");
          setNoDataMessage("Please log in again.");
          setLoading(false);
          return;
        }
        
        if (userRole !== 'instructor') {
          console.log("❌ User role is not instructor:", userRole);
          setNoDataMessage("Access denied. Only instructors can view this page.");
          setLoading(false);
          return;
        }
        
        // Get instructor details from instructor collection
        console.log("📡 Fetching instructors list...");
        const token = localStorage.getItem('token');
        const instructorsResponse = await axios.get("http://localhost:3001/instructors", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("✅ Instructors response:", instructorsResponse.data);
        console.log("🔍 Looking for instructor with name:", userName);
        
        // Match instructor by name (case-insensitive and trimmed)
        const userNameClean = userName.toLowerCase().trim();
        const matchingInstructor = instructorsResponse.data.find(
          instructor => {
            const instructorName = instructor.name.toLowerCase().trim();
            console.log(`🔍 Comparing "${userNameClean}" with "${instructorName}"`);
            return instructorName === userNameClean;
          }
        );
        
        console.log("🎯 Matching instructor found:", matchingInstructor);
        
        if (matchingInstructor) {
          // Check if instructor is active
          if (matchingInstructor.status !== 'Active') {
            console.log("❌ Instructor is not active:", matchingInstructor.status);
            setNoDataMessage("Your instructor account is inactive. Please contact the administrator.");
            setLoading(false);
            return;
          }
          
          // Combine auth info with instructor details
          const combinedInfo = {
            name: userName,
            role: userRole,
            ...matchingInstructor,
            instructorId: matchingInstructor._id, // Store the instructor ObjectId
            department: matchingInstructor.department // Ensure we have department info
          };
          
          console.log("✅ Combined instructor info:", combinedInfo);
          setInstructorInfo(combinedInfo);
        } else {
          console.log("❌ No matching instructor found");
          console.log("Available instructor names:", instructorsResponse.data.map(i => i.name));
          setNoDataMessage(`Instructor profile not found for "${userName}". Please contact the administrator.`);
        }
        
      } catch (error) {
        console.error("❌ Error fetching instructor info:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        setNoDataMessage("Failed to load instructor information. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchInstructorInfo();
  }, []);

  // Fetch rooms data
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:3001/rooms", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRooms(response.data);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        setRooms([]);
      }
    };
    fetchRooms();
  }, []);

  // Fetch instructor's timetable
  useEffect(() => {
    if (!instructorInfo) return;

    const fetchInstructorTimetable = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        // Fetch published timetables only
        const response = await axios.get(
          `http://localhost:3001/home/get-timetable?year=${selectedYear}&semester=${selectedSemester}&publishedOnly=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const schedules = response.data.schedules;
        console.log("All schedules:", schedules);
        
        // Filter schedules assigned to this instructor
        const instructorSchedules = schedules.filter(schedule => {
  // ONLY show courses where instructor is specifically assigned via InstructorID
  // Do NOT show courses where instructor is just in the general Instructors array
  return schedule.InstructorID === instructorInfo.instructorId;
});

console.log("Filtered instructor schedules (only specifically assigned):", instructorSchedules);
        
        if (instructorSchedules.length === 0) {
          setNoDataMessage(`No timetable assignments found for ${selectedYear} Semester ${selectedSemester}.`);
          setTimetable({});
          setHasSchedules(false);
        } else {
          // Organize schedules by day and time
          const organizedTimetable = {};
          
          DAYS.forEach(day => {
            organizedTimetable[day] = [];
          });
          
          instructorSchedules.forEach(schedule => {
            const day = schedule.Day;
            const timeIdx = TIMES.findIndex(t => t === schedule.StartTime);
            const duration = schedule.Duration || 1;
            
            if (day && timeIdx !== -1) {
              organizedTimetable[day].push({
                id: schedule._id,
                courseCode: schedule.CourseCode,
                occType: schedule.OccType,
                occNumber: schedule.OccNumber,
                roomId: schedule.RoomID,
                startTime: schedule.StartTime,
                endTime: schedule.EndTime,
                duration: duration,
                timeIdx: timeIdx,
                raw: schedule
              });
            }
          });
          
          // Sort events by time for each day
          Object.keys(organizedTimetable).forEach(day => {
            organizedTimetable[day].sort((a, b) => a.timeIdx - b.timeIdx);
          });
          
          setTimetable(organizedTimetable);
          setHasSchedules(true);
          setNoDataMessage("");
        }
      } catch (error) {
        console.error("Error fetching instructor timetable:", error);
        setNoDataMessage("Failed to load timetable data.");
        setTimetable({});
        setHasSchedules(false);
      } finally {
        setLoading(false);
      }
    };

    fetchInstructorTimetable();
  }, [instructorInfo, selectedYear, selectedSemester]);

  // Get room details by ID
  const getRoomDetails = (roomId) => {
    const room = rooms.find(r => r._id === roomId);
    return room ? {
      code: room.code,
      capacity: room.capacity,
      building: room.building || room.block
    } : {
      code: "Unknown Room",
      capacity: "N/A",
      building: "N/A"
    };
  };
  
  const calculateModalPosition = () => {
  if (!exportButtonRef.current) return { x: 100, y: 100 };
  
  const buttonRect = exportButtonRef.current.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  const modalWidth = 250;
  const modalHeight = 120;
  const padding = 10;
  
  // Position below the button, aligned to the right edge
  let x = buttonRect.right + scrollX - modalWidth; // Align right edge of modal with right edge of button
  let y = buttonRect.bottom + scrollY + 8; // 8px gap below button
  
  // Ensure modal stays within viewport bounds
  x = Math.max(padding, Math.min(x, window.innerWidth - modalWidth - padding));
  y = Math.max(padding, Math.min(y, window.innerHeight - modalHeight - padding));
  
  return { x, y };
};

  // Export functionality
  const handleExportClick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Use the working position calculation
  const position = calculateModalPosition();
  console.log("Modal position:", position);
  
  setExportModalPosition(position);
  setShowExportModal(true);
};

  const handleExportTimetable = async (format) => {
    if (!timetable || Object.keys(timetable).length === 0) {
      showAlert("No timetable data available to export.", "warning");
      return;
    }

    if (format === "csv") {
      const csvData = [];
      const headers = ["Day", "Time", "Duration (Hours)", "Course Code", "Type", "Occurrence", "Room", "Building", "Departments", "Estimated Students"];
      csvData.push(headers);

      DAYS.forEach(day => {
        const dayEvents = timetable[day] || [];
        dayEvents.forEach(event => {
          const roomDetails = getRoomDetails(event.roomId);
          const occText = Array.isArray(event.occNumber) 
            ? event.occNumber.join(", ") 
            : event.occNumber || "N/A";
          
          const departments = event.raw.Departments && Array.isArray(event.raw.Departments) && event.raw.Departments.length > 0
            ? event.raw.Departments.join(", ")
            : "N/A";

          csvData.push([
            day,
            event.startTime,
            event.duration,
            event.courseCode,
            event.occType,
            occText,
            roomDetails.code,
            roomDetails.building,
            departments,  // Add this
            event.raw.EstimatedStudents || "N/A"  // Add this if you want
          ]);
        });
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `instructor_timetable_${instructorInfo?.name?.replace(/\s+/g, '_')}_${selectedYear.replace("/", "-")}_sem${selectedSemester}.csv`;
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Image export
      if (!tableRef.current) {
        showAlert("Table element not found.", "error");
        return;
      }

      try {
        const canvas = await html2canvas(tableRef.current, {
          scale: 3,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imageType = format === "png" ? "image/png" : "image/jpeg";
        const imageQuality = format === "png" ? 1 : 0.8;
        const imageData = canvas.toDataURL(imageType, imageQuality);
        const link = document.createElement("a");
        const filename = `instructor_timetable_${instructorInfo?.name?.replace(/\s+/g, '_')}_${selectedYear.replace("/", "-")}_sem${selectedSemester}.${format}`;
        link.href = imageData;
        link.download = filename;
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Error exporting timetable as image:", error);
        showAlert("Failed to export timetable as image.", "error");
      }
    }
  };

  const handleExportConfirm = () => {
    handleExportTimetable(selectedExportFormat);
    setShowExportModal(false);
  };

  const handleExportCancel = () => {
    setShowExportModal(false);
  };

  // Close export modal on outside click
  useEffect(() => {
    if (showExportModal) {
      const handleClickOutside = (event) => {
        const modal = document.querySelector('[data-modal="export"]');
        if (modal && !modal.contains(event.target)) {
          setShowExportModal(false);
        }
      };
      
      window.addEventListener('click', handleClickOutside);
      
      return () => {
        window.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showExportModal]);

  if (loading) {
    return (
      <ProtectedRoute>
        <SideBar role={localStorage.getItem('role') || 'student'}>
          <div style={{ padding: "20px", textAlign: "center" }}>
            <div>Loading your timetable...</div>
          </div>
        </SideBar>
      </ProtectedRoute>
    );
  }

  // Replace the noDataMessage return section with this:

if (noDataMessage) {
  return (
    <ProtectedRoute>
      <SideBar role={localStorage.getItem('role') || 'student'}>
        <div 
          ref={containerRef}
          style={{ maxWidth: 1400, margin: "0 auto", padding: "0 10px 0 30px", paddingLeft: "70px" }}
        >
          <h2 className="fw-bold mb-4">My Timetable</h2>
          
          {/* ADD THE MISSING HEADER CONTROLS HERE */}
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
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
              >
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
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {instructorInfo && (
                <div style={{
                  background: "#f8f9fa",
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #e9ecef",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <BiUser style={{ fontSize: 18, color: "#015551" }} />
                  <span style={{ fontWeight: 500, color: "#015551" }}>
                    {instructorInfo.name}
                  </span>
                  {instructorInfo.department && (
                    <span style={{ 
                      fontSize: 12, 
                      color: "#666", 
                      background: "#e9ecef", 
                      padding: "2px 8px", 
                      borderRadius: 12,
                      marginLeft: 4 
                    }}>
                      {instructorInfo.department}
                    </span>
                  )}
                </div>
              )}
              <button
  ref={exportButtonRef}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 24px",
    borderRadius: 8,
    background: "#ccc", // ✅ Always disabled when no data
    fontWeight: 500,
    fontSize: 16,
    color: "#fff",
    cursor: "not-allowed", // ✅ Not-allowed cursor
    border: "none"
  }}
  disabled={true} // ✅ Always disabled when no data
>
  <BiExport style={{ fontSize: 20}} />
  Export
</button>
            </div>
          </div>

          {/* NO DATA MESSAGE SECTION */}
          <div style={{
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
  padding: "40px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "300px"
}}>
  <div style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20
  }}>
    <BiCalendar style={{ 
      fontSize: 64, 
      color: "#ccc"
    }} />
  </div>
  <h3 style={{ 
    color: "#666", 
    marginBottom: 10,
    textAlign: "center" 
  }}>
    No Timetable Available
  </h3>
  <p style={{ 
    color: "#888",
    textAlign: "center",
    maxWidth: "500px",
    margin: "0 auto"
  }}>
    {noDataMessage}
  </p>
</div>
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

  return (
    <ProtectedRoute>
      <SideBar role={localStorage.getItem('role') || 'student'}>
        <div 
          ref={containerRef}
          style={{ maxWidth: 1400, margin: "0 auto", padding: "0 10px 0 30px", paddingLeft: "70px" }}
        >
          <h2 className="fw-bold mb-4">My Timetable</h2>
          
          {/* Header Controls */}
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
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
              >
                <option value="">Year</option>
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
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {instructorInfo && (
                <div style={{
                  background: "#f8f9fa",
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #e9ecef",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <BiUser style={{ fontSize: 18, color: "#015551" }} />
                  <span style={{ fontWeight: 500, color: "#015551" }}>
                    {instructorInfo.name}
                  </span>
                  {instructorInfo.department && (
                    <span style={{ 
                      fontSize: 12, 
                      color: "#666", 
                      background: "#e9ecef", 
                      padding: "2px 8px", 
                      borderRadius: 12,
                      marginLeft: 4 
                    }}>
                      {instructorInfo.department}
                    </span>
                  )}
                </div>
              )}
              <button
  ref={exportButtonRef}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 24px",
    borderRadius: 8,
    background: hasSchedules ? "#015551" : "#ccc", // ✅ Conditional styling
    fontWeight: 500,
    fontSize: 16,
    color: "#fff",
    cursor: hasSchedules ? "pointer" : "not-allowed", // ✅ Conditional cursor
    border: "none"
  }}
  onClick={hasSchedules ? handleExportClick : undefined} // ✅ Conditional onClick
  disabled={!hasSchedules} // ✅ Disabled state
>
  <BiExport style={{ fontSize: 20}} />
  Export
</button>
            </div>
          </div>

          {/* Main Timetable Content */}
          <div style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            padding: "30px",
            maxWidth: 1400,
            margin: "0 auto",
            position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 23 }}>
              <h2 style={{ fontWeight: 700, fontSize: 27, margin: 0 }}>
                Weekly Schedule
              </h2>
              <span style={{ 
                fontSize: 14, 
                color: "#666",
                background: "#f8f9fa",
                padding: "4px 12px",
                borderRadius: 20,
                border: "1px solid #e9ecef"
              }}>
                {selectedYear} • Semester {selectedSemester}
              </span>
            </div>

            {/* Timetable Grid */}
            <div ref={tableRef} style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                <thead>
                  <tr>
                    <th style={{ 
                      textAlign: "left", 
                      padding: "12px", 
                      border: "1px solid #ccc", 
                      background: "#f8f8f8",
                      fontWeight: 600
                    }}>
                      Time Slot
                    </th>
                    {DAYS.map(day => (
                      <th key={day} style={{ 
                        textAlign: "center", 
                        padding: "12px", 
                        border: "1px solid #ccc", 
                        background: "#f8f8f8",
                        fontWeight: 600,
                        minWidth: "150px"
                      }}>
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
  {TIMES.map((timeSlot, timeIdx) => (
    <tr key={timeIdx}>
      <td style={{ 
        padding: "12px", 
        border: "1px solid #ccc", 
        fontWeight: 600,
        background: "#f9f9f9",
        verticalAlign: "top"
      }}>
        {timeSlot}
      </td>
      {DAYS.map(day => {
        // Find ALL events for this day and time slot
        const dayEvents = timetable[day] || [];
        const eventsAtThisTime = dayEvents.filter(e => e.timeIdx === timeIdx);
        
        if (eventsAtThisTime.length > 0) {
          // Calculate the maximum duration for rowspan
          const maxDuration = Math.max(...eventsAtThisTime.map(e => e.duration));
          
          return (
            <td 
              key={day} 
              rowSpan={maxDuration}
              style={{ 
                padding: "10px", 
                border: "1px solid #ccc",
                verticalAlign: "top",
                background: "#f0f9ff"
              }}
            >
              {/* Render ALL events at this time slot */}
              {eventsAtThisTime.map((event, index) => {
                const roomDetails = getRoomDetails(event.roomId);
                const occText = Array.isArray(event.occNumber) 
                  ? `Occ ${event.occNumber.join(", ")}` 
                  : event.occNumber ? `Occ ${event.occNumber}` : "";
                
                return (
                  <div 
                    key={event.id}
                    style={{
                      background: event.occType === "Lecture" ? "#015551" : "#28a745",
                      color: "#fff",
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 500,
                      marginBottom: index < eventsAtThisTime.length - 1 ? "8px" : "0"
                    }}
                  >
                    <div style={{ 
  display: "flex", 
  alignItems: "center", 
  gap: 6, 
  marginBottom: 4 
}}>
  <span style={{ fontSize: 16 }}>📚</span> {/* Replace BiBook */}
  <strong>{event.courseCode}</strong>
</div>
<div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
  {event.occType} {occText && `• ${occText}`}
</div>
{event.raw.Departments && event.raw.Departments.length > 0 && (
  <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 4 }}>
    {event.raw.Departments.join(", ")}
  </div>
)}
<div style={{ 
  display: "flex", 
  alignItems: "center", 
  gap: 4, 
  fontSize: 12, 
  opacity: 0.9 
}}>
  <span style={{ fontSize: 12 }}>📍</span> {/* Replace BiMapPin */}
  {roomDetails.code}
</div>
{event.duration > 1 && (
  <div style={{ 
    display: "flex", 
    alignItems: "center", 
    gap: 4, 
    fontSize: 12, 
    opacity: 0.9, 
    marginTop: 2 
  }}>
    <span style={{ fontSize: 12 }}>🕒</span> {/* Replace BiTime */}
    {event.duration}h
  </div>
                    )}
                  </div>
                );
              })}
            </td>
          );
        } else {
          // Check if this cell should be skipped due to rowspan from previous events
          const skipCell = dayEvents.some(e => {
            return e.timeIdx < timeIdx && 
                   e.timeIdx + e.duration > timeIdx;
          });
          
          if (skipCell) {
            return null;
          }
          
          return (
            <td key={day} style={{ 
              padding: "12px", 
              border: "1px solid #ccc",
              height: "60px",
              verticalAlign: "top",
              background: "#fafafa"
            }}>
              {/* Empty cell */}
            </td>
          );
        }
      })}
    </tr>
  ))}
</tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div style={{ marginTop: 30, padding: "20px 0", borderTop: "1px solid #eee" }}>
              <h4 style={{ marginBottom: 15, fontWeight: 600 }}>Weekly Summary</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 15 }}>
                {DAYS.map(day => {
                  const dayEvents = timetable[day] || [];
                  const totalHours = dayEvents.reduce((sum, event) => sum + (event.duration || 1), 0);
                  
                  return (
                    <div key={day} style={{
                      background: "#f8f9fa",
                      padding: "15px",
                      borderRadius: 8,
                      border: "1px solid #e9ecef"
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{day}</div>
                      <div style={{ fontSize: 14, color: "#666" }}>
                        {dayEvents.length} classes • {totalHours}h total
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export Modal */}
            {showExportModal && (
              <div 
                data-modal="export"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
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
          </div>
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default InstructorTimetable;