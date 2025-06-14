import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import CIcon from "@coreui/icons-react";
import { cilTrash, cilPen, cilFilter, cilCopy } from "@coreui/icons";

const RequiredMark = () => <span style={{ color: 'red', marginLeft: 2 }}>*</span>;

const allRoomTypes = [
  "Lecture Hall",
  "Lecture Room",
  "CCNA Lab",
  "Tutorial Room",
  "Other Lab",
];

function Courses() {
  // Filters
  const [filterYear, setFilterYear] = useState("2024/2025");
  const [filterSemester, setFilterSemester] = useState("1");
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseTypes, setSelectedCourseTypes] = useState(new Set());
  const [showCourseTypeDropdown, setShowCourseTypeDropdown] = useState(false);
  const courseTypeRef = useRef();
  const [expandedRows, setExpandedRows] = useState({});

  // Modal and form
  const [showModal, setShowModal] = useState(false);
  // const [editIndex, setEditIndex] = useState(null);
  const [editCourseId, setEditCourseId] = useState(null);
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

  // Instructors
  const [instructors, setInstructors] = useState([]);
  const [instructorSearch, setInstructorSearch] = useState("");

  // Copy Courses Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFromYear, setCopyFromYear] = useState("2024/2025");
  const [copyFromSemester, setCopyFromSemester] = useState("1");
  const [copyError, setCopyError] = useState(null);
  const [copyLoading, setCopyLoading] = useState(false);

  // Fetch instructors
  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Please log in to view instructors.");
          return;
        }
        const response = await axios.get("http://localhost:3001/instructors", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const activeInstructors = response.data.filter(
          (inst) => inst.status === "Active"
        );
        setInstructors(activeInstructors);
        setError(null);
      } catch (error) {
        setError(error.response?.data?.message || "Failed to fetch instructors.");
      }
    };
    fetchInstructors();
  }, []);

  // Fetch courses
  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to view courses.");
        return;
      }
      const response = await axios.get("http://localhost:3001/courses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(response.data);
      setError(null);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to fetch courses.");
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (showModal || showCopyModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal, showCopyModal]);

  // Handle form changes
  const handleChange = (e) => {
    const { name, value, type, selectedOptions } = e.target;
    if (type === "select-multiple") {
      setForm({
        ...form,
        [name]: Array.from(selectedOptions, (option) => option.value),
      });
    } else if (name === "hasTutorial") {
      setHasTutorial(value);
      setForm({
        ...form,
        hasTutorial: value,
        lectureHour: value === "No" ? "" : form.lectureHour,
      });
    } else {
      setForm({
        ...form,
        [name]: value,
      });
    }
  };

  // Open modal for add or edit
  const openModal = (course = null, idx = null) => {
    setError(null);
    if (course) {
      setForm({ ...course });
      setHasTutorial(course.hasTutorial);
      // setEditIndex(idx);
      setEditCourseId(course._id);
    } else {
      setForm({
        academicYear: filterYear,
        semester: filterSemester,
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
      setEditCourseId(null);
    }
    setInstructorSearch("");
    setShowModal(true);
  };

  // Save course (add or edit)
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
      !form.hasTutorial ||
      (form.hasTutorial === "Yes" && !form.lectureHour)
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (
      form.hasTutorial === "Yes" &&
      Number(form.lectureHour) > Number(form.creditHour)
    ) {
      setError("Lecture hour cannot be greater than credit hour.");
      return;
    }

    try {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to save courses.");
      return;
    }
    if (editCourseId) {
      // Remove _id from the payload
      const { _id, ...formWithoutId } = form;
      const response = await axios.put(
        `http://localhost:3001/courses/${editCourseId}`,
        formWithoutId,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCourses(
        courses.map((c) =>
          c._id === response.data._id ? response.data : c
        )
      );
    } else {
      // POST for new course
      const response = await axios.post("http://localhost:3001/courses", form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses([...courses, response.data]);
    }
    setShowModal(false);
    setError(null);
  } catch (error) {
    if (
      error.response &&
      error.response.data &&
      error.response.data.message &&
      error.response.data.message.includes("duplicate key error")
    ) {
      setError("A course with this code, year, and semester already exists.");
    } else {
      setError(error.response?.data?.message || "Failed to save course.");
    }
  }
  };

  // Delete course
  const handleDelete = async (courseId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to delete courses.");
        return;
      }
      // const course = courses[idx];
      await axios.delete(`http://localhost:3001/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(courses.filter((c) => c._id !== courseId));
      setError(null);
    } catch (error) {
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
    const matchCourseType =
      selectedCourseTypes.size === 0 ||
      selectedCourseTypes.has(course.courseType);
    return matchYear && matchSemester && matchSearch && matchCourseType;
  });

  // Copy Courses Handler
  const handleCopyCourses = async () => {
    setCopyLoading(true);
    setCopyError(null);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:3001/courses/copy",
        {
          fromYear: copyFromYear,
          fromSemester: copyFromSemester,
          toYear: filterYear,
          toSemester: filterSemester,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowCopyModal(false);
      setCopyLoading(false);
      await fetchCourses();
    } catch (err) {
      setCopyError(
        err.response?.data?.message ||
          "Failed to copy courses. Please check your backend."
      );
      setCopyLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <SideBar>
        <div style={{ maxWidth: 1700, margin: "0 auto 0 auto", padding: "0 10px 0 5px" }}>
          <h2 className="fw-bold mb-4">Courses</h2>
          <div className="d-flex align-items-center mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search by code or name..."
              style={{ maxWidth: 250 }}
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
            />
            <div className="d-flex align-items-center gap-3 ms-auto">
              <select
                className="form-select"
                style={{ width: 130 }}
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">Year</option>
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2025/2026">2026/2027</option>
                <option value="2025/2026">2027/2028</option>
                <option value="2025/2026">2028/2029</option>
                <option value="2025/2026">2029/2030</option>
                <option value="2025/2026">2030/2031</option>
                <option value="2025/2026">2031/2032</option>
                <option value="2025/2026">2032/2033</option>
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
                className="btn d-flex align-items-center"
                style={{
                  backgroundColor: "#015551",
                  color: "#fff",
                  fontWeight: 500,
                  borderRadius: 8,
                  minWidth: 130,
                  fontSize: 16,
                  gap: 6,
                  padding: "7px 12px",
                }}
                onClick={() => openModal()}
              >
                <span className="me-2">+</span> Add Course
              </button>
              <button
                className="btn btn-outline-secondary d-flex align-items-center"
                style={{
                  minWidth: 130,
                  fontSize: 16,
                  gap: 6,
                  padding: "7px 12px",
                }}
                onClick={() => setShowCopyModal(true)}
              >
                <CIcon icon={cilCopy} className="me-2" />
                Copy Courses
              </button>
            </div>
          </div>
          <div className="bg-white rounded-3 shadow-sm mt-3 p-4">
            <h5 className="fw-bold mb-3">Course List</h5>
            <div className="table-responsive">
              <table
                className="table align-middle text-center"
                style={{
                  minWidth: "1200px",
                  borderCollapse: "separate",
                  borderSpacing: "0 12px",
                }}
              >
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    backgroundColor: "#fff",
                    zIndex: 1,
                  }}
                >
                  <tr>
                    <th style={{ width: "8%" }}>Code</th>
                    <th style={{ width: "15%" }}>Name</th>
                    <th style={{ width: "8%" }}>Credit Hour</th>
                    <th style={{ width: "10%" }}>Target Student</th>
                    <th style={{ width: "14%", paddingLeft: 28, position: "relative" }} ref={courseTypeRef}>
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
                            left: 20,
                            maxHeight: "200px",
                            overflowY: "auto",
                            padding: "5px",
                          }}
                        >
                          <div className="form-check d-flex align-items-center mb-1">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selectedCourseTypes.size === 0}
                              onChange={() => setSelectedCourseTypes(new Set())}
                              style={{ marginTop: "0" }}
                            />
                            <label className="form-check-label" style={{ marginLeft: 8, verticalAlign: "middle", fontWeight: 600 }}>
                              All
                            </label>
                          </div>
                          {["Faculty Core", "Programme Core", "Elective"].map((courseType) => (
                            <div key={courseType} className="form-check d-flex align-items-center mb-1">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedCourseTypes.has(courseType)}
                                onChange={() => toggleCourseType(courseType)}
                                style={{ marginTop: "0" }}
                              />
                              <label className="form-check-label" style={{ marginLeft: 8, verticalAlign: "middle", fontWeight: 600 }}>
                                {courseType}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </th>
                    <th style={{ width: "15%" }}>Instructors</th>
                    <th style={{ width: "13%" }}>Room Type</th>
                    <th style={{ width: "10%" }}>Lecture @ Tutorial</th>
                    <th style={{ width: "12%" }}>Lecture Hour</th>
                    <th style={{ width: "5%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course, idx) => {
                      const isInstructorsExpanded = expandedRows[`${idx}-instructors`];
                      const isRoomTypesExpanded = expandedRows[`${idx}-roomTypes`];
                      return (
                        <tr key={course._id}>
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
                            <button className="btn btn-link text-danger p-0" onClick={() => handleDelete(course._id)}>
                              <CIcon icon={cilTrash} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  }
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
                    <h4 className="card-title fw-bold">{editCourseId !== null ? "Edit Course" : "Add New Course"}</h4>
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
                        <label className="form-label fw-bold">Academic Year <RequiredMark /></label>
                        <select
                          className="form-select"
                          name="academicYear"
                          value={form.academicYear}
                          onChange={handleChange}
                          disabled={editCourseId === null} // Disable when adding
                        >
                          <option value="" disabled>Select Year</option>
                          <option value="2024/2025">2024/2025</option>
                          <option value="2025/2026">2025/2026</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Semester <RequiredMark /></label>
                        <select
                          className="form-select"
                          name="semester"
                          value={form.semester}
                          onChange={handleChange}
                          disabled={editCourseId === null} // Disable when adding
                        >
                          <option value="" disabled>Select Semester</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Course Code <RequiredMark /></label>
                        <input className="form-control" name="code" value={form.code} onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Course Name <RequiredMark /></label>
                        <input className="form-control" name="name" value={form.name} onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Credit Hour <RequiredMark /></label>
                        <input className="form-control" type="number" name="creditHour" value={form.creditHour} min="0" onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Target Student <RequiredMark /></label>
                        <input className="form-control" type="number" name="targetStudent" value={form.targetStudent} min="0" onChange={handleChange} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Course Type <RequiredMark /></label>
                        <select className="form-select" name="courseType" value={form.courseType} onChange={handleChange}>
                          <option value="" disabled>Select</option>
                          <option>Faculty Core</option>
                          <option>Programme Core</option>
                          <option>Elective</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Instructor List (Select one or more): <RequiredMark /></label>
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
                        <label className="form-label fw-bold">Room Type (Select one or more): <RequiredMark /></label>
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
                        <label className="form-label fw-bold">Any tutorial or lab session? <RequiredMark /></label>
                        <select className="form-select" name="hasTutorial" value={form.hasTutorial} onChange={handleChange}>
                          <option value="" disabled>Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      {form.hasTutorial === "Yes" && (
                        <div className="mb-3">
                          <label className="form-label fw-bold">If yes, please state the lecture hours <RequiredMark /></label>
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

          {/* Modal for Copy Courses */}
          {showCopyModal && (
            <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="fw-bold">Copy Courses</h5>
                    <button type="button" className="btn-close" onClick={() => setShowCopyModal(false)}></button>
                  </div>
                  <div className="modal-body">
                    {copyError && (
                      <div className="alert alert-danger" role="alert">
                        {copyError}
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="form-label fw-bold">From Year</label>
                      <select
                        className="form-select"
                        value={copyFromYear}
                        onChange={e => setCopyFromYear(e.target.value)}
                      >
                        <option value="2024/2025">2024/2025</option>
                        <option value="2025/2026">2025/2026</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">From Semester</label>
                      <select
                        className="form-select"
                        value={copyFromSemester}
                        onChange={e => setCopyFromSemester(e.target.value)}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">To Year</label>
                      <input className="form-control" value={filterYear} disabled />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">To Semester</label>
                      <input className="form-control" value={filterSemester} disabled />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowCopyModal(false)}
                      disabled={copyLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCopyCourses}
                      disabled={copyLoading}
                    >
                      {copyLoading ? "Copying..." : "Copy"}
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