import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      API.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('auth_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async ({ name, organization, email, password }) => {
    const res = await API.post('/auth/register', { name, organization, email, password });
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const guestLogin = async () => {
    const res = await API.post('/auth/guest-login');
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    window.location.href = '/login';
  };

  const isGuest = Boolean(user?.role === 'guest' || user?.isGuest);
  const isAdmin = Boolean(user?.role === 'admin');

  return (
    <AuthContext.Provider value={{ user, loading, login, register, guestLogin, logout, isGuest, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
