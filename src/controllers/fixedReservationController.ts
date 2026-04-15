import { NextFunction, Request, Response } from 'express';
import * as fixedReservationService from '../services/fixedReservationService';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_DAYS = [0, 1, 2, 3, 4, 5, 6];

// ── Pricing helpers ────────────────────────────────────────────────────────────

/**
 * Parses an optional price field from the request body.
 * Returns { value: number | null } on success or { error: string } on failure.
 */
function parseOptionalPrice(
  raw: unknown,
  fieldName: string,
): { value: number | null; error?: never } | { value?: never; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null };
  }
  const n = Number(raw);
  if (isNaN(n) || n < 0) {
    return { error: `${fieldName} must be a number >= 0` };
  }
  return { value: n };
}

// ── GET /fixed-reservations?clubId=<n>
//      Returns all fixed reservations grouped by court for a club.
//
// ── GET /fixed-reservations?date=<YYYY-MM-DD>&courtId=<n>
//      Returns active fixed reservations for a court on a specific date,
//      shaped for merging into the schedule grid.
export async function getFixedReservations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { clubId, date, courtId } = req.query;

    // Club-based listing (management view)
    if (clubId !== undefined) {
      const clubIdNum = Number(clubId);
      if (!Number.isInteger(clubIdNum) || clubIdNum <= 0) {
        res.status(400).json({ status: 'error', message: 'clubId must be a positive integer' });
        return;
      }
      const grouped = await fixedReservationService.getFixedReservationsByClub(clubIdNum, req.user.id);
      res.json(grouped);
      return;
    }

    // Date + court-based listing (schedule grid view)
    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      res.status(400).json({ status: 'error', message: 'date query param is required (YYYY-MM-DD) when clubId is not provided' });
      return;
    }
    const courtIdNum = Number(courtId);
    if (!courtId || !Number.isInteger(courtIdNum) || courtIdNum <= 0) {
      res.status(400).json({ status: 'error', message: 'courtId query param must be a positive integer' });
      return;
    }

    const reservations = await fixedReservationService.getFixedReservationsByDateAndCourt(date, courtIdNum);
    res.json(reservations);
  } catch (err) {
    next(err);
  }
}

// ── POST /fixed-reservations
export async function createFixedReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { courtId, dayOfWeek, timeStart, duration, clientName, type, totalPrice, depositAmount } = req.body;
    const parsedDuration = Number(duration);

    const errors: string[] = [];

    if (courtId === undefined || !Number.isInteger(courtId) || courtId <= 0) {
      errors.push('courtId must be a positive integer');
    }
    if (dayOfWeek === undefined || !VALID_DAYS.includes(dayOfWeek)) {
      errors.push('dayOfWeek must be an integer 0–6 (0 = Sunday)');
    }
    if (!timeStart || !TIME_REGEX.test(timeStart)) {
      errors.push('timeStart is required (HH:MM)');
    }
    if (duration === undefined || isNaN(parsedDuration) || parsedDuration <= 0) {
      errors.push('duration must be a positive integer (minutes)');
    } else if (parsedDuration > 240) {
      errors.push('duration cannot exceed 240 minutes');
    }
    if (!clientName || typeof clientName !== 'string' || clientName.trim() === '') {
      errors.push('clientName is required');
    }
    if (!type || typeof type !== 'string' || type.trim() === '') {
      errors.push('type is required');
    }

    const priceResult    = parseOptionalPrice(totalPrice,    'totalPrice');
    const depositResult  = parseOptionalPrice(depositAmount, 'depositAmount');
    if (priceResult.error)   errors.push(priceResult.error);
    if (depositResult.error) errors.push(depositResult.error);
    if (
      priceResult.value   != null &&
      depositResult.value != null &&
      depositResult.value > priceResult.value
    ) {
      errors.push('depositAmount cannot exceed totalPrice');
    }

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const created = await fixedReservationService.createFixedReservation(
      {
        courtId,
        dayOfWeek,
        timeStart,
        duration: parsedDuration,
        clientName: clientName.trim(),
        type: type.trim(),
        totalPrice:    priceResult.value   ?? undefined,
        depositAmount: depositResult.value ?? undefined,
      },
      req.user.id,
    );

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// ── PUT /fixed-reservations/:id
export async function updateFixedReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid fixed reservation id' });
      return;
    }

    const { clientName, timeStart, duration, type, totalPrice, depositAmount } = req.body;
    const parsedDuration = Number(duration);
    const errors: string[] = [];

    if (!clientName || typeof clientName !== 'string' || clientName.trim() === '') {
      errors.push('clientName is required');
    }
    if (!timeStart || !TIME_REGEX.test(timeStart)) {
      errors.push('timeStart is required (HH:MM)');
    }
    if (duration === undefined || isNaN(parsedDuration) || parsedDuration <= 0) {
      errors.push('duration must be a positive integer (minutes)');
    } else if (parsedDuration > 240) {
      errors.push('duration cannot exceed 240 minutes');
    }

    const priceResult   = parseOptionalPrice(totalPrice,    'totalPrice');
    const depositResult = parseOptionalPrice(depositAmount, 'depositAmount');
    if (priceResult.error)   errors.push(priceResult.error);
    if (depositResult.error) errors.push(depositResult.error);
    if (
      priceResult.value   != null &&
      depositResult.value != null &&
      depositResult.value > priceResult.value
    ) {
      errors.push('depositAmount cannot exceed totalPrice');
    }

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const updated = await fixedReservationService.updateFixedReservation(
      id,
      {
        clientName: clientName.trim(),
        timeStart,
        duration: parsedDuration,
        type: typeof type === 'string' ? type.trim() : '',
        totalPrice:    priceResult.value,
        depositAmount: depositResult.value,
      },
      req.user.id,
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /fixed-reservations/:id/pay
export async function payFixedReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid fixed reservation id' });
      return;
    }

    const isLastWeek    = req.body.isLastWeek === true;
    const paymentMethod = typeof req.body.paymentMethod === 'string' ? req.body.paymentMethod : 'cash';

    const result = await fixedReservationService.processFixedPayment(id, isLastWeek, req.user.id, paymentMethod);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /fixed-reservations/:id
export async function deleteFixedReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid fixed reservation id' });
      return;
    }
    await fixedReservationService.deleteFixedReservation(id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── PATCH /fixed-reservations/:id/toggle
export async function toggleFixedReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid fixed reservation id' });
      return;
    }

    const updated = await fixedReservationService.toggleFixedReservation(id, req.user.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
