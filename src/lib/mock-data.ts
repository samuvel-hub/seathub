import {
  Church,
  Auditorium,
  Section,
  Row,
  Seat,
  Service,
  ServiceSeat,
  Profile,
  ActivityLog,
  UsherAssignment
} from '@/types/database';

export const INITIAL_CHURCH: Church = {
  id: 'church-1',
  name: 'Grace Community Church',
  address: '123 Sanctuary Way, Cityville',
  created_at: new Date().toISOString()
};

export const INITIAL_AUDITORIUM: Auditorium = {
  id: 'aud-1',
  church_id: 'church-1',
  name: 'Main Worship Center',
  total_seats: 800,
  created_at: new Date().toISOString()
};

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'user-admin-1',
    email: 'admin@gracechurch.org',
    full_name: 'Pastor Sarah Jenkins (Admin)',
    role: 'admin',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'user-standard-1',
    email: 'david.user@gracechurch.org',
    full_name: 'David Miller (Lead User)',
    role: 'user',
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'user-standard-2',
    email: 'rachel.user@gracechurch.org',
    full_name: 'Rachel Adams (User)',
    role: 'user',
    status: 'active',
    created_at: new Date().toISOString()
  }
];

export const INITIAL_SERVICES: Service[] = [
  {
    id: 'service-current',
    church_id: 'church-1',
    name: 'Sunday Morning Service',
    service_time: new Date(Date.now() + 30 * 60000).toISOString(),
    status: 'active',
    created_by: 'user-admin-1',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'service-evening',
    church_id: 'church-1',
    name: 'Sunday Evening Worship',
    service_time: new Date(Date.now() + 8 * 3600000).toISOString(),
    status: 'scheduled',
    created_by: 'user-admin-1',
    created_at: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'service-past-1',
    church_id: 'church-1',
    name: 'Wednesday Midweek Gathering',
    service_time: new Date(Date.now() - 4 * 86400000).toISOString(),
    status: 'completed',
    created_by: 'user-admin-1',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  }
];

