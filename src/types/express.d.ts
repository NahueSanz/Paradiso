import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: Role;
      };
      membership?: {
        id: number;
        userId: number;
        clubId: number;
        role: Role;
        displayName: string;
      };
    }
  }
}

export {};
