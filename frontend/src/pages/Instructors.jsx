import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import CIcon from "@coreui/icons-react";
import { cilTrash, cilPen, cilFilter } from "@coreui/icons";

function Instructors() {
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    status: "Active",
  });
  const [instructors, setInstructors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState(new Set());
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [error, setError] = useState(null);

  const departmentRef = useRef();
  const statusRef = useRef();

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to view instructors.');
          return;
        }
        const response = await axios.get("http://localhost:3001/instructors", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setInstructors(response.data);
        setError(null);
      } catch (error) {
        console.error("Error fetching instructors:", error);
        if (error.code === 'ECONNREFUSED') {
          setError('Cannot connect to the server. Please ensure the backend is running on http://localhost:3001.');
        } else {
          setError(error.response?.data?.message || 'Failed to fetch instructors.');
        }
      }
    };
    fetchInstructors();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (departmentRef.current && !departmentRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false);
      }
      if (statusRef.current && !statusRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
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
    setForm({
      ...form,
      [name]: value,
    });
  };

  const openModal = (instructor = null, idx = null) => {
    if (instructor) {
      setForm({ ...instructor });
      setEditIndex(idx);
    } else {
      setForm({
        name: "",
        email: "",
        department: "",
        status: "Active",
      });
      setEditIndex(null);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.department || !form.status) {
      setError('Please fill in all required fields: Name, Email, Department, and Status.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to save instructors.');
        return;
      }
      if (editIndex !== null) {
        const response = await axios.put(
          `http://localhost:3001/instructors/${instructors[editIndex]._id}`,
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const updated = [...instructors];
        updated[editIndex] = response.data;
        setInstructors(updated);
      } else {
        const response = await axios.post(
          "http://localhost:3001/instructors",
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setInstructors([...instructors, response.data]);
      }
      setShowModal(false);
      setError(null);
    } catch (error) {
      console.error("Error saving instructor:", error);
      setError(error.response?.data?.message || 'Failed to save instructor.');
    }
  };

  const handleDelete = async (idx) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to delete instructors.');
        return;
      }
      await axios.delete(
        `http://localhost:3001/instructors/${instructors[idx]._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setInstructors(instructors.filter((_, i) => i !== idx));
      setError(null);
    } catch (error) {
      console.error("Error deleting instructor:", error);
      setError(error.response?.data?.message || 'Failed to delete instructor.');
    }
  };

  const toggleDepartment = (department) => {
    const newSelectedDepartments = new Set(selectedDepartments);
    if (department === "") {
      newSelectedDepartments.clear();
    } else if (newSelectedDepartments.has(department)) {
      newSelectedDepartments.delete(department);
    } else {
      newSelectedDepartments.add(department);
    }
    setSelectedDepartments(newSelectedDepartments);
  };

  const toggleStatus = (status) => {
    const newSelectedStatuses = new Set(selectedStatuses);
    if (status === "") {
      newSelectedStatuses.clear();
    } else if (newSelectedStatuses.has(status)) {
      newSelectedStatuses.delete(status);
    } else {
      newSelectedStatuses.add(status);
    }
    setSelectedStatuses(newSelectedStatuses);
  };

  const filteredInstructors = instructors.filter((instructor) => {
    const matchSearch =
      instructor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instructor.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDepartment = selectedDepartments.size === 0 || selectedDepartments.has(instructor.department);
    const matchStatus = selectedStatuses.size === 0 || selectedStatuses.has(instructor.status);
    return matchSearch && matchDepartment && matchStatus;
  });

  return (
    <ProtectedRoute>
      <SideBar>
        <div
          style={{
            maxWidth: 1700,
            margin: "10px auto 0 auto",
            padding: "0 10px 0px 5px",
          }}
        >
          <h2 className="fw-bold mb-4 mt-20">Instructors</h2>
          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}
          <div className="d-flex align-items-center mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search by name or email..."
              style={{ maxWidth: 250 }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="ms-auto">
              <button
                className="btn d-flex align-items-start"
                style={{
                  backgroundColor: "#015551",
                  color: "#fff",
                  fontWeight: 500,
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
                <span className="me-2">+</span> Add Instructor
              </button>
            </div>
          </div>

          <div
            className="bg-white rounded-3 shadow-sm mt-3 p-4"
            // style={{ height: "450px", display: "flex", flexDirection: "column" }}
          >
            <h5 className="fw-bold mb-3">Instructor List</h5>
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
                    <th>Name</th>
                    <th>Email</th>
                    <th style={{ position: "relative" }} ref={departmentRef}>
                      Department{" "}
                      <button
                        className="btn btn-sm btn-link"
                        onClick={() => setShowDepartmentDropdown((prev) => !prev)}
                      >
                        <CIcon icon={cilFilter} />
                      </button>
                      {showDepartmentDropdown && (
                        <div
                          className="dropdown-menu show"
                          style={{ position: "absolute", top: "100%", left: 0, maxHeight: "200px", overflowY: "auto", padding: "5px" }}
                        >
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selectedDepartments.size === 0}
                              onChange={() => toggleDepartment("")}
                              style={{ marginTop: "0" }}
                            />
                            <label className="form-check-label" style={{ marginLeft: "5px" }}>All</label>
                          </div>
                          {[
                            "Artificial Intelligence",
                            "Computer System and Network",
                            "Data Science",
                            "Information Systems",
                            "Multimedia Computing",
                            "Software Engineering",
                          ].map((department) => (
                            <div key={department} className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedDepartments.has(department)}
                                onChange={() => toggleDepartment(department)}
                                style={{ marginTop: "0" }}
                              />
                              <label className="form-check-label" style={{ marginLeft: "5px" }}>{department}</label>
                            </div>
                          ))}
                        </div>
                      )}
                    </th>
                    <th style={{ position: "relative" }} ref={statusRef}>
                      Status{" "}
                      <button
                        className="btn btn-sm btn-link"
                        onClick={() => setShowStatusDropdown((prev) => !prev)}
                      >
                        <CIcon icon={cilFilter} />
                      </button>
                      {showStatusDropdown && (
                        <div
                          className="dropdown-menu show"
                          style={{ position: "absolute", top: "100%", left: 0, maxHeight: "200px", overflowY: "auto", padding: "5px" }}
                        >
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selectedStatuses.size === 0}
                              onChange={() => toggleStatus("")}
                              style={{ marginTop: "0" }}
                            />
                            <label className="form-check-label" style={{ marginLeft: "5px" }}>All</label>
                          </div>
                          {["Active", "Inactive"].map((status) => (
                            <div key={status} className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedStatuses.has(status)}
                                onChange={() => toggleStatus(status)}
                                style={{ marginTop: "0" }}
                              />
                              <label className="form-check-label" style={{ marginLeft: "5px" }}>{status}</label>
                            </div>
                          ))}
                        </div>
                      )}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstructors.map((instructor, idx) => (
                    <tr key={idx}>
                      <td>{instructor.name}</td>
                      <td>{instructor.email}</td>
                      <td>{instructor.department}</td>
                      <td>{instructor.status}</td>
                      <td>
                        <button
                          className="btn btn-link p-0 me-2"
                          onClick={() => openModal(instructor, idx)}
                        >
                          <CIcon icon={cilPen} />
                        </button>
                        <button
                          className="btn btn-link text-danger p-0"
                          onClick={() => handleDelete(idx)}
                        >
                          <CIcon icon={cilTrash} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Add total items count below the table */}
          <div className="mt-3 text-muted" style={{ textAlign: "right" }}>
            Total Instructors: {filteredInstructors.length}
          </div>

          {showModal && (
            <div
              className="modal fade show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h4 className="modal-title fw-bold">
                      {editIndex !== null
                        ? "Edit Instructor"
                        : "Add New Instructor"}
                    </h4>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowModal(false)}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <form>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Name</label>
                        <input
                          className="form-control"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Email</label>
                        <input
                          className="form-control"
                          name="email"
                          type="email"
                          value={form.email}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Department</label>
                        <select
                          className="form-select"
                          name="department"
                          value={form.department}
                          onChange={handleChange}
                        >
                          <option value="" disabled>Select Department</option>
                          <option value="Artificial Intelligence">
                            Artificial Intelligence
                          </option>
                          <option value="Computer System and Network">
                            Computer System and Network
                          </option>
                          <option value="Data Science">Data Science</option>
                          <option value="Information Systems">
                            Information Systems
                          </option>
                          <option value="Multimedia Computing">
                            Multimedia Computing
                          </option>
                          <option value="Software Engineering">
                            Software Engineering
                          </option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Status</label>
                        <select
                          className="form-select"
                          name="status"
                          value={form.status}
                          onChange={handleChange}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </form>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowModal(false)}
                    >
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

export default Instructors;