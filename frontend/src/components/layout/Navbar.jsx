import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ onToggleMobileMenu }) {
  const { user, logout, isGuest, isAdmin } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 md:px-6 py-2.5 flex items-center justify-between shadow-xs sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
          <span className="text-white font-black text-sm">SH</span>
        </div>
        <div>
          <div className="font-extrabold text-gray-900 text-base leading-tight tracking-tight">SEATHUB</div>
          <div className="text-[11px] text-gray-400 font-medium truncate max-w-[180px]">
            {user?.organization ? user.organization : 'Multi-Event Seating Platform'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* User Identity Info */}
        <div className="text-right hidden sm:block">
          <div className="text-sm font-semibold text-gray-900 leading-tight">
            {user?.name || (isGuest ? 'Guest Attendee' : 'User')}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            {isAdmin ? (
              <>
                {user?.organization && (
                  <span className="text-[11px] font-medium text-blue-600 max-w-[130px] truncate" title={user.organization}>
                    {user.organization} &bull;
                  </span>
                )}
                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Admin
                </span>
              </>
            ) : (
              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Guest Session
              </span>
            )}
          </div>
        </div>

        {/* User Avatar Circle */}
        <div className={'w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ' + (isGuest ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-700')}>
          {isGuest ? 'G' : (user?.name?.[0] || 'A')}
        </div>
      </div>
    </nav>
  );
}
