import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

const OWNER_SELECT = { select: { id: true, name: true, email: true } };
const COURTS_SELECT = { select: { id: true, name: true } };

export async function createClub(data: { name: string; ownerId: number }) {
  return prisma.$transaction(async (tx) => {
    const club = await tx.club.create({
      data,
      include: { owner: OWNER_SELECT },
    });

    await tx.membership.upsert({
      where: { userId_clubId: { userId: data.ownerId, clubId: club.id } },
      create: {
        userId: data.ownerId,
        clubId: club.id,
        role: 'owner',
        displayName: club.owner.name,
      },
      update: {},
    });

    return club;
  });
}

export async function getMyClubs(userId: number) {
  return prisma.club.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { memberships: { some: { userId } } },
      ],
    },
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
