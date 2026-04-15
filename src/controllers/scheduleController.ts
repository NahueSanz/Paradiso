import { NextFunction, Request, Response } from 'express';
import * as scheduleService from '../services/scheduleService';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function getSchedule(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date, clubId } = req.query;

    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      res.status(400).json({
        status: 'error',
        message: 'date query param is required (YYYY-MM-DD)',
      });
      return;
    }

    const clubIdNum = Number(clubId);
    if (!clubId || !Number.isInteger(clubIdNum) || clubIdNum <= 0) {
      res.status(400).json({
        status: 'error',
        message: 'clubId query param must be a positive integer',
      });
      return;
    }

    const schedule = await scheduleService.getScheduleByDateAndClub(
      date,
      clubIdNum,
      req.user.id,
    );

    res.json(schedule);
  } catch (err) {
    next(err);
  }
}
