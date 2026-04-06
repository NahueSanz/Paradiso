import { ReservationStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

// Parses "YYYY-MM-DD" → Date at UTC midnight (matches @db.Date storage)
function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// Parses "HH:MM" → Date anchored to 1970-01-01 UTC (matches @db.Time storage)
function parseTime(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

const DEFAULT_DURATION_MINUTES = 90;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function assertNoOverlap(
  courtId: number,
  date: Date,
  timeStart: Date,
  timeEnd: Date,
  excludeId?: number,
) {
  const overlap = await prisma.reservation.findFirst({
    where: {
      courtId,
      date,
      status: { not: ReservationStatus.cancelled },
      timeStart: { lt: timeEnd },
      timeEnd: { gt: timeStart },
      ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
    },
  });

  if (overlap) {
    throw new AppError(
      `Court is already reserved from ${overlap.timeStart.toISOString().slice(11, 16)} ` +
        `to ${overlap.timeEnd.toISOString().slice(11, 16)} on that date`,
      409,
    );
  }
}

async function assertCourtExists(courtId: number) {
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court) throw new AppError('Court not found', 404);
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getReservationsByDate(dateStr: string) {
  const date = parseDate(dateStr);
  return prisma.reservation.findMany({
    where: { date },
    include: { court: { select: { id: true, name: true } } },
    orderBy: { timeStart: 'asc' },
  });
}

// ── Commands ───────────────────────────────────────────────────────────────

export interface CreateReservationInput {
  courtId: number;
  date: string;
  timeStart: string;
  timeEnd?: string;
  clientName: string;
  clientPhone?: string;
  depositAmount?: number;
}

export async function createReservation(input: CreateReservationInput) {
  const { courtId, date, timeStart, timeEnd, clientName, clientPhone, depositAmount } = input;

  const parsedDate = parseDate(date);
  const parsedStart = parseTime(timeStart);
  const parsedEnd = timeEnd ? parseTime(timeEnd) : addMinutes(parsedStart, DEFAULT_DURATION_MINUTES);

  if (parsedEnd <= parsedStart) {
    throw new AppError('timeEnd must be after timeStart', 400);
  }

  await assertCourtExists(courtId);
  await assertNoOverlap(courtId, parsedDate, parsedStart, parsedEnd);

  return prisma.reservation.create({
    data: {
      courtId,
      date: parsedDate,
      timeStart: parsedStart,
      timeEnd: parsedEnd,
      clientName,
      clientPhone,
      depositAmount,
    },
    include: { court: { select: { id: true, name: true } } },
  });
}

export interface UpdateReservationInput {
  date?: string;
  timeStart?: string;
  timeEnd?: string;
  clientName?: string;
  clientPhone?: string;
  depositAmount?: number | null;
  status?: ReservationStatus;
}

export async function updateReservation(id: number, input: UpdateReservationInput) {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw new AppError('Reservation not found', 404);

  if (existing.status === ReservationStatus.cancelled) {
    throw new AppError('Cannot modify a cancelled reservation', 400);
  }

  const parsedDate = input.date ? parseDate(input.date) : existing.date;
  const parsedStart = input.timeStart ? parseTime(input.timeStart) : existing.timeStart;
  const parsedEnd = input.timeEnd ? parseTime(input.timeEnd) : existing.timeEnd;

  if (parsedEnd <= parsedStart) {
    throw new AppError('timeEnd must be after timeStart', 400);
  }

  // Only re-check overlap when time or date actually changes
  const timeChanged = input.date || input.timeStart || input.timeEnd;
  if (timeChanged) {
    await assertNoOverlap(existing.courtId, parsedDate, parsedStart, parsedEnd, id);
  }

  return prisma.reservation.update({
    where: { id },
    data: {
      date: parsedDate,
      timeStart: parsedStart,
      timeEnd: parsedEnd,
      clientName: input.clientName ?? existing.clientName,
      clientPhone: input.clientPhone !== undefined ? input.clientPhone : existing.clientPhone,
      depositAmount:
        input.depositAmount !== undefined ? input.depositAmount : existing.depositAmount,
      status: input.status ?? existing.status,
    },
    include: { court: { select: { id: true, name: true } } },
  });
}

export async function deleteReservation(id: number) {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw new AppError('Reservation not found', 404);

  await prisma.reservation.delete({ where: { id } });
}
