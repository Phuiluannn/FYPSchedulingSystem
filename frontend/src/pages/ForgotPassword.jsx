import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    axios.defaults.withCredentials = true;

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!email) {
            setErrors({ email: "Email is required." });
            return;
        }

        setLoading(true);
        axios.post('http://localhost:3001/forgot-password', { email })
            .then(res => {
                if(res.data.Status === "Success") {
                    alert('Password reset link has been sent to your email. Please check your inbox.');
                    navigate('/login');
                }
            })
            .catch(error => {
                console.error('There was an error sending the password reset email!', error);
                if (error.response && error.response.data && error.response.data.message) {
                    setErrors({ general: error.response.data.message });
                } else {
                    setErrors({ general: 'Error sending password reset email. Please try again.' });
                }
            })
            .finally(() => {
                setLoading(false);
            });
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#8AB2A6' }}>
            <div className="bg-white p-5 rounded-4" style={{ width: '35%' }}>
                <h2 className="text-center fw-bold display fs-2 mb-3">Forgot Password</h2>
                <p className="text-center text-muted mb-4">Enter your email address and we'll send you a link to reset your password.</p>
                <form onSubmit={handleSubmit}>
                    <div className="font-fredoka mb-4">
                        <label className="form-label fw-semibold">Email</label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            autoComplete="off"
                            name="email"
                            className="form-control rounded-3"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                            }}
                        />
                        {errors.email && <small className="text-danger">{errors.email}</small>}
                    </div>
                    {errors.general && <div className="text-danger text-center mb-3">{errors.general}</div>}
                    <button
                        type="submit"
                        className="font-fredoka btn w-100 rounded-3"
                        style={{ backgroundColor: '#015551', color: '#fff'}}
                        disabled={loading}
                    >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                    <p className="font-fredoka mt-3 text-center">
                        Remember your password?
                        <a href="/login" className="text-primary text-decoration-underline ms-1">
                            Back to Login
                        </a>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default ForgotPassword;