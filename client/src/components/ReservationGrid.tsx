import type { Court, Reservation, TimeSlot } from '../types';
import ReservationCell from './ReservationCell';

interface Props {
  courts: Court[];
  reservations: Reservation[];
  slots: TimeSlot[];
  onCellClick: (courtId: number, slot: TimeSlot, reservation?: Reservation) => void;
}

// Returns true if the reservation covers the given hour slot ("HH:00")
function coversSlot(reservation: Reservation, slot: TimeSlot): boolean {
  const slotH = parseInt(slot.slice(0, 2), 10);
  const startH = parseInt(reservation.timeStart.slice(11, 13), 10);
  const endH   = parseInt(reservation.timeEnd.slice(11, 13), 10);
  // Slot H is covered if startH < H+1 AND endH > H
  return startH < slotH + 1 && endH > slotH;
}

export default function ReservationGrid({ courts, reservations, slots, onCellClick }: Props) {
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
              <th key={court.id} className="text-sm font-semibold text-center text-gray-700 pb-1">
                {court.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
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
                    <ReservationCell
                      courtId={court.id}
                      slot={slot}
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
