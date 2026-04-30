import { useEffect, useRef, useState } from "react";
import type { Reservation, TimeSlot } from "../types";
import { createFixedReservation } from "../api";

// ── tipos públicos ─────────────────────────────────────────────────────────────

export interface ModalState {
  courtId: number;
  courtName: string;
  date: string;
  slot: TimeSlot;
  reservation?: Reservation;
}

export interface FormData {
  clientName: string;
  clientPhone?: string | null;
  type: string;
  totalPrice?: number;
  depositAmount?: number;
  timeStart: string;
  timeEnd: string;
}

interface Props {
  state: ModalState;
  onClose: () => void;
  onSave: (form: FormData) => Promise<void>;
  onPayAmount: (id: number, amount: number) => Promise<Reservation>;
  onUpdateNote: (id: number, note: string | null) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onFixedSuccess?: () => void;
}

// ── constantes ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mié", value: 3 },
  { label: "Jue", value: 4 },
  { label: "Vie", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 0 },
];

const RESERVATION_TYPE_LABELS: Record<string, string> = {
  booking:    "Partido",
  class:      "Clase",
  tournament: "Torneo",
  challenge:  "Desafío",
};

const DURATION_OPTIONS = [
  { value: "60",     label: "60 min" },
  { value: "90",     label: "90 min" },
  { value: "120",    label: "120 min" },
  { value: "custom", label: "Personalizado" },
];

const QUICK_AMOUNTS = [1000, 2000, 5000];

// ── helpers ───────────────────────────────────────────────────────────────────

