import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ status: 'error', message: 'Forbidden' });
      return;
    }
    next();
  };
}
