import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import CIcon from "@coreui/icons-react";
import { cilTrash, cilPen, cilFilter } from "@coreui/icons";

const allRoomTypes = [
  "Lecture Hall",
  "Lecture Room",
  "CCNA Lab",
  "Tutorial Room",
  "Other Lab",
];

function Courses() {
  // States used for filtering (top-level filters)
  const [filterYear, setFilterYear] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  // New state for searching courses
  const [courseSearch, setCourseSearch] = useState("");
  // New state for Course Type filter
  const [selectedCourseTypes, setSelectedCourseTypes] = useState(new Set());
  const [showCourseTypeDropdown, setShowCourseTypeDropdown] = useState(false);
  const courseTypeRef = useRef();
  // New state to track expanded rows for "Instructors" and "Room Type"
  const [expandedRows, setExpandedRows] = useState({});

  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [hasTutorial, setHasTutorial] = useState("");
  const [form, setForm] = useState({
    academicYear: "",
    semester: "",
    code: "",
    name: "",
    creditHour: "",
    targetStudent: "",
    courseType: "",
    instructors: [],
    roomTypes: [],
    hasTutorial: "",
    lectureHour: "",
  });
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);

  // New state to hold the fetched instructors
  const [instructors, setInstructors] = useState([]);
  // New state for searching instructors in the modal form
  const [instructorSearch, setInstructorSearch] = useState("");

  // Fetch instructors from the backend when component mounts
  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Please log in to view instructors.");
          return;
        }
        const response = await axios.get("http://localhost:3001/instructors", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const activeInstructors = response.data.filter(
          (inst) => inst.status === "Active"
        );
        console.log("Active instructors:", activeInstructors);
        setInstructors(activeInstructors);
        setError(null);
      } catch (error) {
        console.error("Error fetching instructors:", error);
        if (error.code === "ECONNREFUSED") {
          setError(
            "Cannot connect to the server. Please ensure the backend is running on http://localhost:3001."
          );
        } else {
          setError(error.response?.data?.message || "Failed to fetch instructors.");
        }
      }
    };
    fetchInstructors();
  }, []);

  // Fetch courses from the backend when component mounts
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Please log in to view courses.");
          return;
        }
        const response = await axios.get("http://localhost:3001/courses", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCourses(response.data);
        setError(null);
      } catch (error) {
        console.error("Error fetching courses:", error);
        if (error.code === "ECONNREFUSED") {
          setError(
            "Cannot connect to the server. Please ensure the backend is running on http://localhost:3001."
          );
        } else {
          setError(error.response?.data?.message || "Failed to fetch courses.");
        }
      }
    };
    fetchCourses();
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

  // Handle input changes for modal form
  const handleChange = (e) => {
    const { name, value, type, selectedOptions } = e.target;
    if (type === "select-multiple") {
      setForm({
        ...form,
        [name]: Array.from(selectedOptions, (option) => option.value),
      });
    } else {
      setForm({
        ...form,
        [name]: value,
      });
      if (name === "hasTutorial") setHasTutorial(value);
    }
  };

  // Open modal for add or edit
  const openModal = (course = null, idx = null) => {
    if (course) {
      setForm({ ...course });
      setHasTutorial(course.hasTutorial);
      setEditIndex(idx);
    } else {
      setForm({
        academicYear: "",
        semester: "",
        code: "",
        name: "",
        creditHour: "",
        targetStudent: "",
        courseType: "",
        instructors: [],
        roomTypes: [],
        hasTutorial: "",
        lectureHour: "",
      });
      setHasTutorial("");
      setEditIndex(null);
    }
    setInstructorSearch(""); // Reset instructor search field when modal opens
    setShowModal(true);
  };

  // Save course (add or edit) with backend integration
  const handleSave = async () => {
    if (
      !form.academicYear ||
      !form.semester ||
      !form.code ||
      !form.name ||
      !form.creditHour ||
      !form.targetStudent ||
      !form.courseType ||
      !form.instructors.length ||
      !form.roomTypes.length ||
      !form.hasTutorial
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to save courses.");
        return;
      }
      if (editIndex !== null) {
        // Update the course (PUT)
        const courseToEdit = courses[editIndex];
        const response = await axios.put(
          `http://localhost:3001/courses/${courseToEdit._id}`,
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const updatedCourses = [...courses];
        updatedCourses[editIndex] = response.data;
        setCourses(updatedCourses);
      } else {
        // Create a new course (POST)
        const response = await axios.post("http://localhost:3001/courses", form, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCourses([...courses, response.data]);
      }
      setShowModal(false);
      setError(null);
    } catch (error) {
      console.error("Error saving course:", error.response?.data || error.message);
      setError(error.response?.data?.message || "Failed to save course.");
    }
  };

  // Delete course with backend integration
  const handleDelete = async (idx) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to delete courses.");
        return;
      }
      const course = courses[idx];
      await axios.delete(`http://localhost:3001/courses/${course._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setCourses(courses.filter((_, i) => i !== idx));
      setError(null);
    } catch (error) {
      console.error("Error deleting course:", error.response?.data || error.message);
      setError(error.response?.data?.message || "Failed to delete course.");
    }
  };

  // Toggle Course Type filter
  const toggleCourseType = (courseType) => {
    const newSelectedCourseTypes = new Set(selectedCourseTypes);
    if (newSelectedCourseTypes.has(courseType)) {
      newSelectedCourseTypes.delete(courseType);
    } else {
      newSelectedCourseTypes.add(courseType);
    }
    setSelectedCourseTypes(newSelectedCourseTypes);
  };

  // Toggle expanded state for a row and column
  const toggleExpand = (rowIdx, column) => {
    setExpandedRows((prev) => ({
      ...prev,
      [`${rowIdx}-${column}`]: !prev[`${rowIdx}-${column}`],
    }));
  };

  // Get condensed content (e.g., first 2 items)
  const getCondensedContent = (items, maxItems = 2) => {
    if (!items || items.length === 0) return "N/A";
    if (items.length <= maxItems) return items.join(", ");
    return items.slice(0, maxItems).join(", ") + "...";
  };

  // Filter courses based on Year, Semester, search term, and Course Type
  const filteredCourses = courses.filter((course) => {
    const matchYear = filterYear ? course.academicYear === filterYear : true;
    const matchSemester = filterSemester ? course.semester === filterSemester : true;
    const matchSearch = courseSearch
      ? course.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
        course.name.toLowerCase().includes(courseSearch.toLowerCase())
      : true;
    const matchCourseType = selectedCourseTypes.size === 0 || selectedCourseTypes.has(course.courseType);
    return matchYear && matchSemester && matchSearch && matchCourseType;
  });

  return (
    <ProtectedRoute>
      <SideBar>
        <div style={{ maxWidth: 1700, margin: "10px auto 0 auto", padding: "0 10px 0 5px" }}>
          <h2 className="fw-bold mb-4 mt-20">Courses</h2>
          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}
          <div className="d-flex align-items-center mb-3">
            {/* Search input for courses */}
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search courses..."
              style={{ maxWidth: 250 }}
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
            />
            <div className="d-flex align-items-center gap-3 ms-auto">
              {/* Top-level Year and Semester Filters */}
              <select
                className="form-select"
                style={{ width: 130 }}
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">Year</option>
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
              </select>
              <select
                className="form-select"
                style={{ width: 120 }}
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
              >
                <option value="">Semester</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
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
                fontSize: 16 }}
                onClick={() => openModal()}
              >
                <span className="me-2">+</span> Add Course
              </button>
            </div>
          </div>
          <div
            className="bg-white rounded-3 shadow-sm mt-3 p-4"
            // style={{ height: "450px", display: "flex", flexDirection: "column" }}
          >
            <h5 className="fw-bold mb-3">Course List</h5>
            <div
              className="table-responsive"
              // style={{ flex: 1, overflowY: "auto" }}
            >
              <table
                className="table align-middle text-center"
                style={{ minWidth: "1200px", borderCollapse: "separate", borderSpacing: "0 12px" }}
              >
                <thead
                  style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}
                >
                  <tr>
                    <th style={{ width: "8%" }}>Code</th>
                    <th style={{ width: "15%" }}>Name</th>
                    <th style={{ width: "8%" }}>Credit Hour</th>
                    <th style={{ width: "10%" }}>Target Student</th>
                    <th style={{ width: "14%", position: "relative" }} ref={courseTypeRef}>
                      Course Type{" "}
                      <button
                        className="btn btn-sm btn-link"
                        onClick={() => setShowCourseTypeDropdown((prev) => !prev)}
                      >
                        <CIcon icon={cilFilter} />
                      </button>
                      {showCourseTypeDropdown && (
                        <div
                          className="dropdown-menu show"
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            maxHeight: "200px",
                            overflowY: "auto",
                            padding: "5px",
                          }}
                        >
                          <div className="form-check">
      <input
        type="checkbox"
        className="form-check-input"
        checked={selectedCourseTypes.size === 0}
        onChange={() => setSelectedCourseTypes(new Set())}
        style={{ marginTop: "0" }}
      />
      <label className="form-check-label" style={{ marginLeft: "5px" }}>
            All
          </label>
        </div>
        {["Faculty Core", "Program Core", "Elective"].map((courseType) => (
          <div key={courseType} className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              checked={selectedCourseTypes.has(courseType)}
              onChange={() => {
                const newSelected = new Set(selectedCourseTypes);
                if (newSelected.has(courseType)) {
                  newSelected.delete(courseType);
                } else {
                  newSelected.add(courseType);
                }
                setSelectedCourseTypes(newSelected);
              }}
              style={{ marginTop: "0" }}
            />
            <label
              className="form-check-label"
              style={{ marginLeft: "5px" }}
            >
              {courseType}
            </label>
          </div>
                          ))}
                        </div>
                      )}
                    </th>
                    <th style={{ width: "15%" }}>Instructors</th>
                    <th style={{ width: "15%" }}>Room Type</th>
                    <th style={{ width: "10%" }}>Lecture @ Tutorial</th>
                    <th style={{ width: "10%" }}>Lecture Hour</th>
                    <th style={{ width: "5%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course, idx) => {
                    const isInstructorsExpanded = expandedRows[`${idx}-instructors`];
                    const isRoomTypesExpanded = expandedRows[`${idx}-roomTypes`];
                    return (
                      <tr key={idx}>
                        <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {course.code}
                        </td>
                        <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {course.name}
                        </td>
                        <td>{course.creditHour}</td>
                        <td>{course.targetStudent}</td>
                        <td>{course.courseType || "N/A"}</td>
                        <td style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
                          {isInstructorsExpanded
                            ? course.instructors.length > 0
                              ? course.instructors.join(", ")
                              : "N/A"
                            : getCondensedContent(course.instructors)}
                          {course.instructors.length > 2 && (
                            <span
                              className="ms-1 text-primary"
                              style={{ cursor: "pointer", textDecoration: "underline" }}
                              onClick={() => toggleExpand(idx, "instructors")}
                            >
                              {isInstructorsExpanded ? " Show Less" : "Show More"}
                            </span>
                          )}
                        </td>
                        <td style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
                          {isRoomTypesExpanded
                            ? course.roomTypes.length > 0
                              ? course.roomTypes.join(", ")
                              : "N/A"
                            : getCondensedContent(course.roomTypes)}
                          {course.roomTypes.length > 2 && (
                            <span
                              className="ms-1 text-primary"
                              style={{ cursor: "pointer", textDecoration: "underline" }}
                              onClick={() => toggleExpand(idx, "roomTypes")}
                            >
                              {isRoomTypesExpanded ? " Show Less" : " Show More"}
                            </span>
                          )}
                        </td>
                        <td>{course.hasTutorial || "N/A"}</td>
                        <td>{course.lectureHour || "N/A"}</td>
                        <td>
                          <button className="btn btn-link p-0 me-2" onClick={() => openModal(course, idx)}>
                            <CIcon icon={cilPen} />
                          </button>
                          <button className="btn btn-link text-danger p-0" onClick={() => handleDelete(idx)}>
                            <CIcon icon={cilTrash} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 text-muted" style={{ textAlign: "right" }}>
            Total Courses: {filteredCourses.length}
          </div>

          {/* Modal for Add/Edit Course */}
          {showModal && (
            <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h4 className="card-title fw-bold">{editIndex !== null ? "Edit Course" : "Add New Course"}</h4>
                    <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                  </div>
                  <div className="modal-body">
                    <form>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Academic Year</label>
                        <select className="form-select" name="academicYear" value={form.academicYear} onChange={handleChange}>
                          <option value="" disabled>Select Year</option>
                          <option value="2024/2025">2024/2025</option>
                          <option value="2025/2026">2025/2026</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Semester</label>
                        <select className="form-select" name="semester" value={form.semester} onChange={handleChange}>
                          <option value="" disabled>Select Semester</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Course Code</label>
                        <input className="form-control" name="code" value={form.code} onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Course Name</label>
                        <input className="form-control" name="name" value={form.name} onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Credit Hour</label>
                        <input className="form-control" type="number" name="creditHour" value={form.creditHour} min="0" onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Target Student</label>
                        <input className="form-control" type="number" name="targetStudent" value={form.targetStudent} min="0" onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Course Type</label>
                        <select className="form-select" name="courseType" value={form.courseType} onChange={handleChange}>
                          <option value="" disabled>Select</option>
                          <option>Faculty Core</option>
                          <option>Program Core</option>
                          <option>Elective</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Instructor List (Select one or more):</label>
                        <div className="mb-3">
                          <label className="form-label">Search Instructors</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search..."
                            value={instructorSearch}
                            onChange={(e) => setInstructorSearch(e.target.value)}
                          />
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {instructors
                            .filter((inst) =>
                              inst.name.toLowerCase().includes(instructorSearch.toLowerCase())
                            )
                            .map((inst, idx) => (
                              <div className="form-check" key={idx}>
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`instructor-${idx}`}
                                  checked={form.instructors.includes(inst.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setForm({
                                        ...form,
                                        instructors: [...form.instructors, inst.name],
                                      });
                                    } else {
                                      setForm({
                                        ...form,
                                        instructors: form.instructors.filter((i) => i !== inst.name),
                                      });
                                    }
                                  }}
                                />
                                <label className="form-check-label" htmlFor={`instructor-${idx}`}>
                                  {inst.name}
                                </label>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Room Type (Select one or more):</label>
                        <div className="d-flex flex-wrap gap-2">
                          {allRoomTypes.map((room, idx) => (
                            <div className="form-check" key={idx}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`roomtype-${idx}`}
                                checked={form.roomTypes.includes(room)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setForm({
                                      ...form,
                                      roomTypes: [...form.roomTypes, room],
                                    });
                                  } else {
                                    setForm({
                                      ...form,
                                      roomTypes: form.roomTypes.filter((r) => r !== room),
                                    });
                                  }
                                }}
                              />
                              <label className="form-check-label" htmlFor={`roomtype-${idx}`}>
                                {room}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Any tutorial or lab session?</label>
                        <select className="form-select" name="hasTutorial" value={form.hasTutorial} onChange={handleChange}>
                          <option value="" disabled>Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      {form.hasTutorial === "Yes" && (
                        <div className="mb-3">
                          <label className="form-label fw-bold">If yes, please state the lecture hours</label>
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            name="lectureHour"
                            value={form.lectureHour}
                            onChange={handleChange}
                          />
                        </div>
                      )}
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

export default Courses;