import { ReservationStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { createCashMovement } from './cashService';

// ── Time helpers ───────────────────────────────────────────────────────────────

/** "HH:MM" → total minutes since midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Adds `duration` minutes to a "HH:MM" string → "HH:MM" */
export function computeTimeEnd(timeStart: string, duration: number): string {
  const [h, m] = timeStart.split(':').map(Number);
  const total = h * 60 + m + duration;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the UTC date of the next (or current) occurrence of a given
 * day-of-week, starting from today. If today IS that day, returns today.
 */
function nextOccurrenceUTC(dayOfWeek: number): Date {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayDay = todayUTC.getUTCDay();
  const daysUntil = (dayOfWeek - todayDay + 7) % 7;
  const result = new Date(todayUTC);
  result.setUTCDate(todayUTC.getUTCDate() + daysUntil);
  return result;
}

// ── Auth helper ────────────────────────────────────────────────────────────────

/** Resolves the clubId for a court and asserts the user holds a membership there. */
async function assertClubMembership(courtId: number, userId: number): Promise<number> {
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { clubId: true },
  });
  if (!court) throw new AppError('Court not found', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId, clubId: court.clubId } },
  });
  if (!membership) throw new AppError('Forbidden', 403);

  return court.clubId;
}

// ── Conflict detection ─────────────────────────────────────────────────────────

/**
 * Returns any non-cancelled Reservation rows on this court whose day-of-week
 * matches, whose date is >= the next occurrence of that day, and whose time
 * range overlaps the proposed slot.
 */
async function findRegularConflicts(
  courtId: number,
  dayOfWeek: number,
  proposedStart: number,
  proposedEnd: number,
): Promise<{ id: number; timeStart: Date; timeEnd: Date }[]> {
  const fromDate = nextOccurrenceUTC(dayOfWeek);

  const rows = await prisma.reservation.findMany({
    where: {
      courtId,
      status: { not: ReservationStatus.cancelled },
      date: { gte: fromDate },
    },
    select: { id: true, date: true, timeStart: true, timeEnd: true },
  });

  return rows.filter((r) => {
    if (r.date.getUTCDay() !== dayOfWeek) return false;
    const rStart = r.timeStart.getUTCHours() * 60 + r.timeStart.getUTCMinutes();
    const rEnd = r.timeEnd.getUTCHours() * 60 + r.timeEnd.getUTCMinutes();
    return proposedStart < rEnd && proposedEnd > rStart;
  });
}

/**
 * Returns any active FixedReservation rows on this court + day-of-week
 * whose time range overlaps the proposed slot.
 */
async function findFixedConflicts(
  courtId: number,
  dayOfWeek: number,
  proposedStart: number,
  proposedEnd: number,
  excludeId?: number,
): Promise<{ id: number; timeStart: string; duration: number }[]> {
  const rows = await prisma.fixedReservation.findMany({
    where: {
      courtId,
      dayOfWeek,
      active: true,
      ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, timeStart: true, duration: true },
  });

  return rows.filter((r) => {
    const rStart = toMinutes(r.timeStart);
    const rEnd = rStart + r.duration;
    return proposedStart < rEnd && proposedEnd > rStart;
  });
}

// ── Shared include shape ───────────────────────────────────────────────────────

const courtSelect = { select: { id: true, name: true } } as const;

// ── Public view type (used by schedule grid) ───────────────────────────────────

export interface FixedReservationView {
  id: string;
  courtId: number;
  courtName: string;
  timeStart: string;
  timeEnd: string;
  clientName: string;
  type: string;
  isFixed: true;
}

export interface ProcessPaymentResult {
  id: number;
  carryOver: string;
  todayPays: number;
  pricePerSlot: number;
  depositAmount: number;
  isLastWeek: boolean;
  paidAt: string;
}

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * Returns active fixed reservations for a specific court on a given date,
 * shaped for merging into the schedule grid.
 */