// Generate 800 seats layout deterministically
export function generateInitialSeatingLayout(): {
  sections: Section[];
  rows: Row[];
  seats: Seat[];
  serviceSeats: ServiceSeat[];
  activityLogs: ActivityLog[];
  usherAssignments: UsherAssignment[];
} {
  const sections: Section[] = [
    {
      id: 'sec-main-center',
      auditorium_id: 'aud-1',
      name: 'Main Floor - Center',
      code: 'SEC-A',
      color: '#2563eb', // Blue
      sort_order: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 'sec-main-left',
      auditorium_id: 'aud-1',
      name: 'Main Floor - Left',
      code: 'SEC-B',
      color: '#0d9488', // Teal
      sort_order: 2,
      created_at: new Date().toISOString()
    },
    {
      id: 'sec-main-right',
      auditorium_id: 'aud-1',
      name: 'Main Floor - Right',
      code: 'SEC-C',
      color: '#7c3aed', // Purple
      sort_order: 3,
      created_at: new Date().toISOString()
    },
    {
      id: 'sec-balcony',
      auditorium_id: 'aud-1',
      name: 'Upper Balcony',
      code: 'SEC-D',
      color: '#d97706', // Amber
      sort_order: 4,
      created_at: new Date().toISOString()
    }
  ];

  const rows: Row[] = [];
  const seats: Seat[] = [];
  const serviceSeats: ServiceSeat[] = [];

  const sectionConfigs = [
    { secId: 'sec-main-center', numRows: 12, seatsPerRow: 20, yStart: 100 },
    { secId: 'sec-main-left', numRows: 10, seatsPerRow: 16, yStart: 100 },
    { secId: 'sec-main-right', numRows: 10, seatsPerRow: 16, yStart: 100 },
    { secId: 'sec-balcony', numRows: 12, seatsPerRow: 20, yStart: 500 }
  ];

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let seatCounter = 0;

  sectionConfigs.forEach((cfg) => {
    for (let r = 0; r < cfg.numRows; r++) {
      const rowLetter = alphabet[r % 26];
      const rowId = `row-${cfg.secId}-${rowLetter}`;
      
      rows.push({
        id: rowId,
        section_id: cfg.secId,
        row_name: `Row ${rowLetter}`,
        sort_order: r + 1,
        created_at: new Date().toISOString()
      });

      for (let s = 1; s <= cfg.seatsPerRow; s++) {
        seatCounter++;
        const seatId = `seat-${cfg.secId}-${rowLetter}-${s}`;
        
        let seatType: 'standard' | 'vip' | 'accessible' | 'companion' = 'standard';
        if (r === 0 && (cfg.secId === 'sec-main-center')) seatType = 'vip';
        if (r === cfg.numRows - 1 && s <= 4) seatType = 'accessible';
        if (r === cfg.numRows - 1 && s > 4 && s <= 8) seatType = 'companion';

        const isBlocked = (cfg.secId === 'sec-main-left' && r === 2 && s === 1) || 
                          (cfg.secId === 'sec-balcony' && r === 0 && s === 10);

        seats.push({
          id: seatId,
          row_id: rowId,
          seat_number: s,
          seat_type: seatType,
          is_blocked: isBlocked,
          x_pos: s * 30,
          y_pos: cfg.yStart + r * 30
        });

        let initialStatus: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'HELD' | 'BLOCKED' = 'AVAILABLE';
        let reservationNote: string | undefined = undefined;
        let heldBy: string | undefined = undefined;
        let heldUntil: string | undefined = undefined;
        let assignedBy: string | undefined = undefined;
        let assignedAt: string | undefined = undefined;

        if (isBlocked) {
          initialStatus = 'BLOCKED';
        } else if (cfg.secId === 'sec-main-center' && r === 0) {
          initialStatus = 'RESERVED';
          reservationNote = 'Pastoral Staff & Guests';
        } else if (cfg.secId === 'sec-main-center' && r === 1 && s <= 8) {
          initialStatus = 'OCCUPIED';
          assignedBy = 'user-standard-1';
          assignedAt = new Date(Date.now() - 15 * 60000).toISOString();
        } else if (cfg.secId === 'sec-main-left' && r === 0 && s <= 4) {
          initialStatus = 'OCCUPIED';
          assignedBy = 'user-standard-2';
          assignedAt = new Date(Date.now() - 10 * 60000).toISOString();
        } else if (cfg.secId === 'sec-main-right' && r === 1 && s >= 5 && s <= 8) {
          initialStatus = 'HELD';
          heldBy = 'user-standard-1';
          heldUntil = new Date(Date.now() + 120000).toISOString();
        }

        serviceSeats.push({
          id: `ss-${seatId}`,
          service_id: 'service-current',
          seat_id: seatId,
          status: initialStatus,
          assigned_by: assignedBy,
          assigned_at: assignedAt,
          held_by: heldBy,
          held_until: heldUntil,
          reservation_note: reservationNote,
          created_at: new Date().toISOString()
        });
      }
    }
  });

  const usherAssignments: UsherAssignment[] = [
    {
      id: 'ua-1',
      service_id: 'service-current',
      usher_id: 'user-standard-1',
      section_id: 'sec-main-center',
      created_at: new Date().toISOString()
    },
    {
      id: 'ua-2',
      service_id: 'service-current',
      usher_id: 'user-standard-2',
      section_id: 'sec-main-left',
      created_at: new Date().toISOString()
    }
  ];

  const activityLogs: ActivityLog[] = [
    {
      id: 'log-1',
      service_id: 'service-current',
      user_id: 'user-admin-1',
      user_name: 'Pastor Sarah Jenkins (Admin)',
      action: 'SERVICE_STARTED',
      details: 'Started Sunday Morning Service (9:00 AM)',
      created_at: new Date(Date.now() - 40 * 60000).toISOString()
    },
    {
      id: 'log-2',
      service_id: 'service-current',
      user_id: 'user-admin-1',
      user_name: 'Pastor Sarah Jenkins (Admin)',
      action: 'SEAT_RESERVED',
      details: 'Reserved Row A (Seats 1-20) in Main Floor Center for Pastoral Staff',
      created_at: new Date(Date.now() - 30 * 60000).toISOString()
    },
    {
      id: 'log-3',
      service_id: 'service-current',
      user_id: 'user-standard-1',
      user_name: 'David Miller (User)',
      action: 'SEAT_ASSIGNED',
      details: 'Assigned family of 8 to Main Floor Center Row B (Seats 1-8)',
      created_at: new Date(Date.now() - 15 * 60000).toISOString()
    },
    {
      id: 'log-4',
      service_id: 'service-current',
      user_id: 'user-standard-2',
      user_name: 'Rachel Adams (User)',
      action: 'SEAT_ASSIGNED',
      details: 'Assigned 4 visitors to Main Floor Left Row A (Seats 1-4)',
      created_at: new Date(Date.now() - 10 * 60000).toISOString()
    }
  ];

  return { sections, rows, seats, serviceSeats, activityLogs, usherAssignments };
}
