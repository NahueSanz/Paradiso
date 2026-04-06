import { NextFunction, Request, Response } from 'express';
import * as courtService from '../services/courtService';

export async function getCourts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const courts = await courtService.getCourts();
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

    const court = await courtService.createCourt({ name: name.trim(), clubId });
    res.status(201).json(court);
  } catch (err) {
    next(err);
  }
}
