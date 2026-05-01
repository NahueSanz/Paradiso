import { NextFunction, Request, Response } from 'express';
import * as movementService from '../services/movementService';
import prisma from '../lib/prisma';

async function getClubId(userId: number): Promise<number | null> {
  const membership = await prisma.membership.findFirst({ where: { userId } });
  return membership?.clubId ?? null;
}

// GET /movements?clubId=&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function listMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubId = Number(req.query.clubId);
    if (!Number.isInteger(clubId) || clubId <= 0) {
      res.status(400).json({ message: 'clubId must be a positive integer' });
      return;
    }

    const { from: fromStr, to: toStr } = req.query as { from?: string; to?: string };

    let from: Date | undefined;
    let to:   Date | undefined;

    if (fromStr || toStr) {
      if (!fromStr || !toStr) {
        res.status(400).json({ message: 'Both from and to are required when filtering by date' });
        return;
      }
      from = new Date(`${fromStr}T00:00:00.000Z`);
      to   = new Date(`${toStr}T23:59:59.999Z`);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        res.status(400).json({ message: 'from and to must be valid dates (YYYY-MM-DD)' });
        return;
      }
      if (from > to) {
        res.status(400).json({ message: 'from must not be after to' });
        return;
      }
    }

    const movements = await movementService.getMovements(clubId, from, to);
    res.json(movements);
  } catch (err) {
    next(err);
  }
}

// POST /movements/manual
export async function createManual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, description, paymentMethod } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ message: 'amount must be a positive number' });
      return;
    }
    if (!description || typeof description !== 'string') {
      res.status(400).json({ message: 'description is required' });
      return;
    }
    if (paymentMethod !== 'cash' && paymentMethod !== 'mercadopago') {
      res.status(400).json({ message: 'paymentMethod must be "cash" or "mercadopago"' });
      return;
    }

    const clubId = await getClubId(req.user.id);
    if (!clubId) {
      res.status(403).json({ message: 'User has no club membership' });
      return;
    }

    const movement = await movementService.createManualMovement({ clubId, amount: Number(amount), description, paymentMethod });
    res.status(201).json(movement);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ message: err.message }); return; }
    next(err);
  }
}

// POST /movements/sale
export async function createSale(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, quantity, paymentMethod } = req.body;
    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({ message: 'productId must be a positive integer' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ message: 'quantity must be a positive integer' });
      return;
    }
    if (paymentMethod !== 'cash' && paymentMethod !== 'mercadopago') {
      res.status(400).json({ message: 'paymentMethod must be "cash" or "mercadopago"' });
      return;
    }

    const clubId = await getClubId(req.user.id);
    if (!clubId) {
      res.status(403).json({ message: 'User has no club membership' });
      return;
    }

    const movement = await movementService.createSaleMovement({ clubId, productId: Number(productId), quantity: Number(quantity), paymentMethod });
    res.status(201).json(movement);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ message: err.message }); return; }
    next(err);
  }
}

// PATCH /movements/:id/cancel
export async function cancelMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Invalid movement id' });
      return;
    }

    const clubId = await getClubId(req.user.id);
    if (!clubId) {
      res.status(403).json({ message: 'User has no club membership' });
      return;
    }

    const movement = await movementService.cancelMovement(id, clubId);
    res.json(movement);
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ message: err.message }); return; }
    next(err);
  }
}

// DELETE /movements/:id
export async function deleteMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Invalid movement id' });
      return;
    }

    const clubId = await getClubId(req.user.id);
    if (!clubId) {
      res.status(403).json({ message: 'User has no club membership' });
      return;
    }

    await movementService.deleteMovement(id, clubId);
    res.status(204).end();
  } catch (err: any) {
    if (err.status) { res.status(err.status).json({ message: err.message }); return; }
    next(err);
  }
}
