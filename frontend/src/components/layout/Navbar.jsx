import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-sm">GC</span>
        </div>
        <div>
          <div className="font-semibold text-gray-900 text-sm">Grace Community Church</div>
          <div className="text-xs text-gray-500">Seating Management</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">{user?.name}</div>
          <div className="text-xs text-gray-500 uppercase">{user?.role}</div>
        </div>
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-blue-700 font-semibold text-sm">{user?.name?.[0] || 'U'}</span>
        </div>
      </div>
    </nav>
  );
}
