import { Request, Response, NextFunction } from 'express';
import { getRevenue, getReservationsReport } from '../services/analyticsService';
import { AppError } from '../middlewares/errorHandler';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseClubId(raw: unknown): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n <= 0) {
    throw new AppError('Query param "clubId" must be a positive integer', 400);
  }
  return n;
}

export async function revenueHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, clubId: rawClubId } = req.query as { from?: string; to?: string; clubId?: string };

    if (!from || !DATE_RE.test(from)) {
      throw new AppError('Query param "from" must be YYYY-MM-DD', 400);
    }
    if (!to || !DATE_RE.test(to)) {
      throw new AppError('Query param "to" must be YYYY-MM-DD', 400);
    }
    if (from > to) {
      throw new AppError('"from" must be before or equal to "to"', 400);
    }
    const clubId = parseClubId(rawClubId);

    const data = await getRevenue(from, to, clubId, req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reservationsReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, clubId: rawClubId } = req.query as { from?: string; to?: string; clubId?: string };

    if (!from || !DATE_RE.test(from)) {
      throw new AppError('Query param "from" must be YYYY-MM-DD', 400);
    }
    if (!to || !DATE_RE.test(to)) {
      throw new AppError('Query param "to" must be YYYY-MM-DD', 400);
    }
    if (from > to) {
      throw new AppError('"from" must be before or equal to "to"', 400);
    }
    const clubId = parseClubId(rawClubId);

    const rows = await getReservationsReport(from, to, clubId, req.user!.id);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
