import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { useLocation } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentManagementPage from './pages/StudentManagementPage';
import FingerprintEnrollmentPage from './pages/FingerprintEnrollmentPage';
import ExamSetupPage from './pages/ExamSetupPage';
import AttendancePage from './pages/AttendancePage';
import MonitoringPage from './pages/MonitoringPage';
import ReportingPage from './pages/ReportingPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import SyncStatusBanner from './SyncStatusBanner';
import { startPeriodicSync, stopPeriodicSync } from './offlineSync';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const isAuthenticated = localStorage.getItem('authToken');
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppContent() {
  // Use location to conditionally render Navbar
  const location = useLocation();
  const isFullScreen = ['/', '/login', '/signup'].includes(location.pathname);
  const isAuthenticated = localStorage.getItem('authToken');

  // Start periodic sync when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      startPeriodicSync();
      return () => stopPeriodicSync();
    }
  }, [isAuthenticated]);

  return (
    <>
      {!isFullScreen && <Navbar />}
      <div style={isFullScreen ? { padding: 0 } : { padding: '2rem', background: '#f7fafd', minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><StudentManagementPage /></ProtectedRoute>} />
          <Route path="/enroll" element={<ProtectedRoute><FingerprintEnrollmentPage /></ProtectedRoute>} />
          <Route path="/exam-setup" element={<ProtectedRoute><ExamSetupPage /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
          <Route path="/monitoring" element={<ProtectedRoute><MonitoringPage /></ProtectedRoute>} />
          <Route path="/reporting" element={<ProtectedRoute><ReportingPage /></ProtectedRoute>} />
        </Routes>
      </div>
      {isAuthenticated && <SyncStatusBanner />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

