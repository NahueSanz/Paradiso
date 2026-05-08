import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import type { User } from '../types';

function nameIsUnset(user: User): boolean {
  return !user.name || user.name.trim() === '' || user.name === user.email;
}

export default function NameSetupGuard({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const [show,   setShow]   = useState(false);
  const [name,   setName]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && nameIsUnset(user)) {
      setShow(true);
    }
  }, [user]);

  useEffect(() => {
    if (show) inputRef.current?.focus();
  }, [show]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('El nombre debe tener al menos 2 caracteres'); return; }
    if (trimmed.length > 50) { setError('El nombre no puede superar los 50 caracteres'); return; }

    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMyProfile({ name: trimmed });
      setUser({ ...user!, name: updated.name });
      setShow(false);
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar el nombre');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {children}

      {show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-1">Completá tu nombre</h2>
            <p className="text-sm text-muted-foreground mb-4">
              ¿Cómo querés que te veamos? Podés cambiarlo después.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan García"
                  maxLength={50}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm
                             bg-background text-foreground
                             focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium
                           hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
