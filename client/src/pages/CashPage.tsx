import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClub } from '../context/ClubContext';
import * as api from '../api';
import type { CashMovement } from '../api';
import AddMovementModal from '../components/AddMovementModal';

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

function isoMinus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

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
  return `${dd}/${mm}/${yyyy}`;
}

// ─── summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, colorClass,
}: { label: string; value: number; colorClass: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{fmtMoney(value)}</p>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CashPage() {
  const navigate = useNavigate();
  const { clubs, selectedClubId } = useClub();

  const currentClub = clubs.find((c) => c.id === selectedClubId) ?? null;

  const [from, setFrom]           = useState(isoMinus(29));
  const [to, setTo]               = useState(todayISO());
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showModal, setShowModal] = useState(false);

  const rangeInvalid = !!from && !!to && from > to;

  function fetchMovements() {
    if (!from || !to || from > to || !selectedClubId) return;
    setLoading(true);
    setError('');
    api.getCashMovements(selectedClubId, from, to)
      .then(setMovements)
      .catch((e: any) => setError(e.message ?? 'Error al cargar movimientos'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchMovements();
  }, [from, to, selectedClubId]);

  // ── derived totals ────────────────────────────────────────────────────────

  const totalIncome  = movements.filter((m) => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const totalExpense = movements.filter((m) => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
  const balance      = totalIncome - totalExpense;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-indigo-600 transition-colors p-1 rounded-lg hover:bg-indigo-50"
            title="Volver al calendario"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-indigo-700 tracking-tight">
              {currentClub ? currentClub.name : 'Caja'}
            </h1>
            <p className="text-xs text-gray-400">Gestión de caja</p>
          </div>
        </div>

        {/* date range */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 transition-colors ${
            rangeInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
          }`}>
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="flex flex-col">
              <label className="text-[10px] font-medium uppercase tracking-wide leading-none mb-0.5 text-gray-400">
                Desde
              </label>
              <input
                type="date" value={from} max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className={`bg-transparent text-sm focus:outline-none w-32 ${rangeInvalid ? 'text-red-600' : ''}`}
              />
            </div>
            <span className="text-gray-300">→</span>
            <div className="flex flex-col">
              <label className="text-[10px] font-medium uppercase tracking-wide leading-none mb-0.5 text-gray-400">
                Hasta
              </label>
              <input
                type="date" value={to} min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="bg-transparent text-sm focus:outline-none w-32"
              />
            </div>
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
            Agregar movimiento
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">

        {!selectedClubId && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="text-lg font-semibold text-gray-700">Seleccioná un club para ver la caja</p>
          </div>
        )}

        {rangeInvalid && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            La fecha &quot;Desde&quot; no puede ser mayor que &quot;Hasta&quot;
          </div>
        )}

        {error && !rangeInvalid && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {selectedClubId && !rangeInvalid && (
          <>
            {/* summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard label="Total ingresos" value={loading ? 0 : totalIncome}  colorClass="text-emerald-600" />
              <SummaryCard label="Total egresos"  value={loading ? 0 : totalExpense} colorClass="text-red-500" />
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
                <p className="text-sm font-medium text-gray-500">Balance</p>
                <p className={`text-2xl font-bold ${
                  loading ? 'text-gray-900' : balance >= 0 ? 'text-indigo-700' : 'text-red-600'
                }`}>
                  {loading ? '—' : fmtMoney(balance)}
                </p>
              </div>
            </div>

            {/* movements table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-base font-semibold text-gray-700">Movimientos</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                      <th className="px-6 py-3 text-left font-medium">Concepto</th>
                      <th className="px-6 py-3 text-left font-medium">Tipo</th>
                      <th className="px-6 py-3 text-right font-medium">Monto</th>
                      <th className="px-6 py-3 text-left font-medium">Método de pago</th>
                      <th className="px-6 py-3 text-left font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-300">Cargando…</td>
                      </tr>
                    ) : movements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-300">No hay movimientos</td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-gray-700">{m.concept}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                              m.type === 'income'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-600'
                            }`}>
                              {m.type === 'income' ? 'Ingreso' : 'Egreso'}
                            </span>
                          </td>
                          <td className={`px-6 py-3 text-right font-medium ${
                            m.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {fmtMoney(m.amount)}
                          </td>
                          <td className="px-6 py-3 text-gray-600">{m.paymentMethod}</td>
                          <td className="px-6 py-3 text-gray-500">{fmtDate(m.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {showModal && (
        <AddMovementModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchMovements}
        />
      )}
    </div>
  );
}
