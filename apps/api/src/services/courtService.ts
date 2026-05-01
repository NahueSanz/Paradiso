import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ReservationStatus } from '@prisma/client';

// Scopes courts to clubs owned by OR employing the requesting user.
// If clubId is provided it is used as an additional filter — ownership is
// still enforced, so guessing another club's id returns nothing.
export async function getCourts(userId: number, clubId?: number) {
  return prisma.court.findMany({
    where: {
      ...(clubId !== undefined ? { clubId } : {}),
      club: {
        OR: [
          { ownerId: userId },
          { employees: { some: { id: userId } } },
        ],
      },
    },
    include: { club: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createCourt(data: { name: string; clubId: number; ownerId: number }) {
  const { ownerId, ...courtData } = data;

  const club = await prisma.club.findUnique({ where: { id: data.clubId } });
  if (!club) throw new AppError('Club not found', 404);
  if (club.ownerId !== ownerId) throw new AppError('Forbidden: club does not belong to you', 403);

  return prisma.court.create({
    data: courtData,
    include: { club: { select: { id: true, name: true } } },
  });
}

export async function updateCourt(id: number, name: string, userId: number) {
  const court = await prisma.court.findUnique({
    where: { id },
    include: { club: { select: { ownerId: true } } },
  });
  if (!court) throw new AppError('Court not found', 404);
  if (court.club.ownerId !== userId) throw new AppError('Forbidden', 403);

  return prisma.court.update({
    where: { id },
    data: { name },
    include: { club: { select: { id: true, name: true } } },
  });
}

export async function deleteCourt(id: number, userId: number) {
  const court = await prisma.court.findUnique({
    where: { id },
    include: { club: { select: { ownerId: true } } },
  });
  if (!court) throw new AppError('Court not found', 404);
  if (court.club.ownerId !== userId) throw new AppError('Forbidden', 403);

  const now = new Date();
  const todayDate = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);

  const futureReservation = await prisma.reservation.findFirst({
    where: {
      courtId: id,
      status: { not: ReservationStatus.cancelled },
      date: { gte: todayDate },
    },
  });

  if (futureReservation) {
    throw new AppError('Cannot delete court with future reservations', 409);
  }

  await prisma.court.delete({ where: { id } });
}
