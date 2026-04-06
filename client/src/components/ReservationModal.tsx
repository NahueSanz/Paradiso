import { useEffect, useRef, useState } from 'react';
import type { Reservation, ReservationStatus, TimeSlot } from '../types';

export interface ModalState {
  courtId: number;
  date: string;
  slot: TimeSlot;
  reservation?: Reservation;
}

interface Props {
  state: ModalState;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export interface FormData {
  courtId: number;
  date: string;
  timeStart: string;
  timeEnd: string;
  clientName: string;
  clientPhone: string;
  depositAmount: string;
  status?: ReservationStatus;
}

// "HH:MM" → "HH:MM" (pass-through); used to build default end from slot
function nextHour(slot: TimeSlot): string {
  const h = parseInt(slot.slice(0, 2), 10);
  return `${String(h + 1).padStart(2, '0')}:00`;
}

function isoToHHMM(iso: string): string {
  return iso.slice(11, 16);
}

const STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'cancelled'];

export default function ReservationModal({ state, onClose, onSave, onDelete }: Props) {
  const { reservation, courtId, date, slot } = state;
  const isEdit = !!reservation;

  const [timeStart, setTimeStart] = useState(
    reservation ? isoToHHMM(reservation.timeStart) : slot,
  );
  const [timeEnd, setTimeEnd] = useState(
    reservation ? isoToHHMM(reservation.timeEnd) : nextHour(slot),
  );
  const [clientName, setClientName] = useState(reservation?.clientName ?? '');
  const [clientPhone, setClientPhone] = useState(reservation?.clientPhone ?? '');
  const [depositAmount, setDepositAmount] = useState(reservation?.depositAmount ?? '');
  const [status, setStatus] = useState<ReservationStatus>(reservation?.status ?? 'pending');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({
        courtId,
        date,
        timeStart,
        timeEnd,
        clientName,
        clientPhone,
        depositAmount: depositAmount.toString(),
        ...(isEdit ? { status } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!reservation) return;
    if (!confirm('Delete this reservation?')) return;
    setSaving(true);
    try {
      await onDelete(reservation.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">
          {isEdit ? 'Edit Reservation' : 'New Reservation'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Time row */}
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-xs text-gray-500 mb-1">Start</span>
              <input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </label>
            <label className="flex-1">
              <span className="block text-xs text-gray-500 mb-1">End</span>
              <input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </label>
          </div>

          {/* Client name */}
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Client name</span>
            <input
              ref={nameRef}
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="John Doe"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </label>

          {/* Phone + deposit */}
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-xs text-gray-500 mb-1">Phone</span>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
            <label className="flex-1">
              <span className="block text-xs text-gray-500 mb-1">Deposit (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <label className="block">
              <span className="block text-xs text-gray-500 mb-1">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReservationStatus)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="text-sm text-red-500 hover:text-red-700 mr-auto"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
