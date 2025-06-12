import { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import SignUp from './pages/SignUp';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import LogIn from './pages/LogIn';
import Home from './pages/Home';
import ForgotPassword from './pages/ForgotPassword';
import Courses from './pages/Courses';
import Instructors from './pages/Instructors';
import Rooms from './pages/Rooms';
import UserHome from './pages/UserHome';
import UserFeedback from './pages/UserFeedback';
import ProtectedRoute from './pages/ProtectedRoute';
import AdminFeedback from './pages/AdminFeedback';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Admin-only routes */}
        <Route path="/courses" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Courses />
          </ProtectedRoute>
        }/>
        <Route path="/instructors" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Instructors />
          </ProtectedRoute>
        }/>
        <Route path="/rooms" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Rooms />
          </ProtectedRoute>
        }/>
        <Route path="/feedback" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminFeedback />
          </ProtectedRoute>
        }/>

        {/* Instructor route example (if needed)
        <Route path="/instructor/home" element={
          <ProtectedRoute allowedRoles={['instructor']}>
            <InstructorHome />
          </ProtectedRoute>
        }/> */}

        {/* Student & Instructor - only routes */}
        <Route path="/user/home" element={
          <ProtectedRoute allowedRoles={['student', 'instructor']}>
            <UserHome />
          </ProtectedRoute>
        }/>
        <Route path="/user/feedback" element={
          <ProtectedRoute allowedRoles={['student', 'instructor']}>
            <UserFeedback />
          </ProtectedRoute>
        }/>

        {/* Home accessible by admin */}
        <Route path="/home" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Home />
          </ProtectedRoute>
        }/>
      </Routes>

    </BrowserRouter>
  )
}

export default App;