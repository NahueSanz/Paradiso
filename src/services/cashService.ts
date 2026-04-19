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

// Prisma returns Decimal fields as objects that serialize to strings in JSON.
// Always convert amount to a JS number before returning to the frontend.
function serializeMovement(m: { amount: unknown; [key: string]: unknown }) {
  return {
    ...m,
    amount: Number(m.amount),
  };
}

export async function createCashMovement(input: CreateCashMovementInput) {
  const movement = await prisma.cashMovement.create({ data: input });
  return serializeMovement(movement);
}

export async function getCashMovementsByDateRange(
  clubId: number,
  from: string,
  to: string,
) {
  const movements = await prisma.cashMovement.findMany({
    where: {
      clubId,
      createdAt: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return movements.map(serializeMovement);
}
