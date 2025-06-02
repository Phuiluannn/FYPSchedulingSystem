import SideBar from './SideBar';
import ProtectedRoute from './ProtectedRoute';

function StudentHome() {

    return (
        <ProtectedRoute>
            <SideBar role="student">
                <h1>Welcome to the Student Home Page</h1>
                <p>This is a protected route.</p>
            </SideBar>
        </ProtectedRoute>
    );

}

export default StudentHome;