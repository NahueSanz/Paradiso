import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as api from '../api';
import type { RevenueData, ReservationReportRow } from '../api';

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

function isoMinus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function fmtDateFull(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtCurrencyPDF(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

const TYPE_LABEL: Record<string, string> = {
  booking:    'Partido',
  class:      'Clase',
  challenge:  'Desafío',
  tournament: 'Torneo',
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  partial: 'Seña',
  paid:    'Pagado',
};

async function generatePDF(
  from: string,
  to: string,
  grandTotal: number,
  totalByType: Record<string, number>,
  rows: ReservationReportRow[],
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;
  const generatedAt = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── header block ──────────────────────────────────────────────────────────
  doc.setFillColor(55, 65, 81); // dark gray
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Ingresos', marginL, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Padel Paradiso', marginL, 19);

  doc.setFontSize(9);
  doc.setTextColor(209, 213, 219);
  doc.text(`Período: ${fmtDateFull(from)} — ${fmtDateFull(to)}`, marginL, 25);
  doc.text(`Generado: ${generatedAt}`, pageW - marginR - 60, 25);

  // ── summary section ───────────────────────────────────────────────────────
  let y = 36;

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen de ingresos', marginL, y);

  y += 5;

  // Total revenue highlight box
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(marginL, y, 60, 16, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(99, 102, 241);
  doc.text('TOTAL DEL PERÍODO', marginL + 3, y + 5);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtCurrencyPDF(grandTotal), marginL + 3, y + 13);

  // Type breakdown boxes
  const types: Array<[string, string, [number, number, number]]> = [
    ['booking',    'Partidos',  [59, 130, 246]],
    ['class',      'Clases',    [168, 85, 247]],
    ['challenge',  'Desafíos',  [249, 115, 22]],
    ['tournament', 'Torneos',   [239, 68, 68]],
  ];

  let boxX = marginL + 65;
  const boxW = (contentW - 65) / 4 - 3;

  for (const [key, label, [r, g, b]] of types) {
    doc.setFillColor(r, g, b, 0.08);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, y, boxW, 16, 2, 2, 'F');
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, y, boxW, 16, 2, 2, 'S');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(r, g, b);
    doc.text(label.toUpperCase(), boxX + 3, y + 5);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(fmtCurrencyPDF(totalByType[key] ?? 0), boxX + 3, y + 13);
    boxX += boxW + 3;
  }

  y += 24;

  // ── reservations table ────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Detalle de reservas', marginL, y);
  y += 3;

  const tableBody = rows.map((r) => [
    fmtDateFull(r.date),
    r.courtName,
    r.clientName,
    TYPE_LABEL[r.type] ?? r.type,
    `${r.timeStart} – ${r.timeEnd}`,
    PAYMENT_LABEL[r.paymentStatus] ?? r.paymentStatus,
    fmtCurrencyPDF(r.totalPrice),
    r.depositAmount > 0 ? fmtCurrencyPDF(r.depositAmount) : '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Cancha', 'Cliente', 'Tipo', 'Horario', 'Pago', 'Monto', 'Seña']],
    body: tableBody,
    margin: { left: marginL, right: marginR },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [31, 41, 55],
      lineColor: [229, 231, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22 },
      4: { cellWidth: 30 },
      5: { cellWidth: 22 },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
    },
    didDrawPage: (hookData) => {
      // footer on each page
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = hookData.pageNumber;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(
        'Generado automáticamente por el sistema · Padel Paradiso',
        marginL,
        pageH - 6,
      );
      doc.text(
        `Página ${currentPage} de ${pageCount}`,
        pageW - marginR - 20,
        pageH - 6,
      );
    },
  });

  doc.save(`reporte_${from}_${to}.pdf`);
}

// ─── constants ───────────────────────────────────────────────────────────────

const TYPE_META = {
  booking:    { label: 'Reservas',   color: '#3B82F6' },
  class:      { label: 'Clases',     color: '#A855F7' },
  challenge:  { label: 'Desafíos',   color: '#F97316' },
  tournament: { label: 'Torneos',    color: '#EF4444' },
} as const;

