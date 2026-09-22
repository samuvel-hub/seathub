import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const adminNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '▣' },
  { to: '/seating/map', label: 'Seating Map', icon: '⊞' },
  { to: '/find-seats', label: 'Find Seats', icon: '⌕' },
  { to: '/reservations', label: 'Reservations', icon: '□' },
  { to: '/services', label: 'Services', icon: '◷' },
  { to: '/users', label: 'Users', icon: '⊙' },
  { to: '/reports', label: 'Reports', icon: '▤' },
  { to: '/activity', label: 'Activity Log', icon: '↻' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

const userNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '▣' },
  { to: '/seating/map', label: 'Seating Map', icon: '⊞' },
  { to: '/find-seats', label: 'Find Seats', icon: '⌕' },
  { to: '/reservations', label: 'Reservations', icon: '□' },
  { to: '/services', label: 'Services', icon: '◷' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const nav = user?.role === 'admin' ? adminNav : userNav;

  return (
    <aside className="w-56 bg-white border-r border-gray-200 min-h-full py-4 flex flex-col">
      <div className="px-4 mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {user?.role === 'admin' ? 'Admin' : 'User'} Workspace
        </span>
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ' +
              (isActive ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100')
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-400">Church Seating Management</div>
        <div className="text-xs text-gray-300">MERN v1.0</div>
      </div>
    </aside>
  );
}
