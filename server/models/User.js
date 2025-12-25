import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, required: true },
}, { 
    timestamps: true // 🔥 ADD THIS - Automatically creates createdAt and updatedAt fields
});

export default mongoose.model('User', UserSchema);