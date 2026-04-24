import type { Club, Court, FixedReservation, Membership, PaymentStatus, PlayStatus, Reservation } from './types';

// ── Schedule ──────────────────────────────────────────────────────────────────
// Returned by GET /schedule for the fixed-reservations array.
// timeEnd is pre-computed on the server (timeStart + duration).
export interface ScheduleFixedReservation {
  id: number;
  courtId: number;
  dayOfWeek: number;
  timeStart: string;          // "HH:MM"
  timeEnd: string;            // "HH:MM"
  duration: number;
  clientName: string;
  clientPhone: string | null;
  type: string | null;
  totalPrice: string | null;
  depositAmount: string | null;
  carryOver: string;          // rolling deposit carry-over, "0" by default
  lastPaidAt: string | null;  // ISO datetime of last payment, null if never paid
  active: boolean;
  court: { id: number; name: string };
}

export interface ScheduleResponse {
  reservations: Reservation[];
  fixedReservations: ScheduleFixedReservation[];
}

export function getSchedule(date: string, clubId: number): Promise<ScheduleResponse> {
  return request(`/schedule?date=${date}&clubId=${clubId}`);
}

export const API_URL = import.meta.env.VITE_API_URL;
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
  clientPhone?: string | null;
  type?: string;
  totalPrice?: number;
  depositAmount?: number;
}

