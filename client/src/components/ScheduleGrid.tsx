import { useEffect, useRef, useState } from 'react';
import { getSchedule } from '../api';
import type {
  Court,
  Reservation,
  ScheduleEntry,
  TimeSlot,
  VirtualFixedReservation,
} from '../types';
import type { ScheduleFixedReservation } from '../api';

// Club hours: 09:00 → 01:00 (next day) — 32 half-hour slots
// Post-midnight hours (00:xx, 01:xx) are treated as virtual minutes > 1440
// so all comparisons remain monotonically increasing.
const OPEN_VIRTUAL  = 9 * 60;        // 540  → 09:00
const CLOSE_VIRTUAL = 25 * 60;       // 1500 → 01:00 next day
const NUM_SLOTS     = (CLOSE_VIRTUAL - OPEN_VIRTUAL) / 30; // 32

const SLOTS: TimeSlot[] = Array.from({ length: NUM_SLOTS }, (_, i) => {
  const virtual = OPEN_VIRTUAL + i * 30;
  const real    = virtual % (24 * 60);
  const h = Math.floor(real / 60);
  const m = real % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses both ISO datetime strings ("1970-01-01T09:00:00.000Z")
 * and plain "HH:MM" strings into virtual minutes.
 */
function toVirtualMinutes(timeStr: string): number {
  const isISO = timeStr.length > 5;
  const h     = parseInt(isISO ? timeStr.slice(11, 13) : timeStr.slice(0, 2), 10);
  const m     = parseInt(isISO ? timeStr.slice(14, 16) : timeStr.slice(3, 5), 10);
  const raw   = h * 60 + m;
  return raw < OPEN_VIRTUAL ? raw + 24 * 60 : raw;
}

/** Convert HH:MM slot label to virtual minutes. */
function slotToVirtualMinutes(slot: TimeSlot): number {
  const [h, m] = slot.split(':').map(Number);
  const raw    = h * 60 + m;
  return raw < OPEN_VIRTUAL ? raw + 24 * 60 : raw;
}

/**
 * Returns "HH:MM" from either ISO datetime or plain "HH:MM".
 */
function toHHMM(timeStr: string): string {
  return timeStr.length > 5 ? timeStr.slice(11, 16) : timeStr.slice(0, 5);
}

type HasTimes = { timeStart: string; timeEnd: string };

function coversSlot(r: HasTimes, slot: TimeSlot): boolean {
  const slotStart = slotToVirtualMinutes(slot);
  const slotEnd   = slotStart + 30;
  const startMin  = toVirtualMinutes(r.timeStart);
  const endMin    = toVirtualMinutes(r.timeEnd);
  return startMin < slotEnd && endMin > slotStart;
}

/** True only for the first half-hour slot covered by the entry. */
function isFirstCoveredSlot(r: HasTimes, slot: TimeSlot): boolean {
  const slotStart = slotToVirtualMinutes(slot);
  const startMin  = toVirtualMinutes(r.timeStart);
  return startMin >= slotStart && startMin < slotStart + 30;
}

/** Number of 30-min rows the entry spans. */
function getRowSpan(r: HasTimes): number {
  return SLOTS.filter((s) => coversSlot(r, s)).length;
}

function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-AR')}`;
}

// ── transform: ScheduleFixedReservation → VirtualFixedReservation ─────────────

function toVirtual(f: ScheduleFixedReservation, currentDate: string): VirtualFixedReservation {
  const paidToday = f.lastPaidAt != null && f.lastPaidAt.slice(0, 10) === currentDate;
  return {
    id:            `fixed-${f.id}`,
    rawId:         f.id,
    courtId:       f.courtId,
    dayOfWeek:     f.dayOfWeek,
    duration:      f.duration,
    timeStart:     f.timeStart,
    timeEnd:       f.timeEnd,
    clientName:    f.clientName,
    type:          f.type ?? null,
    isFixed:       true,
    paymentStatus: paidToday ? 'paid' : 'pending',
    totalPrice:    f.totalPrice    ?? null,
    depositAmount: f.depositAmount ?? null,
    carryOver:     f.carryOver,
    lastPaidAt:    f.lastPaidAt ?? null,
    court:         f.court,
  };
}

// ── type guard ────────────────────────────────────────────────────────────────

function isVirtualFixed(entry: ScheduleEntry): entry is VirtualFixedReservation {
  return 'isFixed' in entry && entry.isFixed === true;
}

// ── visual styles ─────────────────────────────────────────────────────────────

function cellStyle(entry: ScheduleEntry): string {
  if (isVirtualFixed(entry)) {
    if (entry.paymentStatus === 'paid') {
      return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white border-dashed cursor-pointer';
    }
    return 'bg-purple-100 border-purple-400 text-purple-900 border-dashed hover:bg-purple-200 cursor-pointer';
  }
  const r = entry as Reservation;
  if (r.paymentStatus === 'paid')    return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white border-solid';
  if (r.paymentStatus === 'partial') return 'bg-orange-200  hover:bg-orange-300  border-orange-400  text-orange-900 border-solid';
  return                                    'bg-amber-100   hover:bg-amber-200   border-amber-400   text-amber-900  border-solid';
}

// ── Cell ──────────────────────────────────────────────────────────────────────

const EMPTY_STYLE = 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400 border-solid';

interface CellProps {
  entry: ScheduleEntry | undefined;
  onClick: () => void;
}

function Cell({ entry, onClick }: CellProps) {
  if (!entry) {
    return (
      <button
        onClick={onClick}
        className={`w-full h-8 rounded border text-xs font-medium transition-all duration-150 ${EMPTY_STYLE}`}
      >
        <span className="opacity-30 text-lg">+</span>
      </button>
    );
  }

  const fixed = isVirtualFixed(entry);

  const total     = entry.totalPrice     != null ? parseFloat(entry.totalPrice)     : 0;
  const deposit   = entry.depositAmount  != null ? parseFloat(entry.depositAmount)  : 0;
  const remaining = total - deposit;
  const fullyPaid = !fixed && (entry as Reservation).paymentStatus === 'paid' || (total > 0 && remaining <= 0);

  const timeRange = `${toHHMM(entry.timeStart)} – ${toHHMM(entry.timeEnd)}`;
  const isPaidStyle = !fixed && (entry as Reservation).paymentStatus === 'paid';

  return (
    <button
      onClick={onClick}
      className={`w-full h-full min-h-[32px] rounded border text-left transition-all duration-150 relative
        ${fixed ? '' : 'shadow-sm hover:shadow-md'}
        ${cellStyle(entry)}`}
    >
      <span className="flex flex-col h-full leading-tight px-2 py-1.5 overflow-hidden">
        {/* client name + "Fijo" badge */}
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold truncate text-[13px]">{entry.clientName}</span>
          {fixed && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide
                             bg-purple-200 text-purple-700 border border-purple-300
                             px-1.5 py-px rounded-full leading-none">
              Fijo
            </span>
          )}
        </span>

        <span className={`text-[10px] font-normal mt-0.5 ${isPaidStyle ? 'opacity-80' : 'opacity-70'}`}>
          {timeRange}
        </span>

        {/* financial summary — only for normal reservations */}
        {!fixed && (
          <span className="flex flex-col mt-1 gap-px text-[10px] font-normal">
            {total > 0 && <span>{formatCurrency(total)} total</span>}
            {deposit > 0 && <span>Seña: {formatCurrency(deposit)}</span>}
            {fullyPaid ? (
              <span className={`font-semibold ${isPaidStyle ? 'text-white' : 'text-emerald-700'}`}>
                Pagado ✓
              </span>
            ) : total > 0 && (
              <span className="font-semibold text-red-600">
                Falta: {formatCurrency(remaining)}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

// ── ScheduleGrid ──────────────────────────────────────────────────────────────

interface Props {
  date: string;
  courts: Court[];
  clubId: number | null;
  refreshKey?: number;
  isOwner?: boolean;
  onCellClick: (courtId: number, slot: TimeSlot, reservation?: Reservation) => void;
  onFixedClick?: (entry: VirtualFixedReservation) => void;
  onDeleteCourt?: (id: number) => Promise<void>;
  onRenameCourt?: (id: number, name: string) => Promise<void>;
}

export default function ScheduleGrid({
  date,
  courts,
  clubId,
  refreshKey = 0,
  isOwner = false,
  onCellClick,
  onFixedClick,
  onDeleteCourt,
  onRenameCourt,
}: Props) {
  const [entries,  setEntries]  = useState<ScheduleEntry[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // delete court modal state
  const [pendingDelete,  setPendingDelete]  = useState<Court | null>(null);
  const [deletingCourt,  setDeletingCourt]  = useState(false);

  // rename court modal state
  const [pendingRename,  setPendingRename]  = useState<Court | null>(null);
  const [renameValue,    setRenameValue]    = useState('');
  const [renameSaving,   setRenameSaving]   = useState(false);
  const [renameError,    setRenameError]    = useState('');

  const renameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pendingRename) renameInputRef.current?.focus();
  }, [pendingRename]);

  useEffect(() => {
    if (clubId === null || clubId === undefined) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getSchedule(date, clubId)
      .then(({ reservations, fixedReservations }) => {
        if (cancelled) return;

        // Transform fixed reservations into virtual entries
        const virtual = fixedReservations.map((f) => toVirtual(f, date));

        // Merge and sort by courtId then timeStart (virtual minutes)
        const merged: ScheduleEntry[] = [...reservations, ...virtual].sort((a, b) => {
          if (a.courtId !== b.courtId) return a.courtId - b.courtId;
          return toVirtualMinutes(a.timeStart) - toVirtualMinutes(b.timeStart);
        });

        setEntries(merged);
      })
      .catch(() => {
        if (!cancelled) setError('Error al cargar las reservas.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [date, clubId, refreshKey]);

  if (loading) {
    return <p className="text-center text-gray-400 py-16">Cargando…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
        {error}
      </p>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">No hay canchas disponibles.</p>
        {isOwner && (
          <p className="text-sm text-gray-400 mt-1">
            Usá el botón <strong>"Agregar cancha"</strong> para crear la primera.
          </p>
        )}
      </div>
    );
  }

  const colWidth = courts.length <= 4 ? 'min-w-[160px]' : courts.length <= 8 ? 'min-w-[130px]' : 'min-w-[110px]';

  async function confirmDelete() {
    if (!pendingDelete || !onDeleteCourt) return;
    setDeletingCourt(true);
    try {
      await onDeleteCourt(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeletingCourt(false);
    }
  }

  async function confirmRename(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingRename || !onRenameCourt) return;
    if (!renameValue.trim()) { setRenameError('El nombre es requerido.'); return; }
    setRenameSaving(true);
    setRenameError('');
    try {
      await onRenameCourt(pendingRename.id, renameValue.trim());
      setPendingRename(null);
    } catch (err: unknown) {
      setRenameError(err instanceof Error ? err.message : 'Error al renombrar.');
    } finally {
      setRenameSaving(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="min-w-full border-separate border-spacing-1">
          <thead>
            <tr>
              {/* Sticky time header */}
              <th className="sticky left-0 z-20 bg-white w-14 text-xs text-gray-400 font-normal text-right pr-2">
                Hora
              </th>
              {courts.map((court) => (
                <th
                  key={court.id}
                  className={`${colWidth} text-sm font-semibold text-center text-gray-700 pb-1 group`}
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="truncate">{court.name}</span>
                    {isOwner && (
                      <>
                        {onRenameCourt && (
                          <button
                            onClick={() => {
                              setPendingRename(court);
                              setRenameValue(court.name);
                              setRenameError('');
                            }}
                            title={`Renombrar ${court.name}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 p-0.5 rounded
                                       text-gray-300 hover:text-indigo-500 hover:bg-indigo-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {onDeleteCourt && (
                          <button
                            onClick={() => setPendingDelete(court)}
                            title={`Eliminar ${court.name}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 p-0.5 rounded
                                       text-gray-300 hover:text-red-500 hover:bg-red-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <tr key={slot}>
                {/* Sticky time cell */}
                <td className="sticky left-0 z-10 bg-white text-xs text-gray-400 text-right pr-2 align-top pt-1 whitespace-nowrap shadow-[1px_0_0_0_#f1f5f9]">
                  {slot}
                </td>
                {courts.map((court) => {
                  const entry = entries.find(
                    (e) => e.courtId === court.id && coversSlot(e, slot),
                  );

                  // Cell already covered by a rowSpan → omit TD
                  if (entry && !isFirstCoveredSlot(entry, slot)) {
                    return null;
                  }

                  const span = entry ? getRowSpan(entry) : 1;

                  const handleClick = entry && isVirtualFixed(entry)
                    ? () => onFixedClick?.(entry)
                    : () => onCellClick(court.id, slot, entry as Reservation | undefined);

                  return (
                    <td key={court.id} rowSpan={span > 1 ? span : undefined} className="align-stretch">
                      <Cell entry={entry} onClick={handleClick} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Delete Court Modal ── */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Eliminar cancha</h2>
            <p className="text-sm text-gray-500 mb-6">
              ¿Estás seguro? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingCourt}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600
                           hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingCourt}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium
                           hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deletingCourt ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename Court Modal ── */}
      {pendingRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Renombrar cancha</h2>
            <form onSubmit={confirmRename} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none
                             focus:ring-2 focus:ring-indigo-400"
                />
                {renameError && <p className="text-xs text-red-600 mt-1">{renameError}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingRename(null)}
                  disabled={renameSaving}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600
                             hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={renameSaving}
                  className="flex-1 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium
                             hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {renameSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
