import { NextFunction, Request, Response } from 'express';
import * as clubService from '../services/clubService';
import prisma from '../lib/prisma';

export async function getClubs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubs = await clubService.getMyClubs(req.user.id);
    res.json(clubs);
  } catch (err) {
    next(err);
  }
}

export async function updateClub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid club id' });
      return;
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ status: 'error', message: 'name is required' });
      return;
    }

    const club = await clubService.updateClub(id, name.trim(), req.user.id);
    res.json(club);
  } catch (err) {
    next(err);
  }
}

export async function getClubMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.membership) {
      res.status(403).json({ status: 'error', message: 'X-Club-Id header required' });
      return;
    }
    if (req.membership.role !== 'owner') {
      res.status(403).json({ status: 'error', message: 'Forbidden' });
      return;
    }

    const memberships = await prisma.membership.findMany({
      where: { clubId: req.membership.clubId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    res.json(memberships.map((m) => ({
      id:   m.user.id,
      name: m.user.name,
      email: m.user.email,
      displayName: m.displayName,
      role: m.role,
    })));
  } catch (err) {
    next(err);
  }
}

export async function createClub(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ status: 'error', message: 'name is required' });
      return;
    }

    const club = await clubService.createClub({ name: name.trim(), ownerId: req.user.id });
    res.status(201).json(club);
  } catch (err) {
    next(err);
  }
}
