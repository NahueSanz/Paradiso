import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

export async function createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, clubId, displayName } = req.body;

    if (!email || !clubId) {
      res.status(400).json({ status: 'error', message: 'email and clubId are required' });
      return;
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
      res.status(400).json({ status: 'error', message: 'displayName is required (min 2 characters)' });
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
        displayName: displayName.trim(),
      },
      select: { id: true, email: true, clubId: true, displayName: true, token: true, createdAt: true },
    });

    res.status(201).json({ status: 'success', token: invitation.token, invitation });
  } catch (err) {
    next(err);
  }
}

export async function inviteToClub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubId = Number(req.params.clubId);
    if (!Number.isInteger(clubId) || clubId <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid clubId' });
      return;
    }

    const { email, displayName } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ status: 'error', message: 'email is required' });
      return;
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
      res.status(400).json({ status: 'error', message: 'displayName is required (min 2 characters)' });
      return;
    }

    const club = await prisma.club.findFirst({
      where: { id: clubId, ownerId: req.user!.id },
    });

    if (!club) {
      res.status(403).json({ status: 'error', message: 'Club not found or does not belong to you' });
      return;
    }

    const token = randomUUID();

    const invitation = await prisma.invitation.create({
      data: {
        email,
        clubId,
        token,
        displayName: displayName.trim(),
      },
      select: { id: true, email: true, clubId: true, displayName: true, token: true, createdAt: true },
    });

    res.status(201).json({ status: 'success', token: invitation.token, invitation });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token: inviteToken, password, name } = req.body;

    if (!inviteToken || !password) {
      res.status(400).json({ status: 'error', message: 'token and password are required' });
      return;
    }

    const invitation = await prisma.invitation.findUnique({ where: { token: inviteToken } });

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
    const memberDisplayName = invitation.displayName ?? name ?? invitation.email;

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          password: hashed,
          name: name ?? invitation.email,
          role: invitation.role,
          clubId: invitation.clubId,
        },
        select: { id: true, email: true, name: true, role: true, clubId: true, createdAt: true },
      });

      await tx.invitation.update({
        where: { token: inviteToken },
        data: { acceptedAt: new Date() },
      });

      await tx.membership.create({
        data: {
          userId: newUser.id,
          clubId: invitation.clubId,
          role: invitation.role,
          displayName: memberDisplayName,
        },
      });

      return newUser;
    });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.status(201).json({ status: 'success', token, user });
  } catch (err) {
    next(err);
  }
}
