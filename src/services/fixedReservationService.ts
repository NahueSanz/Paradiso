import { PaymentMethod, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

// ── Time helpers ──────────────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function computeTimeEnd(timeStart: string, duration: number): string {
  const total = toMinutes(timeStart) + duration;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getTodayUTCDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function getNextOccurrenceDate(dayOfWeek: number, fromDate: Date): Date {
  const result = new Date(fromDate);
  const diff = (dayOfWeek - result.getUTCDay() + 7) % 7;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + weeks * 7);
  return result;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function assertMembership(userId: number, clubId: number): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
  });
  if (!membership) throw new AppError('Forbidden', 403);
}

// ── Instance data builder ─────────────────────────────────────────────────────

interface RuleSnapshot {
  id: number;
  clubId: number;
  courtId: number;
  timeStart: string;
  duration: number;
  clientName: string;
  clientPhone: string | null;
  type: string;
  totalPrice: Prisma.Decimal | null;
  depositAmount: Prisma.Decimal | null;
}

function buildInstanceRows(
  rule: RuleSnapshot,
  firstDate: Date,
  count: number,
  startingSequence: number,
  depositForFirst: number,
) {
  return Array.from({ length: count }, (_, i) => ({
    fixedReservationId: rule.id,
    clubId:             rule.clubId,
    courtId:            rule.courtId,
    date:               addWeeks(firstDate, i),
    sequenceNumber:     startingSequence + i,
    timeStart:          rule.timeStart,
    duration:           rule.duration,
    clientName:         rule.clientName,
    clientPhone:        rule.clientPhone,
    type:               rule.type,
    totalPrice:         rule.totalPrice,
    depositAmount:      rule.depositAmount,
    carryOverDeposit:   i === 0 ? depositForFirst : 0,
    paidAmount:         0,
    paymentStatus:      'pending'   as const,
    status:             'scheduled' as const,
  }));
}

// ── Update payload builder ────────────────────────────────────────────────────

function buildUpdatePayload(data: UpdateFixedReservationInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    clientName:  data.clientName,
    clientPhone: data.clientPhone ?? null,
  };
  if (data.timeStart    !== undefined) payload.timeStart    = data.timeStart;
  if (data.duration     !== undefined) payload.duration     = data.duration;
  if (data.type         !== undefined) payload.type         = data.type;
  if (data.totalPrice   !== undefined) payload.totalPrice   = data.totalPrice;
  if (data.depositAmount !== undefined) payload.depositAmount = data.depositAmount;
  return payload;
}

// ── Conflict detection ────────────────────────────────────────────────────────

async function checkConflicts(
  courtId: number,
  timeStart: string,
  duration: number,
  dates: Date[],
  excludeRuleId?: number,
): Promise<void> {
  const start = toMinutes(timeStart);
  const end   = start + duration;

  const reservations = await prisma.reservation.findMany({
    where: {
      courtId,
      date:   { in: dates },
      status: { not: 'cancelled' },
    },
    select: { timeStart: true, timeEnd: true },
  });

  for (const r of reservations) {
    const rStart = r.timeStart.getUTCHours() * 60 + r.timeStart.getUTCMinutes();
    const rEnd   = r.timeEnd.getUTCHours()   * 60 + r.timeEnd.getUTCMinutes();
    if (start < rEnd && end > rStart) {
      throw new AppError('Conflicts with an existing reservation', 400);
    }
  }

  const instances = await prisma.fixedReservationInstance.findMany({
    where: {
      courtId,
      date:   { in: dates },
      status: { not: 'cancelled' },
      ...(excludeRuleId !== undefined ? { NOT: { fixedReservationId: excludeRuleId } } : {}),
    },
    select: { timeStart: true, duration: true },
  });

  for (const inst of instances) {
    const iStart = toMinutes(inst.timeStart);
    const iEnd   = iStart + inst.duration;
    if (start < iEnd && end > iStart) {
      throw new AppError('Conflicts with an existing fixed reservation', 400);
    }
  }
}

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface CreateFixedReservationInput {
  courtId:       number;
  dayOfWeek:     number;
  timeStart:     string;
  duration:      number;
  clientName:    string;
  clientPhone?:  string | null;
  type:          string;
  totalPrice?:   number | null;
  depositAmount?: number | null;
}

