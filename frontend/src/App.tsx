import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { CreateMeetingPage } from './pages/CreateMeetingPage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { ReceptionistPage } from './pages/ReceptionistPage';
import { VisitorsPage } from './pages/VisitorsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { VisitorPreRegistrationPage } from './pages/VisitorPreRegistrationPage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import BookInternalMeetingPage from './pages/BookInternalMeetingPage';
import { SecretaryDashboardPage } from './pages/SecretaryDashboardPage';
import { EmployeeDashboardPage } from './pages/EmployeeDashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient();

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated 
                ? <Navigate to={
                    user?.role === 'security' ? '/receptionist' : 
                    user?.role === 'secretary' ? '/secretary-dashboard' :
                    user?.role === 'employee' ? '/employee-dashboard' :
                    '/dashboard'
                  } /> 
                : <LoginPage />
            } 
          />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole={['admin', 'host', 'receptionist']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/secretary-dashboard"
            element={
              <ProtectedRoute requiredRole={['secretary']}>
                <SecretaryDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employee-dashboard"
            element={
              <ProtectedRoute requiredRole={['employee']}>
                <EmployeeDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/meetings"
            element={
              <ProtectedRoute requiredRole={['admin', 'host', 'receptionist', 'secretary', 'employee']}>
                <MeetingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/meetings/create"
            element={
              <ProtectedRoute requiredRole={['admin', 'host', 'secretary', 'employee']}>
                <CreateMeetingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/meetings/:id"
            element={
              <ProtectedRoute>
                <MeetingDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/meetings/internal/book"
            element={
              <ProtectedRoute requiredRole={['admin', 'host', 'receptionist', 'secretary', 'employee']}>
                <BookInternalMeetingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/receptionist"
            element={
              <ProtectedRoute requiredRole={['receptionist', 'admin', 'security']}>
                <ReceptionistPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/visitors"
            element={
              <ProtectedRoute requiredRole={['admin', 'security', 'receptionist']}>
                <VisitorsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/availability"
            element={
              <ProtectedRoute requiredRole={['admin', 'host', 'secretary', 'employee']}>
                <AvailabilityPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole={['admin']}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRole={['admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/analytics"
            element={
              <ProtectedRoute requiredRole={['admin', 'manager', 'hr', 'receptionist']}>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          {/* Public route - no authentication required */}
          <Route path="/preregister" element={<VisitorPreRegistrationPage />} />

          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route 
            path="/" 
            element={
              <Navigate to={
                user?.role === 'security' ? '/receptionist' : 
                user?.role === 'secretary' ? '/secretary-dashboard' :
                user?.role === 'employee' ? '/employee-dashboard' :
                '/dashboard'
              } />
            } 
          />
          <Route 
            path="*" 
            element={
              <Navigate to={
                user?.role === 'security' ? '/receptionist' : 
                user?.role === 'secretary' ? '/secretary-dashboard' :
                user?.role === 'employee' ? '/employee-dashboard' :
                '/dashboard'
              } />
            } 
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
