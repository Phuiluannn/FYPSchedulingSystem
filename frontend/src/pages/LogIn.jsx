import { useState } from 'react';
import axios from 'axios'; // Importing axios for making HTTP requests
import { useNavigate } from 'react-router-dom';

function LogIn() {
    const [email, setEmail] = useState(""); // State to store the email
    const [password, setPassword] = useState(""); // State to store the password
    const [role, setRole] = useState("student"); // State to store the selected role
    const [errors, setErrors] = useState({}); // State to store validation errors
    const navigate = useNavigate();

    const validateFields = () => {
        const newErrors = {};
        if (!email) newErrors.email = "Email is required.";
        if (!password) newErrors.password = "Password is required.";
        if (!role) newErrors.role = "Role is required.";
        return newErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const validationErrors = validateFields();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors); // Set validation errors
            return;
        }

        axios.post('http://localhost:3001/login', { email, password, role })
            .then(result => {
                console.log(result);
                alert(result.data.message);
                if (result.data.message === "Login successful!") {
                    localStorage.setItem('token', result.data.token); // Store the token in local storage
                    localStorage.setItem('name', result.data.name);
                    localStorage.setItem('feedbackBadge', result.data.unresolvedFeedbackCount || 0); // Store unresolved feedback count
                    localStorage.setItem('role', result.data.role); // Store the role in local storage
                    localStorage.setItem('email', email); // Store the email in local storage
                    // Route based on role
                    if (role === "student") {
                        navigate('/user/home');
                    } else if (role === "instructor") {
                        navigate('/user/home');
                    } else if (role === "admin") {
                        navigate('/home');
                    }
                }
            })
            .catch(err => {
                if (err.response && err.response.data && err.response.data.message) {
                    setErrors({ general: err.response.data.message }); // Set backend error message
                } else {
                    setErrors({ general: "An error occurred. Please try again." }); // Generic error message
                }
                console.log(err); // Log the error for debugging
            });
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#8AB2A6' }}>
            <div className="bg-white p-5 rounded-4" style={{ width: '40%' }}>
                <h2 className="text-center fw-bold display fs-2 mb-5">Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="font-fredoka mb-4">
                        {/* <label htmlFor="email">Email</label> */}
                        <input
                            type="email"
                            placeholder="Enter your siswamail or ummail"
                            autoComplete="off"
                            name="email"
                            className="form-control rounded-3"
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                            }}
                        />
                        {errors.email && <small className="text-danger">{errors.email}</small>}
                    </div>
                    <div className="font-fredoka mb-4">
                        {/* <label htmlFor="password">Password</label> */}
                        <input
                            type="password"
                            placeholder="Enter your password"
                            autoComplete="off"
                            name="password"
                            className="form-control rounded-3"
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                            }}
                        />
                        {errors.password && <small className="text-danger">{errors.password}</small>}
                        <p className="mt-2 text-end">
                            <a
                                href="/forgot-password"
                                className="text-primary text-decoration-underline"
                                style={{ fontSize: '0.8rem' }}
                            >
                                Forgot Password?
                            </a>
                        </p>
                    </div>
                    <div className="font-fredoka mb-4 text-center">
                        <p className="mb-2">Select Your Role:</p>
                        <div className="btn-group mb-2" role="group" aria-label="Role selection">
                            <button
                                type="button"
                                className="btn"
                                style={{
                                    backgroundColor: role === 'student' ? '#015551' : 'transparent',
                                    color: role === 'student' ? '#fff' : '#015551',
                                    border: '1px solid #015551',
                                }}
                                onClick={() => setRole('student')}
                            >
                                Student
                            </button>
                            <button
                                type="button"
                                className="btn"
                                style={{
                                    backgroundColor: role === 'instructor' ? '#015551' : 'transparent',
                                    color: role === 'instructor' ? '#fff' : '#015551',
                                    border: '1px solid #015551',
                                }}
                                onClick={() => setRole('instructor')}
                            >
                                Instructor
                            </button>
                            <button
                                type="button"
                                className="btn"
                                style={{
                                    backgroundColor: role === 'admin' ? '#015551' : 'transparent',
                                    color: role === 'admin' ? '#fff' : '#015551',
                                    border: '1px solid #015551',
                                }}
                                onClick={() => setRole('admin')}
                            >
                                Admin
                            </button>
                        </div>
                        {errors.role && <small className="text-danger">{errors.role}</small>}
                    </div>
                    {errors.general && <div className="text-danger text-center mb-3">{errors.general}</div>}
                    <button
                        type="submit"
                        className="font-fredoka btn w-100 rounded-3"
                        style={{ backgroundColor: '#015551', color: '#fff'}}
                    >
                        Login
                    </button>
                    <p className="font-fredoka mt-3 text-center">
                        Don't have an account?
                        <a href="/signup" className="text-primary text-decoration-underline ms-1">
                            Sign Up
                        </a>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default LogIn;