export interface UpdateFixedReservationInput {
  clientName:     string;
  clientPhone?:   string | null;
  timeStart?:     string;
  duration?:      number;
  type?:          string;
  totalPrice?:    number | null;
  depositAmount?: number | null;
}

export interface ProcessPaymentResult {
  instanceId:       number;
  amountDue:        number;
  pricePerSlot:     number;
  carryOverDeposit: number;
  isLastWeek:       boolean;
  paidAt:           string;
  alreadyPaid:      boolean;
}

// ── createFixedReservation ────────────────────────────────────────────────────

export async function createFixedReservation(
  input: CreateFixedReservationInput,
  userId: number,
) {
  const {
    courtId, dayOfWeek, timeStart, duration,
    clientName, clientPhone, type, totalPrice, depositAmount,
  } = input;

  const court = await prisma.court.findUnique({
    where:  { id: courtId },
    select: { clubId: true },
  });
  if (!court) throw new AppError('Court not found', 404);
  const { clubId } = court;

  await assertMembership(userId, clubId);

  const startDate  = getTodayUTCDate();
  const firstDate  = getNextOccurrenceDate(dayOfWeek, startDate);

  const conflictDates = Array.from({ length: 4 }, (_, i) => addWeeks(firstDate, i));
  await checkConflicts(courtId, timeStart, duration, conflictDates);

  const deposit = depositAmount ?? 0;

  return prisma.$transaction(async (tx) => {
    const rule = await tx.fixedReservation.create({
      data: {
        clubId,
        courtId,
        startDate,
        dayOfWeek,
        timeStart,
        duration,
        clientName:    clientName.trim(),
        clientPhone:   clientPhone?.trim() ?? null,
        type,
        totalPrice:    totalPrice    ?? null,
        depositAmount: depositAmount ?? null,
        active:        true,
      },
    });

    const rows = buildInstanceRows(
      {
        id:            rule.id,
        clubId,
        courtId,
        timeStart:     rule.timeStart,
        duration:      rule.duration,
        clientName:    rule.clientName,
        clientPhone:   rule.clientPhone,
        type:          rule.type,
        totalPrice:    rule.totalPrice,
        depositAmount: rule.depositAmount,
      },
      firstDate,
      52,
      1,
      deposit,
    );

    await tx.fixedReservationInstance.createMany({ data: rows, skipDuplicates: true });

    const firstInstance = await tx.fixedReservationInstance.findFirst({
      where:   { fixedReservationId: rule.id },
      orderBy: { sequenceNumber: 'asc' },
      include: { court: { select: { id: true, name: true } } },
    });

    if (deposit > 0 && firstInstance) {
      await tx.cashMovement.create({
        data: {
          clubId,
          type:                      'income',
          concept:                   `Seña turno fijo - ${rule.clientName}`,
          amount:                    deposit,
          // TODO: support depositPaymentMethod instead of hardcoded 'cash'
          paymentMethod:             'cash',
          fixedReservationInstanceId: firstInstance.id,
        },
      });
    }

    return { rule, firstInstance };
  });
}

// ── getFixedReservationsByDateAndCourt ────────────────────────────────────────

export async function getFixedReservationsByDateAndCourt(
  dateStr: string,
  courtId: number,
) {
  const date = parseDateString(dateStr);

  return prisma.fixedReservationInstance.findMany({
    where: {
      courtId,
      date,
      status: { not: 'cancelled' },
    },
    include: { court: { select: { id: true, name: true } } },
    orderBy: { timeStart: 'asc' },
  });
}

// ── getFixedReservationsByClub ────────────────────────────────────────────────

export async function getFixedReservationsByClub(clubId: number, userId: number) {
  await assertMembership(userId, clubId);

  const rules = await prisma.fixedReservation.findMany({
    where:   { clubId, active: true },
    include: { court: { select: { id: true, name: true } } },
    orderBy: [{ courtId: 'asc' }, { dayOfWeek: 'asc' }, { timeStart: 'asc' }],
  });

  return rules.map((r) => ({
    id:            r.id,
    courtId:       r.courtId,
    courtName:     r.court.name,
    dayOfWeek:     r.dayOfWeek,
    timeStart:     r.timeStart,
    timeEnd:       computeTimeEnd(r.timeStart, r.duration),
    duration:      r.duration,
    clientName:    r.clientName,
    clientPhone:   r.clientPhone ?? null,
    type:          r.type,
    totalPrice:    r.totalPrice    != null ? String(r.totalPrice)    : null,
    depositAmount: r.depositAmount != null ? String(r.depositAmount) : null,
    active:        r.active,
    startDate:     r.startDate.toISOString().slice(0, 10),
    endDate:       r.endDate != null ? r.endDate.toISOString().slice(0, 10) : null,
    createdAt:     r.createdAt,
  }));
}

// ── deleteFixedReservation ────────────────────────────────────────────────────

export async function deleteFixedReservation(
  id: number,
  fromDateStr: string,
  userId: number,
): Promise<void> {
  const rule = await prisma.fixedReservation.findUnique({
    where:  { id },
    select: { clubId: true },
  });
  if (!rule) throw new AppError('Fixed reservation not found', 404);

  await assertMembership(userId, rule.clubId);

  const fromDate = parseDateString(fromDateStr);
  const today    = getTodayUTCDate();
  if (fromDate < today) throw new AppError('fromDate cannot be in the past', 400);

  await prisma.$transaction(async (tx) => {
    await tx.fixedReservation.update({
      where: { id },
      data:  { endDate: fromDate, active: false },
    });

    await tx.fixedReservationInstance.updateMany({
      where: {
        fixedReservationId: id,
        date:               { gte: fromDate },
        status:             'scheduled',
      },
      data: { status: 'cancelled' },
    });
  });
}

// ── cancelSingleOccurrence ────────────────────────────────────────────────────

export async function cancelSingleOccurrence(
  instanceId: number,
  userId: number,
): Promise<void> {
  const instance = await prisma.fixedReservationInstance.findUnique({
    where:  { id: instanceId },
    select: {
      clubId:            true,
      status:            true,
      carryOverDeposit:  true,
      fixedReservationId: true,
      date:              true,
    },
  });
  if (!instance) throw new AppError('Instance not found', 404);

  await assertMembership(userId, instance.clubId);

  if (instance.status === 'completed') {
    throw new AppError('Cannot cancel a paid occurrence', 409);
  }
  if (instance.status === 'cancelled') {
    throw new AppError('Occurrence is already cancelled', 409);
  }

  const carry = Number(instance.carryOverDeposit);

  await prisma.$transaction(async (tx) => {
    if (carry > 0) {
      const next = await tx.fixedReservationInstance.findFirst({
        where: {
          fixedReservationId: instance.fixedReservationId,
          date:               { gt: instance.date },
          status:             'scheduled',
        },
        orderBy: { date: 'asc' },
        select:  { id: true, carryOverDeposit: true },
      });

      if (next) {
        await tx.fixedReservationInstance.update({
          where: { id: next.id },
          data:  { carryOverDeposit: Number(next.carryOverDeposit) + carry },
        });
      }
    }

    await tx.fixedReservationInstance.update({
      where: { id: instanceId },
      data:  { status: 'cancelled', carryOverDeposit: 0 },
    });
  });
}

// ── updateFixedReservation ────────────────────────────────────────────────────

