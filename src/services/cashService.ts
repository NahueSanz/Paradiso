import prisma from '../lib/prisma';

export interface CreateCashMovementInput {
  clubId: number;
  type: 'income' | 'expense';
  concept: string;
  amount: number;
  paymentMethod: string;
  relatedReservationId?: number;
  fixedReservationId?: number;
}

export async function createCashMovement(input: CreateCashMovementInput) {
  return prisma.cashMovement.create({ data: input });
}

export async function getCashMovementsByDateRange(
  clubId: number,
  from: string,
  to: string,
) {
  return prisma.cashMovement.findMany({
    where: {
      clubId,
      createdAt: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
