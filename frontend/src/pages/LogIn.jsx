import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAlert } from './AlertContext';

function LogIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student");
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();

    const validateFields = () => {
        const newErrors = {};
        if (!email) newErrors.email = "Email is required.";
        if (!password) newErrors.password = "Password is required.";
        if (!role) newErrors.role = "Role is required.";
        return newErrors;
    };

    // Function to decode JWT token and extract user ID
    const decodeToken = (token) => {
        try {
            // JWT tokens have 3 parts separated by dots
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            const decoded = JSON.parse(jsonPayload);
            console.log('Decoded token:', decoded);
            
            // Common JWT payload fields for user ID (your JWT uses 'id')
            return decoded.id || decoded.userId || decoded.sub || decoded.user?.id || decoded.user?._id;
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const validationErrors = validateFields();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        axios.post('http://localhost:3001/login', { email, password, role })
            .then(result => {
                console.log('Login response:', result.data);
                showAlert(result.data.message, "success");
                
                if (result.data.message === "Login successful!") {
                    const token = result.data.token;
                    
                    // Try to get userId from response first
                    let userId = result.data.userId || result.data.id || result.data.user?.id || result.data.user?._id;
                    
                    // If not in response, decode from token (your JWT has 'id' field)
                    if (!userId && token) {
                        const decodedUserId = decodeToken(token);
                        userId = decodedUserId;
                        console.log('Extracted userId from token:', userId);
                    }
                    
                    // Store all data in localStorage
                    localStorage.setItem('token', token);
                    localStorage.setItem('name', result.data.name);
                    localStorage.setItem('feedbackBadge', result.data.unresolvedFeedbackCount || 0);
                    localStorage.setItem('role', result.data.role);
                    localStorage.setItem('email', email);
                    
                    if (userId) {
                        localStorage.setItem('userId', userId);
                        console.log('✅ Stored userId:', userId);
                    } else {
                        console.error('❌ Could not determine userId');
                        // Fallback: use email as identifier
                        localStorage.setItem('userId', email);
                        console.log('Using email as userId fallback:', email);
                    }
                    
                    // Debug: Show what's stored
                    console.log('Final localStorage contents:', {
                        token: !!localStorage.getItem('token'),
                        userId: localStorage.getItem('userId'),
                        role: localStorage.getItem('role'),
                        name: localStorage.getItem('name'),
                        email: localStorage.getItem('email')
                    });
                    
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
                    setErrors({ general: err.response.data.message });
                } else {
                    setErrors({ general: "An error occurred. Please try again." });
                }
                console.log(err);
            });
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#8AB2A6' }}>
            <div className="bg-white p-5 rounded-4" style={{ width: '40%' }}>
                <h2 className="text-center fw-bold display fs-2 mb-5">Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="font-fredoka mb-4">
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