export async function updateFixedReservation(
  id: number,
  data: UpdateFixedReservationInput,
  scope: 'occurrence' | 'thisAndFuture',
  userId: number,
  options: { instanceId?: number; fromDateStr?: string } = {},
) {
  const rule = await prisma.fixedReservation.findUnique({
    where:  { id },
    select: { clubId: true, courtId: true, dayOfWeek: true, timeStart: true, duration: true },
  });
  if (!rule) throw new AppError('Fixed reservation not found', 404);

  await assertMembership(userId, rule.clubId);

  // ── occurrence scope ──────────────────────────────────────────────────────

  if (scope === 'occurrence') {
    const { instanceId } = options;
    if (!instanceId) throw new AppError('instanceId is required for occurrence scope', 400);

    const instance = await prisma.fixedReservationInstance.findUnique({
      where:  { id: instanceId },
      select: { status: true, fixedReservationId: true },
    });
    if (!instance) throw new AppError('Instance not found', 404);
    if (instance.fixedReservationId !== id) {
      throw new AppError('Instance does not belong to this rule', 400);
    }
    if (instance.status !== 'scheduled') {
      throw new AppError('Only scheduled instances can be edited', 400);
    }

    return prisma.fixedReservationInstance.update({
      where:   { id: instanceId },
      data:    buildUpdatePayload(data),
      include: { court: { select: { id: true, name: true } } },
    });
  }

  // ── thisAndFuture scope ───────────────────────────────────────────────────

  const { fromDateStr } = options;
  if (!fromDateStr) throw new AppError('fromDate is required for thisAndFuture scope', 400);

  const fromDate = parseDateString(fromDateStr);
  const today    = getTodayUTCDate();
  if (fromDate < today) throw new AppError('fromDate cannot be in the past', 400);

  const newTimeStart = data.timeStart ?? rule.timeStart;
  const newDuration  = data.duration  ?? rule.duration;
  const timeChanged  = newTimeStart !== rule.timeStart || newDuration !== rule.duration;

  if (timeChanged) {
    const firstOccurrence = getNextOccurrenceDate(rule.dayOfWeek, fromDate);
    const conflictDates   = Array.from({ length: 4 }, (_, i) => addWeeks(firstOccurrence, i));
    await checkConflicts(rule.courtId, newTimeStart, newDuration, conflictDates, id);
  }

  const payload = buildUpdatePayload(data);

  await prisma.$transaction(async (tx) => {
    await tx.fixedReservation.update({ where: { id }, data: payload });

    await tx.fixedReservationInstance.updateMany({
      where: {
        fixedReservationId: id,
        date:               { gte: fromDate },
        status:             'scheduled',
      },
      data: payload,
    });
  });

  return prisma.fixedReservation.findUnique({
    where:   { id },
    include: { court: { select: { id: true, name: true } } },
  });
}

// ── processPayment ────────────────────────────────────────────────────────────

export async function processPayment(
  instanceId: number,
  isLastWeek: boolean,
  paymentMethod: PaymentMethod,
  userId: number,
): Promise<ProcessPaymentResult> {
  const instance = await prisma.fixedReservationInstance.findUnique({
    where:  { id: instanceId },
    select: {
      clubId:             true,
      status:             true,
      paidAt:             true,
      paidAmount:         true,
      totalPrice:         true,
      carryOverDeposit:   true,
      fixedReservationId: true,
      date:               true,
      clientName:         true,
    },
  });
  if (!instance) throw new AppError('Instance not found', 404);

  await assertMembership(userId, instance.clubId);

  if (instance.status === 'cancelled') {
    throw new AppError('Cannot pay a cancelled occurrence', 400);
  }

  const today    = getTodayUTCDate();
  const todayStr = today.toISOString().slice(0, 10);

  if (instance.status === 'completed') {
    const paidStr = instance.paidAt!.toISOString().slice(0, 10);
    if (paidStr === todayStr) {
      return {
        instanceId,
        amountDue:        Number(instance.paidAmount),
        pricePerSlot:     Number(instance.totalPrice ?? 0),
        carryOverDeposit: Number(instance.carryOverDeposit),
        isLastWeek,
        paidAt:           todayStr,
        alreadyPaid:      true,
      };
    }
    throw new AppError('This occurrence was already paid on a previous date', 409);
  }

  const pricePerSlot = Number(instance.totalPrice ?? 0);
  const carry        = Number(instance.carryOverDeposit);
  const amountDue    = isLastWeek ? Math.max(0, pricePerSlot - carry) : pricePerSlot;
  const newCarry     = isLastWeek ? 0 : carry;

  await prisma.$transaction(async (tx) => {
    await tx.fixedReservationInstance.update({
      where: { id: instanceId },
      data: {
        paidAmount:      amountDue,
        paymentStatus:   'paid',
        paidAt:          new Date(),
        paymentMethod,
        status:          'completed',
        carryOverDeposit: newCarry,
      },
    });

    if (amountDue > 0) {
      await tx.cashMovement.create({
        data: {
          clubId:                    instance.clubId,
          type:                      'income',
          concept:                   `Turno fijo - ${instance.clientName}`,
          amount:                    amountDue,
          paymentMethod,
          fixedReservationInstanceId: instanceId,
        },
      });
    }

    if (!isLastWeek && carry > 0) {
      const next = await tx.fixedReservationInstance.findFirst({
        where: {
          fixedReservationId: instance.fixedReservationId,
          date:               { gt: instance.date },
          status:             'scheduled',
        },
        orderBy: { date: 'asc' },
        select:  { id: true, carryOverDeposit: true },
      });

      if (next) {
        await tx.fixedReservationInstance.update({
          where: { id: next.id },
          data:  { carryOverDeposit: Number(next.carryOverDeposit) + carry },
        });
      }
    }
  });

  extendSeriesInstances(instance.fixedReservationId).catch(() => {});

  return {
    instanceId,
    amountDue,
    pricePerSlot,
    carryOverDeposit: carry,
    isLastWeek,
    paidAt:      todayStr,
    alreadyPaid: false,
  };
}

