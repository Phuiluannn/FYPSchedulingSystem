import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import CIcon from "@coreui/icons-react";
import { cilTrash, cilPen } from "@coreui/icons";
import { BiSearch } from "react-icons/bi";

const RequiredMark = () => <span style={{ color: 'red', marginLeft: 2 }}>*</span>;

const departments = [
  "Software Engineering",
  "Artificial Intelligence",
  "Computer System and Network",
  "Information Systems",
  "Data Science",
  "Multimedia Computing"
];

function Students() {
  const [filterYear, setFilterYear] = useState("2025/2026");
  const [filterSemester, setFilterSemester] = useState("1");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    year: "1",
    totalStudents: "",
    counts: departments.reduce((acc, d) => { acc[d] = ""; return acc; }, {}),
    academicYear: filterYear,
    semester: filterSemester
  });

  const modalRef = useRef();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:3001/students", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudents(res.data || []);
        setError(null);
      } catch (err) {
        console.error("Fetch students error:", err);
        setError(err.response?.data?.message || "Failed to fetch students.");
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (showModal) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => (document.body.style.overflow = "");
  }, [showModal]);

  // compute total automatically from counts if provided
  useEffect(() => {
    const c = form.counts;
    const sum = Object.values(c).reduce((acc, v) => acc + (Number(v) || 0), 0);
    if (sum > 0) setForm(prev => ({ ...prev, totalStudents: String(sum) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.counts]);

  const openModal = (student = null) => {
    setError(null);
    if (student) {
      setForm({
        year: String(student.year || "1"),
        totalStudents: String(student.totalStudents ?? ""),
        counts: departments.reduce((acc, d) => {
          acc[d] = String(student.counts?.[d] ?? "");
          return acc;
        }, {}),
        academicYear: student.academicYear || filterYear,
        semester: student.semester || filterSemester
      });
      setEditId(student._id);
    } else {
      setForm({
        year: "1",
        totalStudents: "",
        counts: departments.reduce((acc, d) => { acc[d] = ""; return acc; }, {}),
        academicYear: filterYear,
        semester: filterSemester
      });
      setEditId(null);
    }
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("count-")) {
      const key = name.replace("count-", "");
      setForm(prev => ({ ...prev, counts: { ...prev.counts, [key]: value } }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!form.academicYear || !form.semester || !form.year) {
      setError("Please fill required fields.");
      return;
    }
    const countsNumeric = {};
    departments.forEach(d => countsNumeric[d] = Number(form.counts[d] || 0));
    const payload = {
      academicYear: form.academicYear,
      semester: form.semester,
      year: Number(form.year),
      totalStudents: Number(form.totalStudents || Object.values(countsNumeric).reduce((a,b)=>a+b,0)),
      counts: countsNumeric
    };

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please login.");
        return;
      }
      if (editId) {
        const res = await axios.put(`http://localhost:3001/students/${editId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudents(prev => prev.map(s => s._id === editId ? res.data : s));
      } else {
        const res = await axios.post("http://localhost:3001/students", payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudents(prev => [...prev, res.data]);
      }
      setShowModal(false);
      setError(null);
    } catch (err) {
      console.error("Save student error:", err);
      setError(err.response?.data?.message || "Failed to save.");
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:3001/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(prev => prev.filter(s => s._id !== id));
    } catch (err) {
      console.error("Delete student error:", err);
      setError(err.response?.data?.message || "Failed to delete.");
    }
  };

  const filtered = students.filter(s => {
    const matchYear = filterYear ? s.academicYear === filterYear : true;
    const matchSemester = filterSemester ? String(s.semester) === String(filterSemester) : true;
    const matchSearch = search ? (
      String(s.year).includes(search) ||
      String(s.totalStudents).includes(search) ||
      (s.counts && Object.values(s.counts).some(v => String(v).includes(search)))
    ) : true;
    return matchYear && matchSemester && matchSearch;
  });

  // ensure rows are always ordered by year 1..4
  const sorted = [...filtered].sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));

  return (
    <ProtectedRoute>
      <SideBar>
        <div style={{margin: "0 auto 0 auto", padding: "0 30px 0 0px", marginLeft: "60px" }}>
          <h2 className="fw-bold mb-4">Students</h2>

          <div className="d-flex align-items-center mb-3">
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <BiSearch style={{ position: "absolute", left: 10, fontSize: 18, color: "#666", zIndex: 1 }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search by year or numbers..."
                style={{ width: 260, padding: "8px 35px 8px 35px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="d-flex align-items-center gap-3 ms-auto">
              <select className="form-select" style={{ width: 130 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2027/2028">2027/2028</option>
                <option value="2028/2029">2028/2029</option>
                <option value="2029/2030">2029/2030</option>
              </select>

              <select className="form-select" style={{ width: 140 }} value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>

              <button
                className="btn d-flex align-items-center"
                style={{ backgroundColor: "#015551", color: "#fff", fontWeight: 500, borderRadius: 8, minWidth: 140, padding: "7px 12px", fontSize: 16 }}
                onClick={() => openModal()}
              >
                <span className="me-2">+</span> Add Student
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3 shadow-sm mt-3 p-4">
            <h5 className="fw-bold mb-3">Student List</h5>
            <div className="table-responsive">
              <table
                className="table align-middle text-center"
                style={{
                  minWidth: Math.max(900, 220 + departments.length * 140),
                  borderCollapse: "separate",
                  borderSpacing: "0 12px",
                }}
              >
                <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                  <tr>
                    <th style={{ width: "6%" }}>Year</th>
                    <th style={{ width: "10%" }}>Total Students</th>
                    {departments.map((d) => (
                      <th key={d} style={{ minWidth: 140 }}>{d}</th>
                    ))}
                    <th style={{ width: "8%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={2 + departments.length + 1} style={{ textAlign: "center", padding: "2rem" }}>
                        <div className="text-muted">
                          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎓</span>
                          <h5>No student data found!</h5>
                          <p>
                            {search ? "No results match your search." : `No student data for ${filterYear} Semester ${filterSemester}. Click "Add Student" to add records.`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((s) => (
                      <tr key={s._id}>
                        <td>{s.year}</td>
                        <td>{s.totalStudents}</td>
                        {departments.map(d => <td key={d}>{s.counts?.[d] ?? 0}</td>)}
                        <td>
                          <button className="btn btn-link p-0 me-2" onClick={() => openModal(s)}>
                            <CIcon icon={cilPen} />
                          </button>
                          <button className="btn btn-link text-danger p-0" onClick={() => handleDelete(s._id)}>
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

          <div className="mt-3 text-muted" style={{ textAlign: "right" }}>
            Total Records: {sorted.length}
          </div>

          {/* Modal */}
          {showModal && (
            <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
              <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content" ref={modalRef}>
                  <div className="modal-header">
                    <h4 className="card-title fw-bold">{editId ? "Edit Student Record" : "Add Student Record"}</h4>
                    <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                  </div>
                  <div className="modal-body">
                    {error && <div className="alert alert-danger">{error}</div>}
                    <form>
                      <div className="row">
                        <div className="col-md-3 mb-3">
                          <label className="form-label fw-bold">Academic Year <RequiredMark/></label>
                          <select
                            className="form-select"
                            name="academicYear"
                            value={form.academicYear}
                            onChange={handleChange}
                            disabled={editId === null} /* follow current filters when adding */
                          >
                            <option value="2025/2026">2025/2026</option>
                            <option value="2026/2027">2026/2027</option>
                            <option value="2027/2028">2027/2028</option>
                            <option value="2028/2029">2028/2029</option>
                            <option value="2029/2030">2029/2030</option>
                          </select>
                        </div>
                        <div className="col-md-2 mb-3">
                          <label className="form-label fw-bold">Semester <RequiredMark/></label>
                          <select
                            className="form-select"
                            name="semester"
                            value={form.semester}
                            onChange={handleChange}
                            disabled={editId === null} /* follow current filters when adding */
                          >
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </div>
                        <div className="col-md-2 mb-3">
                          <label className="form-label fw-bold">Year <RequiredMark/></label>
                          <select className="form-select" name="year" value={form.year} onChange={handleChange}>
                            {[1,2,3,4].map(y => <option key={y} value={String(y)}>{y}</option>)}
                          </select>
                        </div>
                        <div className="col-md-5 mb-3">
                          <label className="form-label fw-bold">Total Students</label>
                          <input className="form-control" name="totalStudents" value={form.totalStudents} onChange={handleChange} />
                          <small className="text-muted">Leave blank - Will auto-calculate from department counts.</small>
                        </div>
                      </div>

                      <hr />

                      <div className="row">
                        {departments.map((d) => (
                          <div className="col-md-4 mb-3" key={d}>
                            <label className="form-label fw-bold">{d}</label>
                            <input
                              className="form-control"
                              name={`count-${d}`}
                              value={form.counts[d]}
                              onChange={handleChange}
                              type="number"
                              min="0"
                            />
                          </div>
                        ))}
                      </div>
                    </form>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleSave}>Save</button>
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

export default Students;