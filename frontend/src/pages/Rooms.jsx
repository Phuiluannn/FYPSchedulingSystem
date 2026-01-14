import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import CIcon from "@coreui/icons-react";
import { cilTrash, cilPen, cilFilter } from "@coreui/icons";
import { BiSearch } from "react-icons/bi";

const RequiredMark = () => <span style={{ color: 'red', marginLeft: 2 }}>*</span>;

function Rooms() {
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    building: "",
    capacity: "",
    roomType: "",
  });
  const [rooms, setRooms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBuildings, setSelectedBuildings] = useState(new Set());
  const [selectedRoomTypes, setSelectedRoomTypes] = useState(new Set());
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false);
  const [showRoomTypeDropdown, setShowRoomTypeDropdown] = useState(false);
  const [error, setError] = useState(null);

  const buildingRef = useRef();
  const roomTypeRef = useRef();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to view rooms.');
          return;
        }
        const response = await axios.get("http://localhost:3001/rooms", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setRooms(response.data);
        setError(null);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        if (error.code === 'ECONNREFUSED') {
          setError('Cannot connect to the server. Please ensure the backend is running on http://localhost:3001.');
        } else {
          setError(error.response?.data?.message || 'Failed to fetch rooms.');
        }
      }
    };
    fetchRooms();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buildingRef.current && !buildingRef.current.contains(event.target)) {
        setShowBuildingDropdown(false);
      }
      if (roomTypeRef.current && !roomTypeRef.current.contains(event.target)) {
        setShowRoomTypeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // Clean up on unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prevForm) => ({
      ...prevForm,
      [name]: value,
    }));
  };

  const openModal = (room = null, idx = null) => {
    setError(null); // Reset error state when modal opens
    if (room) {
      setForm({ ...room });
      setEditIndex(idx);
    } else {
      setForm({
        code: "",
        name: "",
        building: "",
        capacity: "",
        roomType: "",
      });
      setEditIndex(null);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.building || !form.capacity || !form.roomType) {
      setError('Please fill in all required fields.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to save rooms.');
        return;
      }
      if (editIndex !== null) {
        const response = await axios.put(
          `http://localhost:3001/rooms/${rooms[editIndex]._id}`,
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const updated = [...rooms];
        updated[editIndex] = response.data;
        setRooms(updated);
      } else {
        const response = await axios.post("http://localhost:3001/rooms", form, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setRooms([...rooms, response.data]);
      }
      setShowModal(false);
      setError(null);
    } catch (error) {
      console.error("Error saving room:", error);
      setError(error.response?.data?.message || 'Failed to save room.');
    }
  };

  const handleDelete = async (idx) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to delete rooms.');
        return;
      }
      await axios.delete(`http://localhost:3001/rooms/${rooms[idx]._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setRooms(rooms.filter((_, i) => i !== idx));
      setError(null);
    } catch (error) {
      console.error("Error deleting room:", error);
      setError(error.response?.data?.message || 'Failed to delete room.');
    }
  };

  const toggleBuilding = (building) => {
    const newSelectedBuildings = new Set(selectedBuildings);
    if (building === "") {
      newSelectedBuildings.clear();
    } else if (newSelectedBuildings.has(building)) {
      newSelectedBuildings.delete(building);
    } else {
      newSelectedBuildings.add(building);
    }
    setSelectedBuildings(newSelectedBuildings);
  };

  const toggleRoomType = (roomType) => {
    const newSelectedRoomTypes = new Set(selectedRoomTypes);
    if (roomType === "") {
      newSelectedRoomTypes.clear();
    } else if (newSelectedRoomTypes.has(roomType)) {
      newSelectedRoomTypes.delete(roomType);
    } else {
      newSelectedRoomTypes.add(roomType);
    }
    setSelectedRoomTypes(newSelectedRoomTypes);
  };

  const filteredRooms = rooms.filter((room) => {
    const matchSearch =
      room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchBuilding = selectedBuildings.size === 0 || selectedBuildings.has(room.building);
    const matchRoomType = selectedRoomTypes.size === 0 || selectedRoomTypes.has(room.roomType);
    return matchSearch && matchBuilding && matchRoomType;
  });

  return (
    <ProtectedRoute>
      <SideBar role="admin">
        <div style={{ maxWidth: 1300, margin: "0 auto 0 auto", padding: "0 10px 0px 5px" }}>
          <h2 className="fw-bold mb-4">Rooms</h2>
          {/* {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )} */}
          <div className="d-flex align-items-center mb-3">
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
              className="form-control"
              placeholder="Search by code or name..."
              style={{
                width: 230,
                padding: "8px 35px 8px 35px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
            <div className="ms-auto">
              <button
                className="btn d-flex align-items-start"
                style={{ backgroundColor: "#015551", color: "#fff", fontWeight: 500,
                borderRadius: 8,
                minWidth: 130,
                display: "flex",           // For centering content
                justifyContent: "center",  // Center horizontally
                alignItems: "center",      // Center vertically
                gap: 6,                    // Space between "+" and text
                padding: "7px 12px",       // Reduce padding to decrease height (originally larger due to btn class)
                fontSize: 16, }}
                onClick={() => openModal()}
              >
                <span className="me-2">+</span> Add Room
              </button>
            </div>
          </div>

          <div
            className="bg-white rounded-3 shadow-sm mt-3 p-4"
            // style={{ height: "450px", display: "flex", flexDirection: "column" }}
          >
            <h5 className="fw-bold mb-3">Room List</h5>
            <div
              className="table-responsive"
              // style={{ flex: 1, overflowY: "auto" }}
            >
              <table
                className="table align-middle text-center"
                style={{ minWidth: "800px", borderCollapse: "separate", borderSpacing: "0 12px" }}
              >
                <thead
                  style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}
                >
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th style={{ position: "relative", textAlign: "center" }} ref={buildingRef}>
  Building
  <button
    className="btn btn-sm btn-link p-0"
    onClick={() => setShowBuildingDropdown((prev) => !prev)}
    style={{ marginLeft: "2px", fontSize: "12px" }}
  >
    <CIcon icon={cilFilter} />
  </button>
  {showBuildingDropdown && (
    <div
      className="dropdown-menu show"
      style={{ 
        position: "absolute", 
        top: "100%", 
        left: "50%", 
        transform: "translateX(-50%)", 
        maxHeight: "200px", 
        overflowY: "auto", 
        padding: "5px",
        zIndex: 1050,
        minWidth: "150px"
      }}
    >
      <div className="form-check d-flex align-items-center mb-1">
        <input
          type="checkbox"
          className="form-check-input"
          checked={selectedBuildings.size === 0}
          onChange={() => toggleBuilding("")}
          style={{ marginTop: "0" }}
        />
        <label className="form-check-label" style={{ marginLeft: 8, verticalAlign: "middle", fontWeight: 600 }}>All</label>
      </div>
      {["Block A", "Block B"].map((building) => (
        <div key={building} className="form-check d-flex align-items-center mb-1">
          <input
            type="checkbox"
            className="form-check-input"
            checked={selectedBuildings.has(building)}
            onChange={() => toggleBuilding(building)}
            style={{ marginTop: "0" }}
          />
          <label className="form-check-label" style={{ marginLeft: 8, verticalAlign: "middle", fontWeight: 600 }}>{building}</label>
        </div>
      ))}
    </div>
  )}
</th>
<th>Capacity</th>
<th style={{ position: "relative", textAlign: "center" }} ref={roomTypeRef}>
  Room Type
  <button
    className="btn btn-sm btn-link p-0"
    onClick={() => setShowRoomTypeDropdown((prev) => !prev)}
    style={{ marginLeft: "2px", fontSize: "12px" }}
  >
    <CIcon icon={cilFilter} />
  </button>
  {showRoomTypeDropdown && (
    <div
      className="dropdown-menu show"
      style={{ 
        position: "absolute", 
        top: "100%", 
        left: "50%", 
        transform: "translateX(-50%)", 
        maxHeight: "200px", 
        overflowY: "auto", 
        padding: "5px",
        zIndex: 1050,
        minWidth: "180px"
      }}
    >
      <div className="form-check d-flex align-items-center mb-1">
        <input
          type="checkbox"
          className="form-check-input"
          checked={selectedRoomTypes.size === 0}
          onChange={() => toggleRoomType("")}
          style={{ marginTop: "0" }}
        />
        <label className="form-check-label" style={{ marginLeft: 8, verticalAlign: "middle", fontWeight: 600 }}>All</label>
      </div>
      {["Lecture Hall", "Lecture Room", "CCNA Lab", "Tutorial Room", "Other Lab"].map((roomType) => (
        <div key={roomType} className="form-check d-flex align-items-center mb-1">
          <input
            type="checkbox"
            className="form-check-input"
            checked={selectedRoomTypes.has(roomType)}
            onChange={() => toggleRoomType(roomType)}
            style={{ marginTop: "0" }}
          />
          <label className="form-check-label" style={{ marginLeft: 8, verticalAlign: "middle", fontWeight: 600 }}>{roomType}</label>
        </div>
      ))}
    </div>
  )}
</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
  {filteredRooms.length === 0 ? (
    <tr>
      <td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>
        <div className="text-muted">
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🏫</span>
          <h5>No rooms found!</h5>
          <p>
            {searchTerm || selectedBuildings.size > 0 || selectedRoomTypes.size > 0
              ? "No rooms match your current search criteria. Try adjusting your filters or search term."
              : "No rooms have been added yet. Click 'Add Room' to get started."
            }
          </p>
        </div>
      </td>
    </tr>
  ) : (
    filteredRooms.map((room, idx) => (
      <tr key={idx}>
        <td>{room.code}</td>
        <td>{room.name}</td>
        <td>{room.building}</td>
        <td>{room.capacity}</td>
        <td>{room.roomType}</td>
        <td>
          <button className="btn btn-link p-0 me-2" onClick={() => openModal(room, idx)}>
            <CIcon icon={cilPen} />
          </button>
          <button className="btn btn-link text-danger p-0" onClick={() => handleDelete(idx)}>
            <CIcon icon={cilTrash} />
          </button>
        </td>
      </tr>
    ))
  )}
</tbody>
              </table>
            </div>
          </div>
          {/* Add total items count below the table */}
          <div className="mt-3 text-muted" style={{ textAlign: "right" }}>
            Total Rooms: {filteredRooms.length}
          </div>
          {showModal && (
            <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h4 className="modal-title fw-bold">{editIndex !== null ? "Edit Room" : "Add New Room"}</h4>
                    <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                  </div>
                  <div className="modal-body">
                    {error && (
                      <div className="alert alert-danger mt-3" role="alert">
                        {error}
                      </div>
                    )}
                    <form>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Code <RequiredMark /></label>
                        <input className="form-control" name="code" value={form.code} onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Name <RequiredMark /></label>
                        <input className="form-control" name="name" value={form.name} onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Building <RequiredMark /></label>
                        <select className="form-select" name="building" value={form.building} onChange={handleChange}>
                          <option value="" disabled>Select Building</option>
                          <option value="Block A">Block A</option>
                          <option value="Block B">Block B</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Capacity <RequiredMark /></label>
                        <input className="form-control" type="number" name="capacity" value={form.capacity} min="0" onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Room Type <RequiredMark /></label>
                        <select className="form-select" name="roomType" value={form.roomType} onChange={handleChange}>
                          <option value="" disabled>Select Room Type</option>
                          <option value="Lecture Hall">Lecture Hall</option>
                          <option value="Lecture Room">Lecture Room</option>
                          <option value="CCNA Lab">CCNA Lab</option>
                          <option value="Tutorial Room">Tutorial Room</option>
                          <option value="Other Lab">Other Lab</option>
                        </select>
                      </div>
                    </form>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSave}>
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default Rooms;