export async function getFixedReservationsByDateAndCourt(
  date: string,
  courtId: number,
): Promise<FixedReservationView[]> {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  const records = await prisma.fixedReservation.findMany({
    where: { active: true, dayOfWeek, courtId },
    include: { court: courtSelect },
  });

  return records.map((r) => ({
    id: `fixed-${r.id}`,
    courtId: r.courtId,
    courtName: r.court.name,
    timeStart: r.timeStart,
    timeEnd: computeTimeEnd(r.timeStart, r.duration),
    clientName: r.clientName,
    type: r.type,
    isFixed: true as const,
  }));
}

/**
 * Returns all fixed reservations for a club, grouped by court.
 * The caller must be a member of the club.
 */
export async function getFixedReservationsByClub(
  clubId: number,
  userId: number,
): Promise<{ courtId: number; courtName: string; reservations: object[] }[]> {
  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
  });
  if (!membership) throw new AppError('Forbidden', 403);

  const records = await prisma.fixedReservation.findMany({
    where: { court: { clubId } },
    include: { court: courtSelect },
    orderBy: [{ courtId: 'asc' }, { dayOfWeek: 'asc' }, { timeStart: 'asc' }],
  });

  // Group by court
  const grouped = new Map<number, { courtId: number; courtName: string; reservations: object[] }>();
  for (const r of records) {
    if (!grouped.has(r.courtId)) {
      grouped.set(r.courtId, { courtId: r.courtId, courtName: r.court.name, reservations: [] });
    }
    grouped.get(r.courtId)!.reservations.push({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      timeStart: r.timeStart,
      timeEnd: computeTimeEnd(r.timeStart, r.duration),
      duration: r.duration,
      clientName: r.clientName,
      type: r.type,
      totalPrice: r.totalPrice != null ? String(r.totalPrice) : null,
      depositAmount: r.depositAmount != null ? String(r.depositAmount) : null,
      carryOver: String(r.carryOver),
      active: r.active,
      createdAt: r.createdAt,
    });
  }

  return Array.from(grouped.values());
}

// ── Commands ───────────────────────────────────────────────────────────────────

export interface CreateFixedReservationInput {
  courtId: number;
  dayOfWeek: number;
  timeStart: string;
  duration: number;
  clientName: string;
  type: string;
  totalPrice?: number | null;
  depositAmount?: number | null;
}

export async function createFixedReservation(
  input: CreateFixedReservationInput,
  userId: number,
) {
  const { courtId, dayOfWeek, timeStart, duration, clientName, type, totalPrice, depositAmount } = input;

  // Auth: user must be a member of the court's club
  await assertClubMembership(courtId, userId);

  const proposedStart = toMinutes(timeStart);
  const proposedEnd = proposedStart + duration;

  // Check overlap with non-cancelled regular reservations on future dates
  const regularConflicts = await findRegularConflicts(courtId, dayOfWeek, proposedStart, proposedEnd);
  if (regularConflicts.length > 0) {
    throw new AppError('Fixed reservation conflicts with an existing reservation', 400);
  }

  // Check overlap with other active fixed reservations on the same day-of-week
  const fixedConflicts = await findFixedConflicts(courtId, dayOfWeek, proposedStart, proposedEnd);
  if (fixedConflicts.length > 0) {
    throw new AppError('Fixed reservation conflicts with an existing fixed reservation', 400);
  }

  return prisma.fixedReservation.create({
    data: {
      courtId,
      dayOfWeek,
      timeStart,
      duration,
      clientName,
      type,
      ...(totalPrice    != null ? { totalPrice }    : {}),
      ...(depositAmount != null ? { depositAmount } : {}),
    },
    include: { court: courtSelect },
  });
}

export interface UpdateFixedReservationInput {
  clientName: string;
  timeStart: string;
  duration: number;
  type: string;
  totalPrice?: number | null;
  depositAmount?: number | null;
}

