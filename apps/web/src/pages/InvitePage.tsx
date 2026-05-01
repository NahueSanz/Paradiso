import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../context/AuthContext';

export default function InvitePage() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { setUser }     = useAuth();

  const token = searchParams.get('token') ?? '';

  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Link de invitación inválido o expirado.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { token: authToken, user } = await api.acceptInvitation({ token, password });
      localStorage.setItem('pp_token', authToken);
      setUser(user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Error al aceptar la invitación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-indigo-700 tracking-tight">ClubFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Creá tu contraseña para unirte al club</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Repetir contraseña
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium
                       hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Uniéndose…' : 'Unirse al club'}
          </button>
        </form>
      </div>
    </div>
  );
}
