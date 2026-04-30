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
  const [inviteUrl,   setInviteUrl]   = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);

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
      const result = await api.createInvitation(email.trim(), selectedClubId, displayName.trim());
      const url = `${window.location.origin}/invite?token=${result.token}`;
      setInviteUrl(url);
    } catch (err: any) {
      setError(err.message ?? 'Error al crear la invitación.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

        {!inviteUrl ? (
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
                {loading ? 'Generando…' : 'Generar invitación'}
              </button>
            </div>
          </form>
        ) : (
          /* ── Step 2: show link ── */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium">Invitación creada para <strong>{displayName}</strong></p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Link de invitación</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 border border-border bg-muted rounded-lg px-3 py-2
                             text-xs text-muted-foreground focus:outline-none select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 text-xs rounded-lg border border-border text-muted-foreground
                             hover:bg-muted transition-colors whitespace-nowrap"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Compartí este link con el empleado para que pueda crear su cuenta.
              </p>
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
