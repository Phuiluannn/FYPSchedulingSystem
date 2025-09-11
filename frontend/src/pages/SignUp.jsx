import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAlert } from './AlertContext';

function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("");
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();

    // Automatically set role based on email domain
    useEffect(() => {
        if (email.endsWith('@siswa.um.edu.my')) {
            setRole('student');
            setErrors(prev => ({ ...prev, email: undefined, role: undefined }));
        } else if (email.endsWith('@um.edu.my') && !email.endsWith('@siswa.um.edu.my')) {
            setRole('instructor');
            setErrors(prev => ({ ...prev, email: undefined, role: undefined }));
        }
    }, [email]);

    const validateFields = () => {
        const newErrors = {};
        if (!name) newErrors.name = "Name is required.";
        if (!email) newErrors.email = "Email is required.";
        else if (!email.endsWith('@siswa.um.edu.my') && !email.endsWith('@um.edu.my')) {
            newErrors.email = "Email must be siswamail or ummail";
        } else if (email.endsWith('@siswa.um.edu.my') && role !== 'student') {
            newErrors.role = "Email with @siswa.um.edu.my can only be registered as a student.";
        } else if (email.endsWith('@um.edu.my') && !email.endsWith('@siswa.um.edu.my') && role !== 'instructor') {
            newErrors.role = "Email with @um.edu.my can only be registered as an instructor.";
        }
        if (!password) newErrors.password = "Password is required.";
        if (!role) newErrors.role = "Role could not be determined based on email.";
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
                <h2 className="text-center fw-bold display fs-2 mb-5">Signup</h2>
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
                        {errors.password && <small className="text-dang
System: er">{errors.password}</small>}
                    </div>
                    <div className="font-fredoka mb-4 text-center">
                        <p className="mb-2">Role:</p>
                        <div className="btn-group mb-2" role="group" aria-label="Role selection">
                            <button
                                type="button"
                                className="btn"
                                style={{
                                    backgroundColor: role === 'student' ? '#015551' : '#e0e0e0',
                                    color: role === 'student' ? '#fff' : '#666',
                                    border: '1px solid #015551',
                                    cursor: 'default',
                                }}
                                disabled
                            >
                                Student
                            </button>
                            <button
                                type="button"
                                className="btn"
                                style={{
                                    backgroundColor: role === 'instructor' ? '#015551' : '#e0e0e0',
                                    color: role === 'instructor' ? '#fff' : '#666',
                                    border: '1px solid #015551',
                                    cursor: 'default',
                                }}
                                disabled
                            >
                                Instructor
                            </button>
                        </div>
                        {errors.role && <small className="text-danger d-block mt-2">{errors.role}</small>}
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