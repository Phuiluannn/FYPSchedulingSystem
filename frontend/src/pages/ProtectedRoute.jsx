import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const alertedRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token && token !== 'null' ? { 'Authorization': token } : {};

    fetch('https://atss-backend.onrender.com/protected', { headers })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw err; });
        }
        return response.json();
      })
      .then(data => {
        setUserRole(data.user.role);
        setIsAuthenticated(true);
        setIsLoading(false);
      })
      .catch(err => {
        if ((err.message === "Access denied. No token provided." || 
            err.message === "Session expired. Please log in again.") &&
            !alertedRef.current
        ) {
          alertedRef.current = true;
          alert(err.message);
          localStorage.removeItem('token');
          // window.location.href = '/login';
          navigate('/login');
        } else if (!alertedRef.current) {
          alertedRef.current = true;
          alert(err.message);
          setIsLoading(false);
        }
      });
  }, [navigate]);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated || (allowedRoles && !allowedRoles.includes(userRole))) {
    return <div>Unauthorized</div>; // or redirect
  }

  return children;
};


export default ProtectedRoute;