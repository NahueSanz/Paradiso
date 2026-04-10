import { useEffect, useRef, useState } from 'react';
import * as api from './api';
import ScheduleGrid from './components/ScheduleGrid';
import ReservationModal, { type FormData, type ModalState } from './components/ReservationModal';
import { CreateClubModal, NoClubsEmptyState } from './components/ClubSelector';
import InviteModal from './components/InviteModal';
import Header from './components/Header';
import type { Court, Reservation, TimeSlot } from './types';
import { useAuth } from './context/AuthContext';
import { useClub } from './context/ClubContext';
import { useMembership } from './context/MembershipContext';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Create Court Modal ────────────────────────────────────────────────────────

interface CreateCourtModalProps {
  onClose: () => void;
  onCreated: (name: string) => Promise<void>;
}

function CreateCourtModal({ onClose, onCreated }: CreateCourtModalProps) {
  const [name, setName]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es requerido.'); return; }
    setSaving(true);
    setError('');
    try {
      await onCreated(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al crear la cancha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Agregar cancha</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la cancha
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cancha 1"
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
              {saving ? 'Guardando…' : 'Crear cancha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rename Club Modal ─────────────────────────────────────────────────────────

interface RenameClubModalProps {
  currentName: string;
  onClose: () => void;
  onRenamed: (name: string) => Promise<void>;
}

function RenameClubModal({ currentName, onClose, onRenamed }: RenameClubModalProps) {
  const [name, setName]     = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es requerido.'); return; }
    setSaving(true);
    setError('');
    try {
      await onRenamed(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Editar nombre del club</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Profile Modal ─────────────────────────────────────────────────────────────

interface ProfileModalProps {
  currentDisplayName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

function ProfileModal({ currentDisplayName, onClose, onSave }: ProfileModalProps) {
  const [name, setName]     = useState(currentDisplayName);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Mi perfil</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre visible</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Así aparecerá en las reservas que crees.
            </p>
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
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { user } = useAuth();
  const { clubs, selectedClubId, loadingClubs, refreshClubs } = useClub();
  const { currentMembership, updateDisplayName } = useMembership();
  const isOwner = user?.role === 'owner';
  const selectedClub = clubs.find((c) => c.id === selectedClubId);

  const [date, setDate]                   = useState(todayISO());
  const [courts, setCourts]               = useState<Court[]>([]);
  const [courtError, setCourtError]       = useState('');
  const [courtsRefreshKey, setCourtsKey]  = useState(0);
  const [refreshKey, setRefreshKey]       = useState(0);
  const [modal, setModal]                 = useState<ModalState | null>(null);
  const [showCourtModal, setCourtModal]   = useState(false);
  const [showCreateClubModal, setShowCreateClubModal]   = useState(false);
  const [showInviteModal,    setShowInviteModal]        = useState(false);
  const [showRenameClubModal, setShowRenameClubModal]   = useState(false);
  const [showProfileModal, setShowProfileModal]         = useState(false);

  // Fetch courts whenever selectedClubId or courtsRefreshKey changes
  useEffect(() => {
    if (selectedClubId === null) { setCourts([]); return; }
    setCourtError('');
    api.getCourts(selectedClubId)
      .then(setCourts)
      .catch(() => setCourtError('Error al cargar las canchas.'));
  }, [selectedClubId, courtsRefreshKey]);

  function refresh() { setRefreshKey((k) => k + 1); }
  function refreshCourts() { setCourtsKey((k) => k + 1); }

  function openModal(courtId: number, slot: TimeSlot, reservation?: Reservation) {
    const courtName = courts.find((c) => c.id === courtId)?.name ?? '';
    setModal({ courtId, courtName, date, slot, reservation });
  }

  async function handleSave(form: FormData) {
    const base = {
      clientName: form.clientName,
      timeStart:  form.timeStart,
      timeEnd:    form.timeEnd,
      ...(form.type          ? { type: form.type }                   : {}),
      ...(form.totalPrice    ? { totalPrice: form.totalPrice }        : {}),
      ...(form.depositAmount ? { depositAmount: form.depositAmount }  : {}),
    };

    if (modal?.reservation) {
      await api.updateReservation(modal.reservation.id, base);
    } else {
      await api.createReservation({
        courtId: modal!.courtId,
        date:    modal!.date,
        ...base,
      });
    }
    refresh();
  }

  async function handleMarkPaid(id: number) {
    await api.updateReservation(id, { paymentStatus: 'paid' });
    refresh();
  }

  async function handleDelete(id: number) {
    await api.deleteReservation(id);
    refresh();
  }

  async function handleCreateCourt(name: string) {
    if (!selectedClubId) return;
    await api.createCourt({ name, clubId: selectedClubId });
    refreshCourts();
  }

  async function handleDeleteCourt(id: number) {
    await api.deleteCourt(id);
    refreshCourts();
  }

  async function handleRenameCourt(id: number, name: string) {
    await api.updateCourt(id, { name });
    refreshCourts();
  }

  async function handleRenameClub(name: string) {
    if (!selectedClubId) return;
    await api.updateClub(selectedClubId, { name });
    await refreshClubs();
  }

  const legend = [
    { label: 'Disponible', className: 'bg-slate-200' },
    { label: 'Pendiente',  className: 'bg-amber-300' },
    { label: 'Seña',       className: 'bg-orange-400' },
    { label: 'Pagado',     className: 'bg-emerald-500' },
  ];

  // Empty state for owners with no clubs
  const showEmptyState = !loadingClubs && clubs.length === 0 && isOwner;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header
        onRenameClub={() => setShowRenameClubModal(true)}
        onShowProfile={() => setShowProfileModal(true)}
      />

      {/* Page toolbar */}
      <div className="bg-white border-b px-4 sm:px-6 py-2 flex items-center justify-between gap-3 flex-wrap">
        {/* Owner actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && (
            <button
              onClick={() => setCourtModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600
                         hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar cancha
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600
                         hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50
                         border border-indigo-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invitar empleado
            </button>
          )}
        </div>

        {/* Legend + date picker */}
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-600">
            {legend.map(({ label, className }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`inline-block w-3 h-3 rounded-sm ${className}`} />
                {label}
              </span>
            ))}
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Cuerpo */}
      <main className="flex-1 p-4 sm:p-6">
        {showEmptyState ? (
          <NoClubsEmptyState onCreateClick={() => setShowCreateClubModal(true)} />
        ) : (
          <>
            {courtError && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {courtError}
              </p>
            )}
            <ScheduleGrid
              date={date}
              courts={courts}
              refreshKey={refreshKey}
              isOwner={isOwner}
              onCellClick={openModal}
              onDeleteCourt={handleDeleteCourt}
              onRenameCourt={handleRenameCourt}
            />
          </>
        )}
      </main>

      {/* Reservation Modal */}
      {modal && (
        <ReservationModal
          state={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onMarkPaid={handleMarkPaid}
          onDelete={handleDelete}
        />
      )}

      {/* Create Court Modal */}
      {showCourtModal && (
        <CreateCourtModal
          onClose={() => setCourtModal(false)}
          onCreated={handleCreateCourt}
        />
      )}

      {/* Create Club Modal (triggered from empty state) */}
      {showCreateClubModal && (
        <CreateClubModal
          onClose={() => setShowCreateClubModal(false)}
          onCreated={refreshClubs}
        />
      )}

      {/* Invite Employee Modal */}
      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}

      {/* Rename Club Modal */}
      {showRenameClubModal && selectedClub && (
        <RenameClubModal
          currentName={selectedClub.name}
          onClose={() => setShowRenameClubModal(false)}
          onRenamed={handleRenameClub}
        />
      )}

      {/* Profile Modal */}
      {showProfileModal && currentMembership && (
        <ProfileModal
          currentDisplayName={currentMembership.displayName}
          onClose={() => setShowProfileModal(false)}
          onSave={updateDisplayName}
        />
      )}
    </div>
  );
}
