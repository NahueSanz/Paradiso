import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET!;

interface JwtPayload {
  id: number;
  role: Role;
}

function extractPayload(authHeader: string | undefined): JwtPayload | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Requires a valid JWT. Returns 401 if the token is missing or invalid.
 * Use this for endpoints that must be authenticated.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const payload = extractPayload(authHeader);
  if (!payload) {
    res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
    return;
  }

  req.user = { id: payload.id, role: payload.role };
  next();
}

