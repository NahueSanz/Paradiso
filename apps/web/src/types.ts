export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type PlayStatus    = 'scheduled' | 'playing' | 'finished';

export interface Club {
  id: number;
  name: string;
  ownerId: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'owner' | 'employee';
}

export interface Membership {
  id: number;
  clubId: number;
  role: 'owner' | 'employee';
  displayName: string;
}

export interface MembershipInfo {
  id: number;
  displayName: string;
}

export interface Court {
  id: number;
  name: string;
  clubId: number;
}

export interface Reservation {
  id: number;
  courtId: number;
  date: string;        // YYYY-MM-DD
  timeStart: string;   // ISO anchored to 1970-01-01
  timeEnd: string;     // ISO anchored to 1970-01-01
  clientName: string;
  clientPhone: string | null;
  type: string | null;
  totalPrice: string | null;
  depositAmount: string | null;
  paidAmount: string | null;
  internalNote: string | null;
  paymentStatus: PaymentStatus;
  playStatus: PlayStatus;
  court: { id: number; name: string };
  createdByMembership?: MembershipInfo | null;
  updatedByMembership?: MembershipInfo | null;
}

// Slot: "HH:00", e.g. "08:00"
export type TimeSlot = string;

/**
 * A fixed reservation projected onto the current day for display in the grid.
 * Produced client-side from ScheduleFixedReservation — never stored as-is.
 */
export interface VirtualFixedReservation {
  readonly id: string;                    // "fixed-{n}" — string discriminates from Reservation
  readonly rawId: number;                 // instanceId — used for pay/cancel instance calls
  readonly fixedReservationId: number;    // series/rule id — used for delete series calls
  readonly courtId: number;
  readonly dayOfWeek: number;
  readonly duration: number;        // minutes
  readonly timeStart: string;       // "HH:MM"
  readonly clientName: string;
  readonly clientPhone: string | null;
  readonly type: string | null;
  readonly isFixed: true;
  readonly paymentStatus: PaymentStatus;
  readonly totalPrice: string | null;
  readonly depositAmount: string | null;
  readonly carryOver: string;       // rolling deposit carry-over, "0" by default
  readonly lastPaidAt: string | null; // ISO datetime of last payment, null if never paid
  readonly court: { id: number; name: string };
}

/**
 * Reservation normalized for grid use: timeEnd is consumed to produce duration
 * so that all grid entries share the same { timeStart, duration } shape.
 */
export type NormalizedReservation = Reservation & { readonly duration: number };

/** Union of normal and virtual-fixed reservations — used throughout the grid. */
export type ScheduleEntry = NormalizedReservation | VirtualFixedReservation;

export interface FixedReservation {
  id: number;
  courtId: number;
  clubId: number;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  timeStart: string; // "HH:MM"
  timeEnd: string;   // "HH:MM" — computed server-side (timeStart + duration)
  duration: number;  // minutes
  clientName: string;
  clientPhone: string | null;
  type: string | null;
  totalPrice: string | null;
  depositAmount: string | null;
  carryOver: string;
  isFixed: true;
  court: { id: number; name: string };
}
