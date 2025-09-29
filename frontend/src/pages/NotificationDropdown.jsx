import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Add this import
import { io } from 'socket.io-client';
import axios from 'axios';
import CIcon from '@coreui/icons-react';
import { cilBell } from '@coreui/icons';

const socket = io('http://localhost:3001', {
  autoConnect: false,
  transports: ['websocket']
});

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate(); // Initialize navigate

  // Map notification types to routes (only 2 types for now)
  const getNotificationRoute = (notification) => {
    switch (notification.type) {
      case 'timetable_published':
        // Navigate to user home page with year and semester query params
        return `/user/home?year=${notification.academicYear}&semester=${notification.semester}`;
      
      case 'feedback':
        // Navigate to feedback page (not detail, just feedback list)
        return `/user/feedback`;
      
      default:
        // Fallback to user home for any other type
        return `/user/home`;
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read first
      if (!notification.isRead) {
        await markAsRead(notification._id);
      }

      // Close dropdown
      setIsOpen(false);

      // Navigate to relevant page
      const route = getNotificationRoute(notification);
      navigate(route);
      
      console.log(`✅ Navigated to: ${route}`);
    } catch (error) {
      console.error('❌ Error handling notification click:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const userId = localStorage.getItem('userId');
    if (token && userId && role) {
      socket.connect();
      socket.emit('identify', { userId, role });
    }

    socket.on('notification', (data) => {
      if (data.recipients.includes(role)) {
        setNotifications(prev => [data.notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Optional: Show browser notification
        showBrowserNotification(data.notification);
      }
    });

    return () => {
      socket.disconnect();
      socket.off('notification');
    };
  }, []);

  // Optional: Browser notification for real-time alerts
  const showBrowserNotification = (notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/notification-icon.png', // Add your icon path
        tag: notification._id,
      });
    }
  };

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const decodeToken = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const decoded = JSON.parse(jsonPayload);
      return decoded.id || decoded.userId || decoded.sub;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  const getUserCredentials = () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    let userId = localStorage.getItem('userId') || 
                 localStorage.getItem('id') || 
                 localStorage.getItem('user_id');
    
    if (!userId && token) {
      userId = decodeToken(token);
      if (userId) {
        localStorage.setItem('userId', userId);
      }
    }
    
    return { token, userId, role };
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { token, userId, role } = getUserCredentials();

      if (!token || !userId || !role) {
        throw new Error(`Missing credentials: token=${!!token}, userId=${!!userId}, role=${!!role}`);
      }

      const response = await axios.get('http://localhost:3001/api/notifications', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-user-id': userId,
          'x-user-role': role
        }
      });
      
      if (response.data && Array.isArray(response.data.notifications)) {
        setNotifications(response.data.notifications);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      setError(error.response?.data?.error || error.message || 'Failed to fetch notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { token, userId, role } = getUserCredentials();

      if (!token || !userId || !role) {
        return;
      }

      const response = await axios.get('http://localhost:3001/api/notifications/unread-count', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-user-id': userId,
          'x-user-role': role
        }
      });
      
      if (response.data && typeof response.data.unreadCount === 'number') {
        setUnreadCount(response.data.unreadCount);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { token, userId } = getUserCredentials();

      if (!token || !userId) {
        return;
      }

      await axios.patch(`http://localhost:3001/api/notifications/${notificationId}/read`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-user-id': userId
        }
      });

      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffTime / (1000 * 60));

      if (diffDays > 0) return `${diffDays}d ago`;
      if (diffHours > 0) return `${diffHours}h ago`;
      if (diffMinutes > 0) return `${diffMinutes}m ago`;
      return 'Just now';
    } catch (error) {
      return 'Unknown time';
    }
  };

  const handleToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Get icon for notification type (only 2 types)
  const getNotificationIcon = (type) => {
    const iconMap = {
      timetable_published: '📅',
      feedback: '💬'
    };
    return iconMap[type] || '🔔';
  };

  return (
    <>
      <style jsx>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .notification-dropdown {
          animation: fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .bell-button {
          transition: all 0.2s ease;
          border-radius: 12px !important;
        }

        .bell-button:hover {
          background-color: rgba(1, 85, 81, 0.08) !important;
          transform: translateY(-1px);
        }

        .unread-badge {
          animation: pulse 2s infinite;
          box-shadow: 0 0 0 2px white, 0 2px 8px rgba(239, 68, 68, 0.3);
        }

        .notification-item {
          transition: all 0.2s ease;
          border-left: 3px solid transparent;
        }

        .notification-item:hover {
          background-color: rgba(1, 85, 81, 0.05) !important;
          transform: translateX(2px);
          border-left-color: rgba(1, 85, 81, 0.5);
        }

        .notification-item.unread {
          background-color: rgba(1, 85, 81, 0.03);
          border-left-color: #015551;
        }

        .loading-spinner {
          border-top-color: #015551;
        }

        .notification-icon {
          font-size: 20px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(1, 85, 81, 0.08);
          border-radius: 10px;
          flex-shrink: 0;
        }
      `}</style>

      <div className="position-relative" ref={dropdownRef}>
        <button
          className="btn p-1 border-0 bg-transparent position-relative bell-button"
          onClick={handleToggleClick}
          style={{ color: '#015551' }}
        >
          <CIcon icon={cilBell} height={25} width={25} />
          {unreadCount > 0 && (
            <span 
              className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger unread-badge"
              style={{ 
                fontSize: '10px', 
                minWidth: '20px', 
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700'
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div
            className="position-absolute top-100 end-0 bg-white border-0 rounded-3 shadow-lg notification-dropdown"
            style={{ 
              width: '400px', 
              maxHeight: '500px', 
              overflowY: 'auto',
              zIndex: 1050,
              marginTop: '6px',
              boxShadow: '0 20px 40px -4px rgba(0, 0, 0, 0.1), 0 8px 16px -4px rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.05)'
            }}
          >
            <div 
              className="px-4 py-4 border-bottom"
              style={{ 
                background: 'linear-gradient(135deg, #015551 0%, #0d7377 100%)',
                borderTopLeftRadius: '1rem',
                borderTopRightRadius: '1rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
              }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-white" style={{ fontSize: '16px' }}>
                  Notifications
                </h6>
                {unreadCount > 0 && (
                  <span className="badge bg-white text-dark" style={{ fontSize: '12px' }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
            </div>
            
            {error ? (
              <div className="text-center py-5 px-4">
                <div className="mb-3" style={{ fontSize: '3rem', opacity: '0.3' }}>⚠️</div>
                <div className="fw-semibold text-danger mb-2">Unable to load notifications</div>
                <div className="small text-muted mb-3">{error}</div>
                <button 
                  className="btn btn-outline-primary btn-sm rounded-pill px-4"
                  onClick={fetchNotifications}
                  style={{ borderColor: '#015551', color: '#015551' }}
                >
                  Try Again
                </button>
              </div>
            ) : loading ? (
              <div className="text-center py-5">
                <div className="spinner-border loading-spinner mb-3" role="status" style={{ width: '2rem', height: '2rem', borderWidth: '3px' }}>
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="text-muted">Loading notifications...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-5 px-4">
                <div className="mb-3" style={{ fontSize: '4rem', opacity: '0.2' }}>
                  <CIcon icon={cilBell} height={64} width={64} />
                </div>
                <div className="fw-semibold mb-2" style={{ color: '#6b7280' }}>All caught up!</div>
                <div className="small text-muted">No new notifications to show</div>
              </div>
            ) : (
              notifications.map((notification, index) => (
                <div
                  key={notification._id}
                  className={`notification-item px-4 py-3 ${!notification.isRead ? 'unread' : ''}`}
                  style={{ 
                    cursor: 'pointer',
                    borderBottom: index === notifications.length - 1 ? 'none' : '1px solid rgba(0, 0, 0, 0.05)'
                  }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="d-flex align-items-start gap-3">
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div 
                          className="fw-bold" 
                          style={{ 
                            fontSize: '15px',
                            color: notification.isRead ? '#6b7280' : '#1f2937',
                            lineHeight: '1.3'
                          }}
                        >
                          {notification.title || 'Notification'}
                        </div>
                        {!notification.isRead && (
                          <div 
                            className="bg-primary rounded-circle ms-2"
                            style={{ width: '8px', height: '8px', marginTop: '6px' }}
                          />
                        )}
                      </div>
                      <div 
                        className="text-muted mb-2" 
                        style={{ 
                          fontSize: '13px',
                          lineHeight: '1.4',
                          opacity: notification.isRead ? '0.7' : '0.9'
                        }}
                      >
                        {notification.message || 'No message'}
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <div 
                          className="small text-muted"
                          style={{ fontSize: '12px' }}
                        >
                          {formatDate(notification.createdAt)}
                        </div>
                        {!notification.isRead && (
                          <span 
                            className="badge bg-primary rounded-pill"
                            style={{ 
                              fontSize: '10px',
                              padding: '4px 8px'
                            }}
                          >
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationDropdown;