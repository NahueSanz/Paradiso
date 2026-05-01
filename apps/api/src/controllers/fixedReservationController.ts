import { NextFunction, Request, Response } from 'express';
import { PaymentMethod } from '@prisma/client';
import * as fixedReservationService from '../services/fixedReservationService';

const DATE_REGEX           = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX           = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_DAYS           = [0, 1, 2, 3, 4, 5, 6];
const VALID_PAYMENT_METHODS = Object.values(PaymentMethod);

function parseOptionalPrice(
  raw: unknown,
  fieldName: string,
): { value: number | null; error?: never } | { value?: never; error: string } {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (isNaN(n) || n < 0) return { error: `${fieldName} must be a number >= 0` };
  return { value: n };
}

// ── GET /fixed-reservations
// ?clubId=<n>               → management list (rules grouped by court)
// ?date=<YYYY-MM-DD>&courtId=<n> → schedule instances for a specific date + court
export async function getFixedReservations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { clubId, date, courtId } = req.query;

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

    if (!date || typeof date !== 'string' || !DATE_REGEX.test(date)) {
      res.status(400).json({ status: 'error', message: 'date query param is required (YYYY-MM-DD) when clubId is not provided' });
      return;
    }
    const courtIdNum = Number(courtId);
    if (!courtId || !Number.isInteger(courtIdNum) || courtIdNum <= 0) {
      res.status(400).json({ status: 'error', message: 'courtId query param must be a positive integer' });
      return;
    }

    const instances = await fixedReservationService.getFixedReservationsByDateAndCourt(date, courtIdNum);
    res.json(instances);
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
    const { courtId, dayOfWeek, timeStart, duration, clientName, clientPhone, type, totalPrice, depositAmount } = req.body;
    const parsedDuration = Number(duration);
    const errors: string[] = [];

    if (!Number.isInteger(courtId) || courtId <= 0)           errors.push('courtId must be a positive integer');
    if (!VALID_DAYS.includes(dayOfWeek))                       errors.push('dayOfWeek must be an integer 0–6');
    if (!timeStart || !TIME_REGEX.test(timeStart))             errors.push('timeStart is required (HH:MM)');
    if (isNaN(parsedDuration) || parsedDuration <= 0)          errors.push('duration must be a positive integer (minutes)');
    else if (parsedDuration > 240)                             errors.push('duration cannot exceed 240 minutes');
    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) errors.push('clientName is required');
    if (clientPhone != null && clientPhone !== '') {
      if (typeof clientPhone !== 'string' || clientPhone.length > 20 || !/^[0-9 +\-]+$/.test(clientPhone)) {
        errors.push('clientPhone must be digits, spaces, + and -, max 20 chars');
      }
    }
    if (!type || typeof type !== 'string' || !type.trim()) errors.push('type is required');

    const priceResult   = parseOptionalPrice(totalPrice,    'totalPrice');
    const depositResult = parseOptionalPrice(depositAmount, 'depositAmount');
    if (priceResult.error)   errors.push(priceResult.error);
    if (depositResult.error) errors.push(depositResult.error);
    if (priceResult.value != null && depositResult.value != null && depositResult.value > priceResult.value) {
      errors.push('depositAmount cannot exceed totalPrice');
    }

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const result = await fixedReservationService.createFixedReservation(
      {
        courtId,
        dayOfWeek,
        timeStart,
        duration:      parsedDuration,
        clientName:    clientName.trim(),
        clientPhone:   typeof clientPhone === 'string' && clientPhone.trim() ? clientPhone.trim() : null,
        type:          type.trim(),
        totalPrice:    priceResult.value   ?? undefined,
        depositAmount: depositResult.value ?? undefined,
      },
      req.user.id,
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ── PUT /fixed-reservations/:id
// Body must include: scope ('occurrence' | 'thisAndFuture')
// scope='occurrence'    → also requires instanceId (number)
// scope='thisAndFuture' → also requires fromDate (YYYY-MM-DD)
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

    const { scope, instanceId, fromDate, clientName, clientPhone, timeStart, duration, type, totalPrice, depositAmount } = req.body;
    const errors: string[] = [];

    if (scope !== 'occurrence' && scope !== 'thisAndFuture') {
      errors.push('scope must be "occurrence" or "thisAndFuture"');
    }
    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      errors.push('clientName is required');
    }
    if (clientPhone != null && clientPhone !== '') {
      if (typeof clientPhone !== 'string' || clientPhone.length > 20 || !/^[0-9 +\-]+$/.test(clientPhone)) {
        errors.push('clientPhone must be digits, spaces, + and -, max 20 chars');
      }
    }
    if (timeStart !== undefined && !TIME_REGEX.test(timeStart)) {
      errors.push('timeStart must be HH:MM');
    }
    if (duration !== undefined) {
      const d = Number(duration);
      if (isNaN(d) || d <= 0)  errors.push('duration must be a positive integer (minutes)');
      else if (d > 240)         errors.push('duration cannot exceed 240 minutes');
    }

    const priceResult   = parseOptionalPrice(totalPrice,    'totalPrice');
    const depositResult = parseOptionalPrice(depositAmount, 'depositAmount');
    if (priceResult.error)   errors.push(priceResult.error);
    if (depositResult.error) errors.push(depositResult.error);
    if (priceResult.value != null && depositResult.value != null && depositResult.value > priceResult.value) {
      errors.push('depositAmount cannot exceed totalPrice');
    }

    if (scope === 'occurrence' && (!instanceId || !Number.isInteger(instanceId) || instanceId <= 0)) {
      errors.push('instanceId (positive integer) is required when scope is "occurrence"');
    }
    if (scope === 'thisAndFuture' && (!fromDate || !DATE_REGEX.test(fromDate))) {
      errors.push('fromDate (YYYY-MM-DD) is required when scope is "thisAndFuture"');
    }

    if (errors.length) {
      res.status(400).json({ status: 'error', message: errors.join(', ') });
      return;
    }

    const data = {
      clientName:    clientName.trim(),
      clientPhone:   typeof clientPhone === 'string' && clientPhone.trim() ? clientPhone.trim() : null,
      ...(timeStart    !== undefined ? { timeStart }                     : {}),
      ...(duration     !== undefined ? { duration: Number(duration) }    : {}),
      ...(type         !== undefined ? { type: String(type).trim() }     : {}),
      ...(priceResult.value   !== undefined ? { totalPrice:    priceResult.value }   : {}),
      ...(depositResult.value !== undefined ? { depositAmount: depositResult.value } : {}),
    };

    const result = await fixedReservationService.updateFixedReservation(
      id,
      data,
      scope,
      req.user.id,
      scope === 'occurrence'
        ? { instanceId: Number(instanceId) }
        : { fromDateStr: fromDate },
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /fixed-reservations/:id
// Body: { fromDate: "YYYY-MM-DD" }
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

    const { fromDate } = req.body;
    if (!fromDate || typeof fromDate !== 'string' || !DATE_REGEX.test(fromDate)) {
      res.status(400).json({ status: 'error', message: 'fromDate is required (YYYY-MM-DD)' });
      return;
    }

    await fixedReservationService.deleteFixedReservation(id, fromDate, req.user.id);
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
    const result = await fixedReservationService.toggleFixedReservation(id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /fixed-reservations/instances/:instanceId/pay
// Body: { isLastWeek: boolean, paymentMethod: PaymentMethod }
export async function payInstance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const instanceId = parseInt(req.params.instanceId, 10);
    if (isNaN(instanceId) || instanceId <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid instance id' });
      return;
    }

    const { isLastWeek, paymentMethod } = req.body;

    if (typeof isLastWeek !== 'boolean') {
      res.status(400).json({ status: 'error', message: 'isLastWeek must be a boolean' });
      return;
    }

    const method = typeof paymentMethod === 'string' ? paymentMethod : 'cash';
    if (!VALID_PAYMENT_METHODS.includes(method as PaymentMethod)) {
      res.status(400).json({
        status:  'error',
        message: `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`,
      });
      return;
    }

    const result = await fixedReservationService.processPayment(
      instanceId,
      isLastWeek,
      method as PaymentMethod,
      req.user.id,
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /fixed-reservations/instances/:instanceId/cancel
export async function cancelInstance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const instanceId = parseInt(req.params.instanceId, 10);
    if (isNaN(instanceId) || instanceId <= 0) {
      res.status(400).json({ status: 'error', message: 'Invalid instance id' });
      return;
    }

    await fixedReservationService.cancelSingleOccurrence(instanceId, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
