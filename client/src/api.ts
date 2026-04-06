import type { Court, Reservation, ReservationStatus } from './types';

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
  clientPhone?: string;
  depositAmount?: number;
}

export function createReservation(data: CreateReservationPayload): Promise<Reservation> {
  return request('/reservations', { method: 'POST', body: JSON.stringify(data) });
}

export interface UpdateReservationPayload {
  date?: string;
  timeStart?: string;
  timeEnd?: string;
  clientName?: string;
  clientPhone?: string | null;
  depositAmount?: number | null;
  status?: ReservationStatus;
}

export function updateReservation(id: number, data: UpdateReservationPayload): Promise<Reservation> {
  return request(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteReservation(id: number): Promise<void> {
  return request(`/reservations/${id}`, { method: 'DELETE' });
}
