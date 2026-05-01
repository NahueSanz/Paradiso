import { ReservationStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

const DEFAULT_OPEN  = '09:00';
const DEFAULT_CLOSE = '01:00';
const TIME_REGEX    = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface EffectiveHours {
  openTime:   string;
  closeTime:  string;
  isOverride: boolean;
}

export interface DaySchedule {
  dayOfWeek: number;
  openTime:  string;
  closeTime: string;
}

export interface DayConstraint {
  dayOfWeek: number;
  minStart:  string | null;
  maxEnd:    string | null;
}

function validateTime(t: string): boolean {
  return TIME_REGEX.test(t);
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMin(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function validateHoursAgainstReservations(
  openTime: string,
  closeTime: string,
  reservations: Array<{ timeStart: Date; timeEnd: Date }>,
): void {
  if (!reservations.length) return;

  const openMin     = toMin(openTime);
  const closeRaw    = toMin(closeTime);
  const isOvernight = closeRaw < openMin;
  const closeVirtual = isOvernight ? closeRaw + 1440 : closeRaw;

  let openConflictAt:  number | null = null;
  let closeConflictAt: { raw: number; virtual: number } | null = null;

  for (const r of reservations) {
    const startRaw   = r.timeStart.getUTCHours() * 60 + r.timeStart.getUTCMinutes();
    const endRaw     = r.timeEnd.getUTCHours() * 60 + r.timeEnd.getUTCMinutes();
    const endVirtual = endRaw < startRaw ? endRaw + 1440 : endRaw;

    // Opening too late: start falls in the gap before open
    if (startRaw < openMin && (!isOvernight || startRaw >= closeRaw)) {
      if (openConflictAt === null || startRaw < openConflictAt) openConflictAt = startRaw;
    }

    // Closing too early: end exceeds proposed close
    if (endVirtual > closeVirtual) {
      if (!closeConflictAt || endVirtual > closeConflictAt.virtual) {
        closeConflictAt = { raw: endRaw, virtual: endVirtual };
      }
    }
  }

  if (openConflictAt !== null) {
    throw new AppError(`Cannot open after existing reservation at ${formatMin(openConflictAt)}`, 422);
  }
  if (closeConflictAt !== null) {
    throw new AppError(`Cannot close before existing reservation ends at ${formatMin(closeConflictAt.raw)}`, 422);
  }
}

function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns effective open/close time for a date, with override-first logic. */
export async function getEffectiveHours(clubId: number, date: string): Promise<EffectiveHours> {
  const override = await prisma.openingHours.findFirst({
    where: { clubId, date, dayOfWeek: null },
  });
  if (override) {
    return { openTime: override.openTime, closeTime: override.closeTime, isOverride: true };
  }

  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const def = await prisma.openingHours.findFirst({
    where: { clubId, dayOfWeek: dow, date: null },
  });
  if (def) {
    return { openTime: def.openTime, closeTime: def.closeTime, isOverride: false };
  }

  return { openTime: DEFAULT_OPEN, closeTime: DEFAULT_CLOSE, isOverride: false };
}

/** Returns the 7-day default schedule for a club (null = no custom setting for that day). */
export async function getWeeklyDefaults(clubId: number): Promise<(DaySchedule | null)[]> {
  const rows = await prisma.openingHours.findMany({
    where: { clubId, date: null, dayOfWeek: { not: null } },
  });

  return Array.from({ length: 7 }, (_, i) => {
    const row = rows.find((r) => r.dayOfWeek === i);
    return row ? { dayOfWeek: i, openTime: row.openTime, closeTime: row.closeTime } : null;
  });
}

/** Upsert the default schedule for all provided days. */
export async function upsertWeeklyDefaults(clubId: number, schedule: DaySchedule[]): Promise<void> {
  const today = todayUTC();
  const futureReservations = await prisma.reservation.findMany({
    where: {
      court: { clubId },
      status: { not: ReservationStatus.cancelled },
      date: { gte: today },
    },
    select: { date: true, timeStart: true, timeEnd: true },
  });

  for (const entry of schedule) {
    if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) continue;
    if (!validateTime(entry.openTime) || !validateTime(entry.closeTime)) {
      throw new AppError(`Invalid time for day ${entry.dayOfWeek}`, 400);
    }

    const dayReservations = futureReservations.filter(
      (r) => r.date.getUTCDay() === entry.dayOfWeek,
    );
    validateHoursAgainstReservations(entry.openTime, entry.closeTime, dayReservations);

    await prisma.openingHours.deleteMany({
      where: { clubId, dayOfWeek: entry.dayOfWeek, date: null },
    });
    await prisma.openingHours.create({
      data: { clubId, dayOfWeek: entry.dayOfWeek, openTime: entry.openTime, closeTime: entry.closeTime },
    });
  }
}

/** Upsert a date-specific override for a club. */
export async function upsertDateOverride(
  clubId: number,
  date: string,
  openTime: string,
  closeTime: string,
): Promise<void> {
  if (!validateTime(openTime) || !validateTime(closeTime)) {
    throw new AppError('Invalid time format. Expected HH:mm', 400);
  }

  const dateObj = new Date(`${date}T00:00:00.000Z`);
  const dateReservations = await prisma.reservation.findMany({
    where: {
      court: { clubId },
      status: { not: ReservationStatus.cancelled },
      date: dateObj,
    },
    select: { timeStart: true, timeEnd: true },
  });
  validateHoursAgainstReservations(openTime, closeTime, dateReservations);

  await prisma.openingHours.deleteMany({ where: { clubId, date, dayOfWeek: null } });
  await prisma.openingHours.create({
    data: { clubId, date, openTime, closeTime },
  });
}

/** Returns per-day-of-week constraints (min start / max end) based on upcoming reservations. */
export async function getWeeklyConstraints(clubId: number): Promise<DayConstraint[]> {
  const today = todayUTC();
  const reservations = await prisma.reservation.findMany({
    where: {
      court: { clubId },
      status: { not: ReservationStatus.cancelled },
      date: { gte: today },
    },
    select: { date: true, timeStart: true, timeEnd: true },
  });

  return Array.from({ length: 7 }, (_, dow) => {
    const matching = reservations.filter((r) => r.date.getUTCDay() === dow);
    if (!matching.length) return { dayOfWeek: dow, minStart: null, maxEnd: null };

    let minStartRaw  = Infinity;
    let maxEndVirtual = -Infinity;
    let maxEndRaw     = 0;

    for (const r of matching) {
      const startRaw   = r.timeStart.getUTCHours() * 60 + r.timeStart.getUTCMinutes();
      const endRaw     = r.timeEnd.getUTCHours() * 60 + r.timeEnd.getUTCMinutes();
      const endVirtual = endRaw < startRaw ? endRaw + 1440 : endRaw;

      if (startRaw < minStartRaw) minStartRaw = startRaw;
      if (endVirtual > maxEndVirtual) { maxEndVirtual = endVirtual; maxEndRaw = endRaw; }
    }

    return {
      dayOfWeek: dow,
      minStart:  formatMin(minStartRaw),
      maxEnd:    formatMin(maxEndRaw),
    };
  });
}

/** Remove a date-specific override, reverting to the day-of-week default. */
export async function deleteDateOverride(clubId: number, date: string): Promise<void> {
  await prisma.openingHours.deleteMany({ where: { clubId, date, dayOfWeek: null } });
}
