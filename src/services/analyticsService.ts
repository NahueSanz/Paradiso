import prisma from '../lib/prisma';
import { ReservationType } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

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

export async function getReservationsReport(from: string, to: string, clubId: number, ownerId: number): Promise<ReservationReportRow[]> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club || club.ownerId !== ownerId) throw new AppError('Forbidden', 403);

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate   = new Date(`${to}T23:59:59.999Z`);

  const reservations = await prisma.reservation.findMany({
    where: {
      date:   { gte: fromDate, lte: toDate },
      status: { not: 'cancelled' },
      court:  { clubId },
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

export async function getRevenue(from: string, to: string, clubId: number, ownerId: number): Promise<RevenueResult> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club || club.ownerId !== ownerId) throw new AppError('Forbidden', 403);

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate   = new Date(`${to}T23:59:59.999Z`);

  const cashMovements = await prisma.cashMovement.findMany({
    where: {
      clubId,
      createdAt: { gte: fromDate, lte: toDate },
      type: 'income',
      OR: [
        { fixedReservationInstanceId: { not: null } },
        { relatedReservationId: { not: null } },
      ],
    },
    include: {
      instance: { select: { type: true } },
    },
  });

  // Bulk-fetch reservation types for normal reservation payments
  const reservationIds = cashMovements
    .filter((m) => m.relatedReservationId != null)
    .map((m) => m.relatedReservationId!);

  const reservationTypeMap = new Map<number, ReservationType>();
  if (reservationIds.length > 0) {
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, type: true },
    });
    for (const r of reservations) reservationTypeMap.set(r.id, r.type);
  }

  const byDate = new Map<string, Record<ReservationType, number>>();

  for (const m of cashMovements) {
    // Revenue is grouped by payment date (cash basis), not booking date.
    const dateKey = m.createdAt.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, zeroDayTotals());
    const totals = byDate.get(dateKey)!;

    let type: ReservationType = ReservationType.booking;
    if (m.fixedReservationInstanceId != null && m.instance?.type) {
      const t = m.instance.type as ReservationType;
      if (TYPES.includes(t)) type = t;
    } else if (m.relatedReservationId != null) {
      type = reservationTypeMap.get(m.relatedReservationId) ?? ReservationType.booking;
    }

    totals[type] = (totals[type] ?? 0) + Number(m.amount);
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
