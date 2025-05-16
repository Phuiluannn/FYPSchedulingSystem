import express from 'express';
import { signup, login, protectedRoute } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected route
router.get('/protected', authenticateToken, protectedRoute);

export default router;