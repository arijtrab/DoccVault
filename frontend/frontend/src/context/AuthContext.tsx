import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  role: UserRole;
  switchUser: (userId: string) => void;
  usersList: User[];
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (name: string, email: string, department: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, newPassword: string, token: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  addUser: (newUser: Omit<User, 'id' | 'storageUsedBytes' | 'lastActive'>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'docvault_current_user_v2';
const STORAGE_KEY_AUTH_TOKEN = 'docvault_auth_token';

const BASE_URL = '/api/v1';

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  return res;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
  });

  const [usersList, setUsersList] = useState<User[]>([]);

  // Sync currentUser to localStorage
  useEffect(() => {
    try {
      if (currentUser) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      else localStorage.removeItem(STORAGE_KEY_USER);
    } catch (e) { console.error(e); }
  }, [currentUser]);

  // Load users from API on mount
  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/auth/me').then(async res => {
        if (!res.ok) throw new Error('Session expired');
        setCurrentUser(await res.json());
      }).catch(() => {
        localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
        setCurrentUser(null);
        setIsAuthenticated(false);
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentUser?.role === 'admin') refreshUsers();
  }, [currentUser?.id, currentUser?.role]);

  const refreshUsers = async () => {
    try {
      const res = await apiFetch('/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch {
      setUsersList([]);
    }
  };

  const switchUser = async (userId: string) => {
    const target = usersList.find(u => u.id === userId);
    if (target) await login(target.email, 'password123');
  };

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Authentication failed.' };
      }

      localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, data.token);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return { success: false, error: 'Could not connect to the server. Please try again.' };
    }
  };

  const logout = () => {
    void apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const register = async (
    name: string,
    email: string,
    department: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, department, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed.' };
      }

      localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, data.token);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch {
      return { success: false, error: 'Could not connect to the server. Please try again.' };
    }
  };

  const resetPassword = async (email: string, newPassword: string, token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, newPassword, token }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      return { success: true };
    } catch {
      return { success: false, error: 'Could not connect to the server. Please try again.' };
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    try {
      const res = await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentUser(updated);
        setUsersList(prev => prev.map(u => u.id === updated.id ? updated : u));
      } else {
        throw new Error('Could not update the profile.');
      }
    } catch (error) {
      throw error;
    }
  };

  const addUser = async (userData: Omit<User, 'id' | 'storageUsedBytes' | 'lastActive'>) => {
    try {
      const res = await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not create the user.');
      const newUser = await res.json();
      setUsersList(prev => [newUser, ...prev]);
    } catch (error) {
      throw error;
    }
  };

  const deleteUser = async (userId: string) => {
    if (currentUser && userId === currentUser.id) return;
    try {
      const response = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not delete the user.');
    } catch (error) {
      throw error;
    }
    setUsersList(prev => prev.filter(u => u.id !== userId));
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    const res = await apiFetch(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not update user role.');
    const updated = await res.json();
    setUsersList(prev => prev.map(user => user.id === userId ? updated : user));
    if (currentUser?.id === userId) setCurrentUser(updated);
  };

  const activeRole: UserRole = currentUser ? currentUser.role : 'user';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        role: activeRole,
        switchUser,
        usersList,
        login,
        logout,
        register,
        resetPassword,
        updateProfile,
        addUser,
        deleteUser,
        updateUserRole,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
