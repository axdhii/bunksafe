import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';

import { Navbar } from './components/common/Navbar';
import { FloatingDock } from './components/common/FloatingDock';
import { InstallPromptModal } from './components/common/InstallPromptModal';
import { OfflineBanner } from './components/common/OfflineBanner';

// Loading Spinner for Route Chunk Suspense
const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
    <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase">Loading BunkSafe...</span>
  </div>
);

// Auth Pages (Lazy-Loaded)
const StudentLoginPage = React.lazy(() => import('./pages/auth/StudentLoginPage').then((m) => ({ default: m.StudentLoginPage })));
const StudentRegisterPage = React.lazy(() => import('./pages/auth/StudentRegisterPage').then((m) => ({ default: m.StudentRegisterPage })));
const AdminLoginPage = React.lazy(() => import('./pages/auth/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));

// Student Pages (Lazy-Loaded)
const StudentDashboard = React.lazy(() => import('./pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const StudentTimetable = React.lazy(() => import('./pages/student/StudentTimetable').then((m) => ({ default: m.StudentTimetable })));
const StudentSubjects = React.lazy(() => import('./pages/student/StudentSubjects').then((m) => ({ default: m.StudentSubjects })));
const StudentHistory = React.lazy(() => import('./pages/student/StudentHistory').then((m) => ({ default: m.StudentHistory })));
const StudentAnalytics = React.lazy(() => import('./pages/student/StudentAnalytics').then((m) => ({ default: m.StudentAnalytics })));
const StudentNotifications = React.lazy(() => import('./pages/student/StudentNotifications').then((m) => ({ default: m.StudentNotifications })));
const StudentSettings = React.lazy(() => import('./pages/student/StudentSettings').then((m) => ({ default: m.StudentSettings })));

// Admin Pages (Lazy-Loaded: Separated from student bundle)
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminAcademicStructure = React.lazy(() => import('./pages/admin/AdminAcademicStructure').then((m) => ({ default: m.AdminAcademicStructure })));
const AdminStudents = React.lazy(() => import('./pages/admin/AdminStudents').then((m) => ({ default: m.AdminStudents })));
const AdminSubjects = React.lazy(() => import('./pages/admin/AdminSubjects').then((m) => ({ default: m.AdminSubjects })));
const AdminTimetable = React.lazy(() => import('./pages/admin/AdminTimetable').then((m) => ({ default: m.AdminTimetable })));
const AdminNotifications = React.lazy(() => import('./pages/admin/AdminNotifications').then((m) => ({ default: m.AdminNotifications })));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })));

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
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
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
        <React.Suspense fallback={<PageLoader />}>
          <Outlet />
        </React.Suspense>
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
            <Route
              path="/login"
              element={
                <React.Suspense fallback={<PageLoader />}>
                  <StudentLoginPage />
                </React.Suspense>
              }
            />
            <Route
              path="/register"
              element={
                <React.Suspense fallback={<PageLoader />}>
                  <StudentRegisterPage />
                </React.Suspense>
              }
            />
            <Route
              path="/admin/login"
              element={
                <React.Suspense fallback={<PageLoader />}>
                  <AdminLoginPage />
                </React.Suspense>
              }
            />

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
