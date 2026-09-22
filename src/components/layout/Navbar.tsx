'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSeating } from '@/context/SeatingContext';
import { Church, Shield, Radio } from 'lucide-react';
import Link from 'next/link';

export const Navbar: React.FC = () => {
  const { user, role, switchRole } = useAuth();
  const { church, services, activeService, setActiveServiceId } = useSeating();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Church Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <Church className="w-6 h-6" />
            </div>
            <div>
              <Link href="/dashboard" className="font-bold text-lg leading-tight text-slate-900 hover:text-blue-600 transition-colors">
                {church.name}
              </Link>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Seating Management</span>
              </div>
            </div>
          </div>

          {/* Active Service Selector */}
          <div className="hidden md:flex items-center bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 space-x-2">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Service:</span>
            <select
              value={activeService?.id || ''}
              onChange={(e) => setActiveServiceId(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id} className="bg-white text-slate-900">
                  {s.name} ({s.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Role Switcher & User Profile */}
          <div className="flex items-center space-x-3">
            
            {/* Quick Role Switcher */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
              <Shield className="w-3.5 h-3.5 text-blue-600 ml-1 mr-1 hidden sm:block" />
              <button
                onClick={() => switchRole('admin')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  role === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => switchRole('user')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  role === 'user'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                User
              </button>
            </div>

            {/* Current Active Profile Badge */}
            {user && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800">{user.full_name}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">{user.role}</span>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