function isoToMinutes(iso: string): number {
  const clean = iso.includes("T") ? iso.slice(11, 16) : iso;
  const [h, m] = clean.split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(slot: TimeSlot, minutes: number): string {
  const [h, m] = slot.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function defaultDurationForType(type: string): string {
  if (type === "class")      return "60";
  if (type === "tournament") return "custom";
  return "90";
}

function durationFromReservation(r: Reservation): { duration: string; customMinutes: string } {
  const startMin = isoToMinutes(r.timeStart);
  const endMin   = isoToMinutes(r.timeEnd);
  const diff     = endMin - startMin;
  if (diff === 60)  return { duration: "60",  customMinutes: "" };
  if (diff === 90)  return { duration: "90",  customMinutes: "" };
  if (diff === 120) return { duration: "120", customMinutes: "" };
  return { duration: "custom", customMinutes: String(diff) };
}

function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

// ── componente ────────────────────────────────────────────────────────────────

export default function ReservationModal({
  state,
  onClose,
  onSave,
  onPayAmount,
  onUpdateNote,
  onDelete,
  onFixedSuccess,
}: Props) {
  const { reservation, courtName, date, slot } = state;
  const isEdit = !!reservation;

  const [liveReservation, setLiveReservation] = useState<Reservation | null>(
    reservation ?? null,
  );

  const savedTotal   = liveReservation?.totalPrice   != null ? parseFloat(liveReservation.totalPrice)   : 0;
  const savedDeposit = liveReservation?.depositAmount != null ? parseFloat(liveReservation.depositAmount) : 0;
  const savedPaid    = liveReservation?.paidAmount    != null ? parseFloat(liveReservation.paidAmount)    : null;
  const savedRemaining = savedPaid !== null
    ? Math.max(0, savedTotal - savedPaid)
    : Math.max(0, savedTotal - savedDeposit);
  const depositCovered   = savedPaid !== null && savedPaid >= savedDeposit && savedDeposit > 0;
  const isPaidFull       = savedTotal > 0 && savedPaid !== null && savedPaid >= savedTotal;
  const isPartialPay     = savedTotal > 0 && savedPaid !== null && savedPaid > 0 && savedPaid < savedTotal;
  const isDepositCovered = savedDeposit > 0 && savedPaid !== null && savedPaid >= savedDeposit;

  const [clientName,    setClientName]    = useState(reservation?.clientName ?? "");
  const [clientPhone,   setClientPhone]   = useState(reservation?.clientPhone ?? "");
  const [type,          setType]          = useState(reservation?.type ?? "booking");

  const [totalPrice,    setTotalPrice]    = useState(
    reservation?.totalPrice != null ? String(reservation.totalPrice) : ""
  );
  const [depositAmount, setDepositAmount] = useState(
    reservation?.depositAmount != null ? String(reservation.depositAmount) : ""
  );

  const [error, setError]               = useState("");
  const [busy,  setBusy]                = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [paymentInput,   setPaymentInput]   = useState("");
  const [paymentBusy,    setPaymentBusy]    = useState(false);
  const [paymentError,   setPaymentError]   = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const [noteText,  setNoteText]  = useState(reservation?.internalNote ?? "");
  const [noteBusy,  setNoteBusy]  = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteError, setNoteError] = useState("");

  const [isTurnoFijo,   setIsTurnoFijo]   = useState(false);
  const [fixedDayOfWeek, setFixedDayOfWeek] = useState<number>(1);
  const [fixedWarning,  setFixedWarning]  = useState(false);

  const initDuration = isEdit
    ? durationFromReservation(reservation!)
    : { duration: defaultDurationForType(type), customMinutes: "" };

  const [duration,      setDuration]      = useState(initDuration.duration);
  const [customMinutes, setCustomMinutes] = useState(initDuration.customMinutes);

  useEffect(() => {
    if (isEdit) return;
    setDuration(defaultDurationForType(type));
    setCustomMinutes("");
  }, [type, isEdit]);

  const effectiveMinutes = duration === "custom" ? parseInt(customMinutes || "0", 10) : parseInt(duration, 10);
  const timeStart = slot;
  const timeEnd   = effectiveMinutes > 0 ? addMinutes(slot, effectiveMinutes) : "";

  const depositExceedsTotal =
    totalPrice !== '' && depositAmount !== '' &&
    parseFloat(depositAmount) > parseFloat(totalPrice);
  const isFree = totalPrice === '' || parseFloat(totalPrice) === 0;

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function run(fn: () => Promise<void>) {
    setError("");
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

  function parseAndValidatePrices(): { ok: false } | { ok: true; parsedTotalPrice?: number; parsedDepositAmount?: number } {
    let parsedTotalPrice: number | undefined;
    if (totalPrice !== "") {
      const n = Number(totalPrice);
      if (isNaN(n) || n < 0) {
        setError("El precio total debe ser un número no negativo.");
        return { ok: false };
      }
      parsedTotalPrice = n;
    }

    let parsedDepositAmount: number | undefined;
    if (depositAmount !== "") {
      const n = Number(depositAmount);
      if (isNaN(n) || n < 0) {
        setError("La seña debe ser un número no negativo.");
        return { ok: false };
      }
      if (parsedTotalPrice !== undefined && n > parsedTotalPrice) {
        setError("La seña no puede ser mayor que el precio total.");
        return { ok: false };
      }
      parsedDepositAmount = n;
    }

    return { ok: true, parsedTotalPrice, parsedDepositAmount };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFixedWarning(false);

    if (duration === "custom" && (!customMinutes || parseInt(customMinutes, 10) <= 0)) {
      setError("Ingresá una duración válida en minutos.");
      return;
    }

    const prices = parseAndValidatePrices();
    if (!prices.ok) return;
    const { parsedTotalPrice, parsedDepositAmount } = prices;

    if (isTurnoFijo && !isEdit) {
      setError("");
      setBusy(true);
      createFixedReservation({
        courtId: state.courtId,
        dayOfWeek: fixedDayOfWeek,
        timeStart,
        duration: effectiveMinutes,
        clientName,
        clientPhone: clientPhone.trim() || null,
        type,
        totalPrice: parsedTotalPrice,
        depositAmount: parsedDepositAmount,
      })
        .then((res) => {
          if (res?.warning) {
            setFixedWarning(true);
          } else {
            onFixedSuccess?.();
            onClose();
          }
        })
        .catch((err) => setError((err as Error).message))
        .finally(() => setBusy(false));
      return;
    }

    run(() =>
      onSave({
        clientName,
        clientPhone: clientPhone.trim() || null,
        type,
        totalPrice: parsedTotalPrice,
        depositAmount: parsedDepositAmount,
        timeStart,
        timeEnd,
      })
    );
  }

  async function handleRegisterPayment(overrideAmount?: number) {
    const rawAmount = overrideAmount !== undefined ? overrideAmount : parseFloat(paymentInput);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      setPaymentError("Ingresá un monto válido.");
      return;
    }
    setPaymentBusy(true);
    setPaymentError("");
    setPaymentSuccess(false);
    try {
      const updated = await onPayAmount(liveReservation!.id, rawAmount);
      setLiveReservation(updated);
      setPaymentInput("");
      setPaymentSuccess(true);
      setTimeout(() => setPaymentSuccess(false), 3000);
    } catch (err) {
      setPaymentError((err as Error).message);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function handleSaveNote() {
    setNoteBusy(true);
    setNoteSaved(false);
    setNoteError("");
    try {
      await onUpdateNote(liveReservation!.id, noteText.trim() || null);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch (err) {
      setNoteError((err as Error).message);
    } finally {
      setNoteBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto max-h-[90vh]">

        {/* ── encabezado ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">
              {isEdit ? "Editar Reserva" : "Nueva Reserva"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {courtName} &middot; {date}
              {timeEnd && (
                <span className="font-medium text-foreground">
                  {" "}&middot; {timeStart} – {timeEnd}
                  <span className="text-muted-foreground font-normal"> ({effectiveMinutes} min)</span>
                </span>
              )}
            </p>
            {isEdit && (isPaidFull || isPartialPay || isDepositCovered) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {isPaidFull && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    Pagado completo
                  </span>
                )}
                {isPartialPay && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                    Pago parcial
                  </span>
                )}
                {isDepositCovered && !isPaidFull && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    Seña cubierta
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none -mt-1 -mr-1 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── autoría (solo en edición) ── */}
        {isEdit && (reservation?.createdByMembership || reservation?.updatedByMembership) && (
          <div className="mx-6 mt-3 flex flex-wrap gap-x-4 gap-y-0.5">
            {reservation?.createdByMembership && (
              <span className="text-[11px] text-muted-foreground">
                Creado por: <span className="font-medium">{reservation.createdByMembership.displayName}</span>
              </span>
            )}
            {reservation?.updatedByMembership && (
              <span className="text-[11px] text-muted-foreground">
                Última edición: <span className="font-medium">{reservation.updatedByMembership.displayName}</span>
              </span>
            )}
          </div>
        )}

        {/* ── resumen financiero (solo en edición) ── */}
        {isEdit && (
          <div className="mx-6 mt-4 rounded-xl bg-muted border border-border px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-foreground text-base">{formatCurrency(savedTotal)}</span>
            </div>
            {savedDeposit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seña</span>
                <span className="font-semibold text-foreground">{formatCurrency(savedDeposit)}</span>
              </div>
            )}
            {savedPaid !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagado</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(savedPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-border pt-1 mt-1">
              {isPaidFull ? (
                <>
                  <span className="text-muted-foreground">Estado</span>
                  <span className="font-bold text-emerald-600">Pagado ✓</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Restante</span>
                  <span className="font-bold text-red-500">{formatCurrency(savedRemaining)}</span>
                </>
              )}
            </div>
            {savedDeposit > 0 && (
              <p className={`text-xs font-medium mt-0.5 ${depositCovered ? 'text-emerald-600' : 'text-amber-600'}`}>
                {depositCovered ? 'Seña cubierta ✅' : 'Seña pendiente'}
              </p>
            )}
          </div>
        )}

        {/* ── registrar pago ── */}
        {isEdit && savedTotal > 0 && !isPaidFull && (
          <div className="mx-6 mt-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-3 space-y-2.5">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Registrar pago</p>

            <div className="flex gap-1.5 flex-wrap">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={paymentBusy}
                  onClick={() =>
                    setPaymentInput((prev) =>
                      String((parseFloat(prev || "0") || 0) + amt)
                    )
                  }
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-background text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                >
                  +{formatCurrency(amt)}
                </button>
              ))}
              {savedRemaining > 0 && (
                <button
                  type="button"
                  disabled={paymentBusy}
                  onClick={() => handleRegisterPayment(savedRemaining)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 bg-background text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  Pago completo ({formatCurrency(savedRemaining)})
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={paymentInput}
                onChange={(e) => { setPaymentInput(e.target.value); setPaymentError(""); }}
                placeholder="Otro monto…"
                className="flex-1 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground transition-shadow"
              />
              <button
                type="button"
                disabled={paymentBusy || !paymentInput || parseFloat(paymentInput) <= 0}
                onClick={() => handleRegisterPayment()}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {paymentBusy ? "…" : "Registrar"}
              </button>
            </div>

            {paymentError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-1.5">
                {paymentError}
              </p>
            )}
            {paymentSuccess && (
              <p className="text-xs font-medium text-emerald-700">Pago registrado ✓</p>
            )}
          </div>
        )}

        {/* ── nota interna (solo en edición) ── */}
        {isEdit && (
          <div className="mx-6 mt-3">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Nota interna
            </label>
            <textarea
              value={noteText}
              onChange={(e) => { setNoteText(e.target.value); setNoteSaved(false); }}
              placeholder="Notas para el equipo…"
              rows={2}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground resize-none transition-shadow"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs">
                {noteError && <span className="text-red-600">{noteError}</span>}
                {noteSaved && !noteError && <span className="text-emerald-600">Nota guardada ✓</span>}
              </span>
              <button
                type="button"
                disabled={noteBusy}
                onClick={handleSaveNote}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
              >
                {noteBusy ? "Guardando…" : "Guardar nota"}
              </button>
            </div>
          </div>
        )}

        {/* ── formulario ── */}
        <form
          id="reservation-form"
          onSubmit={handleSubmit}
          className="px-6 py-5 space-y-4"
        >
          {/* Nombre del cliente */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Nombre del cliente <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Juan Pérez"
              required
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            />
          </div>

          {/* Teléfono (opcional) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Teléfono <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="11 1234-5678"
              maxLength={20}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            />
          </div>

          {/* Tipo + Duración */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              >
                {Object.entries(RESERVATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Duración</label>
              <select
                value={duration}
                onChange={(e) => { setDuration(e.target.value); setCustomMinutes(""); }}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              >
                {DURATION_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Duración personalizada */}
          {duration === "custom" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Duración en minutos <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="15"
                max="480"
                step="15"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                placeholder="Ej: 150"
                required
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>
          )}

          {/* ── Turno fijo (solo en creación) ── */}
          {!isEdit && (
            <div className="rounded-xl border border-border bg-muted px-4 py-3 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isTurnoFijo}
                    onChange={(e) => {
                      setIsTurnoFijo(e.target.checked);
                      setFixedWarning(false);
                    }}
                  />
                  <div className="w-9 h-5 bg-input rounded-full peer-checked:bg-indigo-500 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-background rounded-full shadow transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-sm font-medium text-foreground">Turno fijo</span>
              </label>

              {isTurnoFijo && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Día de la semana</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_OF_WEEK.map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFixedDayOfWeek(value)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors
                          ${fixedDayOfWeek === value
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Warning turno fijo ── */}
          {fixedWarning && (
            <div className="flex items-start gap-3 rounded-xl border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Superposición detectada</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                  Este turno fijo se superpone con una reserva existente.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-yellow-600 hover:text-yellow-800 text-xs font-medium underline shrink-0"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Precio total + Seña */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Precio total ($)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Seña ($)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>
          </div>

          {isFree && (
            <p className="text-xs text-muted-foreground -mt-1">Reserva sin costo</p>
          )}

          {depositExceedsTotal && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 -mt-1">
              La seña no puede ser mayor que el precio total
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </form>

        {/* ── pie del modal ── */}
        <div className="flex items-center gap-2 px-6 pb-5">
          {isEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Eliminar
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              form="reservation-form"
              type="submit"
              disabled={busy || depositExceedsTotal}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {busy
                ? "Guardando…"
                : isEdit
                  ? "Actualizar"
                  : isTurnoFijo
                    ? "Crear turno fijo"
                    : "Crear"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Delete Reservation Confirm Overlay ── */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Eliminar reserva</h2>
            <p className="text-sm text-muted-foreground mb-6">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground
                           hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmingDelete(false);
                  run(() => onDelete(reservation!.id));
                }}
                className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium
                           hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
