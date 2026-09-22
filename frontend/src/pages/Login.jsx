import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/dashboard'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (e, p) => {
    setEmail(e); setPassword(p);
    setLoading(true);
    try { await login(e, p); navigate('/dashboard'); }
    catch { setError('Login failed'); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">GC</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Grace Community Church</h1>
          <p className="text-gray-500 text-sm mt-1">Seating Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign In</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3 text-center">Quick Login (Demo)</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => quickLogin('admin@church.com', 'admin123')}
                className="border border-blue-200 rounded-xl p-3 text-left hover:bg-blue-50 transition">
                <div className="text-xs font-semibold text-blue-700">Admin</div>
                <div className="text-xs text-gray-500">admin@church.com</div>
              </button>
              <button onClick={() => quickLogin('user@church.com', 'user123')}
                className="border border-green-200 rounded-xl p-3 text-left hover:bg-green-50 transition">
                <div className="text-xs font-semibold text-green-700">User</div>
                <div className="text-xs text-gray-500">user@church.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
