// API client for the Express backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'API error');
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: Record<string, unknown> }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<Record<string, unknown>>('/auth/me'),

  // Seats
  getSeats: () => request<Record<string, unknown>[]>('/seats'),
  getStats: () => request<Record<string, unknown>>('/seats/stats'),
  updateSeat: (seatId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/seats/${seatId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  bulkUpdateSeats: (seatIds: string[], update: Record<string, unknown>) =>
    request<Record<string, unknown>[]>('/seats/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ seatIds, update }),
    }),

  // Services
  getServices: () => request<Record<string, unknown>[]>('/services'),
  createService: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (id: string) =>
    request<Record<string, unknown>>(`/services/${id}`, { method: 'DELETE' }),

  // Reservations
  getReservations: () => request<Record<string, unknown>[]>('/reservations'),
  createReservation: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/reservations', { method: 'POST', body: JSON.stringify(data) }),
  updateReservation: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Users
  getUsers: () => request<Record<string, unknown>[]>('/users'),
  createUser: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<Record<string, unknown>>(`/users/${id}`, { method: 'DELETE' }),

  // Activity
  getActivity: (limit = 100) => request<Record<string, unknown>[]>(`/activity?limit=${limit}`),
};
