import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';

import { Navbar } from './components/common/Navbar';
import { FloatingDock } from './components/common/FloatingDock';
import { InstallPromptModal } from './components/common/InstallPromptModal';
import { OfflineBanner } from './components/common/OfflineBanner';

// Auth Pages
import { StudentLoginPage } from './pages/auth/StudentLoginPage';
import { StudentRegisterPage } from './pages/auth/StudentRegisterPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentTimetable } from './pages/student/StudentTimetable';
import { StudentSubjects } from './pages/student/StudentSubjects';
import { StudentHistory } from './pages/student/StudentHistory';
import { StudentAnalytics } from './pages/student/StudentAnalytics';
import { StudentNotifications } from './pages/student/StudentNotifications';
import { StudentSettings } from './pages/student/StudentSettings';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminAcademicStructure } from './pages/admin/AdminAcademicStructure';
import { AdminStudents } from './pages/admin/AdminStudents';
import { AdminSubjects } from './pages/admin/AdminSubjects';
import { AdminTimetable } from './pages/admin/AdminTimetable';
import { AdminNotifications } from './pages/admin/AdminNotifications';
import { AdminSettings } from './pages/admin/AdminSettings';

const StudentLayout: React.FC = () => {
  const { user, student, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user || user.role !== 'STUDENT') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-zinc-100 transition-colors">
      <OfflineBanner />
      <Navbar />
      <main className="flex-1 pb-20 md:pb-24">
        <Outlet />
      </main>
      <FloatingDock />
      <InstallPromptModal />
    </div>
  );
};

const AdminLayout: React.FC = () => {
  const { user, admin, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-zinc-100 transition-colors">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<StudentLoginPage />} />
            <Route path="/register" element={<StudentRegisterPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Student Protected Routes */}
            <Route path="/" element={<StudentLayout />}>
              <Route index element={<StudentDashboard />} />
              <Route path="timetable" element={<StudentTimetable />} />
              <Route path="subjects" element={<StudentSubjects />} />
              <Route path="history" element={<StudentHistory />} />
              <Route path="analytics" element={<StudentAnalytics />} />
              <Route path="notifications" element={<StudentNotifications />} />
              <Route path="settings" element={<StudentSettings />} />
            </Route>

            {/* Admin Protected Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="structure" element={<AdminAcademicStructure />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="subjects" element={<AdminSubjects />} />
              <Route path="timetable" element={<AdminTimetable />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
