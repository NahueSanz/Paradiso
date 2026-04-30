import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as api from '../api';
import type { CashMovement, RevenueData, ReservationReportRow } from '../api';

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

const MODE_TITLE: Record<Mode, string> = {
  courts:   'Reporte de Alquileres',
  cash:     'Reporte de Caja',
  combined: 'Reporte Combinado',
};

async function generatePDF(
  mode: Mode,
  from: string,
  to: string,
  grandTotal: number,
  totalByCategory: Record<string, number>,
  reservationRows: ReservationReportRow[],
  cashMovements: CashMovement[],
  clubName: string,
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

  const drawPageFooter = () => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(`Generado automáticamente por el sistema · ${clubName}`, marginL, pageH - 6);
      doc.text(`Página ${i} de ${pageCount}`, pageW - marginR - 20, pageH - 6);
    }
  };

  // ── header ──
  doc.setFillColor(55, 65, 81);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(MODE_TITLE[mode], marginL, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(clubName, marginL, 19);
  doc.setFontSize(9);
  doc.setTextColor(209, 213, 219);
  doc.text(`Período: ${fmtDateFull(from)} — ${fmtDateFull(to)}`, marginL, 25);
  doc.text(`Generado: ${generatedAt}`, pageW - marginR - 60, 25);

  let y = 36;

  // ── summary boxes ──
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen de ingresos', marginL, y);
  y += 5;

  doc.setFillColor(238, 242, 255);
  doc.roundedRect(marginL, y, 60, 16, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(99, 102, 241);
  doc.text('TOTAL DEL PERÍODO', marginL + 3, y + 5);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtCurrency(grandTotal), marginL + 3, y + 13);

  type BoxDef = [string, string, [number, number, number]];
  const boxDefs: BoxDef[] = mode === 'courts'
    ? [
        ['booking',    'Partidos',  [59, 130, 246]],
        ['class',      'Clases',    [168, 85, 247]],
        ['challenge',  'Desafíos',  [249, 115, 22]],
        ['tournament', 'Torneos',   [239, 68, 68]],
      ]
    : mode === 'cash'
      ? [
          ['alquileres', 'Alquileres', [59, 130, 246]],
          ['productos',  'Productos',  [16, 185, 129]],
          ['otros',      'Otros',      [245, 158, 11]],
          ['egresos',    'Egresos',    [239, 68, 68]],
        ]
      : [
          ['reservas',  'Reservas',  [59, 130, 246]],
          ['productos', 'Productos', [16, 185, 129]],
          ['otros',     'Otros',     [245, 158, 11]],
          ['egresos',   'Egresos',   [239, 68, 68]],
        ];

  let boxX = marginL + 65;
  const boxW = (contentW - 65) / boxDefs.length - 3;

  for (const [key, label, [r, g, b]] of boxDefs) {
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
    doc.text(fmtCurrency(totalByCategory[key] ?? 0), boxX + 3, y + 13);
    boxX += boxW + 3;
  }

  y += 24;

  // ── reservations table (courts + combined) ──
  if (mode === 'courts' || mode === 'combined') {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Detalle de reservas', marginL, y);
    y += 3;

    const tableBody = reservationRows.map((r) => [
      fmtDateFull(r.date),
      r.courtName,
      r.clientName,
      TYPE_LABEL[r.type] ?? r.type,
      `${r.timeStart} – ${r.timeEnd}`,
      PAYMENT_LABEL[r.paymentStatus] ?? r.paymentStatus,
      fmtCurrency(r.totalPrice),
      r.depositAmount > 0 ? fmtCurrency(r.depositAmount) : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Cancha', 'Cliente', 'Tipo', 'Horario', 'Pago', 'Monto', 'Seña']],
      body: tableBody,
      margin: { left: marginL, right: marginR },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [31, 41, 55], lineColor: [229, 231, 235], lineWidth: 0.2 },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
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
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── cash movements table (cash + combined) ──
  if (mode === 'cash' || mode === 'combined') {
    if (mode === 'combined' && y > pageH - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('Movimientos de caja', marginL, y);
    y += 3;

    const PAYMENT_METHOD_LABEL: Record<string, string> = {
      cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta',
    };

    const cashBody = cashMovements.map((m) => [
      fmtDateFull(m.createdAt.slice(0, 10)),
      m.concept,
      m.type === 'income' ? 'Ingreso' : 'Egreso',
      PAYMENT_METHOD_LABEL[m.paymentMethod] ?? m.paymentMethod,
      fmtCurrency(m.amount),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Concepto', 'Tipo', 'Método', 'Monto']],
      body: cashBody,
      margin: { left: marginL, right: marginR },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [31, 41, 55], lineColor: [229, 231, 235], lineWidth: 0.2 },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 30, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor = val === 'Ingreso' ? [16, 185, 129] : [239, 68, 68];
        }
      },
    });
  }

  drawPageFooter();
  doc.save(`reporte_${mode}_${from}_${to}.pdf`);
}

