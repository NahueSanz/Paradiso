import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useClub } from '../context/ClubContext';

interface Props {
  onClose: () => void;
}

export default function InviteModal({ onClose }: Props) {
  const { selectedClubId } = useClub();

  const [email,       setEmail]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [sent,        setSent]        = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim())                { setError('El correo es requerido.'); return; }
    if (!displayName.trim())          { setError('El nombre visible es requerido.'); return; }
    if (displayName.trim().length < 2){ setError('El nombre debe tener al menos 2 caracteres.'); return; }
    if (!selectedClubId)              { setError('No hay un club seleccionado.'); return; }

    setError('');
    setLoading(true);
    try {
      await api.createInvitation(email.trim(), selectedClubId, displayName.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? 'Error al crear la invitación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Invitar empleado</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!sent ? (
          /* ── Step 1: form ── */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Correo electrónico <span className="text-red-400">*</span>
              </label>
              <input
                ref={inputRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="empleado@correo.com"
                className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Nombre visible <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej: Juan"
                className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Así aparecerá en las reservas que cree este empleado.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-border
                           text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white
                           font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Enviando…' : 'Generar invitación'}
              </button>
            </div>
          </form>
        ) : (
          /* ── Step 2: success ── */
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Invitación enviada correctamente
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                  Le enviamos un correo a <strong>{email}</strong> con el link para crear su cuenta.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white
                         font-medium hover:bg-indigo-700 transition-colors"
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
