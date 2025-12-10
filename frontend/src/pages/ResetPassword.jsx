import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [tokenValid, setTokenValid] = useState(true);
    const navigate = useNavigate();
    const { token } = useParams(); // Get token from URL

    axios.defaults.withCredentials = true;

    useEffect(() => {
        // Verify token is valid when component mounts
        if (!token) {
            setTokenValid(false);
            setErrors({ general: "Invalid or missing reset token." });
        }
    }, [token]);

    const validatePassword = (pwd) => {
        if (pwd.length < 8) {
            return "Password must be at least 8 characters long.";
        }
        return "";
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const newErrors = {};
        
        if (!password) {
            newErrors.password = "Password is required.";
        } else {
            const passwordError = validatePassword(password);
            if (passwordError) {
                newErrors.password = passwordError;
            }
        }
        
        if (!confirmPassword) {
            newErrors.confirmPassword = "Please confirm your password.";
        } else if (password !== confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match.";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        axios.post(`http://localhost:3001/reset-password/${token}`, { password })
            .then(res => {
                if(res.data.Status === "Success") {
                    alert('Your password has been reset successfully. You can now login with your new password.');
                    navigate('/login');
                }
            })
            .catch(error => {
                console.error('There was an error resetting the password!', error);
                if (error.response && error.response.data && error.response.data.message) {
                    setErrors({ general: error.response.data.message });
                } else {
                    setErrors({ general: 'Error resetting password. The link may have expired. Please try again.' });
                }
            })
            .finally(() => {
                setLoading(false);
            });
    };

    if (!tokenValid && !token) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#8AB2A6' }}>
                <div className="bg-white p-5 rounded-4" style={{ width: '35%' }}>
                    <h2 className="text-center fw-bold text-danger mb-4">Invalid Link</h2>
                    <p className="text-center">This password reset link is invalid or has expired.</p>
                    <a href="/forgot-password" className="btn w-100 rounded-3" style={{ backgroundColor: '#015551', color: '#fff'}}>
                        Request New Link
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#8AB2A6' }}>
            <div className="bg-white p-5 rounded-4" style={{ width: '35%' }}>
                <h2 className="text-center fw-bold display fs-2 mb-3">Reset Password</h2>
                <p className="text-center text-muted mb-4">Enter your new password below.</p>
                <form onSubmit={handleSubmit}>
                    <div className="font-fredoka mb-4">
                        <label className="form-label fw-semibold">New Password</label>
                        <input
                            type="password"
                            placeholder="Enter your new password"
                            autoComplete="off"
                            name="password"
                            className="form-control rounded-3"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                            }}
                        />
                        {errors.password && <small className="text-danger">{errors.password}</small>}
                    </div>
                    <div className="font-fredoka mb-4">
                        <label className="form-label fw-semibold">Confirm Password</label>
                        <input
                            type="password"
                            placeholder="Confirm your new password"
                            autoComplete="off"
                            name="confirmPassword"
                            className="form-control rounded-3"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                            }}
                        />
                        {errors.confirmPassword && <small className="text-danger">{errors.confirmPassword}</small>}
                    </div>
                    {errors.general && <div className="text-danger text-center mb-3">{errors.general}</div>}
                    <button
                        type="submit"
                        className="font-fredoka btn w-100 rounded-3"
                        style={{ backgroundColor: '#015551', color: '#fff'}}
                        disabled={loading}
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
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

export default ResetPassword;