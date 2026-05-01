import { NextFunction, Request, Response } from 'express';
import { createCashMovement, getCashMovementsByDateRange } from '../services/cashService';
import prisma from '../lib/prisma';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ── GET /cash?clubId=&from=&to=
export async function getCashMovements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const clubId = Number(req.query.clubId);
    const from   = String(req.query.from ?? '');
    const to     = String(req.query.to   ?? '');

    if (!Number.isInteger(clubId) || clubId <= 0) {
      res.status(400).json({ status: 'error', message: 'clubId must be a positive integer' });
      return;
    }
    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      res.status(400).json({ status: 'error', message: 'from and to must be dates in YYYY-MM-DD format' });
      return;
    }

    const movements = await getCashMovementsByDateRange(clubId, from, to);
    res.json(movements);
  } catch (err) {
    next(err);
  }
}

// ── POST /cash
export async function postCashMovement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { type, concept, amount, paymentMethod, relatedReservationId, fixedReservationId } = req.body;

    const errors: string[] = [];
    if (type !== 'income' && type !== 'expense')              errors.push('type must be "income" or "expense"');
    if (!concept || typeof concept !== 'string')              errors.push('concept is required');
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) errors.push('amount must be a number >= 0');
    if (!paymentMethod || typeof paymentMethod !== 'string')  errors.push('paymentMethod is required');

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: req.user.id },
    });

    if (!membership) {
      res.status(403).json({ status: 'error', message: 'User has no club membership' });
      return;
    }

    const movement = await createCashMovement({
      clubId: membership.clubId,
      type,
      concept,
      amount,
      paymentMethod,
      ...(relatedReservationId !== undefined ? { relatedReservationId } : {}),
      ...(fixedReservationId   !== undefined ? { fixedReservationId }   : {}),
    });

    res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
}
