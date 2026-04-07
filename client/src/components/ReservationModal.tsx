import { useEffect, useRef, useState } from 'react';
import type { Reservation, TimeSlot } from '../types';

// ── public types ──────────────────────────────────────────────────────────────

export interface ModalState {
  courtId: number;
  courtName: string;
  date: string;
  slot: TimeSlot;
  reservation?: Reservation;
}

export interface FormData {
  clientName: string;
  type: string;
  totalPrice: string;
  depositAmount: string;
}

interface Props {
  state: ModalState;
  onClose: () => void;
  onSave: (form: FormData) => Promise<void>;
  onMarkPaid: (id: number) => Promise<void>;
  onMarkPlaying: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

// ── constants ─────────────────────────────────────────────────────────────────

const RESERVATION_TYPES = ['Match', 'Training', 'Class', 'Tournament', 'Other'];

// ── component ─────────────────────────────────────────────────────────────────

export default function ReservationModal({
  state,
  onClose,
  onSave,
  onMarkPaid,
  onMarkPlaying,
  onDelete,
}: Props) {
  const { reservation, courtName, date, slot } = state;
  const isEdit = !!reservation;

  const [clientName,    setClientName]    = useState(reservation?.clientName ?? '');
  const [type,          setType]          = useState(reservation?.type ?? '');
  const [totalPrice,    setTotalPrice]    = useState(reservation?.totalPrice ?? '');
  const [depositAmount, setDepositAmount] = useState(reservation?.depositAmount ?? '');
  const [error,         setError]         = useState('');
  const [busy,          setBusy]          = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function run(fn: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(() => onSave({ clientName, type, totalPrice, depositAmount }));
  }

  function handleDelete() {
    if (!reservation) return;
    if (!confirm('Delete this reservation?')) return;
    run(() => onDelete(reservation.id));
  }

  const isPaid    = reservation?.paymentStatus === 'paid';
  const isPlaying = reservation?.playStatus    === 'playing';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">

        {/* ── header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit Reservation' : 'New Reservation'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {courtName} &middot; {date} &middot; {slot}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-2xl leading-none -mt-1 -mr-1"
          >
            &times;
          </button>
        </div>

        {/* ── form ── */}
        <form id="reservation-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Client name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Client name <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select type…</option>
              {RESERVATION_TYPES.map((t) => (
                <option key={t} value={t.toLowerCase()}>{t}</option>
              ))}
            </select>
          </div>

          {/* Total price + Deposit */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Total price (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Deposit (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ── quick-action buttons (edit only) ── */}
          {isEdit && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy || isPaid}
                onClick={() => run(() => onMarkPaid(reservation!.id))}
                className="flex-1 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPaid ? 'Paid ✓' : 'Mark as Paid'}
              </button>
              <button
                type="button"
                disabled={busy || isPlaying}
                onClick={() => run(() => onMarkPlaying(reservation!.id))}
                className="flex-1 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPlaying ? 'Playing ✓' : 'Mark as Playing'}
              </button>
            </div>
          )}
        </form>

        {/* ── footer ── */}
        <div className="flex items-center gap-2 px-6 pb-5">
          {isEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              form="reservation-form"
              type="submit"
              disabled={busy}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
