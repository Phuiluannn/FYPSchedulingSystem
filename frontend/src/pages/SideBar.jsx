import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  CNavItem,
  CBadge,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilBook,
  cilPeople,
  cilChartLine,
  cilCommentSquare,
  cilHome,
  cilBuilding,
  cilAccountLogout,
  cilCalendar,
  cilMenu,
} from '@coreui/icons';
import NotificationDropdown from './NotificationDropdown';
import '../index.css';
import { BsPersonVcard } from "react-icons/bs";

const SideBar = ({ children, role = "admin", feedbackBadge }) => {
  const location = useLocation();
  const [username, setUsername] = useState(localStorage.getItem('name') || 'User');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'name') {
        setUsername(event.newValue || 'User');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
  };

  // Define sidebar items for each role
  let navItems = [];
  if (role === "admin") {
    navItems = [
      { href: "/home", icon: cilHome, label: "Home" },
      { href: "/students", icon: cilPeople, label: "Students" },
      { href: "/courses", icon: cilBook, label: "Courses" },
      { href: "/instructors", icon: BsPersonVcard, label: "Instructors" },
      { href: "/rooms", icon: cilBuilding, label: "Rooms" },
      { href: "/analytics", icon: cilChartLine, label: "Analytics" },
      { href: "/feedback", icon: cilCommentSquare, label: "Feedback", badge: localStorage.getItem('feedbackBadge') || feedbackBadge || 0 },
    ];
  } else if (role === "student") {
    navItems = [
      { href: "/user/home", icon: cilHome, label: "Home" },
      { href: "/user/feedback", icon: cilCommentSquare, label: "Feedback"},
    ];
  } else if (role === "instructor") {
    navItems = [
      { href: "/user/home", icon: cilHome, label: "Home" },
      { href: "/instructor/my-timetable", icon: cilCalendar, label: "My Timetable" },
      { href: "/user/feedback", icon: cilCommentSquare, label: "Feedback"},
    ];
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <div
        style={{
          background: '#fff',
          minHeight: '70px',
          zIndex: 1000,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        {/* Hamburger Menu - Now visible on desktop too */}
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            color: '#015551',
            cursor: 'pointer',
            padding: '0.5rem',
          }}
          title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <CIcon icon={cilMenu} size="lg" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
          <NotificationDropdown />
          
          {/* Profile Info */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`}
              alt="Profile"
              className="rounded-circle"
              style={{ width: '36px', height: '36px', marginRight: '0.5rem' }}
            />
            <span className="fw-semibold username-text" style={{ color: '#015551' }}>
              {username}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', marginTop: '70px', flex: 1 }}>
        {/* Sidebar - Always collapsed by default, expands on click */}
        <div
          className={`sidebar-container ${sidebarExpanded ? 'expanded' : ''}`}
          style={{
            width: sidebarExpanded ? '256px' : '70px',
            backgroundColor: '#015551',
            position: 'fixed',
            top: '70px',
            bottom: 0,
            left: 0,
            zIndex: 999,
            overflowY: 'auto',
            overflowX: 'hidden',
            transition: 'width 0.3s ease-in-out',
            borderRight: '1px solid #dee2e6',
          }}
        >
          {/* Sidebar Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem 0' }}>
            <hr style={{ margin: '0 1rem 1rem', borderColor: 'rgba(255,255,255,0.2)' }} />
            
            <div style={{ flex: 1 }}>
              {navItems.map((item) => {
                const IconComp = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: sidebarExpanded ? '0.75rem 1.5rem' : '0.75rem 1rem',
                      color: '#fff',
                      textDecoration: 'none',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                      transition: 'background-color 0.2s',
                      whiteSpace: 'nowrap',
                      justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                    }}
                    className="nav-item-link"
                    title={!sidebarExpanded ? item.label : ''}
                  >
                    {typeof IconComp === 'function' ? (
                      <IconComp style={{ marginRight: sidebarExpanded ? '0.75rem' : '0', fontSize: '1.25rem', minWidth: '1.25rem' }} />
                    ) : (
                      <CIcon icon={IconComp} style={{ marginRight: sidebarExpanded ? '0.75rem' : '0', minWidth: '1.25rem' }} size="lg" />
                    )}
                    {sidebarExpanded && (
                      <>
                        <span>{item.label}</span>
                        {item.badge && (
                          <CBadge color="primary" style={{ marginLeft: 'auto' }}>
                            {item.badge}
                          </CBadge>
                        )}
                      </>
                    )}
                  </a>
                );
              })}
            </div>

            {/* Logout */}
            <div style={{ padding: '1rem 0' }}>
              <a
                href="/login"
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: sidebarExpanded ? '0.75rem 1.5rem' : '0.75rem 1rem',
                  color: '#fff',
                  textDecoration: 'none',
                  transition: 'background-color 0.2s',
                  whiteSpace: 'nowrap',
                  justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                }}
                className="nav-item-link"
                title={!sidebarExpanded ? 'Logout' : ''}
              >
                <CIcon icon={cilAccountLogout} style={{ marginRight: sidebarExpanded ? '0.75rem' : '0', minWidth: '1.25rem' }} size="lg" />
                {sidebarExpanded && <span>Logout</span>}
              </a>
            </div>
          </div>
        </div>

        {/* Overlay for when sidebar is expanded */}
        {sidebarExpanded && (
          <div
            onClick={() => setSidebarExpanded(false)}
            style={{
              position: 'fixed',
              top: '70px',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 998,
            }}
            className="sidebar-overlay"
          />
        )}

        {/* Main Content */}
        <div
          className="main-content"
          style={{
            flex: 1,
            marginLeft: '70px',
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            minHeight: 'calc(100vh - 70px)',
            transition: 'margin-left 0.3s ease-in-out',
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 576px) {
          .username-text {
            display: none;
          }
        }

        .nav-item-link:hover {
          background-color: rgba(255,255,255,0.15) !important;
        }
      `}</style>
    </div>
  );
};

export default SideBar;