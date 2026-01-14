import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import passwordRoutes from './routes/passwordRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import roomRoutes from './routes/roomRoutes.js'; 
import courseRoutes from './routes/courseRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import homeRoutes from './routes/homeRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

console.log("MONGODB_URL from env:", process.env.MONGODB_URL);

const PORT = process.env.PORT || 3001;

const app = express();

// ============================================
// CORS Configuration - MUST BE FIRST
// ============================================
const corsOptions = {
    origin: 'http://localhost:5173', // Your frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-user-id', 
        'x-user-role',
        'X-User-Id',
        'X-User-Role'
    ],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/', authRoutes);
app.use('/', passwordRoutes);
app.use('/instructors', instructorRoutes);
app.use('/rooms', roomRoutes);
app.use('/courses', courseRoutes);
app.use('/user/feedback', feedbackRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/home', homeRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/api', notificationRoutes);
app.use('/students', studentRoutes);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('📢 User connected:', socket.id);

  socket.on('identify', ({ userId, role }) => {
    connectedUsers.set(socket.id, { userId, role });
    console.log(`User identified: ${userId} (${role})`);
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

export { io };

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`CORS enabled for: http://localhost:5173`);
});