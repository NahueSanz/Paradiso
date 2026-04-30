import React, { useState } from 'react';
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
import ResetPassword from './pages/ResetPassword';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AppLayout from './components/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClubProvider } from './context/ClubContext';
import { MembershipProvider } from './context/MembershipContext';
import './index.css';

const courtBg: React.CSSProperties = {
  backgroundImage: [
    'linear-gradient(rgba(4,14,26,0.72), rgba(4,14,26,0.72))',
    'url(/paddle-linea-blanca.png)',
  ].join(', '),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

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

// ─── Email verification gate ─────────────────────────────────────────────────

function RequireVerified({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && !user.isEmailVerified) return <PendingVerificationScreen />;
  return <>{children}</>;
}

function PendingVerificationScreen() {
  const { user, resendVerification, logout } = useAuth();
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [resendErr, setResendErr] = useState('');

  async function handleResend() {
    setSending(true);
    setSent(false);
    setResendErr('');
    try {
      await resendVerification(user?.email ?? '');
      setSent(true);
    } catch (err: any) {
      setResendErr(err.message ?? 'Error al reenviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={courtBg}>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lime-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/60 p-8 text-center">

          <div className="mb-6">
            <img src="/logo-full.svg" alt="ClubFlow" className="h-10 mx-auto" />
          </div>

          <div className="w-14 h-14 bg-lime-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-white mb-2">Verificá tu cuenta</h2>
          <p className="text-sm text-white/40 mb-8">
            Te enviamos un enlace de verificación a tu correo electrónico.
            Hacé clic en ese enlace para activar tu cuenta.
          </p>

          {sent && (
            <p className="text-xs text-lime-400 bg-lime-500/10 rounded-lg px-3 py-2 mb-4">
              ¡Correo reenviado! Revisá tu casilla.
            </p>
          )}
          {resendErr && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-4">
              {resendErr}
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={sending}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white
                         bg-gradient-to-r from-lime-500 to-lime-600
                         hover:from-lime-400 hover:to-lime-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enviando…
                </span>
              ) : 'Reenviar correo de verificación'}
            </button>

            <button
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

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
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/verify-email"    element={<VerifyEmailPage />} />

          {/* Protected routes — require auth AND verified email */}
          <Route path="/" element={<RequireAuth><RequireVerified><App /></RequireVerified></RequireAuth>} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth><RequireVerified>
                <OwnerOnly><WithLayout><Dashboard /></WithLayout></OwnerOnly>
              </RequireVerified></RequireAuth>
            }
          />

          <Route path="/movements" element={<Navigate to="/cash" replace />} />

          <Route
            path="/sell"
            element={
              <RequireAuth><RequireVerified>
                <OwnerOnly><WithLayout><SellPage /></WithLayout></OwnerOnly>
              </RequireVerified></RequireAuth>
            }
          />
          <Route
            path="/stock"
            element={
              <RequireAuth><RequireVerified>
                <OwnerOnly><WithLayout><StockPage /></WithLayout></OwnerOnly>
              </RequireVerified></RequireAuth>
            }
          />
          <Route
            path="/cash"
            element={
              <RequireAuth><RequireVerified>
                <OwnerOnly><WithLayout><CashPage /></WithLayout></OwnerOnly>
              </RequireVerified></RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth><RequireVerified>
                <OwnerOnly><WithLayout><SettingsPage /></WithLayout></OwnerOnly>
              </RequireVerified></RequireAuth>
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
