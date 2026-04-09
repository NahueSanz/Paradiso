import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Eye icon ──────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

// ── Register ──────────────────────────────────────────────────────────────────

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  const passwordMismatch =
    confirmPassword !== '' && password !== confirmPassword;

  const isInvalid = passwordMismatch || password.length < 6;

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
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Error al registrarse.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-indigo-700 tracking-tight">Padel Paradiso</h1>
          <p className="text-sm text-gray-500 mt-1">Creá tu cuenta</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="tu@correo.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repetir contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm
                            focus:outline-none focus:ring-2 transition-colors
                            ${passwordMismatch
                              ? 'border-red-400 focus:ring-red-300'
                              : 'border-gray-300 focus:ring-indigo-400'
                            }`}
                placeholder="Repetí tu contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {passwordMismatch && (
              <p className="text-xs text-red-600 mt-1">Las contraseñas no coinciden</p>
            )}
          </div>

          {/* Server error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || isInvalid}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium
                       hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Registrando…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
