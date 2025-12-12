import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem('auth-user');
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('accessToken') || localStorage.getItem('auth-token'),
  isAuthenticated: !!(localStorage.getItem('accessToken') || localStorage.getItem('auth-token')),
  login: (user, token) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('auth-user', JSON.stringify(user));
    localStorage.setItem('auth-token', token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('auth-user');
    localStorage.removeItem('auth-token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  updateUser: (userData) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...userData } : null,
    })),
}));
