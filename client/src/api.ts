import type { Court, PaymentStatus, PlayStatus, Reservation } from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getCourts(): Promise<Court[]> {
  return request('/courts');
}

export function getReservations(date: string): Promise<Reservation[]> {
  return request(`/reservations?date=${date}`);
}

export interface CreateReservationPayload {
  courtId: number;
  date: string;
  timeStart: string;
  timeEnd: string;
  clientName: string;
  type?: string;
  totalPrice?: number;
  depositAmount?: number;
}

export function createReservation(data: CreateReservationPayload): Promise<Reservation> {
  return request('/reservations', { method: 'POST', body: JSON.stringify(data) });
}

export interface UpdateReservationPayload {
  clientName?: string;
  type?: string | null;
  totalPrice?: number | null;
  depositAmount?: number | null;
  paymentStatus?: PaymentStatus;
  playStatus?: PlayStatus;
}

export function updateReservation(id: number, data: UpdateReservationPayload): Promise<Reservation> {
  return request(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteReservation(id: number): Promise<void> {
  return request(`/reservations/${id}`, { method: 'DELETE' });
}

export interface DayRevenue {
  date: string;
  totals: {
    booking: number;
    class: number;
    challenge: number;
    tournament: number;
  };
  total: number;
}

export interface RevenueData {
  days: DayRevenue[];
}

export function getRevenue(from: string, to: string): Promise<RevenueData> {
  return request(`/analytics/revenue?from=${from}&to=${to}`);
}

export interface ReservationReportRow {
  id: number;
  date: string;
  courtName: string;
  clientName: string;
  type: string;
  timeStart: string;
  timeEnd: string;
  paymentStatus: string;
  totalPrice: number;
  depositAmount: number;
}

export function getReservationsReport(from: string, to: string): Promise<ReservationReportRow[]> {
  return request(`/analytics/reservations?from=${from}&to=${to}`);
}
