import mongoose from "mongoose";

const InstructorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
});

export default mongoose.model('Instructor', InstructorSchema);