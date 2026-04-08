import { useEffect, useState } from 'react';
import { getReservations } from '../api';
import type { Court, Reservation, TimeSlot } from '../types';

// 30-min slots from 08:00 to 23:00 (30 slots)
const SLOTS: TimeSlot[] = Array.from({ length: 30 }, (_, i) => {
  const total = 8 * 60 + i * 30;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

// ── helpers ───────────────────────────────────────────────────────────────────

function toMinutes(iso: string): number {
  const h = parseInt(iso.slice(11, 13), 10);
  const m = parseInt(iso.slice(14, 16), 10);
  return h * 60 + m;
}

function slotToMinutes(slot: TimeSlot): number {
  const [h, m] = slot.split(':').map(Number);
  return h * 60 + m;
}

function coversSlot(r: Reservation, slot: TimeSlot): boolean {
  const slotStart = slotToMinutes(slot);
  const slotEnd   = slotStart + 30;
  const startMin  = toMinutes(r.timeStart);
  const endMin    = toMinutes(r.timeEnd);
  return startMin < slotEnd && endMin > slotStart;
}

/** True only for the first slot the reservation occupies. */
function isFirstCoveredSlot(r: Reservation, slot: TimeSlot): boolean {
  const slotStart = slotToMinutes(slot);
  const startMin  = toMinutes(r.timeStart);
  return startMin >= slotStart && startMin < slotStart + 30;
}

/** Number of 30-min rows this reservation spans. */
function getRowSpan(r: Reservation): number {
  return SLOTS.filter((s) => coversSlot(r, s)).length;
}

function isoToHHMM(iso: string): string {
  return iso.slice(11, 16);
}

function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-AR')}`;
}

// ── color logic ───────────────────────────────────────────────────────────────

function cellBg(r: Reservation): string {
  if (r.playStatus === 'finished') {
    return 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-500';
  }
  if (r.paymentStatus === 'paid') {
    return 'bg-green-100 hover:bg-green-200 border-green-400 text-green-900';
  }
  if (r.paymentStatus === 'partial') {
    return 'bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-900';
  }
  return 'bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-yellow-900';
}

// ── cell ──────────────────────────────────────────────────────────────────────

const EMPTY_STYLE = 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-400';

interface CellProps {
  reservation: Reservation | undefined;
  onClick: () => void;
}

function Cell({ reservation, onClick }: CellProps) {
  if (!reservation) {
    return (
      <button
        onClick={onClick}
        className={`w-full h-8 rounded border text-xs font-medium transition-all duration-150 ${EMPTY_STYLE}`}
      >
        <span className="opacity-30 text-lg">+</span>
      </button>
    );
  }

  const total     = parseFloat(reservation.totalPrice    ?? '0') || 0;
  const deposit   = parseFloat(reservation.depositAmount ?? '0') || 0;
  const remaining = total - deposit;
  const fullyPaid = reservation.paymentStatus === 'paid' || (total > 0 && remaining <= 0);

  const timeRange = `${isoToHHMM(reservation.timeStart)} – ${isoToHHMM(reservation.timeEnd)}`;

  return (
    <button
      onClick={onClick}
      className={`w-full h-full min-h-[32px] rounded border text-left transition-all duration-150 relative shadow-sm hover:shadow-md ${cellBg(reservation)}`}
    >
      <span className="flex flex-col h-full leading-tight px-2 py-1.5 overflow-hidden">
        <span className="font-bold truncate text-[13px]">
          {reservation.clientName}
        </span>
        <span className="text-[10px] font-normal opacity-70 mt-0.5">
          {timeRange}
        </span>
        <span className="flex flex-col mt-1 gap-px text-[10px] font-normal">
          <span>Total: {formatCurrency(total)}</span>
          <span>Seña: {formatCurrency(deposit)}</span>
          {fullyPaid ? (
            <span className="font-semibold text-green-600">Pagado ✓</span>
          ) : (
            <span className="font-semibold text-red-500">Falta: {formatCurrency(remaining)}</span>
          )}
        </span>
      </span>
    </button>
  );
}

// ── grid ──────────────────────────────────────────────────────────────────────

interface Props {
  date: string;
  courts: Court[];
  refreshKey?: number;
  onCellClick: (courtId: number, slot: TimeSlot, reservation?: Reservation) => void;
}

export default function ScheduleGrid({ date, courts, refreshKey = 0, onCellClick }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getReservations(date)
      .then((data) => { if (!cancelled) setReservations(data); })
      .catch(() => { if (!cancelled) setError('Error al cargar las reservas.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [date, refreshKey]);

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
    return <p className="text-center text-gray-400 py-16">No hay canchas disponibles.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-16 text-xs text-gray-400 font-normal text-right pr-2">Hora</th>
            {courts.map((court) => (
              <th key={court.id} className="text-sm font-semibold text-center text-gray-700 pb-1 min-w-[120px]">
                {court.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <td className="text-xs text-gray-400 text-right pr-2 align-top pt-4 whitespace-nowrap">
                {slot}
              </td>
              {courts.map((court) => {
                const reservation = reservations.find(
                  (r) => r.courtId === court.id && coversSlot(r, slot),
                );

                // Slot is already covered by a rowSpan from the first row → skip TD entirely
                if (reservation && !isFirstCoveredSlot(reservation, slot)) {
                  return null;
                }

                const span = reservation ? getRowSpan(reservation) : 1;

                return (
                  <td key={court.id} rowSpan={span > 1 ? span : undefined} className="align-stretch">
                    <Cell
                      reservation={reservation}
                      onClick={() => onCellClick(court.id, slot, reservation)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
