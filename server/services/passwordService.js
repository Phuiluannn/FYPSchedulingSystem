// ADD THESE MISSING IMPORTS AT THE TOP
import UserModel from '../models/User.js';
import PasswordResetModel from '../models/PasswordReset.js';
import bcrypt from "bcryptjs";
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';

// Replace createTransporter and email sending code
const sendPasswordResetEmail = async (email, resetUrl, user, isFirstTimeSetup) => {
    if (!process.env.SENDGRID_API_KEY) {
        throw new Error("SENDGRID_API_KEY not set in .env file");
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const emailSubject = isFirstTimeSetup ? 'Set Your Password - Welcome!' : 'Password Reset Request';
    const emailTitle = isFirstTimeSetup ? 'Welcome! Set Your Password' : 'Password Reset Request';
    const emailMessage = isFirstTimeSetup 
        ? `<p>Welcome ${user.name},</p>
           <p>An administrator has created an account for you. Please click the button below to set your password and activate your account:</p>`
        : `<p>Hello ${user.name},</p>
           <p>You requested to reset your password. Click the button below to reset it:</p>`;
    const buttonText = isFirstTimeSetup ? 'Set Password' : 'Reset Password';

    const msg = {
        to: email,
        from: process.env.SENDGRID_VERIFIED_SENDER, // Must be verified in SendGrid
        subject: emailSubject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #015551;">${emailTitle}</h2>
                ${emailMessage}
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background-color: #015551; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        ${buttonText}
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                <p><strong>This link will expire in 1 hour.</strong></p>
                ${isFirstTimeSetup 
                    ? '<p>After setting your password, you can log in to the system.</p>' 
                    : '<p>If you didn\'t request this, please ignore this email.</p>'}
                <hr style="border: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    This is an automated email, please do not reply.
                </p>
            </div>
        `
    };

    try {
        await sgMail.send(msg);
        console.log('✅ Email sent via SendGrid');
        return { message: isFirstTimeSetup ? "Password setup link sent to email" : "Password reset link sent to email" };
    } catch (error) {
        console.error('❌ SendGrid error:', error.response?.body || error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

export const forgotPassword = async (email) => {
    console.log('🔍 Forgot password request for:', email);

    const user = await UserModel.findOne({ email });
    
    if (!user) {
        console.log('❌ User not found:', email);
        throw new Error("User with this email does not exist.");
    }

    const isFirstTimeSetup = user.role === 'instructor' && (!user.password || user.password === '');
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    try {
        await PasswordResetModel.create({
            userId: user._id,
            token: hashedToken
        });
        console.log('✅ Token saved to database');
    } catch (error) {
        console.error('❌ Error saving token:', error);
        throw new Error("Database error. Please try again.");
    }

    const resetUrl = `https://atss-frontend.onrender.com/reset-password/${resetToken}`;
    
    try {
        return await sendPasswordResetEmail(email, resetUrl, user, isFirstTimeSetup);
    } catch (error) {
        // Clean up token if email fails
        await PasswordResetModel.deleteOne({ token: hashedToken });
        throw error;
    }
};

export const resetPassword = async (token, newPassword) => {
    console.log('🔄 Reset password request received');

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find the reset token in database
    const resetRecord = await PasswordResetModel.findOne({ token: hashedToken });
    
    if (!resetRecord) {
        console.log('❌ Invalid or expired token');
        throw new Error("Invalid or expired reset token.");
    }

    console.log('✅ Valid token found');

    // Find user
    const user = await UserModel.findById(resetRecord.userId);
    
    if (!user) {
        console.log('❌ User not found');
        throw new Error("User not found.");
    }

    console.log('✅ User found:', user.email);

    // Check if this is first-time password setup for instructor
    const isFirstTimeSetup = user.role === 'instructor' && (!user.password || user.password === '');
    if (isFirstTimeSetup) {
        console.log('ℹ️ First-time password setup for instructor:', user.email);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user password
    user.password = hashedPassword;
    
    // Update status to verified after setting password
    if (isFirstTimeSetup || user.status === 'unverified') {
        user.status = 'verified';
        console.log('ℹ️ Status updated to verified after password setup');
    }
    
    await user.save();

    console.log('✅ Password updated successfully');

    // Delete the used token
    await PasswordResetModel.deleteOne({ _id: resetRecord._id });

    console.log('✅ Token deleted');

    return { 
        message: isFirstTimeSetup ? "Password set successfully! You can now log in." : "Password reset successful" 
    };
};