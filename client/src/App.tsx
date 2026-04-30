import { useEffect, useRef, useState } from 'react';
import * as api from './api';
import type { OpeningHoursResult } from './api';
import ScheduleGrid from './components/ScheduleGrid';
import ReservationModal, { type FormData, type ModalState } from './components/ReservationModal';
import FixedReservationModal from './components/FixedReservationModal';
import { CreateClubModal, NoClubsEmptyState } from './components/ClubSelector';
import InviteModal from './components/InviteModal';
import AppLayout from './components/AppLayout';
import type { Court, Reservation, TimeSlot, VirtualFixedReservation } from './types';
import { useAuth } from './context/AuthContext';
import { useClub } from './context/ClubContext';
import { useMembership } from './context/MembershipContext';

function todayISO(): string {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold mb-4">Agregar cancha</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Nombre de la cancha
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cancha 1"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm
                         bg-background text-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground
                         hover:bg-muted transition-colors"
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
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold mb-4">Editar nombre del club</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm
                         bg-background text-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground
                         hover:bg-muted transition-colors"
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
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold mb-4">Mi perfil</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre visible</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm
                         bg-background text-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Así aparecerá en las reservas que crees.
            </p>
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground
                         hover:bg-muted transition-colors"
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

// ── Edit Day Hours Modal ──────────────────────────────────────────────────────

interface EditDayHoursModalProps {
  clubId: number;
  date: string;
  current: OpeningHoursResult;
  onClose: () => void;
  onSaved: (result: OpeningHoursResult) => void;
}

function EditDayHoursModal({ clubId, date, current, onClose, onSaved }: EditDayHoursModalProps) {
  const [openTime,  setOpenTime]  = useState(current.openTime);
  const [closeTime, setCloseTime] = useState(current.closeTime);
  const [saving,    setSaving]    = useState(false);
  const [removing,  setRemoving]  = useState(false);
  const [error,     setError]     = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updateDateHours(clubId, date, openTime, closeTime);
      onSaved({ openTime, closeTime, isOverride: true });
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError('');
    try {
      await api.deleteDateHours(clubId, date);
      const updated = await api.getOpeningHours(clubId, date);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al eliminar.');
    } finally {
      setRemoving(false);
    }
  }

  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayLabel = DAY_NAMES[dow];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold mb-1">
          Horario del día
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {dayLabel} {date}
          {current.isOverride && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                             bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              Horario modificado
            </span>
          )}
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Apertura
              </label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm
                           bg-background text-foreground
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Cierre
              </label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm
                           bg-background text-foreground
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Si el cierre es menor a la apertura se interpreta como el día siguiente (ej: 09:00 → 01:00).
          </p>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
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
              disabled={saving || removing}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium
                         hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          {current.isOverride && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving || removing}
              className="w-full px-4 py-2 text-sm rounded-lg text-amber-700 dark:text-amber-300
                         border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20
                         disabled:opacity-50 transition-colors"
            >
              {removing ? 'Eliminando…' : 'Quitar horario modificado'}
            </button>
          )}
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
  const [showFixedModal,  setShowFixedModal]  = useState(false);
  const [editingFixed,    setEditingFixed]    = useState<VirtualFixedReservation | null>(null);
  const [showEditHoursModal, setShowEditHoursModal] = useState(false);
  const [openingHours, setOpeningHours] = useState<OpeningHoursResult>({
    openTime: '09:00', closeTime: '01:00', isOverride: false,
  });

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Fetch courts whenever selectedClubId or courtsRefreshKey changes
  useEffect(() => {
    if (selectedClubId === null) { setCourts([]); return; }
    setCourtError('');
    api.getCourts(selectedClubId)
      .then(setCourts)
      .catch(() => setCourtError('Error al cargar las canchas.'));
  }, [selectedClubId, courtsRefreshKey]);

  // Fetch opening hours whenever date or club changes
  useEffect(() => {
    if (selectedClubId === null) return;
    api.getOpeningHours(selectedClubId, date)
      .then(setOpeningHours)
      .catch(() => setOpeningHours({ openTime: '09:00', closeTime: '01:00', isOverride: false }));
  }, [selectedClubId, date]);


  function refresh() { setRefreshKey((k) => k + 1); }
  function refreshCourts() { setCourtsKey((k) => k + 1); }

  function openModal(courtId: number, slot: TimeSlot, reservation?: Reservation) {
    const courtName = courts.find((c) => c.id === courtId)?.name ?? '';
    setModal({ courtId, courtName, date, slot, reservation });
  }

  async function handleSave(form: FormData) {
    const base = {
      clientName:  form.clientName,
      clientPhone: form.clientPhone ?? null,
      timeStart:   form.timeStart,
      timeEnd:     form.timeEnd,
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

  async function handlePayAmount(id: number, amount: number): Promise<Reservation> {
    const updated = await api.payReservation(id, amount);
    refresh();
    return updated;
  }

  async function handleUpdateNote(id: number, note: string | null): Promise<void> {
    await api.updateReservationNote(id, note);
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
    <AppLayout
      onRenameClub={() => setShowRenameClubModal(true)}
      onShowProfile={() => setShowProfileModal(true)}
    >
      {/* Page header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h1 className="text-xl font-bold text-foreground">Turnos</h1>
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
                           dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700
                           dark:text-indigo-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invitar empleado
              </button>
            )}
            {selectedClubId && (
              <button
                onClick={() => setShowFixedModal(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-violet-700
                           hover:text-violet-900 px-3 py-1.5 rounded-lg hover:bg-violet-50
                           dark:hover:bg-violet-900/30 border border-violet-200 dark:border-violet-700
                           dark:text-violet-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Reserva Fija
              </button>
            )}
            {isOwner && selectedClubId && (
              <button
                onClick={() => setShowEditHoursModal(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground
                           hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted
                           border border-border transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Editar horario del día
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            {legend.map(({ label, className }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`inline-block w-3 h-3 rounded-sm ${className}`} />
                {label}
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {openingHours.isOverride && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                               bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300
                               border border-amber-300 dark:border-amber-700">
                Horario modificado
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {openingHours.openTime} – {openingHours.closeTime}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-input rounded-lg px-3 py-1.5 text-sm
                         bg-background text-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Schedule content */}
      <div className="p-4 sm:p-6">
        {showEmptyState ? (
          <NoClubsEmptyState onCreateClick={() => setShowCreateClubModal(true)} />
        ) : (
          <>
            {courtError && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
                {courtError}
              </p>
            )}
            <ScheduleGrid
              date={date}
              courts={courts}
              clubId={selectedClubId}
              refreshKey={refreshKey}
              isOwner={isOwner}
              openTime={openingHours.openTime}
              closeTime={openingHours.closeTime}
              onCellClick={openModal}
              onFixedClick={(entry) => setEditingFixed(entry)}
              onDeleteCourt={handleDeleteCourt}
              onRenameCourt={handleRenameCourt}
            />
          </>
        )}
      </div>

      {/* Reservation Modal */}
      {modal && (
        <ReservationModal
          state={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onPayAmount={handlePayAmount}
          onUpdateNote={handleUpdateNote}
          onDelete={handleDelete}
          onFixedSuccess={refresh}
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

      {/* Edit Day Hours Modal */}
      {showEditHoursModal && selectedClubId && (
        <EditDayHoursModal
          clubId={selectedClubId}
          date={date}
          current={openingHours}
          onClose={() => setShowEditHoursModal(false)}
          onSaved={(result) => {
            setOpeningHours(result);
            showToast(result.isOverride ? 'Horario del día actualizado' : 'Horario restaurado al predeterminado');
          }}
        />
      )}

      {/* Fixed Reservation Modal (create or edit) */}
      {(showFixedModal || editingFixed !== null) && (
        <FixedReservationModal
          courts={courts}
          editData={editingFixed ?? undefined}
          selectedDate={date}
          onClose={() => { setShowFixedModal(false); setEditingFixed(null); }}
          onSuccess={(message) => {
            refresh();
            showToast(message);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg
            text-sm font-medium pointer-events-none transition-all
            ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </AppLayout>
  );
}
