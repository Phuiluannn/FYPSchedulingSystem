import { useState, useEffect } from "react";
import axios from "axios";
import SideBar from './SideBar';
import ProtectedRoute from './ProtectedRoute';
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BiExport } from "react-icons/bi";

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

  // Fetch instructors
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

  // Handle drag end
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    const getRoomAndTime = (droppableId) => {
      const lastDash = droppableId.lastIndexOf("-");
      return [
        droppableId.substring(0, lastDash),
        Number(droppableId.substring(lastDash + 1))
      ];
    };
    const [sourceRoom, sourceTime] = getRoomAndTime(source.droppableId);
    const [destRoom, destTime] = getRoomAndTime(destination.droppableId);

    const newTimetable = JSON.parse(JSON.stringify(timetable));
    const [moved] = newTimetable[sourceRoom][sourceTime].splice(source.index, 1);
    newTimetable[destRoom][destTime].splice(destination.index, 0, moved);
    setTimetable(newTimetable);
    setIsModified(true);
  };

  // Generate timetable and map to frontend structure
  const handleGenerateTimetable = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        "http://localhost:3001/home/generate-timetable",
        {
          year: selectedYear,
          semester: selectedSemester
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const schedules = response.data.schedules;
      const newTimetable = {};
      rooms.forEach(room => {
        newTimetable[room._id] = TIMES.map(() => []);
      });
      schedules.forEach(sch => {
        if (sch.Day !== selectedDay) return;
        const roomId = sch.RoomID;
        const timeIdx = TIMES.findIndex(t => t === sch.StartTime);
        if (roomId && timeIdx !== -1) {
          newTimetable[roomId][timeIdx].push({
            id: String(sch._id),
            code: sch.CourseCode,
            instructors: sch.OriginalInstructors || sch.Instructors, // Use OriginalInstructors if available
            selectedInstructor: Array.isArray(sch.Instructors) && sch.Instructors.length === 1
              ? sch.Instructors[0]
              : "",
            selectedInstructorId: sch.InstructorID || "",
            raw: sch
          });
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

  // Save timetable to backend
  const handleSaveTimetable = async () => {
    try {
      const timetableArr = [];
      Object.entries(timetable).forEach(([roomId, slots]) => {
        slots.forEach((slot, timeIdx) => {
          slot.forEach(item => {
            if (item.raw) {
              timetableArr.push({
                ...item.raw,
                RoomID: roomId,
                Day: selectedDay,
                StartTime: TIMES[timeIdx],
                EndTime: TIMES[timeIdx].split(" - ")[1],
                Instructors: item.selectedInstructor
                  ? [item.selectedInstructor]
                  : item.instructors,
                InstructorID: item.selectedInstructorId && item.selectedInstructorId.length === 24
                  ? item.selectedInstructorId
                  : null,
                OriginalInstructors: item.instructors // Preserve original instructors
              });
            }
          });
        });
      });

      const token = localStorage.getItem('token');
      await axios.post(
        "http://localhost:3001/home/save-timetable",
        {
          year: selectedYear,
          semester: selectedSemester,
          timetable: timetableArr
        },
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

  // Fetch saved timetable only after rooms are loaded
  useEffect(() => {
    if (!roomsReady) return;

    const fetchSavedTimetable = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `http://localhost:3001/home/get-timetable?year=${selectedYear}&semester=${selectedSemester}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const schedules = response.data.schedules;
        const newTimetable = {};
        rooms.forEach(room => {
          newTimetable[room._id] = TIMES.map(() => []);
        });
        schedules.forEach(sch => {
          if (sch.Day !== selectedDay) return;
          const roomId = sch.RoomID;
          const timeIdx = TIMES.findIndex(t => t === sch.StartTime);
          if (roomId && timeIdx !== -1) {
            newTimetable[roomId][timeIdx].push({
              id: String(sch._id),
              code: sch.CourseCode,
              instructors: sch.OriginalInstructors || sch.Instructors, // Use OriginalInstructors if available
              selectedInstructor: Array.isArray(sch.Instructors) && sch.Instructors.length === 1
                ? sch.Instructors[0]
                : "",
              selectedInstructorId: sch.InstructorID || "",
              raw: sch
            });
          }
        });
        setTimetable(newTimetable);
        setIsGenerated(false);
        setIsModified(false);
      } catch (error) {
        const initial = {};
        rooms.forEach(room => {
          initial[room._id] = TIMES.map(() => []);
        });
        setTimetable(initial);
        setIsModified(false);
      }
    };
    fetchSavedTimetable();
    // eslint-disable-next-line
  }, [roomsReady, rooms, selectedYear, selectedSemester, selectedDay]);

  return (
    <ProtectedRoute>
      <SideBar>
        <div style={{ maxWidth: 1700, margin: "0 auto 0 auto", padding: "0 10px 0 5px" }}>
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
              onChange={e => setSelectedDay(e.target.value)}
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
              <button style={{
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
              }}>
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
            margin: "0 auto"
          }}>
            <h2 style={{ fontWeight: 700, fontSize: 27, marginBottom: 23 }}>
              {selectedDay} Timetable
            </h2>
            <div style={{ overflowX: "auto" }}>
              <DragDropContext onDragEnd={onDragEnd}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
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
                        {TIMES.map((_, tIdx) => (
                          <td key={tIdx} style={{ border: "1px solid #ccc", height: 48, minWidth: 120 }}>
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
                                  {(timetable[room._id] && timetable[room._id][tIdx] || []).map((item, idx) => (
                                    item && item.id ? (
                                      <Draggable key={item.id} draggableId={String(item.id)} index={idx}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            style={{
                                              userSelect: "none",
                                              padding: "6px 10px",
                                              margin: "0 0 4px 0",
                                              minHeight: "32px",
                                              backgroundColor: snapshot.isDragging ? "#015551" : "#e2e8f0",
                                              color: snapshot.isDragging ? "#fff" : "#222",
                                              borderRadius: 6,
                                              fontWeight: 500,
                                              fontSize: 15,
                                              ...provided.draggableProps.style
                                            }}
                                          >
                                            <div><strong>{item.code}</strong></div>
                                            <div style={{ fontSize: 13 }}>
                                              <select
                                                value={item.selectedInstructorId || ""}
                                                onChange={e => {
                                                  const selectedId = e.target.value;
                                                  const selectedInstructorObj = instructors.find(inst => inst._id === selectedId);
                                                  const selectedName = selectedInstructorObj ? selectedInstructorObj.name : "";
                                                  const newTimetable = JSON.parse(JSON.stringify(timetable));
                                                  newTimetable[room._id][tIdx][idx].selectedInstructorId = selectedId;
                                                  newTimetable[room._id][tIdx][idx].selectedInstructor = selectedName;
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
                                    ) : null
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DragDropContext>
            </div>
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
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default Home;