export function createReservation(data: CreateReservationPayload): Promise<Reservation> {
  return request('/reservations', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

export interface UpdateReservationPayload {
  clientName?: string;
  clientPhone?: string | null;
  type?: string | null;
  totalPrice?: number | null;
  depositAmount?: number | null;
  paidAmount?: number | null;
  paymentStatus?: PaymentStatus;
  playStatus?: PlayStatus;
}

export function updateReservation(id: number, data: UpdateReservationPayload): Promise<Reservation> {
  return request(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function deleteReservation(id: number): Promise<void> {
  return request(`/reservations/${id}`, { method: 'DELETE' });
}

export function payReservation(id: number, amount: number): Promise<Reservation> {
  return request(`/reservations/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
    headers: clubIdHeader(),
  });
}

export function updateReservationNote(id: number, internalNote: string | null): Promise<Reservation> {
  return request(`/reservations/${id}/note`, {
    method: 'PATCH',
    body: JSON.stringify({ internalNote }),
    headers: clubIdHeader(),
  });
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

// ── Fixed Reservations ────────────────────────────────────────────────────────

export interface CreateFixedReservationPayload {
  courtId: number;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday (JS convention)
  timeStart: string; // "HH:MM"
  duration: number;  // positive integer (minutes)
  clientName: string;
  clientPhone?: string | null;
  type?: string;
  totalPrice?: number;
  depositAmount?: number;
}

export type FixedReservationResponse = FixedReservation & { warning?: boolean };

export function createFixedReservation(data: CreateFixedReservationPayload): Promise<FixedReservationResponse> {
  return request('/fixed-reservations', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function getFixedReservations(clubId: number): Promise<FixedReservation[]> {
  return request(`/fixed-reservations?clubId=${clubId}`, { headers: clubIdHeader() });
}

export interface UpdateFixedReservationPayload {
  clientName: string;
  clientPhone?: string | null;
  timeStart: string;
  duration: number;
  type?: string | null;
  totalPrice?: number | null;
  depositAmount?: number | null;
}

export function updateFixedReservation(id: number, data: UpdateFixedReservationPayload): Promise<FixedReservationResponse> {
  return request(`/fixed-reservations/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function toggleFixedReservation(id: number): Promise<FixedReservationResponse> {
  return request(`/fixed-reservations/${id}/toggle`, { method: 'PATCH', headers: clubIdHeader() });
}

export function deleteFixedReservation(id: number): Promise<void> {
  return request(`/fixed-reservations/${id}`, { method: 'DELETE', headers: clubIdHeader() });
}

export interface PayFixedReservationResponse {
  id: number;
  carryOver: string;
  todayPays: number;
  pricePerSlot: number;
  depositAmount: number;
  isLastWeek: boolean;
}

export function payFixedReservation(id: number, isLastWeek: boolean): Promise<PayFixedReservationResponse> {
  return request(`/fixed-reservations/${id}/pay`, {
    method: 'PATCH',
    body: JSON.stringify({ isLastWeek }),
    headers: clubIdHeader(),
  });
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

// ── Cash ──────────────────────────────────────────────────────────────────────

export interface CashMovement {
  id: number;
  type: 'income' | 'expense';
  concept: string;
  amount: number;
  paymentMethod: string;
  relatedProductId?: number | null;
  createdAt: string;
}

export interface CreateCashMovementPayload {
  type: 'income' | 'expense';
  concept: string;
  amount: number;
  paymentMethod: string;
}

export function getCashMovements(clubId: number, from: string, to: string): Promise<CashMovement[]> {
  return request(`/cash?clubId=${clubId}&from=${from}&to=${to}`);
}

export function createCashMovement(data: CreateCashMovementPayload): Promise<CashMovement> {
  return request('/cash', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

// ── Stock / Products ──────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  salePrice: number;
  purchasePrice: number;
  stock: number;
}

export interface CreateProductPayload {
  name: string;
  salePrice: number;
  purchasePrice: number;
  stock: number;
}

export interface UpdateProductPayload {
  name?: string;
  salePrice?: number;
  purchasePrice?: number;
  stock?: number;
}

export interface SellProductPayload {
  productId: number;
  quantity: number;
  paymentMethod: 'cash' | 'transfer' | 'card';
}

export function getProducts(clubId: number): Promise<Product[]> {
  return request(`/products?clubId=${clubId}`);
}

export function createProduct(data: CreateProductPayload): Promise<Product> {
  return request('/products', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function updateProduct(id: number, data: UpdateProductPayload): Promise<Product> {
  return request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function deleteProduct(id: number): Promise<void> {
  return request(`/products/${id}`, { method: 'DELETE', headers: clubIdHeader() });
}

export function sellProduct(data: SellProductPayload): Promise<Product> {
  return request('/products/sell', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function cashSellProduct(data: SellProductPayload): Promise<Product> {
  return request('/cash/sell', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

// ── Movements ─────────────────────────────────────────────────────────────────

export interface Movement {
  id: number;
  clubId: number;
  type: 'sale' | 'manual';
  amount: number;
  description: string;
  productId: number | null;
  product: { id: number; name: string } | null;
  quantity: number | null;
  status: 'active' | 'cancelled';
  paymentMethod: 'cash' | 'mercadopago';
  createdAt: string;
}

export interface CreateManualMovementPayload {
  amount: number;
  description: string;
  paymentMethod: 'cash' | 'mercadopago';
}

export interface CreateSaleMovementPayload {
  productId: number;
  quantity: number;
  paymentMethod: 'cash' | 'mercadopago';
}

export function getMovements(clubId: number, from?: string, to?: string): Promise<Movement[]> {
  const params = new URLSearchParams({ clubId: String(clubId) });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request(`/movements?${params}`);
}

export function createManualMovement(data: CreateManualMovementPayload): Promise<Movement> {
  return request('/movements/manual', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function createSaleMovement(data: CreateSaleMovementPayload): Promise<Movement> {
  return request('/movements/sale', { method: 'POST', body: JSON.stringify(data), headers: clubIdHeader() });
}

export function cancelMovement(id: number): Promise<Movement> {
  return request(`/movements/${id}/cancel`, { method: 'PATCH', headers: clubIdHeader() });
}

export function deleteMovement(id: number): Promise<void> {
  return request(`/movements/${id}`, { method: 'DELETE', headers: clubIdHeader() });
}

// ── Opening Hours ─────────────────────────────────────────────────────────────

export interface OpeningHoursResult {
  openTime:   string;  // "HH:mm"
  closeTime:  string;  // "HH:mm"
  isOverride: boolean;
}

export interface DaySchedule {
  dayOfWeek: number;   // 0=Sun … 6=Sat
  openTime:  string;   // "HH:mm"
  closeTime: string;   // "HH:mm"
}

export function getOpeningHours(clubId: number, date: string): Promise<OpeningHoursResult> {
  return request(`/opening-hours?clubId=${clubId}&date=${date}`);
}

export function getWeeklyDefaults(clubId: number): Promise<(DaySchedule | null)[]> {
  return request(`/opening-hours/default?clubId=${clubId}`);
}

export function updateDefaultHours(clubId: number, schedule: DaySchedule[]): Promise<{ ok: boolean }> {
  return request('/opening-hours/default', {
    method: 'PUT',
    body: JSON.stringify({ clubId, schedule }),
  });
}

export function updateDateHours(
  clubId: number,
  date: string,
  openTime: string,
  closeTime: string,
): Promise<{ ok: boolean }> {
  return request('/opening-hours/date', {
    method: 'PUT',
    body: JSON.stringify({ clubId, date, openTime, closeTime }),
  });
}

export function deleteDateHours(clubId: number, date: string): Promise<{ ok: boolean }> {
  return request('/opening-hours/date', {
    method: 'DELETE',
    body: JSON.stringify({ clubId, date }),
  });
}
