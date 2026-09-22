'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Grid,
  Search,
  Users,
  BookmarkCheck,
  BarChart3,
  History,
  Settings as SettingsIcon,
  MapPin
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { role } = useAuth();

  const userNav = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Current Service', href: '/services', icon: Calendar },
    { label: 'Seating Map', href: '/seating/map', icon: MapPin },
    { label: 'Find Seats', href: '/find-seats', icon: Search }
  ];

  const adminNav = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Services', href: '/services', icon: Calendar },
    { label: 'Seating Map', href: '/seating/map', icon: MapPin },
    { label: 'Seating Layout', href: '/seating/config', icon: Grid },
    { label: 'Find Seats', href: '/find-seats', icon: Search },
    { label: 'Reservations', href: '/reservations', icon: BookmarkCheck },
    { label: 'Users', href: '/users', icon: Users },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Activity Log', href: '/activity', icon: History },
    { label: 'Settings', href: '/settings', icon: SettingsIcon }
  ];

  const navItems = role === 'admin' ? adminNav : userNav;

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 text-slate-700 min-h-[calc(100vh-4rem)] p-4 space-y-6 shadow-sm">
        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          {role === 'admin' ? 'Admin Workspace' : 'User Navigation'}
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-bold text-slate-800">Church Seating Management</div>
          <div>Version 2.0 Realtime</div>
        </div>
      </aside>

      {/* Mobile Touch-Friendly Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around shadow-2xl">
        {userNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-semibold min-w-[4.5rem] transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
