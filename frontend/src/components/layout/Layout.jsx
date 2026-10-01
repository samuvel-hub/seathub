import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar onToggleMobileMenu={() => setMobileOpen(prev => !prev)} />
      <div className="flex flex-1 relative">
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl w-full mx-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
