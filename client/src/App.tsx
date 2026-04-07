import { useEffect, useState } from 'react';
import * as api from './api';
import ScheduleGrid from './components/ScheduleGrid';
import ReservationModal, { type FormData, type ModalState } from './components/ReservationModal';
import type { Court, Reservation, TimeSlot } from './types';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextHour(slot: TimeSlot): string {
  const h = parseInt(slot.slice(0, 2), 10);
  return `${String(h + 1).padStart(2, '0')}:00`;
}

export default function App() {
  const [date, setDate]             = useState(todayISO());
  const [courts, setCourts]         = useState<Court[]>([]);
  const [courtError, setCourtError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal]           = useState<ModalState | null>(null);

  useEffect(() => {
    api.getCourts().then(setCourts).catch(() => setCourtError('Failed to load courts.'));
  }, []);

  function refresh() { setRefreshKey((k) => k + 1); }

  function openModal(courtId: number, slot: TimeSlot, reservation?: Reservation) {
    const courtName = courts.find((c) => c.id === courtId)?.name ?? '';
    setModal({ courtId, courtName, date, slot, reservation });
  }

  async function handleSave(form: FormData) {
    const base = {
      clientName: form.clientName,
      ...(form.type         ? { type: form.type }                          : {}),
      ...(form.totalPrice   ? { totalPrice: parseFloat(form.totalPrice) }  : {}),
      ...(form.depositAmount ? { depositAmount: parseFloat(form.depositAmount) } : {}),
    };

    if (modal?.reservation) {
      await api.updateReservation(modal.reservation.id, base);
    } else {
      await api.createReservation({
        courtId:   modal!.courtId,
        date:      modal!.date,
        timeStart: modal!.slot,
        timeEnd:   nextHour(modal!.slot),
        ...base,
      });
    }
    refresh();
  }

  async function handleMarkPaid(id: number) {
    await api.updateReservation(id, { paymentStatus: 'paid' });
    refresh();
  }

  async function handleMarkPlaying(id: number) {
    await api.updateReservation(id, { playStatus: 'playing' });
    refresh();
  }

  async function handleDelete(id: number) {
    await api.deleteReservation(id);
    refresh();
  }

  const legend = [
    { label: 'Available', className: 'bg-green-200' },
    { label: 'Pending',   className: 'bg-indigo-200' },
    { label: 'Partial',   className: 'bg-yellow-200' },
    { label: 'Paid',      className: 'bg-red-200' },
    { label: 'Playing',   className: 'bg-blue-200' },
    { label: 'Done',      className: 'bg-gray-200' },
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
        {courtError && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {courtError}
          </p>
        )}

        <ScheduleGrid
          date={date}
          courts={courts}
          refreshKey={refreshKey}
          onCellClick={openModal}
        />
      </main>

      {/* Modal */}
      {modal && (
        <ReservationModal
          state={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onMarkPaid={handleMarkPaid}
          onMarkPlaying={handleMarkPlaying}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
