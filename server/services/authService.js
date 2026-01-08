import UserModel from '../models/User.js';
import FeedbackModel from '../models/Feedback.js';
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import crypto from 'crypto';  // 🔥 Added for generating random placeholder password

const SECRET_KEY = process.env.SECRET_KEY;

export const signup = async ({ name, email, password, role }) => {
    // Check if all fields are provided
    if (!name || !email || !password || !role) {
        throw new Error("All fields are required: name, email, password, and role.");
    }

    // 🔥 PREVENT INSTRUCTOR SIGNUP - Instructors are auto-created by admin
    if (role === 'instructor') {
        throw new Error("Instructors cannot sign up directly. Your account will be created by an administrator. Please use 'Forgot Password' to set your password if your account already exists.");
    }

    // Validate email domain and role match (only for students in public signup)
    if (email.endsWith('@siswa.um.edu.my') && role !== 'student') {
        throw new Error("Emails ending with @siswa.um.edu.my can only be registered as a student.");
    }

    // Check if the email already exists
    const existingUser = await UserModel.findOne({ email: email });
    if (existingUser) {
        throw new Error("This email is already registered.");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine the status based on the role
    const status = role === "student" ? "verified" : "unverified";

    // Create the user with the hashed password
    const newUser = await UserModel.create({
        name,
        email,
        password: hashedPassword,
        role,
        status,
    });

    return newUser;
};

// 🔥 NEW FUNCTION - Create instructor account (bypasses email domain validation)
export const createInstructorAccount = async ({ name, email }) => {
    // Check if user account already exists
    const existingUser = await UserModel.findOne({ email });
    
    if (existingUser) {
        console.log(`ℹ️ User account already exists for: ${email}`);
        return existingUser;
    }

    // 🔥 Create a placeholder password that cannot be used for login
    // This is a random hash that the user will never know
    const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    // Create user account with placeholder password (will be set via password reset)
    const newUser = await UserModel.create({
        name,
        email,
        password: placeholderPassword, // Placeholder - must be reset before login
        role: 'instructor',
        status: 'unverified' // Keep as unverified until they set password
    });

    console.log(`✅ Auto-created user account for instructor: ${email}`);
    return newUser;
};

export const login = async ({ email, password, role }) => {
    const user = await UserModel.findOne({ email: email });

    if (!user) {
        throw new Error("User not found");
    }

    // Try to validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error("The password is incorrect");
    }

    if (user.role !== role) {
        throw new Error("Role mismatch");
    }

    // 🔥 CHECK IF INSTRUCTOR ACCOUNT IS INACTIVE
    if (user.role === 'instructor' && user.status === 'inactive') {
        throw new Error("Your account has been deactivated. Please contact an administrator.");
    }

    const SECRET_KEY = process.env.SECRET_KEY;
    if (!SECRET_KEY) {
        throw new Error("SECRET_KEY is not defined in environment variables");
    }

    let unresolvedFeedbackCount = 0;
    if (user.role === "admin") {
        unresolvedFeedbackCount = await FeedbackModel.countDocuments({ status: { $in: ["Pending", "In Progress"] } });
        console.log("Unresolved feedback count:", unresolvedFeedbackCount);
    }

    // 🔥 UPDATED: Include createdAt in JWT token for notification filtering
    const token = jwt.sign({ 
        id: user._id, 
        role: user.role,
        createdAt: user.createdAt // 🔥 ADD THIS - Essential for filtering notifications by user registration date
    }, SECRET_KEY, { expiresIn: '1h' });
    
    // 🔥 UPDATE STATUS TO VERIFIED on login if still unverified (just in case)
    if (user.status === 'unverified') {
        user.status = 'verified';
        await user.save();
        console.log(`✅ Verified account on login: ${user.email}`);
    }
    
    return { 
        token, 
        name: user.name, 
        role: user.role, 
        userId: user._id.toString(),
        unresolvedFeedbackCount 
    };
};