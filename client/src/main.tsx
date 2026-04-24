import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Dashboard from './pages/Dashboard';
import CashPage from './pages/CashPage';
import StockPage from './pages/StockPage';
import SellPage from './pages/SellPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import Register from './pages/Register';
import InvitePage from './pages/InvitePage';
import ForgotPassword from './pages/ForgotPassword';
import AppLayout from './components/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClubProvider } from './context/ClubContext';
import { MembershipProvider } from './context/MembershipContext';
import './index.css';

/** Redirect to /login when not authenticated */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Redirect to / when already authenticated */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Restrict to owners only */
function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'owner') return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Pages that use the sidebar layout */
function WithLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
        <MembershipProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"           element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register"        element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/invite"          element={<InvitePage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/" element={<RequireAuth><App /></RequireAuth>} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <OwnerOnly>
                  <WithLayout><Dashboard /></WithLayout>
                </OwnerOnly>
              </RequireAuth>
            }
          />

          {/* Redirect old movements URL */}
          <Route path="/movements" element={<Navigate to="/cash" replace />} />
          <Route
            path="/sell"
            element={
              <RequireAuth>
                <OwnerOnly>
                  <WithLayout><SellPage /></WithLayout>
                </OwnerOnly>
              </RequireAuth>
            }
          />
          <Route
            path="/stock"
            element={
              <RequireAuth>
                <OwnerOnly>
                  <WithLayout><StockPage /></WithLayout>
                </OwnerOnly>
              </RequireAuth>
            }
          />
          <Route
            path="/cash"
            element={
              <RequireAuth>
                <OwnerOnly>
                  <WithLayout><CashPage /></WithLayout>
                </OwnerOnly>
              </RequireAuth>
            }
          />

          <Route
            path="/settings"
            element={
              <RequireAuth>
                <OwnerOnly>
                  <WithLayout><SettingsPage /></WithLayout>
                </OwnerOnly>
              </RequireAuth>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </MembershipProvider>
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
