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

export default function MovementsPage() {
  const { selectedClubId } = useClub();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
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

  const totalActive = movements
    .filter((m) => m.status === 'active')
    .reduce((s, m) => s + Number(m.amount), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimientos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Historial de ventas y movimientos manuales</p>
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

          <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-1 w-fit">
            <p className="text-sm font-medium text-muted-foreground">Total activo</p>
            <p className="text-2xl font-bold text-emerald-600">{loading ? '—' : fmtMoney(totalActive)}</p>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/50">
                    <th className="px-6 py-3 text-left font-medium">Fecha</th>
                    <th className="px-6 py-3 text-left font-medium">Tipo</th>
                    <th className="px-6 py-3 text-left font-medium">Descripción</th>
                    <th className="px-6 py-3 text-right font-medium">Monto</th>
                    <th className="px-6 py-3 text-left font-medium">Estado</th>
                    <th className="px-6 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Cargando…</td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Sin movimientos para {PRESET_LABELS[preset].toLowerCase()}</td>
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
    </div>
  );
}
