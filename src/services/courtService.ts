import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

export async function getCourts() {
  return prisma.court.findMany({
    include: { club: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createCourt(data: { name: string; clubId: number }) {
  const club = await prisma.club.findUnique({ where: { id: data.clubId } });
  if (!club) throw new AppError('Club not found', 404);

  return prisma.court.create({
    data,
    include: { club: { select: { id: true, name: true } } },
  });
}
