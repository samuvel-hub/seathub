import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SeatingProvider } from './context/SeatingContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SeatingMapPage from './pages/SeatingMapPage';
import FindSeats from './pages/FindSeats';
import Services from './pages/Services';
import Reservations from './pages/Reservations';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Activity from './pages/Activity';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SeatingProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="seating/map" element={<SeatingMapPage />} />
              <Route path="find-seats" element={<FindSeats />} />
              <Route path="services" element={<Services />} />
              <Route path="reservations" element={<Reservations />} />
              <Route path="users" element={<Users />} />
              <Route path="reports" element={<Reports />} />
              <Route path="activity" element={<Activity />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </SeatingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
