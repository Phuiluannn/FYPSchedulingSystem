import UserModel from '../models/User.js';
import FeedbackModel from '../models/Feedback.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY;

export const signup = async ({ name, email, password, role }) => {
    // Check if all fields are provided
    if (!name || !email || !password || !role) {
        throw new Error("All fields are required: name, email, password, and role.");
    }

    // Check if the email ends with 'um.edu.my'
    if (!email.endsWith('um.edu.my')) {
        throw new Error("Only siswamail or ummail are allowed to register.");
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

export const login = async ({ email, password, role }) => {
    const user = await UserModel.findOne({ email: email });

    if (!user) {
        throw new Error("User not found");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error("The password is incorrect");
    }

    if (user.role !== role) {
        throw new Error("Role mismatch");
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

    const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    return { token, name: user.name, unresolvedFeedbackCount };

};