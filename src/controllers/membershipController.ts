import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

export async function getMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubId = Number(req.query.clubId);
    if (!Number.isInteger(clubId) || clubId <= 0) {
      res.status(400).json({ status: 'error', message: 'clubId query param is required' });
      return;
    }

    let membership = await prisma.membership.findUnique({
      where: { userId_clubId: { userId: req.user!.id, clubId } },
      select: { id: true, clubId: true, role: true, displayName: true },
    });

    // Auto-create membership for owners who don't have one yet (legacy accounts)
    if (!membership) {
      const club = await prisma.club.findFirst({
        where: { id: clubId, ownerId: req.user!.id },
        include: { owner: { select: { name: true } } },
      });

      if (club) {
        membership = await prisma.membership.create({
          data: {
            userId: req.user!.id,
            clubId,
            role: 'owner',
            displayName: club.owner.name,
          },
          select: { id: true, clubId: true, role: true, displayName: true },
        });
      }
    }

    if (!membership) {
      res.status(404).json({ status: 'error', message: 'Membership not found' });
      return;
    }

    res.json(membership);
  } catch (err) {
    next(err);
  }
}

export async function updateMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid membership id' });
      return;
    }

    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
      res.status(400).json({ status: 'error', message: 'displayName is required (min 2 characters)' });
      return;
    }

    const membership = await prisma.membership.findUnique({ where: { id } });
    if (!membership) {
      throw new AppError('Membership not found', 404);
    }

    const isOwnMembership = membership.userId === req.user!.id;
    const isOwnerRole = req.user!.role === 'owner';

    if (!isOwnMembership && !isOwnerRole) {
      throw new AppError('Forbidden', 403);
    }

    // Owner can only edit memberships in clubs they own
    if (!isOwnMembership && isOwnerRole) {
      const club = await prisma.club.findFirst({
        where: { id: membership.clubId, ownerId: req.user!.id },
      });
      if (!club) throw new AppError('Forbidden', 403);
    }

    const updated = await prisma.membership.update({
      where: { id },
      data: { displayName: displayName.trim() },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
