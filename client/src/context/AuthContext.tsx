import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { API_URL } from '../api';

const TOKEN_KEY = 'pp_token';
const USER_KEY  = 'pp_user';
const BASE      = `${API_URL}/api`;

interface AuthContextValue {
  user:                 User | null;
  token:                string | null;
  setUser:              (user: User | null) => void;
  login:                (email: string, password: string) => Promise<void>;
  register:             (email: string, password: string, role: 'owner' | 'employee') => Promise<void>;
  logout:               () => void;
  resendVerification:   (email: string) => Promise<void>;
  markEmailVerified:    () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postJson<T>(path: string, body: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message ?? `HTTP ${res.status}`);
    (err as any).code = (data as { code?: string }).code;
    throw err;
  }
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUserState] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });

  function setUser(u: User | null) {
    setUserState(u);
  }

  async function login(email: string, password: string) {
    const { token: t, user: u } = await postJson<{ token: string; user: User }>(
      '/auth/login',
      { email, password },
    );
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUserState(u);
  }

  async function register(email: string, password: string, role: 'owner' | 'employee') {
    // Backend no longer returns a token — user must verify email before accessing the app.
    await postJson('/auth/register', { email, password, role });
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUserState(null);
  }

  async function resendVerification(email: string) {
    if (!email?.trim()) return;
    await postJson('/auth/resend-verification', { email });
  }

  function markEmailVerified() {
    if (!user) return;
    const updated: User = { ...user, isEmailVerified: true };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    setUserState(updated);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, setUser, login, register, logout, resendVerification, markEmailVerified }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
