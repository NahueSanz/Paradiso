import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export function requireOwnerMembership(req: Request, res: Response, next: NextFunction): void {
  if (!req.membership) {
    res.status(403).json({ message: 'X-Club-Id header required' });
    return;
  }
  if (req.membership.role !== 'owner') {
    res.status(403).json({ message: 'Se requiere rol de dueño para esta acción' });
    return;
  }
  next();
}

/**
 * Optionally resolves the caller's Membership for a given club.
 * Reads the club id from the X-Club-Id request header.
 * Sets req.membership when found; silently skips when header is absent or invalid.
 */
export async function resolveMembership(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const clubIdHeader = req.headers['x-club-id'];
  if (!clubIdHeader) {
    next();
    return;
  }

  const clubId = Number(clubIdHeader);
  if (!Number.isInteger(clubId) || clubId <= 0) {
    next();
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId: req.user.id, clubId } },
  });
  if (membership) {
    req.membership = membership;
  }

  next();
}
