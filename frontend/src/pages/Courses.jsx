import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import CIcon from "@coreui/icons-react";
import { cilTrash, cilPen, cilFilter, cilCopy } from "@coreui/icons";
import { BiSearch } from "react-icons/bi";

const RequiredMark = () => <span style={{ color: 'red', marginLeft: 2 }}>*</span>;

const allRoomTypes = [
  "Lecture Hall",
  "Lecture Room",
  "CCNA Lab",
  "Tutorial Room",
  "Other Lab",
];

const allDepartments = [
  "Artificial Intelligence",
  "Computer System and Network",
  "Data Science",
  "Information Systems",
  "Multimedia Computing",
  "Software Engineering",
];

const allYears = ["1", "2", "3", "4"];

function Courses() {
  // Filters
  const [filterYear, setFilterYear] = useState("2025/2026");
  const [filterSemester, setFilterSemester] = useState("1");
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseTypes, setSelectedCourseTypes] = useState(new Set());
  const [showCourseTypeDropdown, setShowCourseTypeDropdown] = useState(false);
  const courseTypeRef = useRef();
  const [expandedRows, setExpandedRows] = useState({});

  // Modal and form
  const [showModal, setShowModal] = useState(false);
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
    lectureOccurrence: "",
    tutorialOcc: "",
    year: [],
    department: [],
    departmentStudents: {},
    lectureGroupings: [],         // Array of lecture grouping objects
    tutorialGroupings: []         // Array of tutorial grouping objects
  });
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);

  // Instructors
  const [instructors, setInstructors] = useState([]);
  const [instructorSearch, setInstructorSearch] = useState("");

  // Students data for auto-calculating target students
  const [students, setStudents] = useState([]);

  // Copy Courses Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFromYear, setCopyFromYear] = useState("2025/2026");
  const [copyFromSemester, setCopyFromSemester] = useState("1");
  const [copyError, setCopyError] = useState(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [showDepartmentStudents, setShowDepartmentStudents] = useState(false);
const [selectedCourseForStudents, setSelectedCourseForStudents] = useState(null);

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

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const response = await axios.get("http://localhost:3001/students", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStudents(response.data || []);
      } catch (error) {
        console.error("Failed to fetch students:", error);
      }
    };
    fetchStudents();
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

  useEffect(() => {
  const handleClickOutside = (event) => {
    if (courseTypeRef.current && !courseTypeRef.current.contains(event.target)) {
      setShowCourseTypeDropdown(false);
    }
  };

  if (showCourseTypeDropdown) {
    document.addEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [showCourseTypeDropdown]);

  // Auto-calculate targetStudent based on year, courseType, and department
  useEffect(() => {
    if (!form.academicYear || !form.semester || form.year.length === 0 || !form.courseType) {
      return;
    }

    const calculateTargetStudent = () => {
      // Filter students for the selected academic year and semester
      const relevantStudents = students.filter(
        (s) => s.academicYear === form.academicYear && String(s.semester) === String(form.semester)
      );

      let total = 0;

      // For each selected year
      form.year.forEach((selectedYear) => {
        const studentRecord = relevantStudents.find((s) => String(s.year) === selectedYear);
        if (!studentRecord) return;

        if (form.courseType === "Faculty Core") {
          // Faculty Core: All students in that year
          total += studentRecord.totalStudents || 0;
        } else if (form.courseType === "Programme Core" || form.courseType === "Elective") {
          // Programme Core or Elective: Sum of selected departments
          if (form.department.length > 0) {
            form.department.forEach((dept) => {
              total += studentRecord.counts?.[dept] || 0;
            });
          }
        }
      });

      if (total !== Number(form.targetStudent)) {
        setForm((prev) => ({ ...prev, targetStudent: total > 0 ? String(total) : "" }));
      }
    };

    calculateTargetStudent();
  }, [form.year, form.courseType, form.department, form.academicYear, form.semester, students]);

  // Handle form changes
const handleChange = async (e) => {
  const { name, value, type, selectedOptions, checked } = e.target;
  let newForm = { ...form };
  
  if (type === "select-multiple") {
    newForm[name] = Array.from(selectedOptions, (option) => option.value);
  } else if (name === "hasTutorial") {
    setHasTutorial(value);
    newForm = {
      ...newForm,
      hasTutorial: value,
      lectureHour: value === "No" ? "" : newForm.lectureHour,
      lectureOccurrence: value === "No" ? "" : newForm.lectureOccurrence,
      tutorialOcc: value === "No" ? "" : newForm.tutorialOcc,
    };
  } else if (type === "checkbox" && (name === "year" || name === "department")) {
    const currentArray = newForm[name];
    if (checked) {
      newForm[name] = [...currentArray, value];
    } else {
      newForm[name] = currentArray.filter((item) => item !== value);
    }
  } else {
    newForm[name] = value;
  }
  
  // Recalculate department students and groupings when relevant fields change
  if (name === "year" || name === "department" || name === "courseType" || 
      name === "academicYear" || name === "semester" || name === "lectureOccurrence") {
    await recalculateDepartmentData(newForm);
  }
  
  setForm(newForm);
};

  // Open modal for add or edit
  const openModal = async (course = null, idx = null) => {
  setError(null);
  if (course) {
    // When editing, fetch fresh data including department groupings
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`http://localhost:3001/courses/${course._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setForm({ 
        ...response.data, 
        lectureOccurrence: response.data.lectureOccurrence || "", 
        tutorialOcc: response.data.tutorialOcc || "",
        departmentStudents: response.data.departmentStudents || {},
        lectureGroupings: response.data.lectureGroupings || [],
        tutorialGroupings: response.data.tutorialGroupings || []
      });
      setHasTutorial(response.data.hasTutorial);
      setEditCourseId(response.data._id);
    } catch (error) {
      console.error("Error fetching course details:", error);
      // Fallback to existing course data
      setForm({ 
        ...course, 
        lectureOccurrence: course.lectureOccurrence || "", 
        tutorialOcc: course.tutorialOcc || "",
        departmentStudents: course.departmentStudents || {},
        lectureGroupings: course.lectureGroupings || [],
        tutorialGroupings: course.tutorialGroupings || []
      });
      setHasTutorial(course.hasTutorial);
      setEditCourseId(course._id);
    }
  } else {
    // New course
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
      lectureOccurrence: "",
      tutorialOcc: "",
      year: [],
      department: [],
      departmentStudents: {},
      lectureGroupings: [],
      tutorialGroupings: []
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
      !form.hasTutorial ||
      !form.year.length ||
      ((form.courseType === "Programme Core" || form.courseType === "Elective") && !form.department.length) ||
      (form.hasTutorial === "Yes" && (!form.lectureHour || !form.lectureOccurrence))
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

    if (
      form.hasTutorial === "Yes" &&
      (Number(form.lectureOccurrence) <= 0)
    ) {
      setError("Lecture occurrence must be a positive number.");
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
      await axios.delete(`http://localhost:3001/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(courses.filter((c) => c._id !== courseId));
      setError(null);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to delete course.");
    }
  };

  const toggleCourseType = (courseType) => {
    const newSelectedCourseTypes = new Set(selectedCourseTypes);
    if (newSelectedCourseTypes.has(courseType)) {
      newSelectedCourseTypes.delete(courseType);
    } else {
      newSelectedCourseTypes.add(courseType);
    }
    setSelectedCourseTypes(newSelectedCourseTypes);
  };

  const toggleExpand = (rowIdx, column) => {
    setExpandedRows((prev) => ({
      ...prev,
      [`${rowIdx}-${column}`]: !prev[`${rowIdx}-${column}`],
    }));
  };

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
      const errorMsg = err.response?.data?.message || "Failed to copy courses. Please check your backend.";
      
      // Check if it's a student data missing error
      if (errorMsg.includes("Missing student data for")) {
        setCopyError(
          <div>
            <strong>Incomplete Student Data!</strong>
            <p className="mb-2 mt-2">{errorMsg}</p>
            <p className="mb-0">
              Please go to the <strong>Students</strong> page and add enrollment data for all missing year levels in {filterYear} Semester {filterSemester}.
            </p>
          </div>
        );
      } else if (errorMsg.includes("No student data found") || errorMsg.includes("No courses found")) {
        setCopyError(
          <div>
            <strong>Data Required!</strong>
            <p className="mb-2 mt-2">{errorMsg}</p>
            <p className="mb-0">
              Please configure the required data before copying courses.
            </p>
          </div>
        );
      } else {
        setCopyError(errorMsg);
      }
      setCopyLoading(false);
    }
  };

  const recalculateDepartmentData = async (currentForm) => {
  if (!currentForm.academicYear || !currentForm.semester || 
      currentForm.year.length === 0 || !currentForm.courseType) {
    return;
  }

  try {
    const token = localStorage.getItem("token");
    
    // Fetch student data
    const studentPromises = currentForm.year.map(yearLevel =>
      axios.get(
        `http://localhost:3001/students?academicYear=${currentForm.academicYear}&semester=${currentForm.semester}&year=${yearLevel}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
    );
    
    const studentResponses = await Promise.all(studentPromises);
    
    // Calculate department students
    const departmentStudents = {};
    const relevantDepts = currentForm.courseType === "Faculty Core" 
      ? ["Artificial Intelligence", "Computer System and Network", "Data Science", 
         "Information Systems", "Multimedia Computing", "Software Engineering"]
      : (currentForm.department || []);
    
    studentResponses.forEach(response => {
      const studentData = response.data[0];
      if (studentData && studentData.counts) {
        relevantDepts.forEach(dept => {
          const count = studentData.counts[dept] || 0;
          departmentStudents[dept] = (departmentStudents[dept] || 0) + count;
        });
      }
    });
    
    const totalStudents = Object.values(departmentStudents).reduce((sum, count) => sum + count, 0);
    
    // Generate lecture groupings (distribute departments evenly)
    let lectureGroupings = [];
    if (currentForm.lectureOccurrence > 0) {
      const deptArray = relevantDepts
        .filter(dept => departmentStudents[dept] > 0)
        .sort((a, b) => departmentStudents[b] - departmentStudents[a]);
      
      const deptsPerLecture = Math.ceil(deptArray.length / currentForm.lectureOccurrence);
      
      for (let i = 0; i < currentForm.lectureOccurrence; i++) {
        const startIdx = i * deptsPerLecture;
        const endIdx = Math.min(startIdx + deptsPerLecture, deptArray.length);
        const lectureDepts = deptArray.slice(startIdx, endIdx);
        
        if (lectureDepts.length > 0) {
          const estimatedStudents = lectureDepts.reduce((sum, dept) => 
            sum + (departmentStudents[dept] || 0), 0
          );
          
          lectureGroupings.push({
            occNumber: i + 1,
            departments: lectureDepts,
            estimatedStudents
          });
        }
      }
    }
    
    // Calculate tutorial groupings (max 40 per tutorial)
    let tutorialGroupings = [];
    const maxStudentsPerTutorial = 40;
    
    if (currentForm.hasTutorial === "Yes") {
      const deptEntries = Object.entries(departmentStudents)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);
      
      let occNumber = 1;
      let i = 0;
      
      while (i < deptEntries.length) {
        const [dept, count] = deptEntries[i];
        
        if (count <= maxStudentsPerTutorial) {
          // Try to pair with another small department
          if (i + 1 < deptEntries.length) {
            const [nextDept, nextCount] = deptEntries[i + 1];
            if (count + nextCount <= maxStudentsPerTutorial) {
              tutorialGroupings.push({
                occNumber: occNumber++,
                departments: [dept, nextDept],
                estimatedStudents: count + nextCount
              });
              i += 2;
              continue;
            }
          }
          tutorialGroupings.push({
            occNumber: occNumber++,
            departments: [dept],
            estimatedStudents: count
          });
          i++;
        } else {
          // Split large department
          const numTutorials = Math.ceil(count / maxStudentsPerTutorial);
          for (let j = 0; j < numTutorials; j++) {
            tutorialGroupings.push({
              occNumber: occNumber++,
              departments: [dept],
              estimatedStudents: Math.ceil(count / numTutorials)
            });
          }
          i++;
        }
      }
    }
    
    // Update form
    setForm(prev => ({
      ...prev,
      departmentStudents,
      targetStudent: totalStudents.toString(),
      lectureGroupings,
      tutorialGroupings,
      tutorialOcc: tutorialGroupings.length.toString()
    }));
    
  } catch (error) {
    console.error("Error recalculating department data:", error);
  }
};

  return (
    <ProtectedRoute>
      <SideBar>
        <div style={{margin: "0 auto 0 auto", padding: "0 30px 0 0px", marginLeft: "10px" }}>
          <h2 className="fw-bold mb-4">Courses</h2>
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
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
            />
            </div>
            <div className="d-flex align-items-center gap-3 ms-auto">
              <select
                className="form-select"
                style={{ width: 130 }}
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
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
                className="form-select"
                style={{ width: 140 }}
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
              >
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
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
                  minWidth: "800px",
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
                    <th style={{ width: "6%" }}>Code</th>
                    <th style={{ width: "11%" }}>Name</th>
                    <th style={{ width: "6%" }}>Credit Hour</th>
                    <th style={{ width: "9%" }}>Year</th>
                    <th style={{ width: "9%", position: "relative" }} ref={courseTypeRef}>
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
                            left: "0",  
                            right: "0",
                            minWidth: "160px",
                            maxHeight: "200px",
                            overflowY: "auto",
                            padding: "5px",
                            zIndex: 1050
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
                    <th style={{ width: "11%" }}>Department</th>
                    <th style={{ width: "7%" }}>Target Student</th>
                    <th style={{ width: "11%" }}>Instructors</th>
                    <th style={{ width: "9%" }}>Room Type</th>
                    <th style={{ width: "7%" }}>Lecture @ Tutorial</th>
                    <th style={{ width: "9%" }}>Lecture Hour</th>
                    <th style={{ width: "9%" }}>Lecture Occurrence</th>
                    <th style={{ width: "9%" }}>Tutorial Occurrence</th>
                    <th style={{ width: "10%" }}>Dept. Students</th>
                    <th style={{ width: "10%" }}>Lecture Groups</th>
                    <th style={{ width: "10%" }}>Tutorial Groups</th>
                    <th style={{ width: "5%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
  {filteredCourses.length === 0 ? (
    <tr>
      <td colSpan="17" style={{ textAlign: "center", padding: "2rem" }}>
        <div className="text-muted">
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📚</span>
          <h5>No courses found!</h5>
          <p>
            {courseSearch || selectedCourseTypes.size > 0 
              ? "No courses match your current search criteria. Try adjusting your filters or search term."
              : `No courses available for ${filterYear} Semester ${filterSemester}. Click "Add Course" to get started.`
            }
          </p>
        </div>
      </td>
    </tr>
  ) : (
    filteredCourses.map((course, idx) => {
      const isInstructorsExpanded = expandedRows[`${idx}-instructors`];
      const isRoomTypesExpanded = expandedRows[`${idx}-roomTypes`];
      const isYearsExpanded = expandedRows[`${idx}-year`];
      const isDepartmentsExpanded = expandedRows[`${idx}-department`];
      return (
        <tr key={course._id}>
          <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {course.code}
          </td>
          <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {course.name}
          </td>
          <td>{course.creditHour}</td>
          <td style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
            {isYearsExpanded
              ? course.year.length > 0
                ? course.year.join(", ")
                : "N/A"
              : getCondensedContent(course.year)}
            {course.year.length > 2 && (
              <span
                className="ms-1 text-primary"
                style={{ cursor: "pointer", textDecoration: "underline" }}
                onClick={() => toggleExpand(idx, "year")}
              >
                {isYearsExpanded ? " Show Less" : " Show More"}
              </span>
            )}
          </td>
          <td>{course.courseType || "N/A"}</td>
          <td style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
            {isDepartmentsExpanded
              ? course.department.length > 0
                ? course.department.join(", ")
                : "N/A"
              : getCondensedContent(course.department)}
            {course.department.length > 2 && (
              <span
                className="ms-1 text-primary"
                style={{ cursor: "pointer", textDecoration: "underline" }}
                onClick={() => toggleExpand(idx, "department")}
              >
                {isDepartmentsExpanded ? " Show Less" : " Show More"}
              </span>
            )}
          </td>
          <td>{course.targetStudent}</td>
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
                {isInstructorsExpanded ? " Show Less" : " Show More"}
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
          <td>{course.lectureOccurrence || "N/A"}</td>
          <td>{course.tutorialOcc || "N/A"}</td>
          {/* Department Students Column */}
<td>
  {course.departmentStudents && Object.keys(course.departmentStudents).length > 0 ? (
    <button
      className="btn btn-sm btn-link"
      onClick={() => {
        setSelectedCourseForStudents(course);
        setShowDepartmentStudents(true);
      }}
    >
      View ({Object.keys(course.departmentStudents).length} depts)
    </button>
  ) : (
    "N/A"
  )}
</td>

{/* Lecture Groupings Column */}
<td>
  {course.lectureGroupings && course.lectureGroupings.length > 0 ? (
    <div style={{ fontSize: 13 }}>
      {course.lectureGroupings.map((group, idx) => (
        <div key={idx}>
          Occ {group.occNumber}: {group.departments.join(", ")}
          <br />
          <small className="text-muted">({group.estimatedStudents} students)</small>
        </div>
      ))}
    </div>
  ) : (
    "N/A"
  )}
</td>

{/* Tutorial Groupings Column */}
<td>
  {course.tutorialGroupings && course.tutorialGroupings.length > 0 ? (
    <div style={{ fontSize: 13 }}>
      {course.tutorialGroupings.slice(0, 3).map((group, idx) => (
        <div key={idx}>
          Occ {group.occNumber}: {group.departments.join(", ")}
        </div>
      ))}
      {course.tutorialGroupings.length > 3 && (
        <small className="text-muted">
          +{course.tutorialGroupings.length - 3} more...
        </small>
      )}
    </div>
  ) : (
    "N/A"
  )}
</td>
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
  )}
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
                          disabled={editCourseId === null}
                        >
                          <option value="" disabled>Select Year</option>
                          {/* <option value="2024/2025">2024/2025</option> */}
                          <option value="2025/2026">2025/2026</option>
                          <option value="2026/2027">2026/2027</option>
                          <option value="2027/2028">2027/2028</option>
                          <option value="2028/2029">2028/2029</option>
                          <option value="2029/2030">2029/2030</option>
                          <option value="2030/2031">2030/2031</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Semester <RequiredMark /></label>
                        <select
                          className="form-select"
                          name="semester"
                          value={form.semester}
                          onChange={handleChange}
                          disabled={editCourseId === null}
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
                        <label className="form-label fw-bold">Year (Select one or more) <RequiredMark /></label>
                        <div className="d-flex flex-wrap gap-2">
                          {allYears.map((year, idx) => (
                            <div className="form-check" key={idx}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                name="year"
                                value={year}
                                id={`year-${idx}`}
                                checked={form.year.includes(year)}
                                onChange={handleChange}
                              />
                              <label className="form-check-label" htmlFor={`year-${idx}`}>
                                Year {year}
                              </label>
                            </div>
                          ))}
                        </div>
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
                      {(form.courseType === "Programme Core" || form.courseType === "Elective") && (
                        <div className="mb-3">
                          <label className="form-label fw-bold">Department (Select one or more) <RequiredMark /></label>
                          <div className="d-flex flex-wrap gap-2">
                            {allDepartments.map((dept, idx) => (
                              <div className="form-check" key={idx}>
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  name="department"
                                  value={dept}
                                  id={`department-${idx}`}
                                  checked={form.department.includes(dept)}
                                  onChange={handleChange}
                                />
                                <label className="form-check-label" htmlFor={`department-${idx}`}>
                                  {dept}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mb-3">
                        <label className="form-label fw-bold">
                          Target Student <RequiredMark />
                          {form.targetStudent && (
                            <small className="text-muted ms-2">(Auto-calculated based on student enrollment)</small>
                          )}
                        </label>
                        <input 
                          className="form-control" 
                          type="number" 
                          name="targetStudent" 
                          value={form.targetStudent} 
                          min="0" 
                          onChange={handleChange}
                          placeholder="Will auto-calculate when year and course type are selected"
                        />
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
                        <label className="form-label fw-bold">Room Type (Select if necessary):</label>
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
  <>
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
    <div className="mb-3">
      <label className="form-label fw-bold">Number of lecture occurrences needed <RequiredMark /></label>
      <input
        className="form-control"
        type="number"
        min="1"
        name="lectureOccurrence"
        value={form.lectureOccurrence}
        onChange={handleChange}
      />
    </div>
  </>
)}
{form.hasTutorial === "No" && (
  <div className="alert alert-info" style={{ fontSize: 13 }}>
    <strong>Note:</strong> This course will have tutorial sessions only (no separate lectures). 
    Tutorial groupings will be generated automatically based on student enrollment.
  </div>
)}
{(form.hasTutorial === "Yes" || form.hasTutorial === "No") && (
  <div className="mb-3">
    <label className="form-label fw-bold">
      Number of tutorial occurrences 
      <span className="text-muted ms-2" style={{ fontSize: 13, fontWeight: 400 }}>
        (Auto-calculated based on department sizes)
      </span>
    </label>
    <input
      className="form-control"
      type="number"
      name="tutorialOcc"
      value={form.tutorialOcc}
      readOnly
      style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
      title="This field is automatically calculated"
    />
  </div>
)}
                      {form.year.length > 0 && form.academicYear && form.semester && (
  <div className="mb-3">
    <label className="form-label fw-bold">Department Student Distribution</label>
    <div className="alert alert-info" style={{ fontSize: 13 }}>
      {Object.keys(form.departmentStudents || {}).length > 0 ? (
        <>
          {Object.entries(form.departmentStudents).map(([dept, count]) => (
            <div key={dept}>
              <strong>{dept}:</strong> {count} students
            </div>
          ))}
          <hr />
          <strong>Total: {form.targetStudent} students</strong>
        </>
      ) : (
        "No student data available"
      )}
    </div>
  </div>
)}
{form.lectureOccurrence > 0 && Object.keys(form.departmentStudents || {}).length > 0 && (
  <div className="mb-3">
    <label className="form-label fw-bold">Lecture Groupings Preview</label>
    <div className="alert alert-secondary" style={{ fontSize: 13 }}>
      {form.lectureGroupings && form.lectureGroupings.length > 0 ? (
        form.lectureGroupings.map((group, idx) => (
          <div key={idx} style={{ marginBottom: 8 }}>
            <strong>Lecture {group.occNumber}:</strong> {group.departments.join(", ")}
            <br />
            <small>Estimated: {group.estimatedStudents} students</small>
          </div>
        ))
      ) : (
        "Will be generated automatically"
      )}
    </div>
  </div>
)}
{form.tutorialGroupings && form.tutorialGroupings.length > 0 && (
  <div className="alert alert-secondary mt-2" style={{ fontSize: 13 }}>
    <strong>Tutorial Groupings:</strong>
    {form.tutorialGroupings.map((group, idx) => (
      <div key={idx} style={{ marginTop: 4 }}>
        Tutorial {group.occNumber}: {group.departments.join(" + ")} 
        <span className="text-muted"> ({group.estimatedStudents} students)</span>
      </div>
    ))}
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

          {showDepartmentStudents && selectedCourseForStudents && (
  <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="fw-bold">
            Department Students - {selectedCourseForStudents.code}
          </h5>
          <button 
            type="button" 
            className="btn-close" 
            onClick={() => {
              setShowDepartmentStudents(false);
              setSelectedCourseForStudents(null);
            }}
          ></button>
        </div>
        <div className="modal-body">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Department</th>
                <th className="text-end">Students</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(selectedCourseForStudents.departmentStudents || {}).map(([dept, count]) => (
                <tr key={dept}>
                  <td>{dept}</td>
                  <td className="text-end">{count}</td>
                </tr>
              ))}
              <tr className="fw-bold">
                <td>Total</td>
                <td className="text-end">{selectedCourseForStudents.targetStudent}</td>
              </tr>
            </tbody>
          </table>
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
                    <button type="button" className="btn-close" onClick={() => {
                      setShowCopyModal(false);
                      setCopyError(null);
                    }}></button>
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
                        {/* <option value="2024/2025">2024/2025</option> */}
                        <option value="2025/2026">2025/2026</option>
                        <option value="2026/2027">2026/2027</option>
                        <option value="2027/2028">2027/2028</option>
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
                      onClick={() => {
                        setShowCopyModal(false);
                        setCopyError(null);
                      }}
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