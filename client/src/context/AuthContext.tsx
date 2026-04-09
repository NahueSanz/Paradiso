import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { API_URL } from '../api';

const TOKEN_KEY = 'pp_token';
const USER_KEY  = 'pp_user';
const BASE      = `${API_URL}/api`;

interface AuthContextValue {
  user:     User | null;
  token:    string | null;
  setUser:  (user: User | null) => void;          // kept for demo role toggle
  login:    (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role: 'owner' | 'employee') => Promise<void>;
  logout:   () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function authRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUserState] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });

  // Keep localStorage in sync whenever token/user changes
  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else        localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else      localStorage.removeItem(USER_KEY);
  }, [user]);

  function setUser(u: User | null) {
    setUserState(u);
  }

  async function login(email: string, password: string) {
    const { token: t, user: u } = await authRequest('/auth/login', { email, password });
    setToken(t);
    setUserState(u);
  }

  async function register(email: string, password: string, role: 'owner' | 'employee') {
    const { token: t, user: u } = await authRequest('/auth/register', { email, password, role });
    setToken(t);
    setUserState(u);
  }

  function logout() {
    setToken(null);
    setUserState(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, setUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
