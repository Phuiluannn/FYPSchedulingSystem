import { useState, useEffect } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import CIcon from '@coreui/icons-react';
import { cilWarning, cilClock, cilCheckCircle } from '@coreui/icons';

const statusTabs = ["All", "Open", "In Progress", "Resolved"];
const statusMap = {
  Open: "Pending",
  "In Progress": "In Progress",
  Resolved: "Resolved",
};

function AdminFeedback() {
  const [activeTab, setActiveTab] = useState("All");
  const [feedbackList, setFeedbackList] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState(""); // <-- Priority filter state
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [modalForm, setModalForm] = useState({
    status: "",
    priority: "",
    response: "",
    editing: false,
    updateResponse: "",
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch all feedback for admin
  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://localhost:3001/feedback", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFeedbackList(response.data);
      } catch (error) {
        setErrorMessage(error.response?.data?.message || "Failed to fetch feedback.");
      }
    };
    fetchFeedback();
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedFeedback) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedFeedback]);

  // Filter feedback by tab, search, category, and priority
  const filteredFeedback = feedbackList.filter((fb) => {
    const matchesStatus =
      activeTab === "All" ||
      (statusMap[activeTab] ? fb.status === statusMap[activeTab] : true);
    const matchesCategory = !category || fb.type === category;
    const matchesPriority = !priority || fb.priority === priority;
    const matchesSearch =
      !search ||
      fb.title.toLowerCase().includes(search.toLowerCase()) ||
      fb.feedback.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesCategory && matchesPriority && matchesSearch;
  });

  const openCount = feedbackList.filter((fb) => fb.status === "Pending").length;
  const inProgressCount = feedbackList.filter((fb) => fb.status === "In Progress").length;
  const resolvedCount = feedbackList.filter((fb) => fb.status === "Resolved").length;

  // Badge count for sidebar: Pending + In Progress
  const feedbackBadge = feedbackList.filter(
    (fb) => fb.status === "Pending" || fb.status === "In Progress"
  ).length;

  localStorage.setItem("feedbackBadge", feedbackBadge);

  // Open modal and set form values
  const handleOpenModal = (fb) => {
    setSelectedFeedback(fb);
    setModalForm({
      status: fb.status || "Pending",
      priority: fb.priority || "Low",
      response: fb.response || "",
      editing: !fb.response,
      updateResponse: "",
    });
    setErrorMessage("");
  };

  // Handle modal form changes
  const handleModalChange = (e) => {
    setModalForm({ ...modalForm, [e.target.name]: e.target.value });
  };

  // Handle admin response submit (for first response)
  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      const token = localStorage.getItem("token");
      // If status is Pending and response is being sent, set to In Progress
      const newStatus =
        selectedFeedback.status === "Pending" && modalForm.response.trim()
          ? "In Progress"
          : modalForm.status;
      const response = await axios.put(
        `http://localhost:3001/feedback/${selectedFeedback._id}`,
        {
          status: newStatus,
          priority: modalForm.priority,
          response: modalForm.response,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedbackList((prev) =>
        prev.map((fb) =>
          fb._id === selectedFeedback._id ? { ...fb, ...response.data } : fb
        )
      );
      setSelectedFeedback(null);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Failed to update feedback.");
    }
    setModalLoading(false);
  };

  // Handle admin response update (for editing)
  const handleUpdateResponse = async () => {
    setModalLoading(true);
    try {
      const token = localStorage.getItem("token");
      // If status is Pending and response is being sent, set to In Progress
      const newStatus =
        selectedFeedback.status === "Pending" && modalForm.updateResponse.trim()
          ? "In Progress"
          : modalForm.status;
      const response = await axios.put(
        `http://localhost:3001/feedback/${selectedFeedback._id}`,
        {
          status: newStatus,
          priority: modalForm.priority,
          response: modalForm.updateResponse,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedbackList((prev) =>
        prev.map((fb) =>
          fb._id === selectedFeedback._id ? { ...fb, ...response.data } : fb
        )
      );
      setSelectedFeedback(null);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Failed to update feedback.");
    }
    setModalLoading(false);
  };

  return (
    <ProtectedRoute>
      <SideBar role="admin" feedbackBadge={feedbackBadge}>
        <div>
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto 0 auto",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              padding: "30px 32px 32px 32px",
            }}
          >
            <h2 className="fw-bold mb-4">Feedback Management</h2>
            {/* Summary Cards */}
            <div className="d-flex gap-4 mb-4">
              <div style={{ flex: 1, background: "#f8f8f8", borderRadius: 10, padding: 20, position: "relative" }}>
                <div style={{ fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  Open Issues
                  <CIcon icon={cilWarning} size="lg" style={{ color: "#d4a106" }} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{openCount}</div>
                <div style={{ fontSize: 14, color: "#888" }}>Awaiting review or action</div>
              </div>
              <div style={{ flex: 1, background: "#f8f8f8", borderRadius: 10, padding: 20, position: "relative" }}>
                <div style={{ fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  In Progress
                  <CIcon icon={cilClock} size="lg" style={{ color: "#3b82f6" }} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{inProgressCount}</div>
                <div style={{ fontSize: 14, color: "#888" }}>Currently being addressed</div>
              </div>
              <div style={{ flex: 1, background: "#f8f8f8", borderRadius: 10, padding: 20, position: "relative" }}>
                <div style={{ fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  Resolved
                  <CIcon icon={cilCheckCircle} size="lg" style={{ color: "#22c55e" }} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{resolvedCount}</div>
                <div style={{ fontSize: 14, color: "#888" }}>Successfully addressed and closed</div>
              </div>
            </div>
            {/* Feedback List Controls */}
            <div className="d-flex align-items-center mb-3 gap-3">
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search feedback..."
                style={{ maxWidth: 250 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-select"
                style={{ maxWidth: 205 }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Category</option>
                <option value="Bug">Bug</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Improvement Suggestion">Improvement Suggestion</option>
                <option value="Other">Other</option>
              </select>
              <select
                className="form-select"
                style={{ maxWidth: 180 }}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">Priority</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            {/* Status Tabs */}
            <div className="d-flex mb-4" style={{ gap: 2 }}>
              {statusTabs.map((tab) => (
                <button
                  key={tab}
                  className="btn"
                  style={{
                    flex: 1,
                    background: activeTab === tab ? "#f8f8f8" : "#e1e1e1",
                    color: "#222",
                    fontWeight: activeTab === tab ? 600 : 400,
                    borderRadius: 6,
                    border: "none",
                    boxShadow: "none",
                    outline: "none",
                    height: 38,
                  }}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            {/* Feedback List */}
            <div className="d-flex flex-column gap-4">
              {filteredFeedback.length === 0 ? (
                <div className="text-center text-muted py-5">No feedback found.</div>
              ) : (
                filteredFeedback.map((fb) => (
                  <div
                    key={fb._id}
                    className="p-4"
                    style={{
                      background: "#fff",
                      border: "1px solid #e0e0e0",
                      borderRadius: 10,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      position: "relative",
                      cursor: "pointer",
                    }}
                    onClick={() => handleOpenModal(fb)}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-bold" style={{ fontSize: 18 }}>
                          {fb.title}
                        </div>
                        <div style={{ color: "#888", fontSize: 14, marginBottom: 8 }}>
                          From {fb.user?.name || fb.user?.email || "unknown"} ({fb.user?.role ? fb.user.role : "user"})
                          {" - "}
                          {fb.submitted
                            ? new Date(fb.submitted).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              })
                            : ""}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="badge"
                          style={{
                            background: "#f3f3f3",
                            color: "#222",
                            fontWeight: 500,
                            fontSize: 13,
                          }}
                        >
                          {fb.type}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background:
                              fb.priority === "High"
                                ? "#ffeaea"
                                : fb.priority === "Medium"
                                ? "#FFEDD5"
                                : "#e6f9ed",
                            color:
                              fb.priority === "High"
                                ? "#d91a1a"
                                : fb.priority === "Medium"
                                ? "#9A3412"
                                : "#1db16a",
                            fontWeight: 500,
                            fontSize: 13,
                          }}
                        >
                          {fb.priority}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background:
                              fb.status === "Resolved"
                                ? "#e6f9ed"
                                : fb.status === "Pending"
                                ? "#fffbe6"
                                : "#e6f0ff",
                            color:
                              fb.status === "Resolved"
                                ? "#1db16a"
                                : fb.status === "Pending"
                                ? "#b1a100"
                                : "#1a5ad9",
                            fontWeight: 500,
                            fontSize: 13,
                          }}
                        >
                          {fb.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: "#666", margin: "18px 0 0 0", fontSize: 15 }}>
                      {fb.feedback}
                    </div>
                    {/* Only show Admin Response if it exists */}
                    {fb.response && (
                      <div className="mt-3">
                        <div className="fw-bold" style={{ fontSize: 16 }}>
                          Admin Response:
                        </div>
                        <div style={{ color: "#444" }}>{fb.response}</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Feedback Details Modal */}
          {selectedFeedback && (
            <div
              className="modal fade show"
              style={{
                display: "block",
                background: "rgba(0,0,0,0.3)",
                zIndex: 1050,
              }}
            >
              <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 600 }}>
                <div className="modal-content">
                  <div className="modal-header">
                    <h4 className="modal-title fw-bold">Feedback Details</h4>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setSelectedFeedback(null)}
                    ></button>
                  </div>
                  <form onSubmit={handleModalSubmit}>
                    <div className="modal-body">
                      {errorMessage && (
                        <div className="alert alert-danger">{errorMessage}</div>
                      )}
                      <div className="mb-3" style={{ fontSize: 13, color: "#888" }}>
                        ID #{selectedFeedback._id}
                      </div>
                      <div className="fw-bold" style={{ fontSize: 20 }}>
                        {selectedFeedback.title}
                      </div>
                      <div className="mb-4">{selectedFeedback.feedback}</div>
                      <div className="mb-3" style={{ fontSize: 15 }}>
                        <div>
                          <span className="fw-bold">Submitted by:</span> {selectedFeedback.user?.name || "-"}
                        </div>
                        <div>
                          <span className="fw-bold">Email:</span> {selectedFeedback.user?.email || "-"}
                        </div>
                        <div>
                          <span className="fw-bold">Role:</span> {selectedFeedback.user?.role || "-"}
                        </div>
                        <div>
                          <span className="fw-bold">Date:</span>{" "}
                          {selectedFeedback.submitted
                            ? new Date(selectedFeedback.submitted).toLocaleString("en-GB")
                            : ""}
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Status</label>
                        <select
                          className="form-select"
                          name="status"
                          value={modalForm.status}
                          onChange={handleModalChange}
                        >
                          <option value="Pending">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Priority</label>
                        <select
                          className="form-select"
                          name="priority"
                          value={modalForm.priority}
                          onChange={handleModalChange}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      {/* Admin Response Section */}
                      <div className="mb-3">
                        <label className="form-label fw-bold">Admin Response</label>
                        {/* If response exists and not editing, show response and Update button */}
                        {selectedFeedback.response && !modalForm.editing ? (
                          <>
                            <div
                              style={{
                                background: "#f5f5f5",
                                borderRadius: 8,
                                padding: "14px 16px",
                                color: "#222",
                                marginBottom: 12,
                              }}
                            >
                              {selectedFeedback.response}
                            </div>
                            <button
                              type="button"
                              className="btn btn-dark w-100 fw-semibold"
                              onClick={() =>
                                setModalForm((prev) => ({
                                  ...prev,
                                  editing: true,
                                  updateResponse: "",
                                }))
                              }
                            >
                              Update Response
                            </button>
                          </>
                        ) : selectedFeedback.response && modalForm.editing ? (
                          <>
                            <div
                              style={{
                                background: "#f5f5f5",
                                borderRadius: 8,
                                padding: "14px 16px",
                                color: "#222",
                                marginBottom: 12,
                              }}
                            >
                              {selectedFeedback.response}
                            </div>
                            <textarea
                              className="form-control"
                              name="updateResponse"
                              value={modalForm.updateResponse}
                              onChange={(e) =>
                                setModalForm((prev) => ({
                                  ...prev,
                                  updateResponse: e.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="Type your updated response here..."
                              disabled={modalLoading}
                            />
                            <div className="d-flex gap-2 mt-2">
                              <button
                                type="button"
                                className="btn btn-dark"
                                disabled={modalLoading || !modalForm.updateResponse.trim()}
                                onClick={handleUpdateResponse}
                              >
                                Send Response
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-dark"
                                onClick={() =>
                                  setModalForm((prev) => ({
                                    ...prev,
                                    editing: false,
                                    updateResponse: "",
                                  }))
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          // No response yet
                          <>
                            <textarea
                              className="form-control"
                              name="response"
                              value={modalForm.response}
                              onChange={handleModalChange}
                              rows={3}
                              placeholder="Type your response here..."
                              disabled={modalLoading}
                            />
                            <div className="d-flex gap-2 mt-2">
                              <button
                                type="submit"
                                className="btn btn-dark"
                                disabled={modalLoading || !modalForm.response.trim()}
                              >
                                Send Response
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-dark"
                                onClick={() => setSelectedFeedback(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default AdminFeedback;