import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';

// ── Create Club Modal ─────────────────────────────────────────────────────────

export function CreateClubModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('El nombre es requerido.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createClub(trimmed);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el club.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Crear club</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del club
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Club Padel Norte"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-indigo-400"
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600
                         hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium
                         hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando…' : 'Crear club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Club Selector ─────────────────────────────────────────────────────────────

export default function ClubSelector() {
  const { user } = useAuth();
  const { clubs, selectedClubId, setSelectedClubId, refreshClubs } = useClub();
  const [showModal, setShowModal] = useState(false);

  const isOwner = user?.role === 'owner';

  async function handleCreated() {
    await refreshClubs();
    // refreshClubs will auto-select the new club if needed; but we want the newest one
    // We'll refetch and select the last created
    const updated = await api.getClubs();
    if (updated.length > 0) {
      setSelectedClubId(updated[updated.length - 1].id);
    }
  }

  if (clubs.length === 0 && !isOwner) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        {clubs.length > 0 && (
          <div className="relative">
            <select
              value={selectedClubId ?? ''}
              onChange={(e) => setSelectedClubId(Number(e.target.value))}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm
                         font-medium text-gray-700 bg-white focus:outline-none focus:ring-2
                         focus:ring-indigo-400 cursor-pointer"
            >
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            {/* Chevron icon */}
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {isOwner && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600
                       hover:text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200
                       hover:bg-indigo-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear club
          </button>
        )}
      </div>

      {showModal && (
        <CreateClubModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

// ── Empty state (no clubs) ────────────────────────────────────────────────────

export function NoClubsEmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
      <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
        <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <div>
        <p className="text-xl font-semibold text-gray-800">No tenés clubes todavía</p>
        <p className="text-sm text-gray-500 mt-1">Creá tu primer club para empezar a gestionar canchas y reservas.</p>
      </div>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl
                   font-medium hover:bg-indigo-700 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Crear tu primer club
      </button>
    </div>
  );
}
