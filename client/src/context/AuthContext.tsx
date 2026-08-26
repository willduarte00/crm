import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, AuthResponse } from '../types';
import { apiFetch } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  has: (permission: string) => boolean;
  hasAny: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await apiFetch<AuthResponse>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const userPermissions = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);

  const has = useCallback((permission: string) => {
    if (!user) return false;
    return userPermissions.has(permission);
  }, [user, userPermissions]);

  const hasAny = useCallback((...permissions: string[]) => {
    if (!user) return false;
    return permissions.some((p) => userPermissions.has(p));
  }, [user, userPermissions]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, has, hasAny }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
