export type UserRole = 'admin' | 'user';
export type ServiceStatus = 'scheduled' | 'active' | 'completed';
export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'HELD' | 'BLOCKED';
export type SeatType = 'standard' | 'vip' | 'accessible' | 'companion';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at?: string;
}

export interface Church {
  id: string;
  name: string;
  address?: string;
  created_at: string;
}

export interface Auditorium {
  id: string;
  church_id: string;
  name: string;
  total_seats: number;
  created_at: string;
}

export interface Section {
  id: string;
  auditorium_id: string;
  name: string;
  code: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Row {
  id: string;
  section_id: string;
  row_name: string;
  sort_order: number;
  created_at: string;
}

export interface Seat {
  id: string;
  row_id: string;
  seat_number: number;
  seat_type: SeatType;
  is_blocked: boolean;
  x_pos: number;
  y_pos: number;
  created_at?: string;
}

export interface Service {
  id: string;
  church_id: string;
  name: string;
  service_time: string;
  status: ServiceStatus;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface ServiceSeat {
  id: string;
  service_id: string;
  seat_id: string;
  status: SeatStatus;
  assigned_by?: string;
  assigned_at?: string;
  held_by?: string;
  held_until?: string;
  reservation_note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UsherAssignment {
  id: string;
  service_id: string;
  usher_id: string;
  section_id?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  service_id?: string;
  user_id?: string;
  user_name?: string;
  action: string;
  details: string;
  created_at: string;
}

// Combined seating data node for map rendering & calculations
export interface FullSeatInfo {
  seat: Seat;
  row: Row;
  section: Section;
  serviceSeat: ServiceSeat;
}

export interface SeatRecommendation {
  id: string;
  section: Section;
  row: Row;
  seats: FullSeatInfo[];
  matchScore: number;
  matchReason: string;
}

export interface FindSeatsFilter {
  groupSize: number;
  sectionId?: string;
  seatType?: SeatType;
}

export interface DashboardStats {
  totalSeats: number;
  availableSeats: number;
  occupiedSeats: number;
  reservedSeats: number;
  heldSeats: number;
  blockedSeats: number;
  occupancyPercentage: number;
}
