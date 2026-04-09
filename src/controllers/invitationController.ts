import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';

export async function createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, clubId } = req.body;

    if (!email || !clubId) {
      res.status(400).json({ status: 'error', message: 'email and clubId are required' });
      return;
    }

    // Club must belong to the authenticated owner
    const club = await prisma.club.findFirst({
      where: { id: Number(clubId), ownerId: req.user!.id },
    });

    if (!club) {
      res.status(403).json({ status: 'error', message: 'Club not found or does not belong to you' });
      return;
    }

    const token = randomUUID();

    const invitation = await prisma.invitation.create({
      data: {
        email,
        clubId: Number(clubId),
        token,
      },
      select: { id: true, email: true, clubId: true, token: true, createdAt: true },
    });

    // In production, send invitation.token via email.
    // For now, return it directly so it can be used for testing.
    res.status(201).json({ status: 'success', invitation });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password, name } = req.body;

    if (!token || !password) {
      res.status(400).json({ status: 'error', message: 'token and password are required' });
      return;
    }

    const invitation = await prisma.invitation.findUnique({ where: { token } });

    if (!invitation) {
      res.status(404).json({ status: 'error', message: 'Invalid invitation token' });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(409).json({ status: 'error', message: 'Invitation already accepted' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      res.status(409).json({ status: 'error', message: 'An account with this email already exists' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);

    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invitation.email,
          password: hashed,
          name: name ?? invitation.email,
          role: invitation.role,
          clubId: invitation.clubId,
        },
        select: { id: true, email: true, name: true, role: true, clubId: true, createdAt: true },
      }),
      prisma.invitation.update({
        where: { token },
        data: { acceptedAt: new Date() },
      }),
    ]);

    res.status(201).json({ status: 'success', user });
  } catch (err) {
    next(err);
  }
}
