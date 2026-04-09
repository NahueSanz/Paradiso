import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

const OWNER_SELECT = { select: { id: true, name: true, email: true } };
const COURTS_SELECT = { select: { id: true, name: true } };

export async function createClub(data: { name: string; ownerId: number }) {
  return prisma.club.create({
    data,
    include: { owner: OWNER_SELECT },
  });
}

export async function getMyClubs(ownerId: number) {
  return prisma.club.findMany({
    where: { ownerId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function updateClub(id: number, name: string, ownerId: number) {
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) throw new AppError('Club not found', 404);
  if (club.ownerId !== ownerId) throw new AppError('Forbidden', 403);

  return prisma.club.update({
    where: { id },
    data: { name },
    include: { owner: OWNER_SELECT },
  });
}
