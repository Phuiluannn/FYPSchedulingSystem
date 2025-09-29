import Notification from '../models/Notification.js';
import { io } from '../index.js';

export const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    const saved = await notification.save();

    // Emit to all relevant users
    if (notificationData.recipients && Array.isArray(notificationData.recipients)) {
      io.emit('notification', {
        recipients: notificationData.recipients,
        notification: saved
      });
    }

    return saved;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

export const createTimetablePublishedNotification = async (year, semester) => {
  const notificationData = {
    title: "Timetable Published",
    message: `The timetable for ${year}, Semester ${semester} has been published and is now available for viewing.`,
    type: "timetable_published",
    recipients: ["student", "instructor"], // Send to both students and instructors
    academicYear: year,
    semester: semester
  };
  
  return await createNotification(notificationData);
};

// New function to create feedback response notifications
export const createFeedbackResponseNotification = async (feedbackId, feedbackTitle, userId, userRole) => {
  const notificationData = {
    title: "Feedback Response Received",
    message: `Your feedback "${feedbackTitle}" has received a response from an administrator.`,
    type: "feedback",
    recipients: [userRole], // Send to the specific user role
    feedbackId: feedbackId,
    feedbackTitle: feedbackTitle,
    // Initialize isRead Map with the specific user set to false
    isRead: new Map([[userId.toString(), false]])
  };
  
  return await createNotification(notificationData);
};

export const getUserNotifications = async (userRole, userId, limit = 20) => {
  try {
    // Get notifications for user role OR specific feedback notifications for this user
    const notifications = await Notification.find({
      $or: [
        { recipients: userRole }, // General notifications for user role
        { 
          type: "feedback",
          [`isRead.${userId}`]: { $exists: true } // Feedback notifications specifically for this user
        }
      ],
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    console.log(`Found ${notifications.length} notifications for role: ${userRole}, userId: ${userId}`);

    // 🔥 FIX: Properly handle isRead Map field
    return notifications.map(notification => {
      let isRead = false;
      
      // Handle different possible formats of isRead field
      if (notification.isRead) {
        if (typeof notification.isRead === 'object') {
          // If it's an object/Map, check for the userId key
          isRead = notification.isRead[userId] || false;
        } else if (typeof notification.isRead.get === 'function') {
          // If it's a proper Map object
          isRead = notification.isRead.get(userId) || false;
        }
      }

      console.log(`Notification ${notification._id}: isRead for user ${userId} = ${isRead}`);

      return {
        ...notification,
        isRead: isRead
      };
    });
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    console.log(`Marking notification ${notificationId} as read for user ${userId}`);
    
    // Use MongoDB's $set operator to update the Map field
    const result = await Notification.findByIdAndUpdate(
      notificationId,
      { 
        $set: { [`isRead.${userId}`]: true }
      },
      { new: true }
    );
    
    console.log('Mark as read result:', result ? 'success' : 'notification not found');
    return result;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

export const getUnreadNotificationCount = async (userRole, userId) => {
  try {
    console.log(`Getting unread count for role: ${userRole}, userId: ${userId}`);
    
    // Get all notifications for this user role OR specific feedback notifications
    const notifications = await Notification.find({
      $or: [
        { recipients: userRole }, // General notifications for user role
        { 
          type: "feedback",
          [`isRead.${userId}`]: { $exists: true } // Feedback notifications specifically for this user
        }
      ],
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).lean();
    
    console.log(`Found ${notifications.length} total notifications for role ${userRole}`);
    
    // Count unread notifications
    let unreadCount = 0;
    notifications.forEach(notification => {
      let isRead = false;
      
      if (notification.isRead) {
        if (typeof notification.isRead === 'object') {
          isRead = notification.isRead[userId] || false;
        } else if (typeof notification.isRead.get === 'function') {
          isRead = notification.isRead.get(userId) || false;
        }
      }
      
      if (!isRead) {
        unreadCount++;
      }
    });
    
    console.log(`Unread count for user ${userId}: ${unreadCount}`);
    return unreadCount;
  } catch (error) {
    console.error("Error getting unread notification count:", error);
    return 0;
  }
};