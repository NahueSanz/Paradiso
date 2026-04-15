import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { computeTimeEnd } from './fixedReservationService';

// ── helpers (mirrors reservationService — not exported there) ─────────────────

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

const membershipSelect = { select: { id: true, displayName: true } } as const;

function withRemainingAmount<
  T extends { totalPrice: Prisma.Decimal | null; depositAmount: Prisma.Decimal | null },
>(r: T): T & { remainingAmount: number | null } {
  const total   = r.totalPrice   != null ? Number(r.totalPrice)   : null;
  const deposit = r.depositAmount != null ? Number(r.depositAmount) : null;
  const remainingAmount =
    total !== null && deposit !== null ? Math.max(0, total - deposit) : null;
  return { ...r, remainingAmount };
}

// ── public return types ───────────────────────────────────────────────────────

export interface ScheduleFixedReservation {
  id: number;
  courtId: number;
  dayOfWeek: number;
  timeStart: string;     // "HH:MM"
  timeEnd: string;       // "HH:MM"  (pre-computed from timeStart + duration)
  duration: number;
  clientName: string;
  type: string;
  totalPrice: string | null;
  depositAmount: string | null;
  carryOver: string;     // rolling deposit carry-over, default "0"
  lastPaidAt: string | null; // ISO date string of last payment, null if never paid
  active: boolean;
  court: { id: number; name: string };
}

// ── service ───────────────────────────────────────────────────────────────────

export async function getScheduleByDateAndClub(
  dateStr: string,
  clubId: number,
  userId: number,
) {
  // Auth: caller must hold a membership in the target club
  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
  });
  if (!membership) throw new AppError('Forbidden', 403);

  const date = parseDate(dateStr);

  // Derive day-of-week from the date string directly (avoids TZ shifts)
  const [year, month, day] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Sunday

  // ── normal reservations ──────────────────────────────────────────────────
  const reservations = await prisma.reservation.findMany({
    where: {
      date,
      court: { clubId },
    },
    include: {
      court: { select: { id: true, name: true } },
      createdByMembership: membershipSelect,
      updatedByMembership: membershipSelect,
    },
    orderBy: [{ courtId: 'asc' }, { timeStart: 'asc' }],
  });

  // ── active fixed reservations — only for today and future dates ──────────
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const requestedDateUTC = new Date(Date.UTC(year, month - 1, day));
  const isPast = requestedDateUTC < todayUTC;

  const fixed = isPast ? [] : await prisma.fixedReservation.findMany({
    where: {
      active: true,
      dayOfWeek,
      court: { clubId },
    },
    include: { court: { select: { id: true, name: true } } },
    orderBy: [{ courtId: 'asc' }, { timeStart: 'asc' }],
  });

  const fixedReservations: ScheduleFixedReservation[] = fixed.map((f) => ({
    id:            f.id,
    courtId:       f.courtId,
    dayOfWeek:     f.dayOfWeek,
    timeStart:     f.timeStart,
    timeEnd:       computeTimeEnd(f.timeStart, f.duration),
    duration:      f.duration,
    clientName:    f.clientName,
    type:          f.type,
    totalPrice:    f.totalPrice    != null ? String(f.totalPrice)    : null,
    depositAmount: f.depositAmount != null ? String(f.depositAmount) : null,
    carryOver:     String(f.carryOver),
    lastPaidAt:    f.lastPaidAt != null ? f.lastPaidAt.toISOString() : null,
    active:        f.active,
    court:         f.court,
  }));

  return {
    reservations:     reservations.map(withRemainingAmount),
    fixedReservations,
  };
}
