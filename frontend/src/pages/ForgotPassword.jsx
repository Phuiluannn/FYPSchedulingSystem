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
        axios.post('https://atss-backend.onrender.com/forgot-password', { email })
            .then(res => {
                if(res.data.Status === "Success") {
                    alert('Password reset link has been sent to your email. Please check your inbox or spam folder.');
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
        <div className="min-h-screen flex items-center justify-center p-2" style={{ 
            background: 'linear-gradient(135deg, #a4c3d2 0%, #b8acd2 100%)'
        }}>
            <div className="w-full max-w-lg my-2">
                {/* Forgot Password Card */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-3 text-center">
                        <div className="w-12 h-12 bg-white rounded-full mx-auto mb-2 flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-white">Forgot Password</h2>
                        <p className="text-xs text-teal-100">Reset your password</p>
                    </div>

                    {/* Form Content */}
                    <div className="p-4 space-y-2.5">
                        {/* Info Text */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 mb-3">
                            <p className="text-xs text-gray-600 text-center">
                                Enter your email address and we'll send you a link to reset your password.
                            </p>
                        </div>

                        {/* Email Input */}
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-gray-700">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    autoComplete="off"
                                    name="email"
                                    value={email}
                                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all ${
                                        errors.email ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                                    }}
                                />
                            </div>
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>

                        {/* General Error */}
                        {errors.general && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-2 rounded">
                                <p className="text-red-700 text-xs">{errors.general}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className={`w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white py-2 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl ${
                                loading 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : 'hover:from-teal-700 hover:to-teal-800'
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </span>
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>

                        {/* Back to Login Link */}
                        <div className="text-center pt-2 border-t border-gray-200">
                            <p className="text-gray-600 text-xs">
                                Remember your password?{' '}
                                <a href="/login" className="text-teal-600 hover:text-teal-700 font-semibold transition-colors">
                                    Back to Login
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;