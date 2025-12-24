import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAlert } from './AlertContext';

function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student"); // 🔥 Always set to student
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();

    const validateFields = () => {
        const newErrors = {};
        if (!name) newErrors.name = "Name is required.";
        if (!email) newErrors.email = "Email is required.";
        else if (!email.endsWith('@siswa.um.edu.my')) {
            newErrors.email = "Email must be a siswamail (@siswa.um.edu.my)";
        }
        if (!password) newErrors.password = "Password is required.";
        return newErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const validationErrors = validateFields();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        axios.post('http://localhost:3001/signup', { name, email, password, role })
            .then(result => {
                console.log(result);
                showAlert("Signup successful!", "success");
                navigate('/login');
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
                <h2 className="text-center fw-bold display fs-2 mb-5">Student Signup</h2>
                <form onSubmit={handleSubmit}>
                    <div className="font-fredoka mb-4">
                        <input
                            type="text"
                            placeholder="Enter your name"
                            autoComplete="off"
                            name="name"
                            className="form-control rounded-3"
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                            }}
                        />
                        {errors.name && <small className="text-danger">{errors.name}</small>}
                    </div>
                    <div className="font-fredoka mb-4">
                        <input
                            type="email"
                            placeholder="Enter your siswamail"
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
                    </div>

                    {/* 🔥 INFO BOX FOR INSTRUCTORS */}
                    <div 
                        className="alert alert-info mb-4" 
                        style={{ 
                            fontSize: '0.85rem',
                            backgroundColor: '#e7f3ff',
                            borderColor: '#b3d9ff',
                            color: '#004085',
                            padding: '12px 15px'
                        }}
                    >
                        <strong>👨‍🏫 Are you an Instructor?</strong>
                        <p className="mb-0 mt-1">
                            Instructors cannot sign up directly. Your account will be created by an administrator. 
                            Please contact the admin or use <strong>"Forgot Password"</strong> on the login page if your account already exists.
                        </p>
                    </div>

                    {errors.general && <div className="text-danger text-center mb-3">{errors.general}</div>}
                    <button
                        type="submit"
                        className="font-fredoka btn w-100 rounded-3"
                        style={{ backgroundColor: '#015551', color: '#fff' }}
                    >
                        Signup
                    </button>
                    <p className="font-fredoka mt-3 text-center">
                        Already have an account?
                        <a href="/login" className="text-primary text-decoration-underline ms-1">
                            Log In
                        </a>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default SignUp;