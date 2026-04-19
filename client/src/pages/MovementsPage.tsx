import { useEffect, useState, useCallback } from 'react';
import { useClub } from '../context/ClubContext';
import * as api from '../api';
import type { Movement } from '../api';

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export default function MovementsPage() {
  const { selectedClubId } = useClub();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [acting, setActing]       = useState<number | null>(null);

  const fetchMovements = useCallback(() => {
    if (!selectedClubId) return;
    setLoading(true);
    setError('');
    api.getMovements(selectedClubId)
      .then(setMovements)
      .catch((e: any) => setError(e.message ?? 'Error al cargar movimientos'))
      .finally(() => setLoading(false));
  }, [selectedClubId]);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-app-text">Movimientos</h1>
        <p className="text-sm text-gray-500 dark:text-app-muted mt-0.5">Historial de ventas y movimientos manuales</p>
      </div>

      {!selectedClubId && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <p className="text-lg font-semibold text-gray-700 dark:text-app-text">Seleccioná un club</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {selectedClubId && (
        <>
          <div className="bg-white dark:bg-app-card rounded-2xl border border-gray-100 dark:border-app-border shadow-sm p-5 flex flex-col gap-1 w-fit">
            <p className="text-sm font-medium text-gray-500 dark:text-app-muted">Total activo</p>
            <p className="text-2xl font-bold text-emerald-600">{fmtMoney(totalActive)}</p>
          </div>

          <div className="bg-white dark:bg-app-card rounded-2xl shadow-sm border border-gray-100 dark:border-app-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-app-muted uppercase tracking-wide bg-gray-50 dark:bg-slate-700/50">
                    <th className="px-6 py-3 text-left font-medium">Fecha</th>
                    <th className="px-6 py-3 text-left font-medium">Tipo</th>
                    <th className="px-6 py-3 text-left font-medium">Descripción</th>
                    <th className="px-6 py-3 text-right font-medium">Monto</th>
                    <th className="px-6 py-3 text-left font-medium">Estado</th>
                    <th className="px-6 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-app-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-300 dark:text-slate-600">Cargando…</td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-300 dark:text-slate-600">No hay movimientos</td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr
                        key={m.id}
                        className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${m.status === 'cancelled' ? 'opacity-50' : ''}`}
                      >
                        <td className="px-6 py-3 text-gray-500 dark:text-app-muted whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                            m.type === 'sale'
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                          }`}>
                            {m.type === 'sale' ? 'Venta' : 'Manual'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-700 dark:text-app-text max-w-xs truncate">{m.description}</td>
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
