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
  const [selectedDay, setSelectedDay] = useState("Monday");
  // Example: timetable[roomId][timeIdx] = [{id, content}]
  const [timetable, setTimetable] = useState({});

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get("http://localhost:3001/rooms", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRooms(response.data);

        // Initialize timetable if empty
        if (Object.keys(timetable).length === 0) {
          const initial = {};
          response.data.forEach(room => {
            initial[room._id] = TIMES.map(() => []);
          });
          setTimetable(initial);
        }
      } catch (error) {
        setRooms([]);
      }
    };
    fetchRooms();
    // eslint-disable-next-line
  }, []);

  // Handle drag end
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    // Parse source/destination
    const [sourceRoom, sourceTime] = source.droppableId.split("-");
    const [destRoom, destTime] = destination.droppableId.split("-");

    // Copy timetable
    const newTimetable = JSON.parse(JSON.stringify(timetable));
    // Remove from source
    const [moved] = newTimetable[sourceRoom][sourceTime].splice(source.index, 1);
    // Add to destination
    newTimetable[destRoom][destTime].splice(destination.index, 0, moved);
    setTimetable(newTimetable);
  };

  // Example: Add a dummy event to first cell for demo
  useEffect(() => {
    if (rooms.length) {
      const initial = {};
      rooms.forEach(room => {
        initial[room._id] = TIMES.map(() => []);
      });
      // Add a sample event to the first room, first time slot
      if (rooms[0]) initial[rooms[0]._id][0] = [{ id: "event-1", content: "Sample Event" }];
      setTimetable(initial);
    }
    // eslint-disable-next-line
  }, [rooms]);

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
              marginBottom: 28,
            }}
          >
            {/* Left: Day selector */}
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
            {/* Right: Year, Semester, Export */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <select className='form-select' style={{ width: 130, borderRadius: 8 }}>
                <option>2025/2026</option>
                <option>2026/2027</option>
                <option>2027/2028</option>
                <option>2028/2029</option>
                <option>2029/2030</option>
                <option>2030/2031</option>
              </select>
              <select className='form-select' style={{ width: 140, borderRadius: 8 }}>
                <option>Semester 1</option>
                <option>Semester 2</option>
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
                                    <Draggable key={item.id} draggableId={item.id} index={idx}>
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
                                          {item.content}
                                        </div>
                                      )}
                                    </Draggable>
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
            <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
              <button style={{
                background: "#015551",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 36px",
                fontWeight: 500,
                fontSize: 16,
                cursor: "pointer"
              }}>
                Generate
              </button>
            </div>
          </div>
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default Home;