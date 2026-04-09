import type { Club, Court, Membership, PaymentStatus, PlayStatus, Reservation } from './types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const BASE = `${API_URL}/api`;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('pp_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clubIdHeader(): Record<string, string> {
  const clubId = localStorage.getItem('pp_selected_club');
  return clubId ? { 'X-Club-Id': clubId } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getClubs(): Promise<Club[]> {
  return request('/clubs');
}

export function createClub(name: string): Promise<Club> {
  return request('/clubs', { method: 'POST', body: JSON.stringify({ name }) });
}

export function getCourts(clubId?: number): Promise<Court[]> {
  const q = clubId !== undefined ? `?clubId=${clubId}` : '';
  return request(`/courts${q}`);
}

export function createCourt(data: { name: string; clubId: number }): Promise<Court> {
  return request('/courts', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteCourt(id: number): Promise<void> {
  return request(`/courts/${id}`, { method: 'DELETE' });
}

export function updateCourt(id: number, data: { name: string }): Promise<Court> {
  return request(`/courts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function updateClub(id: number, data: { name: string }): Promise<Club> {
  return request(`/clubs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function getReservations(date: string): Promise<Reservation[]> {
  return request(`/reservations?date=${date}`, { headers: clubIdHeader() });
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
  return request('/reservations', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
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
  return request(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: clubIdHeader() });
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

export function getRevenue(from: string, to: string, clubId: number): Promise<RevenueData> {
  return request(`/analytics/revenue?from=${from}&to=${to}&clubId=${clubId}`);
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

export function getReservationsReport(from: string, to: string, clubId: number): Promise<ReservationReportRow[]> {
  return request(`/analytics/reservations?from=${from}&to=${to}&clubId=${clubId}`);
}

// ── Memberships ───────────────────────────────────────────────────────────────

export function getMembership(clubId: number): Promise<Membership> {
  return request(`/membership?clubId=${clubId}`);
}

export function updateMembership(id: number, data: { displayName: string }): Promise<Membership> {
  return request(`/membership/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ── Invitations ───────────────────────────────────────────────────────────────

export interface InvitationResponse {
  status: string;
  token: string;
  invitation: { token: string; [key: string]: unknown };
}

export function createInvitation(email: string, clubId: number, displayName: string): Promise<InvitationResponse> {
  return request('/invitations', { method: 'POST', body: JSON.stringify({ email, clubId, displayName }) });
}

export interface AcceptInvitationPayload {
  token: string;
  password: string;
}

export interface AcceptInvitationResponse {
  token: string;
  user: import('./types').User;
}

export function acceptInvitation(data: AcceptInvitationPayload): Promise<AcceptInvitationResponse> {
  return request('/invitations/accept', { method: 'POST', body: JSON.stringify(data) });
}