type TypeKey = keyof typeof TYPE_META;

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, pct,
}: { label: string; value: number; color: string; pct: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${color}22`, color }}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{fmtCurrency(value)}</p>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── custom tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{TYPE_META[p.dataKey as TypeKey]?.label ?? p.dataKey}:</span>
          <span className="font-medium text-gray-900">{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  const [from, setFrom] = useState(isoMinus(29));
  const [to,   setTo]   = useState(todayISO());
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!from || !to || from > to) return;
    setLoading(true);
    setError('');
    api.getRevenue(from, to)
      .then(setData)
      .catch((e) => setError(e.message ?? 'Error al cargar datos'))
      .finally(() => setLoading(false));
  }, [from, to]);

  // ── derived stats ────────────────────────────────────────────────────────

  const grandTotal = data?.days.reduce((s, d) => s + d.total, 0) ?? 0;

  const totalByType: Record<TypeKey, number> = {
    booking: 0, class: 0, challenge: 0, tournament: 0,
  };

  data?.days.forEach((d) => {
    (Object.keys(totalByType) as TypeKey[]).forEach((k) => {
      totalByType[k] += d.totals[k] ?? 0;
    });
  });

  const chartData = data?.days.map((d) => ({
    date: fmtDate(d.date),
    ...d.totals,
    total: d.total,
  })) ?? [];

  const bestDay = data?.days.reduce(
    (best, d) => (d.total > best.total ? d : best),
    { date: '-', total: 0 },
  );

  const avgPerDay = data?.days.length
    ? grandTotal / data.days.filter((d) => d.total > 0).length || 0
    : 0;

  async function handleExportPDF() {
    setExporting(true);
    try {
      const rows = await api.getReservationsReport(from, to);
      await generatePDF(from, to, grandTotal, totalByType, rows);
    } catch (e: any) {
      setError(e.message ?? 'Error al generar el PDF');
    } finally {
      setExporting(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── header ── */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
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
            <h1 className="text-xl font-bold text-indigo-700 tracking-tight">Padel Paradiso</h1>
            <p className="text-xs text-gray-400">Dashboard de ingresos</p>
          </div>
        </div>

        {/* date range */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent text-sm focus:outline-none w-32"
            />
            <span className="text-gray-300">→</span>
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="bg-transparent text-sm focus:outline-none w-32"
            />
          </div>

          {/* quick ranges */}
          <div className="hidden sm:flex gap-1">
            {[
              { label: '7d',  days: 6 },
              { label: '30d', days: 29 },
              { label: '90d', days: 89 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => { setFrom(isoMinus(days)); setTo(todayISO()); }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500
                           hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* export button */}
          <button
            onClick={handleExportPDF}
            disabled={exporting || loading || !data}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       border-gray-300 text-gray-600 bg-white hover:border-gray-400 hover:bg-gray-50"
          >
            {exporting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generando…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar PDF
              </>
            )}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">

        {/* ── error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── KPI row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* grand total */}
          <div className="sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-600 to-indigo-500
                          rounded-2xl p-5 text-white shadow-md flex flex-col gap-1">
            <p className="text-indigo-200 text-sm font-medium">Ingresos totales</p>
            <p className="text-3xl font-extrabold tracking-tight">
              {loading ? '—' : fmtCurrency(grandTotal)}
            </p>
            <p className="text-indigo-200 text-xs mt-1">
              {data?.days.length ?? 0} días · promedio {fmtCurrency(avgPerDay)}/día
            </p>
          </div>

          {/* best day */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
            <p className="text-gray-500 text-sm font-medium">Mejor día</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '—' : fmtCurrency(bestDay?.total ?? 0)}
            </p>
            <p className="text-gray-400 text-xs">{bestDay?.date !== '-' ? bestDay?.date : 'Sin datos'}</p>
          </div>

          {/* active days */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
            <p className="text-gray-500 text-sm font-medium">Días con ingresos</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '—' : (data?.days.filter((d) => d.total > 0).length ?? 0)}
            </p>
            <p className="text-gray-400 text-xs">de {data?.days.length ?? 0} días en rango</p>
          </div>

          {/* top type */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
            <p className="text-gray-500 text-sm font-medium">Categoría líder</p>
            {loading ? <p className="text-2xl font-bold text-gray-900">—</p> : (() => {
              const top = (Object.keys(totalByType) as TypeKey[]).reduce(
                (a, b) => totalByType[a] >= totalByType[b] ? a : b
              );
              return (
                <>
                  <p className="text-2xl font-bold" style={{ color: TYPE_META[top].color }}>
                    {TYPE_META[top].label}
                  </p>
                  <p className="text-gray-400 text-xs">{fmtCurrency(totalByType[top])}</p>
                </>
              );
            })()}
          </div>
        </div>

        {/* ── type cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(TYPE_META) as TypeKey[]).map((k) => (
            <StatCard
              key={k}
              label={TYPE_META[k].label}
              value={loading ? 0 : totalByType[k]}
              color={TYPE_META[k].color}
              pct={grandTotal > 0 ? (totalByType[k] / grandTotal) * 100 : 0}
            />
          ))}
        </div>

        {/* ── charts row ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* line chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4">Ingresos por día</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
                Cargando…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false} axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(v) => TYPE_META[v as TypeKey]?.label ?? v}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  {(Object.keys(TYPE_META) as TypeKey[]).map((k) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={TYPE_META[k].color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* bar chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4">Mix de ingresos por día</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
                Cargando…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false} axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(v) => TYPE_META[v as TypeKey]?.label ?? v}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  {(Object.keys(TYPE_META) as TypeKey[]).map((k) => (
                    <Bar key={k} dataKey={k} stackId="a" fill={TYPE_META[k].color} radius={k === 'tournament' ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── daily table ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-700">Detalle por día</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium">Fecha</th>
                  {(Object.keys(TYPE_META) as TypeKey[]).map((k) => (
                    <th key={k} className="px-6 py-3 text-right font-medium" style={{ color: TYPE_META[k].color }}>
                      {TYPE_META[k].label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-300">Cargando…</td></tr>
                ) : data?.days.filter((d) => d.total > 0).length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-300">Sin ingresos en el rango seleccionado</td></tr>
                ) : (
                  data?.days
                    .filter((d) => d.total > 0)
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-700">{d.date}</td>
                        {(Object.keys(TYPE_META) as TypeKey[]).map((k) => (
                          <td key={k} className="px-6 py-3 text-right text-gray-600">
                            {d.totals[k] > 0 ? fmtCurrency(d.totals[k]) : <span className="text-gray-200">—</span>}
                          </td>
                        ))}
                        <td className="px-6 py-3 text-right font-semibold text-gray-900">
                          {fmtCurrency(d.total)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
              {!loading && grandTotal > 0 && (
                <tfoot>
                  <tr className="bg-indigo-50 border-t border-indigo-100 font-semibold">
                    <td className="px-6 py-3 text-indigo-700">Total</td>
                    {(Object.keys(TYPE_META) as TypeKey[]).map((k) => (
                      <td key={k} className="px-6 py-3 text-right" style={{ color: TYPE_META[k].color }}>
                        {fmtCurrency(totalByType[k])}
                      </td>
                    ))}
                    <td className="px-6 py-3 text-right text-indigo-700">{fmtCurrency(grandTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
