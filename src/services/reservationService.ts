import { PaymentStatus, ReservationStatus, ReservationType } from '@prisma/client';
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

function toNumber(value: Prisma.Decimal | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

function derivePaymentStatus(totalPrice: number | undefined, depositAmount: number | undefined): PaymentStatus {
  if (totalPrice === undefined || depositAmount === undefined || depositAmount <= 0) return PaymentStatus.pending;
  if (depositAmount >= totalPrice) return PaymentStatus.paid;
  return PaymentStatus.partial;
}

function withRemainingAmount<T extends { totalPrice: Prisma.Decimal | null; depositAmount: Prisma.Decimal | null }>(
  r: T,
): T & { remainingAmount: number | null } {
  const total = r.totalPrice != null ? Number(r.totalPrice) : null;
  const deposit = r.depositAmount != null ? Number(r.depositAmount) : null;
  const remainingAmount = total !== null && deposit !== null ? Math.max(0, total - deposit) : null;
  return { ...r, remainingAmount };
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getReservationsByDate(dateStr: string) {
  const reservations = await prisma.reservation.findMany({
    where: { date: parseDate(dateStr) },
    include: { court: { select: { id: true, name: true } } },
    orderBy: { timeStart: 'asc' },
  });
  return reservations.map(withRemainingAmount);
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

  if (totalPrice !== undefined && depositAmount !== undefined && depositAmount > totalPrice) {
    throw new AppError('depositAmount cannot exceed totalPrice', 400);
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

  const result = await prisma.reservation.create({
    data: {
      courtId,
      date: parsedDate,
      timeStart: parsedStart,
      timeEnd: parsedEnd,
      clientName,
      clientPhone,
      type,
      totalPrice: totalPrice ?? null,
      depositAmount: depositAmount ?? null,
      paymentStatus: derivePaymentStatus(totalPrice, depositAmount),
    },
    include: { court: { select: { id: true, name: true } } },
  });

  return withRemainingAmount(result);
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
  type?: ReservationType;
  paymentStatus?: PaymentStatus;
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

  const timeChanged = input.date || input.timeStart || input.timeEnd;
  if (timeChanged) {
    await assertNoOverlap(existing.courtId, parsedDate, parsedStart, parsedEnd, id);
  }

  // Resolve effective total price
  const newTotalPrice =
    input.totalPrice !== undefined ? (input.totalPrice ?? undefined) : toNumber(existing.totalPrice);

  // Resolve deposit: if marking paid, deposit = total; otherwise use input or keep existing
  let newDepositAmount: number | null | undefined; // undefined = keep existing

  if (input.paymentStatus === PaymentStatus.paid) {
    newDepositAmount = newTotalPrice !== undefined ? newTotalPrice : null;
  } else if (input.depositAmount !== undefined) {
    newDepositAmount = input.depositAmount; // can be null to clear
  }

  // Effective deposit for validation
  const effectiveDeposit =
    newDepositAmount !== undefined ? (newDepositAmount ?? undefined) : toNumber(existing.depositAmount);

  if (newTotalPrice !== undefined && effectiveDeposit !== undefined && effectiveDeposit > newTotalPrice) {
    throw new AppError('depositAmount cannot exceed totalPrice', 400);
  }

  const resolvedPaymentStatus =
    input.paymentStatus ?? derivePaymentStatus(newTotalPrice, effectiveDeposit);

  const result = await prisma.reservation.update({
    where: { id },
    data: {
      date: parsedDate,
      timeStart: parsedStart,
      timeEnd: parsedEnd,
      clientName: input.clientName ?? existing.clientName,
      clientPhone: input.clientPhone !== undefined ? input.clientPhone : existing.clientPhone,
      totalPrice: input.totalPrice !== undefined ? input.totalPrice : existing.totalPrice,
      depositAmount: newDepositAmount !== undefined ? newDepositAmount : existing.depositAmount,
      type: input.type ?? existing.type,
      paymentStatus: resolvedPaymentStatus,
      status: input.status ?? existing.status,
    },
    include: { court: { select: { id: true, name: true } } },
  });

  return withRemainingAmount(result);
}

export async function deleteReservation(id: number) {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw new AppError('Reservation not found', 404);

  await prisma.reservation.delete({ where: { id } });
}
