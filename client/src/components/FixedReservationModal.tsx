import { useRef, useState, useEffect } from 'react';
import type { Court, VirtualFixedReservation } from '../types';
import {
  createFixedReservation,
  deleteFixedReservation,
  updateFixedReservation,
  payFixedReservation,
} from '../api';

// ── constants ─────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { label: 'Domingo',   value: 0 },
  { label: 'Lunes',     value: 1 },
  { label: 'Martes',    value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves',    value: 4 },
  { label: 'Viernes',   value: 5 },
  { label: 'Sábado',    value: 6 },
];

const RESERVATION_TYPES = [
  { value: 'booking',    label: 'Partido' },
  { value: 'class',      label: 'Clase' },
  { value: 'tournament', label: 'Torneo' },
  { value: 'challenge',  label: 'Desafío' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  const endH   = Math.floor(total / 60) % 24;
  const endM   = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/** Parses a price string from state: '' → undefined, otherwise → number */
function parsePrice(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Props {
  courts: Court[];
  /** When provided, the modal opens in edit mode pre-filled with this data. */
  editData?: VirtualFixedReservation;
  /** ISO date string (YYYY-MM-DD) of the currently viewed date, used to detect same-day payment. */
  selectedDate?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FormErrors {
  courtId?:       string;
  timeStart?:     string;
  duration?:      string;
  clientName?:    string;
  totalPrice?:    string;
  depositAmount?: string;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function FixedReservationModal({ courts, editData, selectedDate, onClose, onSuccess }: Props) {
  const isEditMode = editData !== undefined;

  // In edit mode, courtId and dayOfWeek are fixed (read-only)
  const [courtId,       setCourtId]       = useState<number | ''>(
    isEditMode ? editData.courtId : (courts.length === 1 ? courts[0].id : ''),
  );
  const [dayOfWeek,     setDayOfWeek]     = useState<number>(
    isEditMode ? editData.dayOfWeek : 1,
  );
  const [timeStart,     setTimeStart]     = useState(isEditMode ? editData.timeStart : '09:00');
  const [duration,      setDuration]      = useState<number | ''>(
    isEditMode ? editData.duration : '',
  );
  const [clientName,    setClientName]    = useState(isEditMode ? editData.clientName : '');
  const [type,          setType]          = useState(isEditMode ? (editData.type ?? '') : '');
  const [totalPrice,    setTotalPrice]    = useState(
    isEditMode && editData.totalPrice != null ? editData.totalPrice : '',
  );
  const [depositAmount, setDepositAmount] = useState(
    isEditMode && editData.depositAmount != null ? editData.depositAmount : '',
  );

  const [fieldErrors,   setFieldErrors]   = useState<FormErrors>({});
  const [submitError,   setSubmitError]   = useState('');
  const [conflictError, setConflictError] = useState(false);
  const [busy,          setBusy]          = useState(false);

  // ── payment panel state (edit mode only) ──────────────────────────────────
  const [isLastWeek,    setIsLastWeek]    = useState(false);
  const [payError,      setPayError]      = useState('');
  const [payBusy,       setPayBusy]       = useState(false);
  const [justPaid, setJustPaid] = useState<number | null>(null);

  // ── delete confirmation state ──────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy,        setDeleteBusy]        = useState(false);
  const [deleteError,       setDeleteError]        = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleRegisterPayment() {
    if (!isEditMode || !editData) return;
    setPayError('');
    setPayBusy(true);
    try {
      const result = await payFixedReservation(editData.rawId, isLastWeek);
      setJustPaid(result.todayPays);
      onSuccess('Pago registrado correctamente.');
      onClose();
    } catch (err) {
      setPayError((err as Error).message || 'Error al registrar el pago.');
    } finally {
      setPayBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEditMode || !editData) return;
    setDeleteError('');
    setDeleteBusy(true);
    try {
      await deleteFixedReservation(editData.rawId);
      onSuccess('Turno fijo eliminado correctamente.');
      onClose();
    } catch (err) {
      setDeleteError((err as Error).message || 'Error al eliminar el turno fijo.');
      setDeleteBusy(false);
    }
  }

  function validate(): boolean {
    const errs: FormErrors = {};

    if (!isEditMode && courtId === '') errs.courtId = 'Seleccioná una cancha.';
    if (!timeStart)                    errs.timeStart = 'Ingresá un horario.';
    if (duration === '' || duration <= 0) errs.duration = 'La duración debe ser mayor a 0.';
    if (!clientName.trim())            errs.clientName = 'El nombre del cliente es requerido.';

    const parsedTotal   = parsePrice(totalPrice);
    const parsedDeposit = parsePrice(depositAmount);

    if (totalPrice.trim() !== '' && (parsedTotal === null || parsedTotal < 0)) {
      errs.totalPrice = 'El precio debe ser un número >= 0.';
    }
    if (depositAmount.trim() !== '' && (parsedDeposit === null || parsedDeposit < 0)) {
      errs.depositAmount = 'La seña debe ser un número >= 0.';
    }
    if (parsedTotal !== null && parsedDeposit !== null && parsedDeposit > parsedTotal) {
      errs.depositAmount = 'La seña no puede superar el precio total.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setConflictError(false);
    if (!validate()) return;

    const parsedDuration = Number(duration);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      setSubmitError('Duración inválida');
      return;
    }

    const parsedTotal   = parsePrice(totalPrice);
    const parsedDeposit = parsePrice(depositAmount);

    setBusy(true);
    try {
      if (isEditMode) {
        await updateFixedReservation(editData.rawId, {
          clientName:    clientName.trim(),
          timeStart,
          duration:      parsedDuration,
          type:          type || null,
          totalPrice:    parsedTotal,
          depositAmount: parsedDeposit,
        });
        onSuccess('Turno fijo actualizado correctamente.');
      } else {
        await createFixedReservation({
          courtId:   courtId as number,
          dayOfWeek,
          timeStart,
          duration:  parsedDuration,
          clientName: clientName.trim(),
          ...(type ? { type } : {}),
          ...(parsedTotal   != null ? { totalPrice:    parsedTotal   } : {}),
          ...(parsedDeposit != null ? { depositAmount: parsedDeposit } : {}),
        });
        onSuccess('Turno fijo creado correctamente.');
      }
      onClose();
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (
        msg.toLowerCase().includes('conflict') ||
        msg.toLowerCase().includes('overlap')  ||
        msg.toLowerCase().includes('superposi') ||
        msg.startsWith('HTTP 400') ||
        msg.startsWith('HTTP 409')
      ) {
        setConflictError(true);
      } else {
        setSubmitError(msg || (isEditMode ? 'Error al actualizar el turno fijo.' : 'Error al crear el turno fijo.'));
      }
    } finally {
      setBusy(false);
    }
  }

  const hasFieldError = Object.keys(fieldErrors).length > 0;

  const editCourtName  = isEditMode ? (courts.find((c) => c.id === editData.courtId)?.name ?? `Cancha #${editData.courtId}`) : '';
  const editDayLabel   = isEditMode ? (DAYS_OF_WEEK.find((d) => d.value === editData.dayOfWeek)?.label ?? '') : '';

  // ── payment panel calculations ────────────────────────────────────────────
  const payPricePerSlot  = isEditMode ? (parseFloat(String(editData.totalPrice   ?? '0')) || 0) : 0;
  const payDeposit       = isEditMode ? (parseFloat(String(editData.depositAmount ?? '0')) || 0) : 0;
  const payCarryOver     = isEditMode ? (parseFloat(String(editData.carryOver     ?? '0')) || 0) : 0;
  const paidToday = isEditMode
    ? (editData.lastPaidAt != null && selectedDate != null && editData.lastPaidAt.slice(0, 10) === selectedDate)
    : false;

  const todayPays = paidToday
    ? 0
    : isLastWeek
      ? payPricePerSlot - payCarryOver
      : payPricePerSlot;

  // ── delete confirmation modal ─────────────────────────────────────────────
  if (showDeleteConfirm) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onMouseDown={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-in fade-in zoom-in-95 duration-150">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Eliminar turno fijo</h2>
          <p className="text-sm text-gray-500 mb-1">
            ¿Seguro que querés eliminar este turno fijo?
          </p>
          <p className="text-xs text-gray-400 mb-5">
            Las reservas pasadas no se verán afectadas. Esta acción no se puede deshacer.
          </p>

          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {deleteError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
              disabled={deleteBusy}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600
                         hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteBusy}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white
                         hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {deleteBusy ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-150">

        {/* ── header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                {isEditMode ? 'Editar Reserva Fija' : 'Reserva Fija'}
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 tracking-wide">
                FIJO
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Aplica desde hoy en adelante
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-2xl leading-none -mt-1 -mr-1 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── form ── */}
        <form id="fixed-reservation-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Court — read-only in edit mode */}
          {isEditMode ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cancha</label>
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {editCourtName}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Cancha <span className="text-red-400">*</span>
              </label>
              <select
                value={courtId}
                onChange={(e) => setCourtId(e.target.value === '' ? '' : Number(e.target.value))}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2
                  focus:ring-indigo-400 transition-shadow ${fieldErrors.courtId ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">Seleccioná una cancha</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.courtId && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.courtId}</p>
              )}
            </div>
          )}

          {/* Day of week — read-only in edit mode */}
          {isEditMode ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Día de la semana</label>
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {editDayLabel}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Día de la semana <span className="text-red-400">*</span>
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              >
                {DAYS_OF_WEEK.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Time start + Duration */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Hora inicio <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  focus:ring-indigo-400 transition-shadow ${fieldErrors.timeStart ? 'border-red-400' : 'border-gray-300'}`}
              />
              {fieldErrors.timeStart && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.timeStart}</p>
              )}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Duración (min) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={duration}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuration(value === '' ? '' : Number(value));
                }}
                placeholder="90"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  focus:ring-indigo-400 transition-shadow ${fieldErrors.duration ? 'border-red-400' : 'border-gray-300'}`}
              />
              {fieldErrors.duration && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.duration}</p>
              )}
            </div>
          </div>

          {/* Time preview */}
          {timeStart && duration !== '' && duration > 0 && (
            <p className="text-xs text-indigo-600 -mt-1 font-medium">
              Horario: {timeStart} – {addMinutes(timeStart, Number(duration))}
            </p>
          )}

          {/* Client name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nombre del cliente <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Juan Pérez"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                focus:ring-indigo-400 transition-shadow ${fieldErrors.clientName ? 'border-red-400' : 'border-gray-300'}`}
            />
            {fieldErrors.clientName && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.clientName}</p>
            )}
          </div>

          {/* Type (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Tipo <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
            >
              <option value="">Sin tipo</option>
              {RESERVATION_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Pricing */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Precio total <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  focus:ring-indigo-400 transition-shadow ${fieldErrors.totalPrice ? 'border-red-400' : 'border-gray-300'}`}
              />
              {fieldErrors.totalPrice && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.totalPrice}</p>
              )}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Seña <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  focus:ring-indigo-400 transition-shadow ${fieldErrors.depositAmount ? 'border-red-400' : 'border-gray-300'}`}
              />
              {fieldErrors.depositAmount && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.depositAmount}</p>
              )}
            </div>
          </div>

          {/* Conflict error */}
          {conflictError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-lg leading-none mt-0.5" aria-hidden>⚠️</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Superposición detectada</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Este turno fijo se superpone con una reserva existente.
                </p>
              </div>
            </div>
          )}

          {/* Validation summary */}
          {hasFieldError && !conflictError && (
            <p className="text-xs text-red-500">Completá los campos requeridos.</p>
          )}

          {/* General submit error */}
          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}
        </form>

        {/* ── payment panel (edit mode only) ── */}
        {isEditMode && (
          <div className="mx-6 mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 space-y-2.5">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Pago semanal</p>

            {/* Price summary */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Precio del turno</span>
                <span className="font-semibold text-gray-800">{fmtMoney(payPricePerSlot)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seña configurada</span>
                <span className="font-semibold text-gray-800">{fmtMoney(payDeposit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seña acumulada</span>
                <span className={`font-semibold ${payCarryOver > 0 ? 'text-violet-700' : 'text-gray-400'}`}>
                  {fmtMoney(payCarryOver)}
                </span>
              </div>
            </div>

            {/* Last week toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isLastWeek}
                  onChange={(e) => setIsLastWeek(e.target.checked)}
                />
                <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-orange-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <span className="text-sm font-medium text-gray-700">Última semana</span>
            </label>

            {/* Today pays */}
            <div className="rounded-lg border border-violet-200 bg-white px-3 py-2">
              {paidToday ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✅</span>
                    <span className="text-sm font-semibold text-green-700">Pagado</span>
                  </div>
                  {payCarryOver > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔵</span>
                      <span className="text-[11px] text-gray-500">Seña aplicada a la próxima semana</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 font-medium">
                      {isLastWeek ? 'Paga hoy (usa seña)' : 'Paga hoy'}
                    </span>
                    <span className="text-lg font-bold text-violet-700">{fmtMoney(todayPays)}</span>
                  </div>
                  {isLastWeek && payCarryOver > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Se descuenta seña acumulada de {fmtMoney(payCarryOver)}
                    </p>
                  )}
                </>
              )}
            </div>

            {payError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {payError}
              </p>
            )}
          </div>
        )}

        {/* ── footer ── */}
        <div className="flex items-center gap-2 px-6 pb-5">

          {/* Delete button — left side, edit mode only */}
          {isEditMode && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={busy || payBusy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:text-red-700
                         hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Eliminar turno fijo"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>
          )}

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy || payBusy || deleteBusy}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>

            {/* Register payment button — edit mode only, inline in footer */}
            {isEditMode && (
              <button
                type="button"
                disabled={payBusy || busy}
                onClick={handleRegisterPayment}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border
                           border-violet-400 text-violet-700 hover:bg-violet-50 active:bg-violet-100
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {payBusy ? (
                  'Registrando…'
                ) : (
                  <>
                    <span>💰</span>
                    Registrar pago
                  </>
                )}
              </button>
            )}

            <button
              type="submit"
              form="fixed-reservation-form"
              disabled={busy || payBusy}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {busy
                ? 'Guardando…'
                : isEditMode
                  ? 'Guardar cambios'
                  : 'Crear turno fijo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
