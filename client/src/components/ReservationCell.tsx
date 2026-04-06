import type { Reservation, TimeSlot } from '../types';

interface Props {
  courtId: number;
  slot: TimeSlot;
  reservation: Reservation | undefined;
  onClick: () => void;
}

const STATUS_STYLES = {
  available: 'bg-green-100 hover:bg-green-200 text-green-800',
  pending:   'bg-yellow-100 hover:bg-yellow-200 text-yellow-800',
  confirmed: 'bg-red-100 hover:bg-red-200 text-red-800',
  cancelled: 'bg-gray-100 hover:bg-gray-200 text-gray-500 line-through',
} as const;

// Extract "HH:MM" from an ISO time string like "1970-01-01T08:00:00.000Z"
function isoToHHMM(iso: string): string {
  return iso.slice(11, 16);
}

export default function ReservationCell({ reservation, onClick }: Props) {
  const status = reservation?.status ?? 'available';
  const style = STATUS_STYLES[status];

  return (
    <button
      onClick={onClick}
      className={`w-full h-14 rounded border border-white text-xs font-medium transition-colors ${style}`}
    >
      {reservation ? (
        <span className="flex flex-col items-center leading-tight">
          <span>{reservation.clientName}</span>
          <span className="opacity-70">
            {isoToHHMM(reservation.timeStart)}–{isoToHHMM(reservation.timeEnd)}
          </span>
        </span>
      ) : (
        <span className="opacity-40">+</span>
      )}
    </button>
  );
}
