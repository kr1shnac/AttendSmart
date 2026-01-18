import React, { useState, useEffect, Suspense, lazy } from "react";
import PropTypes from "prop-types";
import "./styles/index.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

// Global Error Boundary - Prevents white screen crashes
import ErrorBoundary from "./components/common/ErrorBoundary";
import LoadingSpinner from "./components/common/LoadingSpinner";
import ToastContainer from "./components/common/ToastContainer";
import Layout from "./components/Layout/Layout";
import { initializeSyncManager, stopSyncManager } from "./services/syncManager";
import "./App.css";

// ============================================
// LAZY LOADED COMPONENTS (Code Splitting)
// Reduces initial bundle size significantly
// ============================================

// Auth (keep Login eager for fast initial load)
import Login from "./components/Auth/Login";

// Student Pages - Lazy Loaded
const StudentHome = lazy(() => import("./components/Student/StudentHome"));
const StudentProfile = lazy(() =>
  import("./components/Student/StudentProfile")
);
const StudentHistory = lazy(() =>
  import("./components/Student/StudentHistory")
);

// Teacher Pages - Lazy Loaded
const TeacherHome = lazy(() => import("./components/Teacher/TeacherHome"));
const TeacherDashboard = lazy(() =>
  import("./components/Teacher/TeacherDashboard")
);
const TeacherSessions = lazy(() =>
  import("./components/Teacher/TeacherSessions")
);
const TeacherAnalytics = lazy(() =>
  import("./components/Teacher/TeacherAnalytics")
);
const ClassAnalytics = lazy(() =>
  import("./components/Teacher/ClassAnalytics")
);
const TeacherProfile = lazy(() =>
  import("./components/Teacher/TeacherProfile")
);
const LiveMonitorPage = lazy(() => import("./pages/LiveMonitorPage"));

// Admin Pages - Lazy Loaded
const AdminDashboard = lazy(() => import("./components/Admin/AdminDashboard"));
const BroadcastPage = lazy(() => import("./components/Admin/BroadcastPage"));
const UserManagement = lazy(() => import("./components/Admin/UserManagement"));
const ClassManagement = lazy(() =>
  import("./components/Admin/ClassManagement")
);
const SubjectManagement = lazy(() =>
  import("./components/Admin/SubjectManagement")
);
const ClassDetailManagement = lazy(() =>
  import("./components/Admin/ClassDetailManagement")
);
const LocationSettings = lazy(() =>
  import("./components/Admin/LocationSettings")
);

// Biometric - Lazy Loaded (MediaPipe Face Detection)
const BiometricEnrollment = lazy(() =>
  import("./components/Biometric/BiometricEnrollment")
);

// Protected Route component with role-based access
const ProtectedRoute = ({ allowedRoles = [], onLogout, children }) => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Redirect to login if not authenticated or no valid role
  if (!token || !user.role) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to login if role is not allowed
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  // Render children within Layout
  return (
    <Layout role={user.role} onLogout={onLogout}>
      {children}
    </Layout>
  );
};

// Prop type validation for ProtectedRoute
ProtectedRoute.propTypes = {
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
  onLogout: PropTypes.func,
  children: PropTypes.node,
};

