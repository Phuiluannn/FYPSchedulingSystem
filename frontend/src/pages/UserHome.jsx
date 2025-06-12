import SideBar from './SideBar';
import ProtectedRoute from './ProtectedRoute';

function UserHome() {
    const role = localStorage.getItem('role') || 'student'; // get role from localStorage

    return (
        <ProtectedRoute>
            <SideBar role={role}>
                <h1>Welcome to the Home Page</h1>
                <p>This is timetable view.</p>
            </SideBar>
        </ProtectedRoute>
    );
}

export default UserHome;