import { useCallback, useEffect, useState } from 'react';
import * as api from './api';
import ReservationGrid from './components/ReservationGrid';
import ReservationModal, { type FormData, type ModalState } from './components/ReservationModal';
import type { Court, Reservation, TimeSlot } from './types';

// Time slots: 08:00 → 21:00 (each row is 1 hour)
const SLOTS: TimeSlot[] = Array.from({ length: 14 }, (_, i) =>
  `${String(i + 8).padStart(2, '0')}:00`,
);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [date, setDate] = useState(todayISO());
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);

  // Load courts once
  useEffect(() => {
    api.getCourts().then(setCourts).catch(() => setError('Failed to load courts'));
  }, []);

  // Load reservations when date changes
  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getReservations(date);
      setReservations(data);
    } catch {
      setError('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadReservations(); }, [loadReservations]);

  function openModal(courtId: number, slot: TimeSlot, reservation?: Reservation) {
    setModal({ courtId, date, slot, reservation });
  }

  async function handleSave(form: FormData) {
    const payload = {
      courtId: form.courtId,
      date: form.date,
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      clientName: form.clientName,
      ...(form.clientPhone ? { clientPhone: form.clientPhone } : {}),
      ...(form.depositAmount ? { depositAmount: parseFloat(form.depositAmount) } : {}),
    };

    if (modal?.reservation) {
      await api.updateReservation(modal.reservation.id, { ...payload, status: form.status });
    } else {
      await api.createReservation(payload);
    }
    await loadReservations();
  }

  async function handleDelete(id: number) {
    await api.deleteReservation(id);
    await loadReservations();
  }

  const legend = [
    { label: 'Available', className: 'bg-green-200' },
    { label: 'Pending',   className: 'bg-yellow-200' },
    { label: 'Confirmed', className: 'bg-red-200' },
    { label: 'Cancelled', className: 'bg-gray-200' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-indigo-700 tracking-tight">Padel Paradiso</h1>

        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-600">
            {legend.map(({ label, className }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`inline-block w-3 h-3 rounded-sm ${className}`} />
                {label}
              </span>
            ))}
          </div>

          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 p-4 sm:p-6">
        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading…</p>
        ) : (
          <ReservationGrid
            courts={courts}
            reservations={reservations}
            slots={SLOTS}
            onCellClick={openModal}
          />
        )}
      </main>

      {/* Modal */}
      {modal && (
        <ReservationModal
          state={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