export async function updateFixedReservation(
  id: number,
  input: UpdateFixedReservationInput,
  userId: number,
) {
  const existing = await prisma.fixedReservation.findUnique({
    where: { id },
    select: { courtId: true, dayOfWeek: true },
  });
  if (!existing) throw new AppError('Fixed reservation not found', 404);

  // Auth: user must be a member of the court's club
  await assertClubMembership(existing.courtId, userId);

  const { clientName, timeStart, duration, type, totalPrice, depositAmount } = input;

  const proposedStart = toMinutes(timeStart);
  const proposedEnd = proposedStart + duration;

  // Check overlap with non-cancelled regular reservations on future dates
  const regularConflicts = await findRegularConflicts(
    existing.courtId, existing.dayOfWeek, proposedStart, proposedEnd,
  );
  if (regularConflicts.length > 0) {
    throw new AppError('Fixed reservation conflicts with an existing reservation', 400);
  }

  // Check overlap with other fixed reservations (exclude this one)
  const fixedConflicts = await findFixedConflicts(
    existing.courtId, existing.dayOfWeek, proposedStart, proposedEnd, id,
  );
  if (fixedConflicts.length > 0) {
    throw new AppError('Fixed reservation conflicts with an existing fixed reservation', 400);
  }

  return prisma.fixedReservation.update({
    where: { id },
    data: {
      clientName,
      timeStart,
      duration,
      type,
      totalPrice:    totalPrice    !== undefined ? totalPrice    : null,
      depositAmount: depositAmount !== undefined ? depositAmount : null,
    },
    include: { court: courtSelect },
  });
}

export async function toggleFixedReservation(id: number, userId: number) {
  const existing = await prisma.fixedReservation.findUnique({
    where: { id },
    select: { active: true, courtId: true },
  });
  if (!existing) throw new AppError('Fixed reservation not found', 404);

  // Auth: user must be a member of the court's club
  await assertClubMembership(existing.courtId, userId);

  return prisma.fixedReservation.update({
    where: { id },
    data: { active: !existing.active },
    include: { court: courtSelect },
  });
}

/**
 * Soft-deletes a fixed reservation by marking it inactive.
 * Past reservations that were generated from it are NOT affected.
 */
export async function deleteFixedReservation(id: number, userId: number): Promise<void> {
  const existing = await prisma.fixedReservation.findUnique({
    where: { id },
    select: { courtId: true },
  });
  if (!existing) throw new AppError('Fixed reservation not found', 404);

  await assertClubMembership(existing.courtId, userId);

  await prisma.fixedReservation.delete({
    where: { id },
  });
}

/**
 * Implements the rolling deposit financial model for fixed reservations.
 *
 * - Already paid today:
 *     todayPays = 0
 *
 * - Final week (isLastWeek):
 *     todayPays = pricePerSlot - carryOver
 *     carryOver → 0
 *
 * - Any other week:
 *     todayPays = pricePerSlot
 *     carryOver unchanged
 *
 * depositAmount is NEVER added to todayPays; it is set as carryOver at creation time.
 * Revenue tracked is always pricePerSlot regardless of todayPays.
 */
export async function processFixedPayment(
  id: number,
  isLastWeek: boolean,
  userId: number,
  paymentMethod = 'cash',
): Promise<ProcessPaymentResult> {
  const fr = await prisma.fixedReservation.findUnique({ where: { id } });
  if (!fr) throw new AppError('Fixed reservation not found', 404);

  const clubId = await assertClubMembership(fr.courtId, userId);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const pricePerSlot  = Number(fr.totalPrice    ?? 0);
  const depositAmount = Number(fr.depositAmount  ?? 0);
  const currentCarry = Number(fr.carryOver ?? 0);

  const paidToday = fr.lastPaidAt
    ? fr.lastPaidAt.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)
    : false;

  let todayPays: number;
  let newCarryOver: number;

  if (paidToday) {
    todayPays    = 0;
    newCarryOver = currentCarry;
  } else if (isLastWeek) {
    todayPays    = pricePerSlot - currentCarry;
    newCarryOver = 0;
  } else {
    todayPays    = pricePerSlot;
    newCarryOver = currentCarry;
  }
  
  await prisma.fixedReservation.update({
    where: { id },
    data:  { carryOver: newCarryOver, lastPaidAt: today },
  });

  if (!paidToday && pricePerSlot > 0) {
    await createCashMovement({
      clubId,
      type: 'income',
      concept: `Turno fijo - ${fr.clientName}`,
      amount: pricePerSlot,
      paymentMethod,
      fixedReservationId: id,
    });
  }

  return {
    id,
    carryOver:      String(newCarryOver),
    todayPays,
    pricePerSlot,
    depositAmount,
    isLastWeek,
    paidAt: today.toISOString().slice(0, 10),
  };
}
