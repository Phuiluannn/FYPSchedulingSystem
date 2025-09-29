import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";
import { BiSort, BiSortUp, BiSortDown } from "react-icons/bi";

const socket = io('http://localhost:3001', { transports: ['websocket'] });
const statusTabs = ["All", "Pending", "In Progress", "Resolved"];

function UserFeedback() {
  const [activeTab, setActiveTab] = useState("All");
  const [feedbackList, setFeedbackList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState(null);
  const [form, setForm] = useState({
    title: "",
    type: "",
    feedback: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const RequiredMark = () => <span style={{ color: 'red', marginLeft: 2 }}>*</span>;

  // Fetch feedback on mount and when activeTab changes
  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          "http://localhost:3001/user/feedback",
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { status: activeTab }
          }
        );
        setFeedbackList(response.data);
      } catch (error) {
        console.error("Error fetching feedback:", error);
        setErrorMessage(error.response?.data?.message || "Failed to fetch feedback.");
      }
    };
    fetchFeedback();
  }, [activeTab]);

  useEffect(() => {
  socket.connect();

  socket.on('feedback:new', (newFeedback) => {
    setFeedbackList(prev => [newFeedback, ...prev]);
  });

  socket.on('feedback:update', (updatedFeedback) => {
    setFeedbackList(prev =>
      prev.map(fb => fb._id === updatedFeedback._id ? updatedFeedback : fb)
    );
  });

  socket.on('feedback:delete', ({ _id }) => {
    setFeedbackList(prev => prev.filter(fb => fb._id !== _id));
  });

  return () => {
    socket.disconnect();
    socket.off('feedback:new');
    socket.off('feedback:update');
    socket.off('feedback:delete');
  };
}, []);

  useEffect(() => {
    if (showModal || showDeleteModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal, showDeleteModal]);

  const sortedFeedback = [...feedbackList].sort((a, b) => {
  const dateA = new Date(a.submitted);
  const dateB = new Date(b.submitted);
  return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
});

const filteredFeedback = sortedFeedback; // Backend handles filtering by status

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrorMessage("");
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!form.title.trim() || !form.feedback.trim()) {
    setErrorMessage("Please fill in both Subject and Description fields.");
    return;
  }

  try {
    const token = localStorage.getItem("token");

    // Set priority based on feedback type
    let priority = "Low";
    if (form.type === "Schedule Issue") {
      priority = "High";
    } else if (form.type === "Bug") {
      priority = "Medium";
    }

    const response = await axios.post(
      "http://localhost:3001/user/feedback",
      {
        title: form.title,
        type: form.type,
        feedback: form.feedback,
        priority: priority
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setFeedbackList([response.data, ...feedbackList]);
    setShowModal(false);
    setForm({ title: "", type: "", feedback: "" });
    setErrorMessage("");
  } catch (error) {
    setErrorMessage(error.response?.data?.message || "Failed to submit feedback.");
  }
};

  const handleDeleteClick = (feedback) => {
    setFeedbackToDelete(feedback);
    setShowDeleteModal(true);
    setDeleteErrorMessage("");
  };

  const handleDeleteConfirm = async () => {
    if (!feedbackToDelete) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `http://localhost:3001/user/feedback/${feedbackToDelete._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Remove the deleted feedback from the list
      setFeedbackList(feedbackList.filter(fb => fb._id !== feedbackToDelete._id));
      setShowDeleteModal(false);
      setFeedbackToDelete(null);
    } catch (error) {
      setDeleteErrorMessage(error.response?.data?.message || "Failed to delete feedback.");
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setFeedbackToDelete(null);
    setDeleteErrorMessage("");
  };

  // Function to check if feedback can be deleted (only unresolved feedback)
  const canDeleteFeedback = (feedback) => {
    return feedback.status !== "Resolved";
  };

  return (
    <ProtectedRoute>
      <SideBar role={localStorage.getItem('role') || 'student'}>
        <div>
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto 0 auto",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              padding: "30px 32px 32px 32px",
            }}
          >
            <div className="d-flex justify-content-between align-items-start mb-4">
  <h2 className="fw-bold mb-0">Feedback</h2>
  <div className="d-flex gap-2">
    <button
      className="btn"
      style={{
        background: "#f8f9fa",
        color: "#495057",
        fontWeight: 500,
        borderRadius: 8,
        minWidth: 140,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        fontSize: 14,
        marginTop: 18,
        border: "1px solid #dee2e6"
      }}
      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
    >
      {sortOrder === "asc" ? (
        <>
          <BiSortUp size={18} /> Oldest First
        </>
      ) : (
        <>
          <BiSortDown size={18} /> Newest First
        </>
      )}
    </button>
    <button
      className="btn"
      style={{
        background: "#015551",
        color: "#fff",
        fontWeight: 500,
        borderRadius: 8,
        minWidth: 160,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        fontSize: 16,
        marginTop: 18,
      }}
      onClick={() => setShowModal(true)}
    >
      <span style={{ fontSize: 18 }}>+</span> Submit Feedback
    </button>
  </div>
</div>
            {/* Tabs */}
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
            {/* Feedback Cards */}
            <div className="d-flex flex-column gap-4">
              {filteredFeedback.map((fb) => (
                <div
                  key={fb._id}
                  className="p-4"
                  style={{
                    background: "#fff",
                    border: "1px solid #e0e0e0",
                    borderRadius: 10,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    position: "relative",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div style={{ flex: 1 }}>
                      <div className="fw-bold" style={{ fontSize: 22 }}>
                        {fb.title}
                      </div>
                      <div className="mb-2">
                        <span
                          className="badge me-2"
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
                    <div className="d-flex align-items-start gap-3">
                      <div
                        className="text-end"
                        style={{ minWidth: 180, fontSize: 15, color: "#666" }}
                      >
                        <div>
                          Submitted: {new Date(fb.submitted).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </div>
                        {fb.status === "Resolved" && fb.resolved && (
                          <div style={{ color: "#1db16a", fontSize: 14, marginTop: 2 }}>
                            Resolved: {new Date(fb.resolved).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </div>
                        )}
                      </div>
                      {canDeleteFeedback(fb) && (
                        <button
                          className="btn btn-sm"
                          style={{
                            background: "#dc3545",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 12,
                            fontWeight: 500,
                            minWidth: 60,
                          }}
                          onClick={() => handleDeleteClick(fb)}
                          title="Delete feedback"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="fw-bold" style={{ fontSize: 16 }}>
                      Your Feedback:
                    </div>
                    <div style={{ color: "#444" }}>{fb.feedback}</div>
                  </div>
                  {fb.response && (
                    <div className="mt-3">
                      <div className="fw-bold" style={{ fontSize: 16 }}>
                        Admin Response:
                      </div>
                      <div style={{ color: "#444" }}>
                        {fb.response}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredFeedback.length === 0 && (
                <div className="text-center text-muted py-5">
                  No feedback found.
                </div>
              )}
            </div>
          </div>

          {/* Submit Feedback Modal */}
          {showModal && (
            <div
              className="modal fade show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: "650px" }}
              >
                <div className="modal-content">
                  <div className="modal-header">
                    <h4 className="modal-title fw-bold">
                      Feedback & Issue Reporting
                    </h4>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => {
                        setShowModal(false);
                        setForm({ title: "", type: "", feedback: "" });
                        setErrorMessage("");
                      }}
                    ></button>
                  </div>
                  <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                      {errorMessage && (
                        <div className="alert alert-danger">{errorMessage}</div>
                      )}
                      <div className="mb-4">
                        <label className="form-label fw-bold">Category<RequiredMark /></label>
                        <select
                          className="form-select"
                          name="type"
                          value={form.type}
                          onChange={handleChange}
                          required
                        >
                          <option value="" disabled>
                            Select category
                          </option>
                          <option value="Schedule Issue">Schedule Issue</option>
                          <option value="Bug">Bug</option>
                          <option value="Feature Request">Feature Request</option>
                          <option value="Improvement Suggestion">Improvement Suggestion</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="form-label fw-bold">Subject<RequiredMark /></label>
                        <input
                          className="form-control"
                          name="title"
                          value={form.title}
                          onChange={handleChange}
                          required
                          maxLength={100}
                          placeholder="Brief summary of your feedback"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold">Description<RequiredMark /></label>
                        <textarea
                          className="form-control"
                          name="feedback"
                          value={form.feedback}
                          onChange={handleChange}
                          rows={4}
                          required
                          maxLength={500}
                          placeholder="Please provide detailed information about your feedback or the issue you're experiencing..."
                        />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowModal(false);
                          setForm({ title: "", type: "", feedback: "" });
                          setErrorMessage("");
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Submit
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div
              className="modal fade show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div
                className="modal-dialog modal-dialog-centered"
                style={{ maxWidth: "500px" }}
              >
                <div className="modal-content">
                  <div className="modal-header">
                    <h4 className="modal-title fw-bold">
                      Confirm Delete
                    </h4>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={handleDeleteCancel}
                    ></button>
                  </div>
                  <div className="modal-body">
                    {deleteErrorMessage && (
                      <div className="alert alert-danger">{deleteErrorMessage}</div>
                    )}
                    <p>Are you sure you want to delete this feedback?</p>
                    {feedbackToDelete && (
                      <div className="bg-light p-3 rounded">
                        <strong>Subject:</strong> {feedbackToDelete.title}<br/>
                        <strong>Type:</strong> {feedbackToDelete.type}<br/>
                        <strong>Status:</strong> {feedbackToDelete.status}
                      </div>
                    )}
                    <p className="mt-3 text-muted">
                      <small>This action cannot be undone.</small>
                    </p>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleDeleteCancel}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: "#dc3545", color: "#fff" }}
                      onClick={handleDeleteConfirm}
                    >
                      Delete
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

export default UserFeedback;