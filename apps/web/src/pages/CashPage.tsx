import { useEffect, useState, useCallback } from 'react';
import { useClub } from '../context/ClubContext';
import * as api from '../api';
import type { Movement } from '../api';

type DatePreset = 'today' | '7d' | '30d';

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
};

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const to = localISO(today);
  if (preset === 'today') return { from: to, to };
  const from = new Date(today);
  from.setDate(today.getDate() - (preset === '7d' ? 6 : 29));
  return { from: localISO(from), to };
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

interface AddManualModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddManualModal({ onClose, onSuccess }: AddManualModalProps) {
  const [amount,        setAmount]        = useState('');
  const [description,   setDescription]   = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mercadopago'>('cash');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('El monto debe ser mayor a 0'); return; }
    if (!description.trim()) { setError('La descripción es requerida'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createManualMovement({ amount: amt, description: description.trim(), paymentMethod });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold">Nuevo movimiento manual</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Monto</label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Ingreso por alquiler"
              className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Medio de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'mercadopago')}
              className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="cash">Efectivo</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CashPage() {
  const { selectedClubId } = useClub();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showModal, setShowModal] = useState(false);
  const [acting, setActing]       = useState<number | null>(null);
  const [preset, setPreset]       = useState<DatePreset>('today');

  const fetchMovements = useCallback(() => {
    if (!selectedClubId) return;
    const { from, to } = getDateRange(preset);
    setLoading(true);
    setError('');
    api.getMovements(selectedClubId, from, to)
      .then(setMovements)
      .catch((e: any) => setError(e.message ?? 'Error al cargar movimientos'))
      .finally(() => setLoading(false));
  }, [selectedClubId, preset]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  async function handleCancel(id: number) {
    if (!confirm('¿Cancelar esta venta? Se restaurará el stock.')) return;
    setActing(id);
    try {
      await api.cancelMovement(id);
      fetchMovements();
    } catch (e: any) {
      setError(e.message ?? 'Error al cancelar');
    } finally {
      setActing(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    setActing(id);
    try {
      await api.deleteMovement(id);
      setMovements((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setError(e.message ?? 'Error al eliminar');
    } finally {
      setActing(null);
    }
  }

  const activeMovements = movements.filter((m) => m.status === 'active');

  const totalCash = activeMovements
    .filter((m) => m.paymentMethod === 'cash')
    .reduce((s, m) => s + Number(m.amount), 0);

  const totalMercadopago = activeMovements
    .filter((m) => m.paymentMethod === 'mercadopago')
    .reduce((s, m) => s + Number(m.amount), 0);

  const totalIncome = totalCash + totalMercadopago;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caja</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen e historial de movimientos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!selectedClubId}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600
                     hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar movimiento manual
        </button>
      </div>

      {!selectedClubId && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <p className="text-lg font-semibold text-foreground">Seleccioná un club</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {selectedClubId && (
        <>
          {/* Date filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Período:</span>
            {(['today', '7d', '30d'] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  preset === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              Mostrando: {PRESET_LABELS[preset]}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground">Total efectivo</p>
              <p className="text-2xl font-bold text-emerald-600">
                {loading ? '—' : fmtMoney(totalCash)}
              </p>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground">Total Mercado Pago</p>
              <p className="text-2xl font-bold text-blue-600">
                {loading ? '—' : fmtMoney(totalMercadopago)}
              </p>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground">Total general</p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                {loading ? '—' : fmtMoney(totalIncome)}
              </p>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/50">
                    <th className="px-6 py-3 text-left font-medium">Fecha</th>
                    <th className="px-6 py-3 text-left font-medium">Tipo</th>
                    <th className="px-6 py-3 text-left font-medium">Descripción</th>
                    <th className="px-6 py-3 text-left font-medium">Pago</th>
                    <th className="px-6 py-3 text-right font-medium">Monto</th>
                    <th className="px-6 py-3 text-left font-medium">Estado</th>
                    <th className="px-6 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Cargando…</td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Sin movimientos para {PRESET_LABELS[preset].toLowerCase()}</td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr
                        key={m.id}
                        className={`hover:bg-muted/50 transition-colors ${m.status === 'cancelled' ? 'opacity-50' : ''}`}
                      >
                        <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                            m.type === 'sale'
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {m.type === 'sale' ? 'Venta' : 'Manual'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-foreground max-w-xs truncate">{m.description}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                            m.paymentMethod === 'cash'
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}>
                            {m.paymentMethod === 'cash' ? 'Efectivo' : 'Mercado Pago'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-emerald-600">
                          {fmtMoney(Number(m.amount))}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                            m.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
                          }`}>
                            {m.status === 'active' ? 'Activo' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          {m.type === 'sale' && m.status === 'active' && (
                            <button
                              onClick={() => handleCancel(m.id)}
                              disabled={acting === m.id}
                              className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {acting === m.id ? '…' : 'Cancelar'}
                            </button>
                          )}
                          {m.type === 'manual' && (
                            <button
                              onClick={() => handleDelete(m.id)}
                              disabled={acting === m.id}
                              className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {acting === m.id ? '…' : 'Eliminar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <AddManualModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchMovements}
        />
      )}
    </div>
  );
}
