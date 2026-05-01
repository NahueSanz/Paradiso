import { NextFunction, Request, Response } from 'express';
import * as svc from '../services/openingHoursService';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseClubId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function getOpeningHours(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubId = parseClubId(req.query.clubId);
    const { date } = req.query;
    if (!clubId) { res.status(400).json({ message: 'clubId must be a positive integer' }); return; }
    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      res.status(400).json({ message: 'date must be YYYY-MM-DD' }); return;
    }
    res.json(await svc.getEffectiveHours(clubId, date));
  } catch (err) { next(err); }
}

export async function getWeeklyDefaults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubId = parseClubId(req.query.clubId);
    if (!clubId) { res.status(400).json({ message: 'clubId must be a positive integer' }); return; }
    res.json(await svc.getWeeklyDefaults(clubId));
  } catch (err) { next(err); }
}

export async function updateDefaultHours(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, schedule } = req.body;
    if (!parseClubId(clubId) || !Array.isArray(schedule)) {
      res.status(400).json({ message: 'clubId and schedule[] are required' }); return;
    }
    await svc.upsertWeeklyDefaults(Number(clubId), schedule);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function updateDateHours(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, date, openTime, closeTime } = req.body;
    if (!parseClubId(clubId) || !date || !openTime || !closeTime) {
      res.status(400).json({ message: 'clubId, date, openTime, closeTime are required' }); return;
    }
    if (!DATE_REGEX.test(date)) { res.status(400).json({ message: 'date must be YYYY-MM-DD' }); return; }
    await svc.upsertDateOverride(Number(clubId), date, openTime, closeTime);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function deleteDateHours(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { clubId, date } = req.body;
    if (!parseClubId(clubId) || !date) {
      res.status(400).json({ message: 'clubId and date are required' }); return;
    }
    await svc.deleteDateOverride(Number(clubId), date);
    res.json({ ok: true });
  } catch (err) { next(err); }
}
