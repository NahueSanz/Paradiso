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
  paymentStatus: PaymentStatus;
  playStatus: PlayStatus;
  court: { id: number; name: string };
  createdByMembership?: MembershipInfo | null;
  updatedByMembership?: MembershipInfo | null;
}

// Slot: "HH:00", e.g. "08:00"
export type TimeSlot = string;
