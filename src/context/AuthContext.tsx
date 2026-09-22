'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole } from '@/types/database';
import { INITIAL_PROFILES } from '@/lib/mock-data';
import { api } from '@/lib/api';

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  allProfiles: Profile[];
  isLoading: boolean;
  switchRole: (role: UserRole) => void;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  addUser: (profile: Omit<Profile, 'id' | 'created_at'>) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  updateUserStatus: (userId: string, status: 'active' | 'disabled') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>(INITIAL_PROFILES);
  const [user, setUser] = useState<Profile | null>(INITIAL_PROFILES[0]);
  const [role, setRole] = useState<UserRole>('admin');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) setRole(user.role);
  }, [user]);

  // On mount, try to restore session from token
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      api.me()
        .then((data) => {
          const apiUser = data as { _id: string; name: string; email: string; role: string };
          const profile: Profile = {
            id: apiUser._id,
            email: apiUser.email,
            full_name: apiUser.name,
            role: (apiUser.role as UserRole) || 'user',
            status: 'active',
            created_at: new Date().toISOString(),
          };
          setUser(profile);
          setRole(profile.role);
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
        });
    }
  }, []);

  const switchRole = (newRole: UserRole) => {
    const matchingUser = profiles.find((p) => p.role === newRole && p.status === 'active');
    if (matchingUser) {
      setUser(matchingUser);
      setRole(matchingUser.role);
    } else {
      const tempUser: Profile = {
        id: `user-${newRole}-temp`,
        email: `${newRole}@gracechurch.org`,
        full_name: `${newRole.toUpperCase()} User`,
        role: newRole,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      setUser(tempUser);
      setRole(newRole);
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    // Try real API login first if password is provided
    if (password) {
      try {
        setIsLoading(true);
        const result = await api.login(email, password) as { token: string; user: { _id: string; name: string; email: string; role: string } };
        localStorage.setItem('auth_token', result.token);
        const profile: Profile = {
          id: result.user._id,
          email: result.user.email,
          full_name: result.user.name,
          role: (result.user.role as UserRole) || 'user',
          status: 'active',
          created_at: new Date().toISOString(),
        };
        setUser(profile);
        setRole(profile.role);
        return true;
      } catch {
        // Fall through to mock login
      } finally {
        setIsLoading(false);
      }
    }

    // Fallback: mock login (demo mode)
    const found = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
    if (found) {
      if (found.status === 'disabled') throw new Error('This user account has been disabled.');
      setUser(found);
      setRole(found.role);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(INITIAL_PROFILES[0]);
    setRole('admin');
  };

  const addUser = (newProfileData: Omit<Profile, 'id' | 'created_at'>) => {
    const newProfile: Profile = {
      ...newProfileData,
      id: `user-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setProfiles((prev) => [...prev, newProfile]);
  };

  const updateUserRole = (userId: string, newRole: UserRole) => {
    setProfiles((prev) => prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p)));
    if (user && user.id === userId) {
      setUser((prev) => (prev ? { ...prev, role: newRole } : null));
      setRole(newRole);
    }
  };

  const updateUserStatus = (userId: string, newStatus: 'active' | 'disabled') => {
    setProfiles((prev) => prev.map((p) => (p.id === userId ? { ...p, status: newStatus } : p)));
    if (user && user.id === userId && newStatus === 'disabled') setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        allProfiles: profiles,
        isLoading,
        switchRole,
        login,
        logout,
        addUser,
        updateUserRole,
        updateUserStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
