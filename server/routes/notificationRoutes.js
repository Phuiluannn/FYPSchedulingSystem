import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/authenticateToken.js';

const router = express.Router();

router.get('/notifications', authenticateToken, notificationController.getUserNotifications);
router.patch('/notifications/:notificationId/read', authenticateToken, notificationController.markAsRead);
router.get('/notifications/unread-count', authenticateToken, notificationController.getUnreadCount);

export default router;