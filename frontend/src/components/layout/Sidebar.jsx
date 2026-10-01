import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const adminNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '▣' },
  { to: '/find-seats', label: 'Find Seats', icon: '⌕' },
  { to: '/events', label: 'Events & Seating', icon: '◷' },
  { to: '/reports', label: 'Reports', icon: '▤' },
  { to: '/activity', label: 'Activity Log', icon: '↻' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

const guestNav = [
  { to: '/find-seats', label: 'Find Seats', icon: '⌕' },
  { to: '/events', label: 'Events & Seating', icon: '◷' },
];

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { user, logout, isGuest, isAdmin } = useAuth();
  const nav = isAdmin ? adminNav : guestNav;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 py-4 flex flex-col justify-between transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:w-56 ' +
          (mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0')
        }
      >
        <div>
          <div className="px-4 mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {isAdmin ? 'Admin Portal' : 'Guest Attendee'}
            </span>
            <button
              onClick={onCloseMobile}
              className="md:hidden text-gray-400 hover:text-gray-600 p-1 rounded"
            >
              ✕
            </button>
          </div>
          <nav className="px-2 space-y-1">
            {nav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ' +
                  (isActive
                    ? (isGuest ? 'bg-emerald-600 text-white shadow-xs' : 'bg-blue-600 text-white shadow-xs')
                    : 'text-gray-600 hover:bg-gray-100')
                }
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
