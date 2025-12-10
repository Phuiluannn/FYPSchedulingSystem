import * as passwordService from '../services/passwordService.js';

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        await passwordService.forgotPassword(email);
        res.json({ Status: "Success", message: "Password reset link sent to email" });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(400).json({ Status: "Error", message: err.message });
    }
};

export const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        await passwordService.resetPassword(token, password);
        res.json({ Status: "Success", message: "Password reset successful" });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(400).json({ Status: "Error", message: err.message });
    }
};