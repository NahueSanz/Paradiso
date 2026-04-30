import { useRef, useState, useEffect } from 'react';
import type { Court, VirtualFixedReservation } from '../types';
import {
  cancelFixedOccurrence,
  createFixedReservation,
  deleteFixedReservation,
  payFixedReservation,
  updateFixedReservation,
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
  editData?: VirtualFixedReservation;
  selectedDate?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FormErrors {
  courtId?:       string;
  timeStart?:     string;
  duration?:      string;
  clientName?:    string;
  clientPhone?:   string;
  totalPrice?:    string;
  depositAmount?: string;
}

// ── shared field classes ──────────────────────────────────────────────────────

const fieldBase =
  'w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring transition-shadow';

// ── component ─────────────────────────────────────────────────────────────────

export default function FixedReservationModal({ courts, editData, selectedDate, onClose, onSuccess }: Props) {
  const isEditMode = editData !== undefined;

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
  const [clientPhone,   setClientPhone]   = useState(isEditMode ? (editData.clientPhone ?? '') : '');
  const [type,          setType]          = useState(isEditMode ? (editData.type ?? 'booking') : 'booking');
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

  const [isLastWeek,    setIsLastWeek]    = useState(false);
  const [payError,      setPayError]      = useState('');
  const [payBusy,       setPayBusy]       = useState(false);

  const [deleteMode,  setDeleteMode]  = useState<'none' | 'occurrence' | 'series'>('none');
  const [deleteBusy,  setDeleteBusy]  = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      await payFixedReservation(editData.rawId, isLastWeek, 'cash');
      onSuccess('Pago registrado correctamente.');
      onClose();
    } catch (err) {
      setPayError((err as Error).message || 'Error al registrar el pago.');
    } finally {
      setPayBusy(false);
    }
  }

  async function handleDeleteOccurrence() {
    if (!isEditMode || !editData) return;
    setDeleteError('');
    setDeleteBusy(true);
    try {
      await cancelFixedOccurrence(editData.rawId);
      onSuccess('Semana cancelada correctamente.');
      onClose();
    } catch (err) {
      setDeleteError((err as Error).message || 'Error al cancelar la semana.');
      setDeleteBusy(false);
    }
  }

  async function handleDeleteSeries() {
    if (!isEditMode || !editData) return;
    setDeleteError('');
    setDeleteBusy(true);
    const fromDate = selectedDate ?? new Date().toISOString().slice(0, 10);
    try {
      await deleteFixedReservation(editData.fixedReservationId, fromDate);
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
    if (clientPhone.trim() && !/^[0-9 +\-]{1,20}$/.test(clientPhone.trim())) {
      errs.clientPhone = 'Solo se permiten números, espacios, + y -.';
    }

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
        await updateFixedReservation(editData.fixedReservationId, {
          scope:         'occurrence',
          instanceId:    editData.rawId,
          clientName:    clientName.trim(),
          clientPhone:   clientPhone.trim() || null,
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
          clientPhone: clientPhone.trim() || null,
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

  const editCourtName = isEditMode ? (courts.find((c) => c.id === editData.courtId)?.name ?? `Cancha #${editData.courtId}`) : '';
  const editDayLabel  = isEditMode ? (DAYS_OF_WEEK.find((d) => d.value === editData.dayOfWeek)?.label ?? '') : '';

  const payPricePerSlot = isEditMode ? (parseFloat(String(editData.totalPrice   ?? '0')) || 0) : 0;
  const payDeposit      = isEditMode ? (parseFloat(String(editData.depositAmount ?? '0')) || 0) : 0;
  const payCarryOver    = isEditMode ? (parseFloat(String(editData.carryOver     ?? '0')) || 0) : 0;
  const paidToday = isEditMode
    ? (editData.lastPaidAt != null && selectedDate != null && editData.lastPaidAt.slice(0, 10) === selectedDate)
    : false;

  const todayPays = paidToday
    ? 0
    : isLastWeek
      ? Math.max(0, payPricePerSlot - payCarryOver)
      : payPricePerSlot;

  // ── delete confirmation modal ─────────────────────────────────────────────
  if (deleteMode !== 'none') {
    const isOccurrence = deleteMode === 'occurrence';
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onMouseDown={(e) => { if (e.target === e.currentTarget) { setDeleteMode('none'); setDeleteError(''); } }}
      >
        <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
          <h2 className="text-base font-semibold mb-2">
            {isOccurrence ? 'Cancelar esta semana' : 'Eliminar turno fijo'}
          </h2>
          <p className="text-sm text-muted-foreground mb-1">
            {isOccurrence
              ? `¿Cancelar solo la semana del ${selectedDate ?? ''}?`
              : '¿Eliminar toda la serie de turnos fijos?'}
          </p>
          <p className="text-xs text-muted-foreground mb-5">
            {isOccurrence
              ? 'Las demás semanas no se verán afectadas. Esta acción no se puede deshacer.'
              : 'Se eliminan todos los turnos futuros de esta serie. Esta acción no se puede deshacer.'}
          </p>

          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {deleteError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setDeleteMode('none'); setDeleteError(''); }}
              disabled={deleteBusy}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground
                         hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={isOccurrence ? handleDeleteOccurrence : handleDeleteSeries}
              disabled={deleteBusy}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white
                         hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {deleteBusy
                ? 'Eliminando…'
                : isOccurrence ? 'Cancelar semana' : 'Eliminar serie'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── main modal ────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      {/* Modal shell */}
      <div className="
        bg-card text-card-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-150
        flex flex-col
        w-full max-w-[720px]
        h-screen sm:h-auto sm:max-h-[90vh]
        rounded-none sm:rounded-xl
        sm:mx-4
      ">

        {/* ── HEADER (fixed) ── */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                {isEditMode ? 'Editar reserva fija' : 'Nueva reserva fija'}
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 tracking-wide">
                FIJO
              </span>
            </div>
            {isEditMode && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ID #{editData.fixedReservationId} · {editCourtName} · {editDayLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none p-1 -mr-1 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── BODY (scrollable) ── */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <form id="fixed-reservation-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Court */}
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Cancha {!isEditMode && <span className="text-red-400">*</span>}
                </label>
                {isEditMode ? (
                  <p className="text-sm text-foreground bg-muted border border-border rounded-lg px-3 py-2">
                    {editCourtName}
                  </p>
                ) : (
                  <>
                    <select
                      value={courtId}
                      onChange={(e) => setCourtId(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`${fieldBase} ${fieldErrors.courtId ? 'border-red-400' : 'border-input'}`}
                    >
                      <option value="">Seleccioná una cancha</option>
                      {courts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {fieldErrors.courtId && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.courtId}</p>
                    )}
                  </>
                )}
              </div>

              {/* Day of week */}
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Día de la semana {!isEditMode && <span className="text-red-400">*</span>}
                </label>
                {isEditMode ? (
                  <p className="text-sm text-foreground bg-muted border border-border rounded-lg px-3 py-2">
                    {editDayLabel}
                  </p>
                ) : (
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className={`${fieldBase} border-input`}
                  >
                    {DAYS_OF_WEEK.map(({ label, value }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Time start */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Hora inicio <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  className={`${fieldBase} ${fieldErrors.timeStart ? 'border-red-400' : 'border-input'}`}
                />
                {fieldErrors.timeStart && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.timeStart}</p>
                )}
                {timeStart && duration !== '' && duration > 0 && (
                  <p className="text-[11px] text-indigo-500 mt-1 font-medium">
                    {timeStart} – {addMinutes(timeStart, Number(duration))}
                  </p>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
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
                  className={`${fieldBase} ${fieldErrors.duration ? 'border-red-400' : 'border-input'}`}
                />
                {fieldErrors.duration && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.duration}</p>
                )}
              </div>

              {/* Client name — full width */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nombre del cliente <span className="text-red-400">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Juan Pérez"
                  className={`${fieldBase} ${fieldErrors.clientName ? 'border-red-400' : 'border-input'}`}
                />
                {fieldErrors.clientName && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.clientName}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="11 1234 5678"
                  maxLength={20}
                  className={`${fieldBase} ${fieldErrors.clientPhone ? 'border-red-400' : 'border-input'}`}
                />
                {fieldErrors.clientPhone && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.clientPhone}</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={`${fieldBase} border-input`}
                >
                  {RESERVATION_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Total price */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Precio total
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  placeholder="0"
                  className={`${fieldBase} ${fieldErrors.totalPrice ? 'border-red-400' : 'border-input'}`}
                />
                {fieldErrors.totalPrice && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.totalPrice}</p>
                )}
              </div>

              {/* Deposit */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Seña
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0"
                  className={`${fieldBase} ${fieldErrors.depositAmount ? 'border-red-400' : 'border-input'}`}
                />
                {fieldErrors.depositAmount && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.depositAmount}</p>
                )}
              </div>

            </div>

            {/* Errors */}
            {conflictError && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3 mt-4">
                <span className="text-lg leading-none mt-0.5" aria-hidden>⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">Superposición detectada</p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                    Este turno fijo se superpone con una reserva existente.
                  </p>
                </div>
              </div>
            )}

            {hasFieldError && !conflictError && (
              <p className="text-xs text-red-500 mt-3">Completá los campos requeridos.</p>
            )}

            {submitError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 mt-3">
                {submitError}
              </p>
            )}
          </form>

          {/* ── PAYMENT PANEL (edit mode only) ── */}
          {isEditMode && (
            <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-4 py-3 space-y-2.5">
              <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                Pago semanal
              </p>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Precio del turno</span>
                  <span className="font-semibold text-foreground">{fmtMoney(payPricePerSlot)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seña configurada</span>
                  <span className="font-semibold text-foreground">{fmtMoney(payDeposit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seña acumulada</span>
                  <span className={`font-semibold ${payCarryOver > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground'}`}>
                    {fmtMoney(payCarryOver)}
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isLastWeek}
                    onChange={(e) => setIsLastWeek(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-input rounded-full peer-checked:bg-orange-500 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-background rounded-full shadow transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-sm font-medium text-foreground">Última semana</span>
              </label>

              <div className="rounded-lg border border-violet-200 bg-background px-3 py-2">
                {paidToday ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✅</span>
                      <span className="text-sm font-semibold text-green-700">Pagado</span>
                    </div>
                    {payCarryOver > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔵</span>
                        <span className="text-[11px] text-muted-foreground">Seña aplicada a la próxima semana</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-foreground font-medium">
                        {isLastWeek ? 'Paga hoy (usa seña)' : 'Paga hoy'}
                      </span>
                      <span className="text-lg font-bold text-violet-700 dark:text-violet-300">{fmtMoney(todayPays)}</span>
                    </div>
                    {isLastWeek && payCarryOver > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Se descuenta seña acumulada de {fmtMoney(payCarryOver)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {payError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                  {payError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER (fixed) ── */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex flex-col md:flex-row items-stretch md:items-center gap-2">

          {/* Left: destructive actions */}
          {isEditMode && (
            <div className="flex gap-2 md:mr-auto">
              <button
                type="button"
                onClick={() => { setDeleteMode('series'); setDeleteError(''); }}
                disabled={busy || payBusy}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-500
                           hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar desde fecha
              </button>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => { setDeleteMode('occurrence'); setDeleteError(''); }}
                  disabled={busy || payBusy}
                  className="flex-1 md:flex-none px-3 py-2 text-xs text-orange-600 hover:text-orange-800
                             hover:bg-orange-50 rounded-lg border border-orange-200 hover:border-orange-300
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Pausar esta semana
                </button>
              )}
            </div>
          )}

          {/* Right: main actions */}
          <div className="flex gap-2 md:ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={busy || payBusy || deleteBusy}
              className="flex-1 md:flex-none px-4 py-2 text-sm text-muted-foreground hover:text-foreground
                         border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>

            {isEditMode && (
              <button
                type="button"
                disabled={payBusy || busy}
                onClick={handleRegisterPayment}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg
                           border border-violet-400 text-violet-700 hover:bg-violet-50 active:bg-violet-100
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {payBusy ? 'Registrando…' : <><span>💰</span> Registrar pago</>}
              </button>
            )}

            <button
              type="submit"
              form="fixed-reservation-form"
              disabled={busy || payBusy}
              className="flex-1 md:flex-none px-5 py-2 text-sm font-medium bg-indigo-600 text-white
                         rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Guardando…' : isEditMode ? 'Guardar cambios' : 'Crear turno fijo'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
