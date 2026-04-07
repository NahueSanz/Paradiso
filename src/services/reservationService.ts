import { PaymentStatus, PlayStatus, ReservationStatus, ReservationType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';

// Parses "YYYY-MM-DD" → Date at UTC midnight (matches @db.Date storage)
function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// Parses "HH:MM" → Date anchored to 1970-01-01 UTC (matches @db.Time storage)
function parseTime(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

const DEFAULT_DURATION: Record<ReservationType, number | null> = {
  [ReservationType.booking]: 90,
  [ReservationType.class]: 60,
  [ReservationType.challenge]: 90,
  [ReservationType.tournament]: null, // flexible — timeEnd required
};

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

function derivePaymentStatus(totalPrice: number | undefined, depositAmount: number | undefined): PaymentStatus {
  if (totalPrice === undefined || depositAmount === undefined || depositAmount <= 0) return PaymentStatus.pending;
  if (depositAmount >= totalPrice) return PaymentStatus.paid;
  return PaymentStatus.partial;
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
  type?: ReservationType;
  totalPrice?: number;
  depositAmount?: number;
}

export async function createReservation(input: CreateReservationInput) {
  const {
    courtId,
    date,
    timeStart,
    timeEnd,
    clientName,
    clientPhone,
    type = ReservationType.booking,
    totalPrice,
    depositAmount,
  } = input;

  // Price and deposit rules
  if (type === ReservationType.booking) {
    if (!totalPrice || totalPrice <= 0) {
      throw new AppError('booking reservations require a totalPrice greater than 0', 400);
    }
    if (depositAmount === undefined || depositAmount <= 0) {
      throw new AppError('booking reservations require a depositAmount greater than 0', 400);
    }
    if (depositAmount > totalPrice) {
      throw new AppError('depositAmount cannot exceed totalPrice', 400);
    }
  } else if (depositAmount !== undefined && depositAmount > 0) {
    throw new AppError(`${type} reservations do not accept a deposit`, 400);
  }

  const parsedDate = parseDate(date);
  const parsedStart = parseTime(timeStart);

  const defaultDuration = DEFAULT_DURATION[type];
  if (!timeEnd && defaultDuration === null) {
    throw new AppError('tournament reservations require an explicit timeEnd', 400);
  }
  const parsedEnd = timeEnd ? parseTime(timeEnd) : addMinutes(parsedStart, defaultDuration!);

  if (parsedEnd <= parsedStart) {
    throw new AppError('timeEnd must be after timeStart', 400);
  }

  await assertCourtExists(courtId);
  await assertNoOverlap(courtId, parsedDate, parsedStart, parsedEnd);

  const isBooking = type === ReservationType.booking;

  return prisma.reservation.create({
    data: {
      courtId,
      date: parsedDate,
      timeStart: parsedStart,
      timeEnd: parsedEnd,
      clientName,
      clientPhone,
      type,
      totalPrice: isBooking ? totalPrice : null,
      depositAmount: isBooking ? depositAmount : null,
      paymentStatus: derivePaymentStatus(totalPrice, depositAmount),
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
  totalPrice?: number | null;
  depositAmount?: number | null;
  status?: ReservationStatus;
  playStatus?: PlayStatus;
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
  
  function toNumber(value: Prisma.Decimal | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

const newTotalPrice = toNumber(
  input.totalPrice !== undefined ? input.totalPrice : existing.totalPrice
);

const newDepositAmount = toNumber(
  input.depositAmount !== undefined ? input.depositAmount : existing.depositAmount
);

  if (newDepositAmount != null && newTotalPrice != null && newDepositAmount > newTotalPrice) {
    throw new AppError('depositAmount cannot exceed totalPrice', 400);
  }

  return prisma.reservation.update({
    where: { id },
    data: {
      date: parsedDate,
      timeStart: parsedStart,
      timeEnd: parsedEnd,
      clientName: input.clientName ?? existing.clientName,
      clientPhone: input.clientPhone !== undefined ? input.clientPhone : existing.clientPhone,
      totalPrice: input.totalPrice !== undefined ? input.totalPrice : existing.totalPrice,
      depositAmount:
        input.depositAmount !== undefined ? input.depositAmount : existing.depositAmount,
      paymentStatus: derivePaymentStatus(newTotalPrice, newDepositAmount ?? undefined),
      playStatus: input.playStatus ?? existing.playStatus,
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
