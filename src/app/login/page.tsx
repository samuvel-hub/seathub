'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Church, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, allProfiles } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const success = await login(email);
      if (success) {
        router.push('/dashboard');
      } else {
        setErrorMsg('User not found. Try one of the quick test accounts below.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string) => {
    setEmail(quickEmail);
    setLoading(true);
    setErrorMsg('');
    try {
      const success = await login(quickEmail);
      if (success) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-lg space-y-6">
        
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md shadow-blue-600/20">
            <Church className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Church Seating Pro</h1>
          <p className="text-xs text-slate-500">Live Church Seating Management System</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">Email Address:</label>
            <input
              type="email"
              placeholder="admin@gracechurch.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Test Demo Accounts */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
            Quick One-Click Test Accounts
          </span>

          <div className="space-y-2">
            {allProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleQuickLogin(p.email)}
                className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center justify-between text-xs transition-all"
              >
                <div>
                  <div className="font-bold text-slate-900">{p.full_name}</div>
                  <div className="text-[10px] text-slate-500">{p.email}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    p.role === 'admin'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {p.role}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
