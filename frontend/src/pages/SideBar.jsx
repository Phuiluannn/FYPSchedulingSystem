import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  CSidebar,
  CSidebarNav,
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
} from '@coreui/icons';
import NotificationDropdown from './NotificationDropdown'; // Import the new component
import '../index.css';
import { BsPersonVcard } from "react-icons/bs";

const SideBar = ({ children, role = "admin", feedbackBadge }) => {
  const location = useLocation();
  const [username, setUsername] = useState(localStorage.getItem('name') || 'User');

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'name') {
        setUsername(event.newValue || 'User');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div className="d-flex flex-column" style={{ minHeight: '100vh' }}>
      {/* Top Navigation Bar */}
      <div
        className="d-flex justify-content-end align-items-center px-5 py-2 shadow-sm"
        style={{
          background: '#fff',
          minHeight: '70px',
          zIndex: 100,
          position: 'fixed',
          top: 0,
          left: '0px',
          right: 0,
          width: 'auto',
        }}
      >
        <div className="d-flex align-items-center gap-4">
          {/* Replace the simple notification icon with NotificationDropdown */}
          <NotificationDropdown />
          
          {/* Profile Info */}
          <div className="d-flex align-items-center">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`}
              alt="Profile"
              className="rounded-circle me-2"
              style={{ width: '36px', height: '36px' }}
            />
            <span className="fw-semibold" style={{ color: '#015551' }}>{username}</span>
          </div>
        </div>
      </div>
      {/* Main Content with Sidebar */}
      <div className="d-flex flex-grow-1" style={{ minHeight: 0 }}>
        <div style={{ width: '70px' }}>
          <SidebarUnfoldableExample currentPath={location.pathname} role={role} feedbackBadge={feedbackBadge} />
        </div>
        <div className="flex-grow-1 p-4" style={{ marginLeft: '0', background: '#f8f9fa', marginTop: '70px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const SidebarUnfoldableExample = ({ currentPath, role, feedbackBadge }) => {
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
    <CSidebar className="border-end" unfoldable style={{ backgroundColor: '#015551' }}>
      <CSidebarNav className="mt-5">
        <hr className="mx-3" />
        <div className="flex-grow-1">
          {navItems.map((item) => {
            const IconComp = item.icon;
            return (
              <CNavItem
                key={item.href}
                href={item.href}
                className={`text-white custom-nav-item ${currentPath === item.href ? 'active' : ''}`}
              >
                {typeof IconComp === 'function'
                  ? <IconComp className="nav-icon text-white" />
                  : <CIcon customClassName="nav-icon text-white" icon={IconComp} />
                } {item.label}
                {item.badge && <CBadge color="primary ms-auto">{item.badge}</CBadge>}
              </CNavItem>
            );
          })}
        </div>
        <div className="mb-3">
          <CNavItem
            href="/login"
            className={`text-white custom-nav-item ${currentPath === '/login' ? 'active' : ''}`}
          >
            <CIcon customClassName="nav-icon text-white" icon={cilAccountLogout} /> Logout
          </CNavItem>
        </div>
      </CSidebarNav>
    </CSidebar>
  );
};

export default SideBar;