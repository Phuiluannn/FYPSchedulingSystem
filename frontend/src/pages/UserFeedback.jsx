import { useState, useEffect } from "react";
import axios from "axios";
import SideBar from "./SideBar";
import ProtectedRoute from "./ProtectedRoute";

const statusTabs = ["All", "Pending", "In Progress", "Resolved"];

function UserFeedback() {
  const [activeTab, setActiveTab] = useState("All");
  const [feedbackList, setFeedbackList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "",
    feedback: "",
  });
  const [errorMessage, setErrorMessage] = useState("");

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
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const filteredFeedback = feedbackList; // Backend handles filtering by status

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
      const response = await axios.post(
        "http://localhost:3001/user/feedback",
        {
          title: form.title,
          type: form.type,
          feedback: form.feedback,
          priority: form.priority || "Low"
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

  return (
    <ProtectedRoute>
      <SideBar role={localStorage.getItem('role') || 'student'}>
        <div
          // style={{
          //   minHeight: "100vh",
          //   background: "#f6f6f6",
          // }}
        >
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
                    <div>
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

          {/* Modal */}
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
                        <label className="form-label fw-bold">Category</label>
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
                          <option value="Bug">Bug</option>
                          <option value="Feature Request">Feature Request</option>
                          <option value="Improvement Suggestion">Improvement Suggestion</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="form-label fw-bold">Subject</label>
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
                        <label className="form-label fw-bold">Description</label>
                        <textarea
                          className="form-control"
                          name="feedback"
                          value={form.feedback}
                          onChange={handleChange}
                          rows={4}
                          required
                          maxLength={500}
                          placeholder="Please provide detailed information about your feedback or the issue you’re experiencing..."
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
        </div>
      </SideBar>
    </ProtectedRoute>
  );
}

export default UserFeedback;