// ── extendSeriesInstances ─────────────────────────────────────────────────────

export async function extendSeriesInstances(
  ruleId: number,
  weeksAhead = 26,
): Promise<void> {
  const rule = await prisma.fixedReservation.findUnique({
    where:  { id: ruleId },
    select: {
      clubId:        true,
      courtId:       true,
      timeStart:     true,
      duration:      true,
      clientName:    true,
      clientPhone:   true,
      type:          true,
      totalPrice:    true,
      depositAmount: true,
      active:        true,
      endDate:       true,
    },
  });
  if (!rule || !rule.active) return;

  const last = await prisma.fixedReservationInstance.findFirst({
    where:   { fixedReservationId: ruleId },
    orderBy: { date: 'desc' },
    select:  { date: true, sequenceNumber: true },
  });
  if (!last) return;

  const today       = getTodayUTCDate();
  const daysToLast  = Math.floor((last.date.getTime() - today.getTime()) / 86_400_000);
  if (daysToLast >= 28) return;

  const nextDate = addWeeks(last.date, 1);
  if (rule.endDate && nextDate >= rule.endDate) return;

  let count = weeksAhead;
  if (rule.endDate) {
    const weeksLeft = Math.ceil(
      (rule.endDate.getTime() - nextDate.getTime()) / (7 * 86_400_000),
    );
    count = Math.min(weeksAhead, Math.max(0, weeksLeft));
  }
  if (count <= 0) return;

  const rows = buildInstanceRows(
    { id: ruleId, ...rule },
    nextDate,
    count,
    last.sequenceNumber + 1,
    0,
  );

  await prisma.fixedReservationInstance.createMany({ data: rows, skipDuplicates: true });
}

// ── toggleFixedReservation ────────────────────────────────────────────────────

export async function toggleFixedReservation(id: number, userId: number) {
  const rule = await prisma.fixedReservation.findUnique({
    where:  { id },
    select: { clubId: true, active: true },
  });
  if (!rule) throw new AppError('Fixed reservation not found', 404);

  await assertMembership(userId, rule.clubId);

  if (rule.active) {
    const today = getTodayUTCDate();

    await prisma.$transaction(async (tx) => {
      await tx.fixedReservation.update({
        where: { id },
        data:  { active: false, endDate: today },
      });
      await tx.fixedReservationInstance.updateMany({
        where: {
          fixedReservationId: id,
          date:               { gte: today },
          status:             'scheduled',
        },
        data: { status: 'cancelled' },
      });
    });
  } else {
    await prisma.fixedReservation.update({
      where: { id },
      data:  { active: true, endDate: null },
    });
    await extendSeriesInstances(id, 52);
  }

  return prisma.fixedReservation.findUnique({
    where:   { id },
    include: { court: { select: { id: true, name: true } } },
  });
}