// ============================================
// APP ROUTES COMPONENT
// Uses useLocation for navigation-aware routing
// key={location.pathname} forces re-render on back navigation
// ============================================
const AppRoutes = ({
  isAuthenticated,
  userRole,
  handleLoginSuccess,
  handleLogout,
}) => {
  const location = useLocation();

  return (
    <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
      {/* key={location.pathname} forces React to remount on route change */}
      {/* This fixes the "back button doesn't update view" issue */}
      <Routes location={location} key={location.pathname}>
        {/* Login Route */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate
                to={
                  userRole === "admin"
                    ? "/admin"
                    : userRole === "teacher"
                    ? "/teacher"
                    : "/student"
                }
                replace
              />
            ) : (
              <Login
                setIsAuthenticated={handleLoginSuccess}
                setUserRole={() => {}}
              />
            )
          }
        />

        {/* STUDENT ROUTES */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["student"]} onLogout={handleLogout}>
              <StudentHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/profile"
          element={
            <ProtectedRoute allowedRoles={["student"]} onLogout={handleLogout}>
              <StudentProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/history"
          element={
            <ProtectedRoute allowedRoles={["student"]} onLogout={handleLogout}>
              <StudentHistory />
            </ProtectedRoute>
          }
        />

        {/* BIOMETRIC ENROLLMENT ROUTE */}
        <Route
          path="/biometric-enrollment"
          element={
            <ProtectedRoute
              allowedRoles={["student", "teacher"]}
              onLogout={handleLogout}
            >
              <BiometricEnrollment />
            </ProtectedRoute>
          }
        />

        {/* TEACHER ROUTES */}
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={["teacher"]} onLogout={handleLogout}>
              <TeacherHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/classes"
          element={
            <ProtectedRoute allowedRoles={["teacher"]} onLogout={handleLogout}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/sessions"
          element={
            <ProtectedRoute allowedRoles={["teacher"]} onLogout={handleLogout}>
              <TeacherSessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/analytics"
          element={
            <ProtectedRoute allowedRoles={["teacher"]} onLogout={handleLogout}>
              <TeacherAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/analytics/class/:classId"
          element={
            <ProtectedRoute allowedRoles={["teacher"]} onLogout={handleLogout}>
              <ClassAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/profile"
          element={
            <ProtectedRoute allowedRoles={["teacher"]} onLogout={handleLogout}>
              <TeacherProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/live-monitor/:sessionId"
          element={
            <ProtectedRoute allowedRoles={["teacher"]} onLogout={handleLogout}>
              <LiveMonitorPage />
            </ProtectedRoute>
          }
        />

        {/* ADMIN ROUTES */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]} onLogout={handleLogout}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Broadcast Messages Route */}
        <Route
          path="/admin/messages"
          element={
            <ProtectedRoute allowedRoles={["admin"]} onLogout={handleLogout}>
              <BroadcastPage />
            </ProtectedRoute>
          }
        />

        {/* Admin User Management */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]} onLogout={handleLogout}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        {/* Admin Class Management */}
        <Route
          path="/admin/classes"
          element={
            <ProtectedRoute allowedRoles={["admin"]} onLogout={handleLogout}>
              <ClassManagement />
            </ProtectedRoute>
          }
        />

        {/* Admin Class Detail */}
        <Route
          path="/admin/classes/:classId"
          element={
            <ProtectedRoute allowedRoles={["admin"]} onLogout={handleLogout}>
              <ClassDetailManagement />
            </ProtectedRoute>
          }
        />

        {/* Admin Subject Management */}
        <Route
          path="/admin/subjects"
          element={
            <ProtectedRoute allowedRoles={["admin"]} onLogout={handleLogout}>
              <SubjectManagement />
            </ProtectedRoute>
          }
        />

        {/* Admin Location Settings */}
        <Route
          path="/admin/location"
          element={
            <ProtectedRoute allowedRoles={["admin"]} onLogout={handleLogout}>
              <LocationSettings />
            </ProtectedRoute>
          }
        />

        {/* DEFAULT ROUTE */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate
                to={
                  userRole === "admin"
                    ? "/admin"
                    : userRole === "teacher"
                    ? "/teacher"
                    : "/student"
                }
                replace
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* 404 Route */}
        <Route
          path="*"
          element={
            <div className="not-found">
              <h1>404</h1>
              <p>Page not found</p>
              <a href="/">Go Home</a>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
};

AppRoutes.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  userRole: PropTypes.string,
  handleLoginSuccess: PropTypes.func.isRequired,
  handleLogout: PropTypes.func.isRequired,
};

// ============================================
// MAIN APP COMPONENT
// ============================================
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    // Listen for changes to localStorage (cross-tab logout/login)
    window.addEventListener("storage", checkAuth);

    // Initialize offline sync manager
    // Automatically syncs offline attendance when network restores
    initializeSyncManager()
      .then(() => {
        console.log(
          "✅ Sync manager initialized - offline data will sync automatically"
        );
      })
      .catch((err) => {
        console.warn("⚠️ Sync manager failed to initialize:", err);
      });

    return () => {
      window.removeEventListener("storage", checkAuth);
      stopSyncManager();
    };
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role) {
          setIsAuthenticated(true);
          setUserRole(user.role);
        } else {
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch {
        setIsAuthenticated(false);
        setUserRole(null);
      }
    } else {
      setIsAuthenticated(false);
      setUserRole(null);
    }

    setLoading(false);
  };

  const handleLoginSuccess = () => {
    checkAuth();
  };

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setIsAuthenticated(false);
    setUserRole(null);
  };

  if (loading) {
    return <LoadingSpinner message="Loading AttendSmart..." />;
  }

  return (
    <ErrorBoundary>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="App">
          <ToastContainer />
          <AppRoutes
            isAuthenticated={isAuthenticated}
            userRole={userRole}
            handleLoginSuccess={handleLoginSuccess}
            handleLogout={handleLogout}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
