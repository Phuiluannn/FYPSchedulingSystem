import { useEffect, useRef, useState } from 'react';

function Home() {
    const hasFetched = useRef(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        console.log("Protected API triggered");
        const token = localStorage.getItem('token');
        const headers = token && token !== 'null' ? { 'Authorization': token } : {};

        fetch('http://localhost:3001/protected', { headers })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {
                console.log(data);
                setIsAuthenticated(true);
                setIsLoading(false);
            })
            .catch(err => {
                console.log(err);
                if (err.message === "Access denied. No token provided." || 
                    err.message === "Session expired. Please log in again.") {
                    alert(err.message);
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                } else {
                    alert(err.message);
                    setIsLoading(false);
                }
            });
    }, []);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div>
            <h1>Welcome to the Home Page</h1>
            <p>This is a protected route.</p>
        </div>
    );
}

export default Home;