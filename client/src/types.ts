export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Court {
  id: number;
  name: string;
  clubId: number;
}

export interface Reservation {
  id: number;
  courtId: number;
  date: string;       // ISO string — date part
  timeStart: string;  // ISO string — time anchored to 1970-01-01
  timeEnd: string;    // ISO string — time anchored to 1970-01-01
  clientName: string;
  clientPhone: string | null;
  status: ReservationStatus;
  depositAmount: string | null;
  court: { id: number; name: string };
}

// Slot: "HH:00", e.g. "08:00"
export type TimeSlot = string;
