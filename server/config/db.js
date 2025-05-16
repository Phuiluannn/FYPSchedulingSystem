import mongoose from 'mongoose';

export const connectDB = async () => {
    const MONGODB_URL = process.env.MONGODB_URL; // Move it here
    try {
        if (!MONGODB_URL) {
            throw new Error("MONGODB_URL is not defined in environment variables");
        }
        await mongoose.connect(MONGODB_URL, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1);
    }
};