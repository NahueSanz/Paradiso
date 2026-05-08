import { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma';

// ── PATCH /users/me
export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ message: 'El nombre debe tener al menos 2 caracteres' });
      return;
    }
    if (name.trim().length > 50) {
      res.status(400).json({ message: 'El nombre no puede superar los 50 caracteres' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data:  { name: name.trim() },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
