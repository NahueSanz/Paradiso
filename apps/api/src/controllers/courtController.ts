import { NextFunction, Request, Response } from 'express';
import * as courtService from '../services/courtService';

export async function getCourts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubIdRaw = req.query.clubId;
    let clubId: number | undefined;

    if (clubIdRaw !== undefined) {
      clubId = Number(clubIdRaw);
      if (!Number.isInteger(clubId) || clubId <= 0) {
        res.status(400).json({ status: 'error', message: 'clubId must be a positive integer' });
        return;
      }
    }
    const user = req.user;
    
    const courts = await courtService.getCourts(user.id, clubId);
    res.json(courts);
  } catch (err) {
    next(err);
  }
}

export async function createCourt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, clubId } = req.body;
    const errors: string[] = [];

    if (!name || typeof name !== 'string' || name.trim() === '') {
      errors.push('name is required');
    }
    if (clubId === undefined || !Number.isInteger(clubId) || clubId <= 0) {
      errors.push('clubId must be a positive integer');
    }

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const court = await courtService.createCourt({ name: name.trim(), clubId, ownerId: req.user.id });
    res.status(201).json(court);
  } catch (err) {
    next(err);
  }
}

export async function updateCourt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid court id' });
      return;
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ status: 'error', message: 'name is required' });
      return;
    }

    const court = await courtService.updateCourt(id, name.trim(), req.user.id);
    res.json(court);
  } catch (err) {
    next(err);
  }
}

export async function deleteCourt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid court id' });
      return;
    }

    await courtService.deleteCourt(id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