// ─── mode & category meta ─────────────────────────────────────────────────────

type Mode = 'courts' | 'cash' | 'combined';

type CatMeta = { label: string; color: string };

const COURTS_META: Record<string, CatMeta> = {
  booking:    { label: 'Reservas',   color: '#3B82F6' },
  class:      { label: 'Clases',     color: '#A855F7' },
  challenge:  { label: 'Desafíos',   color: '#F97316' },
  tournament: { label: 'Torneos',    color: '#EF4444' },
};

const CASH_META: Record<string, CatMeta> = {
  alquileres: { label: 'Alquileres', color: '#3B82F6' },
  productos:  { label: 'Productos',  color: '#10B981' },
  otros:      { label: 'Otros',      color: '#F59E0B' },
  egresos:    { label: 'Egresos',    color: '#EF4444' },
};

const COMBINED_META: Record<string, CatMeta> = {
  reservas:  { label: 'Reservas',  color: '#3B82F6' },
  productos: { label: 'Productos', color: '#10B981' },
  otros:     { label: 'Otros',     color: '#F59E0B' },
  egresos:   { label: 'Egresos',   color: '#EF4444' },
};

const EXPENSE_KEYS = new Set(['egresos']);

function getMetaForMode(mode: Mode): Record<string, CatMeta> {
  if (mode === 'courts') return COURTS_META;
  if (mode === 'cash') return CASH_META;
  return COMBINED_META;
}

// ─── unified day data ─────────────────────────────────────────────────────────

interface UnifiedDay {
  date: string;
  categories: Record<string, number>;
  totalIncome: number;
  totalExpenses: number;
}

