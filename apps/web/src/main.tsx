import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Dashboard from './pages/Dashboard';
import CashPage from './pages/CashPage';
import StockPage from './pages/StockPage';
import SellPage from './pages/SellPage';
import SettingsPage from './pages/SettingsPage';
import TeamPage from './pages/TeamPage';
import ChatPage from './pages/ChatPage';
import Login from './pages/Login';
import Register from './pages/Register';
import InvitePage from './pages/InvitePage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AppLayout from './components/AppLayout';
import NameSetupGuard from './components/NameSetupGuard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClubProvider } from './context/ClubContext';
import { MembershipProvider } from './context/MembershipContext';
import './index.css';

// ─── Auth guard components ────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'owner') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function WithLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

// ─── Router ───────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
        <MembershipProvider>
        <NameSetupGuard>
        <Routes>
          {/* Public routes */}
          <Route path="/login"           element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register"        element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/invite"          element={<InvitePage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />

          {/* Protected routes */}
          <Route path="/" element={<RequireAuth><App /></RequireAuth>} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <OwnerOnly><WithLayout><Dashboard /></WithLayout></OwnerOnly>
              </RequireAuth>
            }
          />

          <Route path="/movements" element={<Navigate to="/cash" replace />} />

          <Route
            path="/sell"
            element={
              <RequireAuth>
                <WithLayout><SellPage /></WithLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/stock"
            element={
              <RequireAuth>
                <WithLayout><StockPage /></WithLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/cash"
            element={
              <RequireAuth>
                <OwnerOnly><WithLayout><CashPage /></WithLayout></OwnerOnly>
              </RequireAuth>
            }
          />
          <Route
            path="/chat"
            element={
              <RequireAuth>
                <WithLayout><ChatPage /></WithLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/team"
            element={
              <RequireAuth>
                <OwnerOnly><WithLayout><TeamPage /></WithLayout></OwnerOnly>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <OwnerOnly><WithLayout><SettingsPage /></WithLayout></OwnerOnly>
              </RequireAuth>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </NameSetupGuard>
        </MembershipProvider>
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
