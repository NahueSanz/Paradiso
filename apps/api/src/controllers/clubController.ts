import { NextFunction, Request, Response } from 'express';
import * as clubService from '../services/clubService';

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
