import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAlert } from './AlertContext';

function LogIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student");
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
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

        axios.post('https://atss-backend.onrender.com/login', { email, password, role })
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
        <div className="min-h-screen flex items-center justify-center p-2" style={{ 
            background: 'linear-gradient(135deg, #a4c3d2 0%, #b8acd2 100%)'
        }}>
            <div className="w-full max-w-lg my-2">
                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-3 text-center">
                        <div className="w-12 h-12 bg-white rounded-full mx-auto mb-2 flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-white">Welcome Back</h2>
                        <p className="text-xs text-teal-100">Log in to continue</p>
                    </div>

                    {/* Form Content */}
                    <div className="p-4 space-y-2.5">
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
                                    placeholder="Enter your siswamail or ummail"
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

                        {/* Password Input */}
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-gray-700">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    autoComplete="off"
                                    name="password"
                                    value={password}
                                    className={`w-full pl-10 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all ${
                                        errors.password ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                                    }}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                            <div className="text-right">
                                <a href="/forgot-password" className="text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors">
                                    Forgot Password?
                                </a>
                            </div>
                        </div>

                        {/* Role Selection */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-700">Select Your Role</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['student', 'instructor', 'admin'].map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        className={`py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                                            role === r 
                                                ? 'bg-teal-600 text-white shadow-lg scale-105' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                        onClick={() => setRole(r)}
                                    >
                                        {r.charAt(0).toUpperCase() + r.slice(1)}
                                    </button>
                                ))}
                            </div>
                            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
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
                            className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white py-2 rounded-lg font-semibold hover:from-teal-700 hover:to-teal-800 transition-all shadow-lg hover:shadow-xl"
                        >
                            Log In
                        </button>

                        {/* Instructor Notice */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                            <div className="flex items-start">
                                <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-xs font-semibold text-blue-900">👨‍🏫 New Instructor?</p>
                                    <p className="text-xs text-blue-700 mt-0.5">
                                        Account has been created by admin. Use <strong>"Forgot Password"</strong> to set up your password.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Sign Up Link */}
                        <div className="text-center pt-2 border-t border-gray-200">
                            <p className="text-gray-600 text-xs">
                                Don't have an account?{' '}
                                <a href="/signup" className="text-teal-600 hover:text-teal-700 font-semibold transition-colors">
                                    Sign Up
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LogIn;