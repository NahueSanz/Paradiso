import { ReservationStatus } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import * as reservationService from '../services/reservationService';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_STATUSES = Object.values(ReservationStatus);

export async function getReservations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date } = req.query;

    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      res.status(400).json({ status: 'error', message: 'date query param is required (YYYY-MM-DD)' });
      return;
    }

    const reservations = await reservationService.getReservationsByDate(date);
    res.json(reservations);
  } catch (err) {
    next(err);
  }
}

export async function createReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { courtId, date, timeStart, timeEnd, clientName, clientPhone, depositAmount } = req.body;
    const errors: string[] = [];

    if (courtId === undefined || !Number.isInteger(courtId) || courtId <= 0) {
      errors.push('courtId must be a positive integer');
    }
    if (!date || !DATE_REGEX.test(date)) {
      errors.push('date is required (YYYY-MM-DD)');
    }
    if (!timeStart || !TIME_REGEX.test(timeStart)) {
      errors.push('timeStart is required (HH:MM)');
    }
    if (timeEnd !== undefined && !TIME_REGEX.test(timeEnd)) {
      errors.push('timeEnd must be HH:MM');
    }
    if (!clientName || typeof clientName !== 'string' || clientName.trim() === '') {
      errors.push('clientName is required');
    }
    if (clientPhone !== undefined && typeof clientPhone !== 'string') {
      errors.push('clientPhone must be a string');
    }
    if (depositAmount !== undefined && (typeof depositAmount !== 'number' || depositAmount < 0)) {
      errors.push('depositAmount must be a non-negative number');
    }

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const reservation = await reservationService.createReservation({
      courtId,
      date,
      timeStart,
      timeEnd,
      clientName: clientName.trim(),
      clientPhone,
      depositAmount,
    });

    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function updateReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid reservation id' });
      return;
    }

    const { date, timeStart, timeEnd, clientName, clientPhone, depositAmount, status } = req.body;
    const errors: string[] = [];

    if (date !== undefined && !DATE_REGEX.test(date)) {
      errors.push('date must be YYYY-MM-DD');
    }
    if (timeStart !== undefined && !TIME_REGEX.test(timeStart)) {
      errors.push('timeStart must be HH:MM');
    }
    if (timeEnd !== undefined && !TIME_REGEX.test(timeEnd)) {
      errors.push('timeEnd must be HH:MM');
    }
    if (clientName !== undefined && (typeof clientName !== 'string' || clientName.trim() === '')) {
      errors.push('clientName must be a non-empty string');
    }
    if (clientPhone !== undefined && clientPhone !== null && typeof clientPhone !== 'string') {
      errors.push('clientPhone must be a string or null');
    }
    if (
      depositAmount !== undefined &&
      depositAmount !== null &&
      (typeof depositAmount !== 'number' || depositAmount < 0)
    ) {
      errors.push('depositAmount must be a non-negative number or null');
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const reservation = await reservationService.updateReservation(id, {
      date,
      timeStart,
      timeEnd,
      clientName: clientName?.trim(),
      clientPhone,
      depositAmount,
      status,
    });

    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function deleteReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid reservation id' });
      return;
    }

    await reservationService.deleteReservation(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
