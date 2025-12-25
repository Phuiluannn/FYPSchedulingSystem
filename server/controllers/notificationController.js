import * as notificationService from "../services/notificationService.js";

export const getUserNotifications = async (req, res) => {
  try {
    const userRole = req.user?.role || req.headers['x-user-role'];
    const userId = req.user?.id || req.headers['x-user-id'];
    const userCreatedAt = req.user?.createdAt; // Get user's creation date from auth token
    const limit = parseInt(req.query.limit) || 20;

    if (!userRole || !userId) {
      return res.status(400).json({ error: "User role and ID required" });
    }

    const notifications = await notificationService.getUserNotifications(
      userRole, 
      userId, 
      limit, 
      userCreatedAt
    );
    res.json({ notifications });
  } catch (error) {
    console.error("Error in getUserNotifications:", error);
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const notification = await notificationService.markNotificationAsRead(notificationId, userId);
    res.json({ success: true, notification });
  } catch (error) {
    console.error("Error in markAsRead:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userRole = req.user?.role || req.headers['x-user-role'];
    const userId = req.user?.id || req.headers['x-user-id'];
    const userCreatedAt = req.user?.createdAt; // Get user's creation date from auth token

    if (!userRole || !userId) {
      return res.status(400).json({ error: "User role and ID required" });
    }

    const count = await notificationService.getUnreadNotificationCount(
      userRole, 
      userId, 
      userCreatedAt
    );
    res.json({ unreadCount: count });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    res.status(500).json({ error: error.message });
  }
};