import { useState, useEffect } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import { BiExport, BiCheck, BiRefresh } from "react-icons/bi";

function Analytics() {
  const [activeTab, setActiveTab] = useState("workload");
  const [workloadSemester, setWorkloadSemester] = useState("Semester 1");
  const [workloadYear, setWorkloadYear] = useState("2024/2025");
  const [workloadData, setWorkloadData] = useState([]);
  const [conflictSemester, setConflictSemester] = useState("Semester 1");
  const [conflictYear, setConflictYear] = useState("2024/2025");
  const [conflictData, setConflictData] = useState([]);
  const [conflictStats, setConflictStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    byType: [],
    byPriority: []
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [workloadYear, workloadSemester, conflictYear, conflictSemester]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view analytics.');
        console.error('No token found in localStorage');
        return;
      }

      console.log('Fetching analytics data with parameters:', {
        conflictYear,
        conflictSemester: conflictSemester.replace('Semester ', '')
      });

      // Fetch workload data from backend
      const workloadResponse = await axios.get(
        `http://localhost:3001/analytics/instructor-workload?year=${workloadYear}&semester=${workloadSemester.replace('Semester ', '')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkloadData(workloadResponse.data.workload || []);


      // Fetch conflict data
      const conflictResponse = await axios.get(
        `http://localhost:3001/analytics/conflicts?year=${conflictYear}&semester=${conflictSemester.replace('Semester ', '')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Conflict API response:', conflictResponse.data);

      setConflictData(conflictResponse.data.conflicts || []);

      // Fetch conflict statistics
      const statsResponse = await axios.get(
        `http://localhost:3001/analytics/conflict-stats?year=${conflictYear}&semester=${conflictSemester.replace('Semester ', '')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setConflictStats(statsResponse.data.stats || {
        total: 0,
        pending: 0,
        resolved: 0,
        byType: [],
        byPriority: []
      });
      
      setError(null);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      console.error("Error details:", error.response?.data);
      setError(error.response?.data?.message || 'Failed to fetch analytics data.');
      setConflictData([]);
      setConflictStats({
        total: 0,
        pending: 0,
        resolved: 0,
        byType: [],
        byPriority: []
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (conflictId) => {
    setResolvingConflict(conflictId);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:3001/analytics/conflicts/${conflictId}/resolve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh conflict data
      await fetchAnalyticsData();
      
      console.log('Conflict resolved successfully');
    } catch (error) {
      console.error("Error resolving conflict:", error);
      setError('Failed to resolve conflict.');
    } finally {
      setResolvingConflict(null);
    }
  };

  const exportWorkloadData = () => {
  if (!workloadData || workloadData.length === 0) {
    alert("No workload data to export.");
    return;
  }

  const header = ["Instructor", "Department", "Courses", "Total Hours"];
  const rows = workloadData.map(item => [
    item.name,
    item.department || "N/A",
    item.courses,
    item.totalHours
  ]);

  const csvContent = [
    header.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `workload_data_${workloadSemester}_${workloadYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export Conflict Data as CSV
const exportConflictData = () => {
  if (!conflictData || conflictData.length === 0) {
    alert("No conflict data to export.");
    return;
  }

  const header = ["Type", "Description", "Status", "Priority", "Course Code", "Instructor", "Room", "Day", "Start Time"];
  const rows = conflictData.map(item => [
    item.Type || "",
    `"${(item.Description || "").replace(/"/g, '""')}"`, // escape quotes
    item.Status || "",
    item.Priority || "",
    item.CourseCode || "",
    item.InstructorName || "",
    item.RoomCode || "",
    item.Day || "",
    item.StartTime || ""
  ]);

  const csvContent = [
    header.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `conflict_data_${conflictSemester}_${conflictYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

  const getStatusBadgeClass = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'badge';
      case 'resolved':
        return 'badge';
      default:
        return 'badge bg-secondary';
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          backgroundColor: '#fffbe6',
          color: '#b1a100',
          border: 'none'
        };
      case 'resolved':
        return {
          backgroundColor: '#e6f9ed',
          color: '#1db16a',
          border: 'none'
        };
      default:
        return {};
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return '#dc3545';
      case 'medium':
        return '#fd7e14';
      case 'low':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getConflictTypeIcon = (type) => {
    switch (type) {
      case 'Room Double Booking':
        return '🔄';
      case 'Room Capacity':
        return '📏';
      case 'Instructor Conflict':
        return '👨‍🏫';
      case 'Course Overlap':
        return '📚';
      default:
        return '⚠️';
    }
  };

  return (
    <ProtectedRoute>
      <SideBar>
        <div
          style={{
            maxWidth: 1700,
            margin: "0 auto 0 auto",
            padding: "0 10px 0px 2px"
          }}
        >
          <h2 className="fw-bold mb-4">Analytics & Reports</h2>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {loading && (
            <div className="d-flex justify-content-center my-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}

          <div className="d-flex mb-4" style={{ backgroundColor: "#f8f9fa", borderRadius: "8px", padding: "4px" }}>
            <button
              className="btn"
              style={{
                backgroundColor: activeTab === "workload" ? "#ffffff" : "transparent",
                color: activeTab === "workload" ? "#000" : "#6c757d",
                borderColor: activeTab === "workload" ? "#ced4da" : "transparent",
                borderRadius: "6px",
                padding: "8px 20px",
                fontWeight: activeTab === "workload" ? "500" : "normal",
                boxShadow: activeTab === "workload" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                flex: 1,
                marginRight: "2px"
              }}
              onClick={() => setActiveTab("workload")}
            >
              Instructor Workload
            </button>
            <button
              className="btn"
              style={{
                backgroundColor: activeTab === "conflicts" ? "#ffffff" : "transparent",
                color: activeTab === "conflicts" ? "#000" : "#6c757d",
                borderColor: activeTab === "conflicts" ? "#ced4da" : "transparent",
                borderRadius: "6px",
                padding: "8px 20px",
                fontWeight: activeTab === "conflicts" ? "500" : "normal",
                boxShadow: activeTab === "conflicts" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                flex: 1,
                marginLeft: "2px"
              }}
              onClick={() => setActiveTab("conflicts")}
            >
              Conflict Reports
            </button>
          </div>

          <div className="bg-white rounded-3 shadow-sm mt-3 p-4">
            {activeTab === "workload" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <h5 className="fw-bold mb-0">Instructor Workload Distribution</h5>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <select
                      className='form-select'
                      style={{ width: 130, borderRadius: 8 }}
                      value={workloadYear}
                      onChange={e => setWorkloadYear(e.target.value)}
                    >
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
                      value={workloadSemester}
                      onChange={e => setWorkloadSemester(e.target.value)}
                    >
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                    </select>
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 20px",
                        borderRadius: 8,
                        background: "#28a745",
                        fontWeight: 500,
                        fontSize: 16,
                        color: "#fff",
                        cursor: "pointer",
                        border: "none"
                      }}
                      onClick={() => fetchAnalyticsData()}
                    >
                      <BiRefresh style={{ fontSize: 20 }} />
                      Refresh
                    </button>
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 24px",
                        borderRadius: 8,
                        background: "#015551",
                        fontWeight: 500,
                        fontSize: 16,
                        color: "#fff",
                        cursor: "pointer",
                        border: "none"
                      }}
                      onClick={exportWorkloadData}
                    >
                      <BiExport style={{ fontSize: 20 }} />
                      Export
                    </button>
                  </div>
                </div>
                <div className="table-responsive">
                  <table
                    className="table align-middle"
                    style={{ minWidth: "800px", borderCollapse: "separate", borderSpacing: "0 12px" }}
                  >
                    <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: "left", paddingLeft: 20 }}>Instructor</th>
                        <th style={{ textAlign: "center" }}>Courses</th>
                        <th style={{ textAlign: "center" }}>Workload Distribution</th>
                        <th style={{ textAlign: "right", paddingRight: 20 }}>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloadData.map((instructor, idx) => (
                        <tr key={idx}>
                          <td style={{ paddingLeft: 20 }}>
                            <div>
                              <div className="fw-bold">{instructor.name}</div>
                              <div className="text-muted small">{instructor.courses} course(s)</div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>{instructor.courses}</td>
                          <td style={{ padding: "0 20px" }}>
                            <div className="d-flex align-items-center">
                              <div
                                className="progress flex-grow-1"
                                style={{ height: "20px", backgroundColor: "#e9ecef" }}
                              >
                                <div
                                  className="progress-bar"
                                  style={{
                                    width: `${Math.min((instructor.totalHours / 16) * 100, 100)}%`,
                                    backgroundColor: "#000"
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "right", paddingRight: 20 }}>
                            <span className="fw-bold">{instructor.totalHours}/12 hrs</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === "conflicts" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <h5 className="fw-bold mb-0">Scheduling Conflicts</h5>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <select
                      className='form-select'
                      style={{ width: 130, borderRadius: 8 }}
                      value={conflictYear}
                      onChange={e => setConflictYear(e.target.value)}
                    >
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
                      value={conflictSemester}
                      onChange={e => setConflictSemester(e.target.value)}
                    >
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                    </select>
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 20px",
                        borderRadius: 8,
                        background: "#28a745",
                        fontWeight: 500,
                        fontSize: 16,
                        color: "#fff",
                        cursor: "pointer",
                        border: "none"
                      }}
                      onClick={() => fetchAnalyticsData()}
                    >
                      <BiRefresh style={{ fontSize: 20 }} />
                      Refresh
                    </button>
                    <button
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 24px",
                        borderRadius: 8,
                        background: "#015551",
                        fontWeight: 500,
                        fontSize: 16,
                        color: "#fff",
                        cursor: "pointer",
                        border: "none"
                      }}
                      onClick={exportConflictData}
                    >
                      <BiExport style={{ fontSize: 20 }} />
                      Export
                    </button>
                  </div>
                </div>

                {/* Conflict Statistics Cards */}
                <div className="row mb-4">
                  <div className="col-md-3">
                    <div className="card bg-primary text-white">
                      <div className="card-body">
                        <div className="d-flex justify-content-between">
                          <div>
                            <h4>{conflictStats.total}</h4>
                            <p className="mb-0">Total Conflicts</p>
                          </div>
                          <div className="align-self-center">
                            <span style={{ fontSize: '2rem' }}>📊</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                      <div className="card bg-warning text-white">
                      <div className="card-body">
                        <div className="d-flex justify-content-between">
                          <div>
                            <h4>{conflictStats.pending}</h4>
                            <p className="mb-0">Pending</p>
                          </div>
                          <div className="align-self-center">
                            <span style={{ fontSize: '2rem' }}>🕒</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-success text-white">
                      <div className="card-body">
                        <div className="d-flex justify-content-between">
                          <div>
                            <h4>{conflictStats.resolved}</h4>
                            <p className="mb-0">Resolved</p>
                          </div>
                          <div className="align-self-center">
                            <span style={{ fontSize: '2rem' }}>✅</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-info text-white">
                      <div className="card-body">
                        <div className="d-flex justify-content-between">
                          <div>
                            <h4>{conflictStats.total > 0 ? Math.round((conflictStats.resolved / conflictStats.total) * 100) : 0}%</h4>
                            <p className="mb-0">Resolution Rate</p>
                          </div>
                          <div className="align-self-center">
                            <span style={{ fontSize: '2rem' }}>🎯</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table
                    className="table align-middle"
                    style={{ minWidth: "800px", borderCollapse: "separate", borderSpacing: "0 8px" }}
                  >
                    <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: "left", paddingLeft: 20 }}>Conflict Type</th>
                        <th style={{ textAlign: "left" }}>Description</th>
                        <th style={{ textAlign: "center" }}>Time & Location</th>
                        <th style={{ textAlign: "center" }}>Status</th>
                        <th style={{ textAlign: "center" }}>Created</th>
                        <th style={{ textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflictData.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>
                            <div className="text-muted">
                              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
                              <h5>No conflicts found!</h5>
                              <p>Great job! There are no scheduling conflicts for the selected year and semester.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        conflictData.map((conflict) => (
                          <tr key={conflict._id} style={{ backgroundColor: conflict.Status === 'Resolved' ? '#f8f9fa' : '#fff' }}>
                            <td style={{ paddingLeft: 20 }}>
                              <div className="d-flex align-items-center">
                                <span className="me-2" style={{ fontSize: '1.2rem' }}>
                                  {getConflictTypeIcon(conflict.Type)}
                                </span>
                                <div>
                                  <div
                                    className="rounded-circle me-2 d-inline-block"
                                    style={{
                                      width: 8,
                                      height: 8,
                                      backgroundColor: getPriorityColor(conflict.Priority)
                                    }}
                                  ></div>
                                  <span className="fw-bold">{conflict.Type}</span>
                                  {conflict.CourseCode && (
                                    <div className="text-muted small">Course: {conflict.CourseCode}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="text-muted small" style={{ maxWidth: 350, lineHeight: 1.4 }}>
                                {conflict.Description}
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div className="small">
                                {conflict.Day && <div className="fw-bold">{conflict.Day}</div>}
                                {conflict.StartTime && <div className="text-muted">{conflict.StartTime}</div>}
                                {conflict.RoomCode && <div className="text-muted">{conflict.RoomCode}</div>}
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span
                                className={getStatusBadgeClass(conflict.Status)}
                                style={{
                                  ...getStatusBadgeStyle(conflict.Status),
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {conflict.Status}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div className="small text-muted">
                                {formatDate(conflict.CreatedAt)}
                              </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {conflict.Status === 'Pending' ? (
                                <button
                                  onClick={() => resolveConflict(conflict._id)}
                                  disabled={resolvingConflict === conflict._id}
                                  style={{
                                    background: "#28a745",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    cursor: resolvingConflict === conflict._id ? "not-allowed" : "pointer",
                                    fontSize: "0.85rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 4,
                                    opacity: resolvingConflict === conflict._id ? 0.7 : 1,
                                    width: "fit-content",
                                    margin: "0 auto"
                                  }}
                                >
                                  {resolvingConflict === conflict._id ? (
                                    <>
                                      <div 
                                        className="spinner-border spinner-border-sm" 
                                        role="status"
                                        style={{ width: '12px', height: '12px' }}
                                      >
                                        <span className="visually-hidden">Loading...</span>
                                      </div>
                                      Resolving...
                                    </>
                                  ) : (
                                    <>
                                      <BiCheck style={{ fontSize: 14 }} />
                                      Resolve
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-muted small">Resolved</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="mt-3 text-muted" style={{ textAlign: "right" }}>
            {activeTab === "workload"
              ? `Total Instructors: ${workloadData.length}`
              : `Total Conflicts: ${conflictData.length} (${conflictData.filter(c => c.Status === 'Pending').length} pending, ${conflictData.filter(c => c.Status === 'Resolved').length} resolved)`}
          </div>
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default Analytics;