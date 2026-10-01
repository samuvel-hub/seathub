import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SeatingProvider } from './context/SeatingContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SeatingMapPage from './pages/SeatingMapPage';
import FindSeats from './pages/FindSeats';
import Events from './pages/Services';
import EventRegistrations from './pages/EventRegistrations';
import Reports from './pages/Reports';
import Activity from './pages/Activity';
import Settings from './pages/Settings';
import GuestPage from './pages/GuestPage';

// Route guard: Restricts route to administrators only
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return <Navigate to="/find-seats" replace />;
  }
  return children;
}

// Redirects root index to appropriate experience based on user role
function IndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/dashboard' : '/find-seats'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SeatingProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Direct Guest Booking Portal with Unique Event URL (Requirement 4) */}
            <Route path="/guest/:eventId" element={<GuestPage />} />
            <Route path="/guest" element={<GuestPage />} />

            <Route path="/" element={<Layout />}>
              <Route index element={<IndexRedirect />} />
              
              {/* Attendee / Guest & Admin Accessible Routes */}
              <Route path="find-seats" element={<FindSeats />} />
              <Route path="events" element={<Events />} />
              <Route path="events/:eventId/seating" element={<SeatingMapPage />} />

              {/* Admin-Only Protected Routes */}
              <Route path="dashboard" element={
                <AdminRoute>
                  <Dashboard />
                </AdminRoute>
              } />
              <Route path="events/:eventId/registrations" element={
                <AdminRoute>
                  <EventRegistrations />
                </AdminRoute>
              } />
              <Route path="reports" element={
                <AdminRoute>
                  <Reports />
                </AdminRoute>
              } />
              <Route path="activity" element={
                <AdminRoute>
                  <Activity />
                </AdminRoute>
              } />
              <Route path="settings" element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              } />

              {/* Normal-user account management is removed */}
              <Route path="users" element={<IndexRedirect />} />

              {/* Backward compatibility redirects */}
              <Route path="services" element={<Navigate to="/events" replace />} />
              <Route path="seating/map" element={<Navigate to="/events" replace />} />
              <Route path="reservations" element={<Navigate to="/events" replace />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SeatingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
