import { useState } from 'react';
import axios from 'axios'; // Importing axios for making HTTP requests
import { useNavigate } from 'react-router-dom';

function SignUp() {
    const [name, setName] = useState(""); // State to store the name
    const [email, setEmail] = useState(""); // State to store the email
    const [password, setPassword] = useState(""); // State to store the password
    const [role, setRole] = useState("student"); // State to store the selected role
    const [errors, setErrors] = useState({}); // State to store validation errors
    const navigate = useNavigate();

    const validateFields = () => {
        const newErrors = {};
        if (!name) newErrors.name = "Name is required.";
        if (!email) newErrors.email = "Email is required.";
        else if (!email.endsWith("um.edu.my")) newErrors.email = "Only siswamail or ummail are allowed.";
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

        axios.post('http://localhost:3001/signup', { name, email, password, role })
            .then(result => {
                console.log(result);
                alert("Signup successful!");
                navigate('/login');
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
                <h2 className="text-center fw-bold display fs-2 mb-3">Signup</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="name">Name</label>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            autoComplete="off"
                            name="name"
                            className="form-control rounded-3"
                            onChange={(e) => setName(e.target.value)} // Update name state on change
                        />
                        {errors.name && <small className="text-danger">{errors.name}</small>}
                    </div>
                    <div className="mb-3">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            placeholder="Enter your siswamail or ummail"
                            autoComplete="off"
                            name="email"
                            className="form-control rounded-3"
                            onChange={(e) => setEmail(e.target.value)} // Update email state on change
                        />
                        {errors.email && <small className="text-danger">{errors.email}</small>}
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            autoComplete="off"
                            name="password"
                            className="form-control rounded-3"
                            onChange={(e) => setPassword(e.target.value)} // Update password state on change
                        />
                        {errors.password && <small className="text-danger">{errors.password}</small>}
                    </div>
                    <div className="mb-3 text-center">
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
                        </div>
                        {errors.role && <small className="text-danger">{errors.role}</small>}
                    </div>
                    {errors.general && <div className="text-danger text-center mb-3">{errors.general}</div>}
                    <button
                        type="submit"
                        className="btn w-100 rounded-3"
                        style={{ backgroundColor: '#015551', color: '#fff' }}
                    >
                        Signup
                    </button>
                    <p className="mt-3 text-center">
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