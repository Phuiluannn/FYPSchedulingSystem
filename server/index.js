import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import roomRoutes from './routes/roomRoutes.js'; 
import courseRoutes from './routes/courseRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import homeRoutes from './routes/homeRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') }); // Explicit path to .env

console.log("MONGODB_URL from env:", process.env.MONGODB_URL); // Debug log

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
connectDB();

// Routes
app.use('/', authRoutes);
app.use('/instructors', instructorRoutes);
app.use('/rooms', roomRoutes);
app.use('/courses', courseRoutes);
app.use('/user/feedback', feedbackRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/home', homeRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/api', notificationRoutes);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5173", // your frontend origin
    methods: ["GET", "POST"]
  }
});

// Store connected users (optional)
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔔 User connected:', socket.id);

  socket.on('identify', ({ userId, role }) => {
    connectedUsers.set(socket.id, { userId, role });
    console.log(`User identified: ${userId} (${role})`);
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

// Export io for use in notificationService.js
export { io };

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});