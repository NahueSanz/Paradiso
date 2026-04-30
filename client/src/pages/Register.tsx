import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Icons ──────────────────────────────────────────────────────────────────────

function EmailIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

// ── Background — padel court photo + dark overlay ─────────────────────────────

const courtBg: React.CSSProperties = {
  backgroundImage: [
    'linear-gradient(rgba(4,14,26,0.72), rgba(4,14,26,0.72))',
    'url(/paddle-linea-blanca.png)',
  ].join(', '),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

// ── Shared input class ─────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-white/[0.07] border border-white/[0.12] rounded-xl ' +
  'pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 ' +
  'focus:outline-none focus:ring-2 focus:ring-lime-400/40 focus:border-lime-400/50 ' +
  'hover:bg-white/[0.10] hover:border-white/20 ' +
  'transition-all duration-200';

// ── Post-registration "check your email" screen ────────────────────────────────

function CheckEmailScreen({
  email,
  onResend,
}: {
  email: string;
  onResend: (email: string) => Promise<void>;
}) {
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [resendErr,  setResendErr]  = useState('');

  async function handleResend() {
    setSending(true);
    setSent(false);
    setResendErr('');
    try {
      await onResend(email);
      setSent(true);
    } catch (err: any) {
      setResendErr(err.message ?? 'Error al reenviar. Intentá de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={courtBg}>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lime-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/60 p-8 text-center">
          <div className="w-16 h-16 bg-lime-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">¡Revisá tu correo!</h2>
          <p className="text-sm text-white/50 mb-1">Enviamos un enlace de verificación a</p>
          <p className="text-sm font-semibold text-lime-400 mb-4">{email}</p>
          <p className="text-xs text-white/30 mb-6">
            El enlace expira en 24 horas. Si no lo ves, revisá la carpeta de spam.
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
            <Link
              to="/login"
              className="block py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-400 hover:to-lime-500 transition-all duration-200"
            >
              Ir al inicio de sesión
            </Link>
            <button
              onClick={handleResend}
              disabled={sending}
              className="block w-full py-2.5 px-6 rounded-xl text-sm text-white/50 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Enviando…' : '¿No recibiste el correo? Reenviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Register ──────────────────────────────────────────────────────────────────

export default function Register() {
  const { register, resendVerification } = useAuth();

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [registered,      setRegistered]      = useState(false);

  const passwordMismatch = confirmPassword !== '' && password !== confirmPassword;
  const isInvalid        = passwordMismatch || password.length < 6;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email, password, 'owner');
      setRegistered(true);
    } catch (err: any) {
      setError(err.message ?? 'Error al registrarse.');
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return <CheckEmailScreen email={email} onResend={resendVerification} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative" style={courtBg}>
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lime-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/60 p-8">

          {/* Logo + heading */}
          <div className="text-center mb-8">
            <img src="/logo-full.svg" alt="ClubFlow" className="h-14 mx-auto mb-5" />
            <p className="text-sm text-white/40">
              Gestión inteligente para clubes deportivos
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                Correo electrónico
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/40 pointer-events-none">
                  <EmailIcon />
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="tu@correo.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/40 pointer-events-none">
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls + ' pr-11'}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-white/40 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">
                Repetir contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-white/40 pointer-events-none">
                  <ShieldIcon />
                </span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={
                    inputCls +
                    ' pr-11' +
                    (passwordMismatch
                      ? ' border-red-500/50 focus:ring-red-400/40 focus:border-red-400/50'
                      : '')
                  }
                  placeholder="Repetí tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3.5 flex items-center text-white/40 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {passwordMismatch && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Las contraseñas no coinciden
                </p>
              )}
            </div>

            {/* Server error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || isInvalid}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white
                         bg-gradient-to-r from-lime-500 to-lime-600
                         hover:from-lime-400 hover:to-lime-500
                         hover:shadow-lg hover:shadow-lime-500/25
                         active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registrando…
                </span>
              ) : 'Crear cuenta'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/25">o</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <p className="text-center text-sm text-white/40">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-lime-400 hover:text-lime-300 font-semibold transition-colors">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
