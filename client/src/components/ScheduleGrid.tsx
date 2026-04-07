import { useEffect, useState } from 'react';
import { getReservations } from '../api';
import type { Court, Reservation, TimeSlot } from '../types';

const SLOTS: TimeSlot[] = Array.from({ length: 16 }, (_, i) =>
  `${String(i + 8).padStart(2, '0')}:00`,
);

// ── helpers ───────────────────────────────────────────────────────────────────

function coversSlot(r: Reservation, slot: TimeSlot): boolean {
  const slotH  = parseInt(slot.slice(0, 2), 10);
  const startH = parseInt(r.timeStart.slice(11, 13), 10);
  const endH   = parseInt(r.timeEnd.slice(11, 13), 10);
  return startH < slotH + 1 && endH > slotH;
}

function isoToHHMM(iso: string): string {
  return iso.slice(11, 16);
}

// ── color logic ───────────────────────────────────────────────────────────────
//
//  Priority (highest first):
//    playing  → blue   — court is in use right now
//    paid     → red    — fully paid, confirmed
//    partial  → yellow — deposit only
//    pending  → indigo — booked, nothing paid
//    finished → gray   — done

interface CellStyle {
  cell: string;
  badge: string;
  label: string;
}

function resolvStyle(r: Reservation): CellStyle {
  if (r.playStatus === 'playing') {
    return {
      cell:  'bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-900',
      badge: 'bg-blue-500 text-white',
      label: 'Playing',
    };
  }
  if (r.playStatus === 'finished') {
    return {
      cell:  'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-400',
      badge: 'bg-gray-400 text-white',
      label: 'Done',
    };
  }
  if (r.paymentStatus === 'paid') {
    return {
      cell:  'bg-red-100 hover:bg-red-200 border-red-300 text-red-900',
      badge: 'bg-red-500 text-white',
      label: 'Paid',
    };
  }
  if (r.paymentStatus === 'partial') {
    return {
      cell:  'bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-900',
      badge: 'bg-yellow-500 text-white',
      label: 'Partial',
    };
  }
  // pending + scheduled
  return {
    cell:  'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800',
    badge: 'bg-indigo-400 text-white',
    label: 'Pending',
  };
}

// ── cell ──────────────────────────────────────────────────────────────────────

const EMPTY_STYLE = 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700';

interface CellProps {
  reservation: Reservation | undefined;
  onClick: () => void;
}

function Cell({ reservation, onClick }: CellProps) {
  if (!reservation) {
    return (
      <button
        onClick={onClick}
        className={`w-full h-14 rounded border text-xs font-medium transition-colors ${EMPTY_STYLE}`}
      >
        <span className="opacity-40 text-lg">+</span>
      </button>
    );
  }

  const { cell, badge, label } = resolvStyle(reservation);

  return (
    <button
      onClick={onClick}
      className={`w-full h-14 rounded border text-xs font-medium transition-colors relative ${cell}`}
    >
      {/* status badge — top-right corner */}
      <span className={`absolute top-1 right-1 text-[10px] px-1 py-px rounded font-semibold leading-none ${badge}`}>
        {label}
      </span>

      <span className="flex flex-col items-center justify-center h-full leading-tight px-1 pt-2">
        <span className="font-semibold truncate max-w-full">{reservation.clientName}</span>
        <span className="opacity-60 mt-0.5">
          {isoToHHMM(reservation.timeStart)}–{isoToHHMM(reservation.timeEnd)}
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
      .catch(() => { if (!cancelled) setError('Failed to load reservations.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [date, refreshKey]);

  if (loading) {
    return <p className="text-center text-gray-400 py-16">Loading…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
        {error}
      </p>
    );
  }

  if (courts.length === 0) {
    return <p className="text-center text-gray-400 py-16">No courts available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-16 text-xs text-gray-400 font-normal text-right pr-2">Time</th>
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
              <td className="text-xs text-gray-400 text-right pr-2 align-middle whitespace-nowrap">
                {slot}
              </td>
              {courts.map((court) => {
                const reservation = reservations.find(
                  (r) => r.courtId === court.id && coversSlot(r, slot),
                );
                return (
                  <td key={court.id}>
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
