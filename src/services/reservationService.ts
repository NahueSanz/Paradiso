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

const membershipSelect = { select: { id: true, displayName: true } } as const;

export async function getReservationsByDate(dateStr: string, userId: number) {
  const reservations = await prisma.reservation.findMany({
    where: {
      date: parseDate(dateStr),
      court: {
        club: {
          OR: [
            { ownerId: userId },
            { employees: { some: { id: userId } } },
          ],
        },
      },
    },
    include: {
      court: { select: { id: true, name: true } },
      createdByMembership: membershipSelect,
      updatedByMembership: membershipSelect,
    },
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
  membershipId?: number;
}

export async function createReservation(input: CreateReservationInput, userId: number) {
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
    membershipId,
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

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { club: { select: { ownerId: true, employees: { select: { id: true } } } } },
  });
  if (!court) throw new AppError('Court not found', 404);
  const isOwner = court.club.ownerId === userId;
  const isEmployee = court.club.employees.some((e) => e.id === userId);
  if (!isOwner && !isEmployee) throw new AppError('Forbidden', 403);

  await assertNoOverlap(courtId, parsedDate, parsedStart, parsedEnd);

  const resolvedPaymentStatus = derivePaymentStatus(totalPrice, depositAmount);

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
      paymentStatus: resolvedPaymentStatus,
      playStatus: resolvedPaymentStatus === PaymentStatus.paid ? PlayStatus.finished : undefined,
      createdByMembershipId: membershipId ?? null,
    },
    include: {
      court: { select: { id: true, name: true } },
      createdByMembership: membershipSelect,
      updatedByMembership: membershipSelect,
    },
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
  playStatus?: PlayStatus;
  membershipId?: number;
}

export async function updateReservation(id: number, input: UpdateReservationInput, userId: number) {
  const existing = await prisma.reservation.findUnique({
    where: { id },
    include: { court: { select: { club: { select: { ownerId: true, employees: { select: { id: true } } } } } } },
  });
  if (!existing) throw new AppError('Reservation not found', 404);

  const isOwner = existing.court.club.ownerId === userId;
  const isEmployee = existing.court.club.employees.some((e) => e.id === userId);
  if (!isOwner && !isEmployee) throw new AppError('Forbidden', 403);

  if (existing.status === ReservationStatus.cancelled) {
    throw new AppError('Cannot modify a cancelled reservation', 400);
  }

  // Compute effective times for validation — only write to DB if explicitly provided
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

  // When marking as paid, auto-set depositAmount = totalPrice if not explicitly provided
  const newTotalPrice =
    input.totalPrice !== undefined ? (input.totalPrice ?? undefined) : toNumber(existing.totalPrice);

  let resolvedDepositAmount = input.depositAmount;
  if (input.paymentStatus === PaymentStatus.paid && resolvedDepositAmount === undefined) {
    resolvedDepositAmount = newTotalPrice !== undefined ? newTotalPrice : null;
  }

  const effectiveDeposit =
    resolvedDepositAmount !== undefined ? (resolvedDepositAmount ?? undefined) : toNumber(existing.depositAmount);

  if (newTotalPrice !== undefined && effectiveDeposit !== undefined && effectiveDeposit > newTotalPrice) {
    throw new AppError('depositAmount cannot exceed totalPrice', 400);
  }

  // Build update payload dynamically — only include fields that were explicitly provided.
  // This prevents concurrent requests from overwriting each other's changes.
  const data: Partial<{
    date: Date; timeStart: Date; timeEnd: Date;
    clientName: string; clientPhone: string | null;
    totalPrice: number | null; depositAmount: number | null;
    status: ReservationStatus; type: ReservationType;
    paymentStatus: PaymentStatus; playStatus: PlayStatus;
    updatedByMembershipId: number | null;
  }> = {};

  if (input.date !== undefined) data.date = parsedDate;
  if (input.timeStart !== undefined) data.timeStart = parsedStart;
  if (input.timeEnd !== undefined) data.timeEnd = parsedEnd;
  if (input.clientName !== undefined) data.clientName = input.clientName;
  if (input.clientPhone !== undefined) data.clientPhone = input.clientPhone;

  if (input.totalPrice !== undefined) data.totalPrice = input.totalPrice;
  if (resolvedDepositAmount !== undefined) data.depositAmount = resolvedDepositAmount;

  if (input.status !== undefined) data.status = input.status;
  if (input.type !== undefined) data.type = input.type;

  // CRITICAL: only overwrite these if the caller explicitly sent them
  if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
  if (input.playStatus !== undefined) data.playStatus = input.playStatus;

  if (input.membershipId !== undefined) data.updatedByMembershipId = input.membershipId;

  const result = await prisma.reservation.update({
    where: { id },
    data,
    include: {
      court: { select: { id: true, name: true } },
      createdByMembership: membershipSelect,
      updatedByMembership: membershipSelect,
    },
  });

  return withRemainingAmount(result);
}

export async function deleteReservation(id: number, userId: number) {
  const existing = await prisma.reservation.findUnique({
    where: { id },
    include: { court: { select: { club: { select: { ownerId: true, employees: { select: { id: true } } } } } } },
  });
  if (!existing) throw new AppError('Reservation not found', 404);

  const isOwner = existing.court.club.ownerId === userId;
  const isEmployee = existing.court.club.employees.some((e) => e.id === userId);
  if (!isOwner && !isEmployee) throw new AppError('Forbidden', 403);

  await prisma.reservation.delete({ where: { id } });
}
