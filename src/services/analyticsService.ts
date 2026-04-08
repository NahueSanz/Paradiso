import prisma from '../lib/prisma';
import { ReservationType } from '@prisma/client';

export interface ReservationReportRow {
  id: number;
  date: string;
  courtName: string;
  clientName: string;
  type: string;
  timeStart: string;
  timeEnd: string;
  paymentStatus: string;
  totalPrice: number;
  depositAmount: number;
}

export async function getReservationsReport(from: string, to: string): Promise<ReservationReportRow[]> {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate   = new Date(`${to}T23:59:59.999Z`);

  const reservations = await prisma.reservation.findMany({
    where: {
      date:   { gte: fromDate, lte: toDate },
      status: { not: 'cancelled' },
    },
    include: { court: { select: { name: true } } },
    orderBy: [{ date: 'asc' }, { timeStart: 'asc' }],
  });

  return reservations.map((r) => ({
    id:            r.id,
    date:          r.date.toISOString().slice(0, 10),
    courtName:     r.court.name,
    clientName:    r.clientName,
    type:          r.type,
    timeStart:     r.timeStart.toISOString().slice(11, 16),
    timeEnd:       r.timeEnd.toISOString().slice(11, 16),
    paymentStatus: r.paymentStatus,
    totalPrice:    Number(r.totalPrice ?? 0),
    depositAmount: Number(r.depositAmount ?? 0),
  }));
}

export interface DayRevenue {
  date: string;
  totals: Record<ReservationType, number>;
  total: number;
}

export interface RevenueResult {
  days: DayRevenue[];
}

const TYPES: ReservationType[] = ['booking', 'class', 'challenge', 'tournament'];

function zeroDayTotals(): Record<ReservationType, number> {
  return { booking: 0, class: 0, challenge: 0, tournament: 0 };
}

export async function getRevenue(from: string, to: string): Promise<RevenueResult> {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate   = new Date(`${to}T23:59:59.999Z`);

  const reservations = await prisma.reservation.findMany({
    where: {
      date:          { gte: fromDate, lte: toDate },
      status:        { not: 'cancelled' },
      paymentStatus: { in: ['paid', 'partial'] },
    },
    select: {
      date:          true,
      type:          true,
      totalPrice:    true,
      depositAmount: true,
      paymentStatus: true,
    },
  });

  // Group by date string (YYYY-MM-DD)
  const byDate = new Map<string, Record<ReservationType, number>>();

  for (const r of reservations) {
    const dateKey = r.date.toISOString().slice(0, 10);

    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, zeroDayTotals());
    }

    const totals = byDate.get(dateKey)!;
    const type   = r.type as ReservationType;

    // Count totalPrice for paid, depositAmount for partial
    const amount =
      r.paymentStatus === 'paid'
        ? Number(r.totalPrice ?? 0)
        : Number(r.depositAmount ?? 0);

    totals[type] = (totals[type] ?? 0) + amount;
  }

  // Fill in every date in the range so the chart has no gaps
  const days: DayRevenue[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end    = new Date(`${to}T00:00:00.000Z`);

  while (cursor <= end) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const totals  = byDate.get(dateKey) ?? zeroDayTotals();
    const total   = TYPES.reduce((sum, t) => sum + (totals[t] ?? 0), 0);

    days.push({ date: dateKey, totals, total });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { days };
}