function computeUnifiedDays(
  mode: Mode,
  revenueData: RevenueData | null,
  cashMovements: CashMovement[],
): UnifiedDay[] {
  const dateMap = new Map<string, Record<string, number>>();

  if (mode !== 'cash' && revenueData) {
    for (const day of revenueData.days) {
      if (mode === 'courts') {
        dateMap.set(day.date, { ...day.totals });
      } else {
        dateMap.set(day.date, { reservas: day.total });
      }
    }
  }

  if (mode !== 'courts') {
    for (const m of cashMovements) {
      const date = m.createdAt.slice(0, 10);
      const cats = dateMap.get(date) ?? {};
      if (m.type === 'income') {
        if (m.relatedProductId) {
          cats.productos = (cats.productos ?? 0) + m.amount;
        } else if (m.fixedReservationInstanceId != null || m.relatedReservationId != null) {
          if (mode === 'cash') {
            // In 'cash' mode show rental payments as alquileres
            cats.alquileres = (cats.alquileres ?? 0) + m.amount;
          }
          // In 'combined' mode, rentals are already counted via revenueData → skip to avoid double-count
        } else {
          cats.otros = (cats.otros ?? 0) + m.amount;
        }
      } else {
        cats.egresos = (cats.egresos ?? 0) + m.amount;
      }
      dateMap.set(date, cats);
    }
  }

  return Array.from(dateMap.entries())
    .map(([date, categories]) => {
      let totalIncome = 0;
      let totalExpenses = 0;
      for (const [k, v] of Object.entries(categories)) {
        if (EXPENSE_KEYS.has(k)) totalExpenses += v;
        else totalIncome += v;
      }
      return { date, categories, totalIncome, totalExpenses };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, color, pct,
}: { label: string; value: number; color: string; pct: number }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${color}22`, color }}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground">{fmtCurrency(value)}</p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, meta }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{meta[p.dataKey]?.label ?? p.dataKey}:</span>
          <span className="font-medium text-foreground">{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clubs, selectedClubId } = useClub();
  const selectedClubName = clubs.find((c) => c.id === selectedClubId)?.name ?? 'ClubFlow';



  useEffect(() => {
    if (user?.role !== 'owner') navigate('/', { replace: true });
  }, [user, navigate]);

  const [mode, setMode] = useState<Mode>('combined');
  const [from, setFrom] = useState(isoMinus(29));
  const [to,   setTo]   = useState(todayISO());

  const [revenueData,    setRevenueData]    = useState<RevenueData | null>(null);
  const [cashMovements,  setCashMovements]  = useState<CashMovement[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [exporting,      setExporting]      = useState(false);

  const rangeInvalid = !!from && !!to && from > to;

  useEffect(() => {
    if (!from || !to || from > to || !selectedClubId) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.getRevenue(from, to, selectedClubId),
      api.getCashMovements(selectedClubId, from, to),
    ])
      .then(([rev, cash]) => {
        setRevenueData(rev);
        setCashMovements(cash);
      })
      .catch((e) => setError(e.message ?? 'Error al cargar datos'))
      .finally(() => setLoading(false));
  }, [from, to, selectedClubId]);

  // ── derived data ──────────────────────────────────────────────────────────

  const activeMeta = getMetaForMode(mode);

  const unifiedDays = useMemo(
    () => computeUnifiedDays(mode, revenueData, cashMovements),
    [mode, revenueData, cashMovements],
  );

  const grandTotal    = unifiedDays.reduce((s, d) => s + d.totalIncome, 0);
  const grandExpenses = unifiedDays.reduce((s, d) => s + d.totalExpenses, 0);

  const totalByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const day of unifiedDays) {
      for (const [k, v] of Object.entries(day.categories)) {
        acc[k] = (acc[k] ?? 0) + v;
      }
    }
    return acc;
  }, [unifiedDays]);

  const chartData = unifiedDays.map((d) => ({
    date: fmtDate(d.date),
    ...d.categories,
    total: d.totalIncome,
  }));

  const bestDay = unifiedDays.reduce(
    (best, d) => (d.totalIncome > best.totalIncome ? d : best),
    { date: '-', totalIncome: 0, totalExpenses: 0, categories: {} } as UnifiedDay,
  );

  const activeDays = unifiedDays.filter((d) => d.totalIncome > 0).length;
  const avgPerDay  = activeDays > 0 ? grandTotal / activeDays : 0;

  const incomeCatKeys = Object.keys(activeMeta).filter((k) => !EXPENSE_KEYS.has(k));
  const topCatKey = incomeCatKeys.length > 0
    ? incomeCatKeys.reduce((a, b) => (totalByCategory[a] ?? 0) >= (totalByCategory[b] ?? 0) ? a : b)
    : null;

  async function handleExportPDF() {
    if (!selectedClubId) return;
    setExporting(true);
    try {
      let reservationRows: ReservationReportRow[] = [];
      if (mode === 'courts' || mode === 'combined') {
        reservationRows = await api.getReservationsReport(from, to, selectedClubId);
      }
      await generatePDF(mode, from, to, grandTotal, totalByCategory, reservationRows, cashMovements, selectedClubName);
    } catch (e: any) {
      setError(e.message ?? 'Error al generar el PDF');
    } finally {
      setExporting(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const catColCount = Object.keys(activeMeta).length + 2; // date + cats + total

  return (
    <div className="min-h-full bg-background">
      {/* ── Page header ── */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">Ingresos</h1>

          <div className="flex items-center gap-3 flex-wrap">
            {/* date range */}
            <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 transition-colors ${
              rangeInvalid
                ? 'border-red-300 bg-red-50'
                : 'border-input bg-muted'
            }`}>
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex flex-col">
                <label className="text-[10px] font-medium uppercase tracking-wide leading-none mb-0.5 text-muted-foreground">
                  Desde
                </label>
                <input
                  type="date" value={from} max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className={`bg-transparent text-sm focus:outline-none w-32 text-foreground ${rangeInvalid ? 'text-red-600' : ''}`}
                />
              </div>
              <span className="text-gray-300">→</span>
              <div className="flex flex-col">
                <label className="text-[10px] font-medium uppercase tracking-wide leading-none mb-0.5 text-muted-foreground">
                  Hasta
                </label>
                <input
                  type="date" value={to} min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none w-32 text-foreground"
                />
              </div>
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
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-border
                             text-muted-foreground hover:border-indigo-400 hover:text-indigo-600
                             hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={exporting || loading || rangeInvalid}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         border-border text-muted-foreground
                         bg-card hover:border-border/80 hover:bg-muted"
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
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* ── mode selector ── */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-xl border border-border bg-muted p-1 gap-1">
            {([
              { key: 'courts',   label: 'Alquileres' },
              { key: 'cash',     label: 'Caja' },
              { key: 'combined', label: 'Combinado' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  mode === key
                    ? 'bg-background text-indigo-700 dark:text-indigo-400 shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── no club selected ── */}
        {!selectedClubId && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="text-lg font-semibold text-foreground">Seleccioná un club para ver los ingresos</p>
            <p className="text-sm text-muted-foreground">Usá el selector de club en la barra superior.</p>
          </div>
        )}

        {/* ── errors ── */}
        {rangeInvalid && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            La fecha &quot;Desde&quot; no puede ser mayor que &quot;Hasta&quot;
          </div>
        )}
        {error && !rangeInvalid && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {selectedClubId && (<>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* grand total */}
          <div className="sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-600 to-indigo-500
                          rounded-2xl p-5 text-white shadow-md flex flex-col gap-1">
            <p className="text-indigo-200 text-sm font-medium">Ingresos totales</p>
            <p className="text-3xl font-extrabold tracking-tight">
              {loading ? '—' : fmtCurrency(grandTotal)}
            </p>
            {grandExpenses > 0 && !loading && (
              <p className="text-indigo-200 text-xs">
                Egresos: {fmtCurrency(grandExpenses)} · Neto: {fmtCurrency(grandTotal - grandExpenses)}
              </p>
            )}
            <p className="text-indigo-200 text-xs mt-1">
              {activeDays} días · promedio {fmtCurrency(avgPerDay)}/día
            </p>
          </div>

          {/* best day */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
            <p className="text-muted-foreground text-sm font-medium">Mejor día</p>
            <p className="text-2xl font-bold text-foreground">
              {loading ? '—' : fmtCurrency(bestDay.totalIncome)}
            </p>
            <p className="text-muted-foreground text-xs">
              {bestDay.date !== '-' ? fmtDate(bestDay.date) : 'Sin datos'}
            </p>
          </div>

          {/* active days */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
            <p className="text-muted-foreground text-sm font-medium">Días con ingresos</p>
            <p className="text-2xl font-bold text-foreground">
              {loading ? '—' : activeDays}
            </p>
            <p className="text-muted-foreground text-xs">de {unifiedDays.length} días en rango</p>
          </div>

          {/* top category */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
            <p className="text-muted-foreground text-sm font-medium">Categoría líder</p>
            {loading || !topCatKey ? (
              <p className="text-2xl font-bold text-foreground">—</p>
            ) : (
              <>
                <p className="text-2xl font-bold" style={{ color: activeMeta[topCatKey].color }}>
                  {activeMeta[topCatKey].label}
                </p>
                <p className="text-muted-foreground text-xs">{fmtCurrency(totalByCategory[topCatKey] ?? 0)}</p>
              </>
            )}
          </div>
        </div>

        {/* ── category cards ── */}
        <div className={`grid gap-4 ${Object.keys(activeMeta).length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {Object.keys(activeMeta).map((k) => (
            <StatCard
              key={k}
              label={activeMeta[k].label}
              value={loading ? 0 : (totalByCategory[k] ?? 0)}
              color={activeMeta[k].color}
              pct={grandTotal > 0 ? ((totalByCategory[k] ?? 0) / grandTotal) * 100 : 0}
            />
          ))}
        </div>

        {/* ── charts row ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* line chart */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Ingresos por día</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Cargando…</div>
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
                  <Tooltip content={<CustomTooltip meta={activeMeta} />} />
                  <Legend
                    formatter={(v) => activeMeta[v]?.label ?? v}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  {Object.keys(activeMeta).map((k) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={activeMeta[k].color}
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
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Mix de ingresos por día</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Cargando…</div>
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
                  <Tooltip content={<CustomTooltip meta={activeMeta} />} />
                  <Legend
                    formatter={(v) => activeMeta[v]?.label ?? v}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  {Object.keys(activeMeta).map((k, i, arr) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      stackId="a"
                      fill={activeMeta[k].color}
                      radius={i === arr.length - 1 ? [4, 4, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── daily table ── */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Detalle por día</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/50">
                  <th className="px-6 py-3 text-left font-medium">Fecha</th>
                  {Object.keys(activeMeta).map((k) => (
                    <th key={k} className="px-6 py-3 text-right font-medium" style={{ color: activeMeta[k].color }}>
                      {activeMeta[k].label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right font-medium text-foreground">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={catColCount} className="px-6 py-8 text-center text-muted-foreground">Cargando…</td>
                  </tr>
                ) : unifiedDays.filter((d) => d.totalIncome > 0 || d.totalExpenses > 0).length === 0 ? (
                  <tr>
                    <td colSpan={catColCount} className="px-6 py-8 text-center text-muted-foreground">
                      Sin datos en el rango seleccionado
                    </td>
                  </tr>
                ) : (
                  unifiedDays
                    .filter((d) => d.totalIncome > 0 || d.totalExpenses > 0)
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((d) => (
                      <tr key={d.date} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-3 font-medium text-foreground">{fmtDate(d.date)}</td>
                        {Object.keys(activeMeta).map((k) => (
                          <td key={k} className="px-6 py-3 text-right text-muted-foreground">
                            {(d.categories[k] ?? 0) > 0
                              ? fmtCurrency(d.categories[k])
                              : <span className="text-muted-foreground/30">—</span>}
                          </td>
                        ))}
                        <td className="px-6 py-3 text-right font-semibold text-foreground">
                          {fmtCurrency(d.totalIncome)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
              {!loading && grandTotal > 0 && (
                <tfoot>
                  <tr className="bg-indigo-50 dark:bg-indigo-900/30 border-t border-indigo-100 dark:border-indigo-900 font-semibold">
                    <td className="px-6 py-3 text-indigo-700 dark:text-indigo-300">Total</td>
                    {Object.keys(activeMeta).map((k) => (
                      <td key={k} className="px-6 py-3 text-right" style={{ color: activeMeta[k].color }}>
                        {fmtCurrency(totalByCategory[k] ?? 0)}
                      </td>
                    ))}
                    <td className="px-6 py-3 text-right text-indigo-700 dark:text-indigo-300">{fmtCurrency(grandTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        </>)}
      </div>
    </div>
  );
}
