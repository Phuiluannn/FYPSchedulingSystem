import * as authService from '../services/authService.js';

export const signup = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const newUser = await authService.signup({ name, email, password, role });
        res.json({ message: "Signup successful!", user: newUser });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

export const login = async (req, res) => {
    const { email, password, role } = req.body;

    try {
        const {token, name, role: userRole, unresolvedFeedbackCount} = await authService.login({ email, password, role });
        res.json({ message: "Login successful!", token, name, role: userRole, unresolvedFeedbackCount });
    } catch (err) {
        const status = err.message === "User not found" ? 404 :
                       err.message === "The password is incorrect" ? 401 :
                       err.message === "Role mismatch" ? 403 : 500;
        res.status(status).json({ message: err.message });
    }
};

export const protectedRoute = (req, res) => {
    res.json({ message: "This is a protected route", user: req.user });
};