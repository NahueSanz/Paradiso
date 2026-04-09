import { useEffect, useRef, useState } from "react";
import type { Reservation, TimeSlot } from "../types";

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
  onMarkPaid: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

// ── constantes ────────────────────────────────────────────────────────────────

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
  return "90"; // partido, desafío
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
  onMarkPaid,
  onDelete,
}: Props) {
  const { reservation, courtName, date, slot } = state;
  const isEdit = !!reservation;

  // ── estado del formulario ──
  const [clientName,    setClientName]    = useState(reservation?.clientName ?? "");
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

  // Estado optimista para pago — se activa antes de que responda el servidor
  const [paidOptimistic, setPaidOptimistic] = useState(false);
  const isPaid = reservation?.paymentStatus === "paid" || paidOptimistic;

  // ── estado de duración ──
  const initDuration = isEdit
    ? durationFromReservation(reservation!)
    : { duration: defaultDurationForType(type), customMinutes: "" };

  const [duration,      setDuration]      = useState(initDuration.duration);
  const [customMinutes, setCustomMinutes] = useState(initDuration.customMinutes);

  // Actualizar duración por defecto al cambiar el tipo (solo en nuevas reservas)
  useEffect(() => {
    if (isEdit) return;
    setDuration(defaultDurationForType(type));
    setCustomMinutes("");
  }, [type, isEdit]);

  // ── tiempos calculados ──
  const effectiveMinutes = duration === "custom" ? parseInt(customMinutes || "0", 10) : parseInt(duration, 10);
  const timeStart = slot;
  const timeEnd   = effectiveMinutes > 0 ? addMinutes(slot, effectiveMinutes) : "";

  // ── validación precio / seña ──
  const depositExceedsTotal =
    totalPrice !== '' && depositAmount !== '' &&
    parseFloat(depositAmount) > parseFloat(totalPrice);
  const isFree = totalPrice === '' || parseFloat(totalPrice) === 0;

  // ── resumen financiero (calculado en tiempo real desde el formulario) ──
  const summaryTotal     = parseFloat(totalPrice)    || 0;
  const summaryDeposit   = parseFloat(depositAmount) || 0;
  const summaryRemaining = summaryTotal - summaryDeposit;
  const summaryPaid      = isPaid || (summaryTotal > 0 && summaryRemaining <= 0);

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

  // Registrar pago con actualización optimista — no cierra el modal
  async function handleMarkPaid() {
    if (isPaid || busy) return;
    setError("");
    setBusy(true);
    setPaidOptimistic(true);
    try {
      await onMarkPaid(reservation!.id);
    } catch (err) {
      setPaidOptimistic(false);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (duration === "custom" && (!customMinutes || parseInt(customMinutes, 10) <= 0)) {
      setError("Ingresá una duración válida en minutos.");
      return;
    }

    let parsedTotalPrice: number | undefined;
    if (totalPrice !== "") {
      const n = Number(totalPrice);
      if (isNaN(n) || n < 0) {
        setError("El precio total debe ser un número no negativo.");
        return;
      }
      parsedTotalPrice = n;
    }

    let parsedDepositAmount: number | undefined;
    if (depositAmount !== "") {
      const n = Number(depositAmount);
      if (isNaN(n) || n < 0) {
        setError("La seña debe ser un número no negativo.");
        return;
      }
      if (parsedTotalPrice !== undefined && n > parsedTotalPrice) {
        setError("La seña no puede ser mayor que el precio total.");
        return;
      }
      parsedDepositAmount = n;
    }

    run(() =>
      onSave({
        clientName,
        type,
        totalPrice: parsedTotalPrice,
        depositAmount: parsedDepositAmount,
        timeStart,
        timeEnd,
      })
    );
  }

  function handleDelete() {
    if (!reservation) return;
    setConfirmingDelete(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-150">

        {/* ── encabezado ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? "Editar Reserva" : "Nueva Reserva"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {courtName} &middot; {date}
              {timeEnd && (
                <span className="font-medium text-gray-600">
                  {" "}&middot; {timeStart} – {timeEnd}
                  <span className="text-gray-400 font-normal"> ({effectiveMinutes} min)</span>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-2xl leading-none -mt-1 -mr-1 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* ── resumen financiero (solo en edición) ── */}
        {isEdit && (
          <div className="mx-6 mt-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-800 text-base">{formatCurrency(summaryTotal)}</span>
            </div>
            {summaryDeposit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Seña abonada</span>
                <span className="font-semibold text-gray-700">{formatCurrency(summaryDeposit)}</span>
              </div>
            )}
            {summaryDeposit > 0 && !summaryPaid && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Restante</span>
                <span className="font-semibold text-orange-600">{formatCurrency(summaryRemaining)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-gray-200 pt-1 mt-1">
              {summaryPaid ? (
                <>
                  <span className="text-gray-500">Estado</span>
                  <span className="font-bold text-emerald-600">Pagado ✓</span>
                </>
              ) : (
                <>
                  <span className="text-gray-500">Adeuda</span>
                  <span className="font-bold text-red-500">{formatCurrency(summaryRemaining)}</span>
                </>
              )}
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
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nombre del cliente <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Juan Pérez"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
            />
          </div>

          {/* Tipo + Duración */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              >
                {Object.entries(RESERVATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Duración</label>
              <select
                value={duration}
                onChange={(e) => { setDuration(e.target.value); setCustomMinutes(""); }}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
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
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              />
            </div>
          )}

          {/* Precio total + Seña */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Precio total ($)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Seña ($)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              />
            </div>
          </div>

          {/* Free reservation hint */}
          {isFree && (
            <p className="text-xs text-gray-400 -mt-1">Reserva sin costo</p>
          )}

          {/* Deposit exceeds total error */}
          {depositExceedsTotal && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 -mt-1">
              La seña no puede ser mayor que el precio total
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ── Botón registrar pago (solo edición) ── */}
          {isEdit && (
            <div className="pt-1">
              <button
                type="button"
                disabled={isPaid || busy}
                onClick={handleMarkPaid}
                className={`w-full py-2.5 text-sm font-semibold rounded-lg border transition-all duration-150
                  ${isPaid
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                    : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100'
                  } disabled:cursor-not-allowed`}
              >
                {isPaid ? 'Pagado ✓' : 'Registrar pago completo'}
              </button>
            </div>
          )}
        </form>

        {/* ── pie del modal ── */}
        <div className="flex items-center gap-2 px-6 pb-5">
          {isEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Eliminar
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              form="reservation-form"
              type="submit"
              disabled={busy || depositExceedsTotal}
              className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "Guardando…" : isEdit ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Delete Reservation Confirm Overlay ── */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Eliminar reserva</h2>
            <p className="text-sm text-gray-500 mb-6">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600
                           hover:bg-gray-50 disabled:opacity-50 transition-colors"
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
