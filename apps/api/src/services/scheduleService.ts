import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

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

export async function getScheduleByDateAndClub(
  dateStr: string,
  clubId: number,
  userId: number,
) {
  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
  });
  if (!membership) throw new AppError('Forbidden', 403);

  const date = parseDate(dateStr);

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

  const instances = await prisma.fixedReservationInstance.findMany({
    where: {
      date,
      clubId,
      status: { not: 'cancelled' },
    },
    include: {
      court: { select: { id: true, name: true } },
      fixedReservation: { select: { dayOfWeek: true } },
    },
    orderBy: [{ courtId: 'asc' }, { timeStart: 'asc' }],
  });

  const fixedReservations = instances.map((inst) => ({
    id:                inst.id,
    fixedReservationId: inst.fixedReservationId,
    courtId:           inst.courtId,
    dayOfWeek:         inst.fixedReservation.dayOfWeek,
    timeStart:         inst.timeStart,
    duration:          inst.duration,
    clientName:        inst.clientName,
    clientPhone:       inst.clientPhone ?? null,
    type:              inst.type,
    totalPrice:        inst.totalPrice    != null ? String(inst.totalPrice)    : null,
    depositAmount:     inst.depositAmount != null ? String(inst.depositAmount) : null,
    carryOver:         String(inst.carryOverDeposit),
    lastPaidAt:        inst.paidAt != null ? inst.paidAt.toISOString() : null,
    paymentStatus:     inst.paymentStatus,
    court:             inst.court,
  }));

  return {
    reservations:     reservations.map(withRemainingAmount),
    fixedReservations,
  };
}
