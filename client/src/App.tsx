import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from './api';
import ScheduleGrid from './components/ScheduleGrid';
import ReservationModal, { type FormData, type ModalState } from './components/ReservationModal';
import type { Court, Reservation, TimeSlot } from './types';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const navigate = useNavigate();
  const [date, setDate]             = useState(todayISO());
  const [courts, setCourts]         = useState<Court[]>([]);
  const [courtError, setCourtError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal]           = useState<ModalState | null>(null);

  useEffect(() => {
    api.getCourts().then(setCourts).catch(() => setCourtError('Error al cargar las canchas.'));
  }, []);

  function refresh() { setRefreshKey((k) => k + 1); }

  function openModal(courtId: number, slot: TimeSlot, reservation?: Reservation) {
    const courtName = courts.find((c) => c.id === courtId)?.name ?? '';
    setModal({ courtId, courtName, date, slot, reservation });
  }

  async function handleSave(form: FormData) {
    const base = {
      clientName: form.clientName,
      timeStart:  form.timeStart,
      timeEnd:    form.timeEnd,
      ...(form.type          ? { type: form.type }                               : {}),
      ...(form.totalPrice    ? { totalPrice: parseFloat(form.totalPrice) }       : {}),
      ...(form.depositAmount ? { depositAmount: parseFloat(form.depositAmount) } : {}),
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

  const legend = [
    { label: 'Disponible',  className: 'bg-gray-200' },
    { label: 'Pendiente',   className: 'bg-yellow-300' },
    { label: 'Seña',        className: 'bg-amber-300' },
    { label: 'Pagado',      className: 'bg-green-300' },
    { label: 'Finalizado',  className: 'bg-gray-400' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-indigo-700 tracking-tight">Padel Paradiso</h1>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-indigo-600
                       px-3 py-1.5 rounded-lg hover:bg-indigo-50 border border-transparent
                       hover:border-indigo-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </button>
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
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
