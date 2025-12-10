import UserModel from '../models/User.js';
import PasswordResetModel from '../models/PasswordReset.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Debug: Log environment variables (remove in production)
console.log('=== EMAIL CONFIGURATION DEBUG ===');
console.log('EMAIL_USER:', process.env.EMAIL_USER || '❌ NOT SET');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ SET (length: ' + process.env.EMAIL_PASSWORD.length + ')' : '❌ NOT SET');
console.log('================================');

const createTransporter = () => {
    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.error('❌ EMAIL_USER or EMAIL_PASSWORD not set in .env file');
        console.error('Current EMAIL_USER:', process.env.EMAIL_USER);
        console.error('Current EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);
        return null;
    }

    // Trim any whitespace from credentials
    const emailUser = process.env.EMAIL_USER.trim();
    const emailPassword = process.env.EMAIL_PASSWORD.trim();

    console.log('📧 Creating transporter with user:', emailUser);

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: emailUser,
                pass: emailPassword
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        return transporter;
    } catch (error) {
        console.error('❌ Error creating email transporter:', error);
        return null;
    }
};

export const forgotPassword = async (email) => {
    console.log('🔍 Forgot password request for:', email);

    // Find user by email
    const user = await UserModel.findOne({ email });
    
    if (!user) {
        console.log('❌ User not found:', email);
        throw new Error("User with this email does not exist.");
    }

    console.log('✅ User found:', user.name);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log('🔑 Generated reset token');
    
    // Hash the token before storing
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Save token to database
    try {
        await PasswordResetModel.create({
            userId: user._id,
            token: hashedToken
        });
        console.log('✅ Token saved to database');
    } catch (error) {
        console.error('❌ Error saving token to database:', error);
        throw new Error("Database error. Please try again.");
    }

    // Create transporter
    const transporter = createTransporter();
    
    if (!transporter) {
        // Clean up the token if email is not configured
        await PasswordResetModel.deleteOne({ token: hashedToken });
        throw new Error("Email service is not configured. Please check EMAIL_USER and EMAIL_PASSWORD in .env file.");
    }

    // Verify transporter connection before sending
    try {
        await transporter.verify();
        console.log('✅ Email transporter verified');
    } catch (error) {
        await PasswordResetModel.deleteOne({ token: hashedToken });
        console.error('❌ Transporter verification failed:', error);
        throw new Error("Email authentication failed. Please check your email credentials.");
    }

    // Create reset URL
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
    
    // Email content
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #015551;">Password Reset Request</h2>
                <p>Hello ${user.name},</p>
                <p>You requested to reset your password. Click the button below to reset it:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background-color: #015551; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this, please ignore this email.</p>
                <hr style="border: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    This is an automated email, please do not reply.
                </p>
            </div>
        `
    };

    // Send email with detailed error logging
    try {
        console.log('📨 Attempting to send email to:', email);
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return { message: "Password reset link sent to email" };
    } catch (error) {
        // If email fails, delete the token
        await PasswordResetModel.deleteOne({ token: hashedToken });
        console.error('❌ Email sending failed:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Provide more specific error messages
        if (error.code === 'EAUTH') {
            throw new Error("Email authentication failed. Please check your email credentials.");
        } else if (error.code === 'ESOCKET') {
            throw new Error("Network error. Please check your internet connection.");
        } else if (error.code === 'ECONNECTION') {
            throw new Error("Could not connect to email server. Please try again later.");
        } else {
            throw new Error(`Failed to send email: ${error.message}`);
        }
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

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user password
    user.password = hashedPassword;
    await user.save();

    console.log('✅ Password updated successfully');

    // Delete the used token
    await PasswordResetModel.deleteOne({ _id: resetRecord._id });

    console.log('✅ Token deleted');

    return { message: "Password reset successful" };
};