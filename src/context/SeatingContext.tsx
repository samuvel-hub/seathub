'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Church,
  Auditorium,
  Section,
  Row,
  Seat,
  Service,
  ServiceSeat,
  ActivityLog,
  UsherAssignment,
  FullSeatInfo,
  SeatRecommendation,
  DashboardStats,
  SeatStatus,
  SeatType
} from '@/types/database';
import {
  INITIAL_CHURCH,
  INITIAL_AUDITORIUM,
  INITIAL_SERVICES,
  generateInitialSeatingLayout
} from '@/lib/mock-data';
import { api } from '@/lib/api';

interface SeatingContextType {
  church: Church;
  auditorium: Auditorium;
  sections: Section[];
  rows: Row[];
  seats: Seat[];
  services: Service[];
  activeService: Service | null;
  serviceSeats: ServiceSeat[];
  activityLogs: ActivityLog[];
  usherAssignments: UsherAssignment[];
  stats: DashboardStats;
  
  // Actions
  setActiveServiceId: (serviceId: string) => void;
  assignSeats: (seatIds: string[], usherId: string, usherName: string) => Promise<{ success: boolean; message: string }>;
  holdSeats: (seatIds: string[], usherId: string, usherName: string, minutes?: number) => Promise<{ success: boolean; message: string }>;
  releaseSeats: (seatIds: string[]) => Promise<void>;
  reserveSeats: (seatIds: string[], note: string) => Promise<void>;
  blockSeats: (seatIds: string[]) => Promise<void>;
  unblockSeats: (seatIds: string[]) => Promise<void>;
  findBestSeats: (count: number, sectionId?: string, seatType?: SeatType) => SeatRecommendation[];
  
  // Service management
  createService: (name: string, serviceTime: string) => Promise<Service>;
  startService: (serviceId: string) => Promise<void>;
  completeService: (serviceId: string) => Promise<void>;
  assignUsherToService: (serviceId: string, usherId: string, sectionId?: string) => Promise<void>;
  
  // Configuration Editor
  addSection: (name: string, code: string, color: string) => void;
  addRow: (sectionId: string, rowName: string) => void;
  addSeat: (rowId: string, seatNumber: number, seatType: SeatType) => void;
  
  // Helper lookup
  getFullSeatInfo: (seatId: string) => FullSeatInfo | undefined;
  getFullSeatInfoList: () => FullSeatInfo[];
}

const SeatingContext = createContext<SeatingContextType | undefined>(undefined);

export const SeatingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [church] = useState<Church>(INITIAL_CHURCH);
  const [auditorium] = useState<Auditorium>(INITIAL_AUDITORIUM);
  
  // Initialize layout & state
  const [layout] = useState(() => generateInitialSeatingLayout());
  const [sections, setSections] = useState<Section[]>(layout.sections);
  const [rows, setRows] = useState<Row[]>(layout.rows);
  const [seats, setSeats] = useState<Seat[]>(layout.seats);
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [activeServiceId, setActiveServiceIdState] = useState<string>('service-current');
  const [serviceSeats, setServiceSeats] = useState<ServiceSeat[]>(layout.serviceSeats);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(layout.activityLogs);
  const [usherAssignments, setUsherAssignments] = useState<UsherAssignment[]>(layout.usherAssignments);

  // Sync from Express/MongoDB backend (silently falls back to mock data if backend is down)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) return; // Only sync if logged in via real API

    const syncFromBackend = async () => {
      try {
        // Sync services
        const apiServices = await api.getServices() as Array<{
          _id: string; name: string; date: string; time: string; isActive: boolean; type: string; attendanceTarget: number;
        }>;
        if (apiServices.length > 0) {
          const mapped: Service[] = apiServices.map((s) => ({
            id: s._id,
            church_id: INITIAL_CHURCH.id,
            name: s.name,
            service_time: new Date(`${s.date.split('T')[0]}T${s.time.replace(' AM', '').replace(' PM', '')}`).toISOString(),
            status: s.isActive ? 'active' as const : 'scheduled' as const,
            created_at: new Date().toISOString(),
          }));
          setServices(mapped);
          const active = apiServices.find((s) => s.isActive);
          if (active) setActiveServiceIdState(active._id);
        }
      } catch {
        // Backend not available — using mock data
      }

      try {
        // Sync activity logs
        const apiLogs = await api.getActivity(50) as Array<{
          _id: string; action: string; userName: string; seatId: string; details: string; timestamp: string;
        }>;
        if (apiLogs.length > 0) {
          const mapped: ActivityLog[] = apiLogs.map((l) => ({
            id: l._id,
            service_id: activeServiceId,
            user_name: l.userName || 'System',
            action: l.action,
            details: l.details,
            created_at: l.timestamp,
          }));
          setActivityLogs(mapped);
        }
      } catch {
        // Backend not available — using mock data
      }
    };

    syncFromBackend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeService = services.find((s) => s.id === activeServiceId) || services[0] || null;

  // Auto release expired holds every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setServiceSeats((prevSeats) => {
        let hasExpired = false;
        const updated = prevSeats.map((ss) => {
          if (ss.status === 'HELD' && ss.held_until && new Date(ss.held_until).getTime() <= now) {
            hasExpired = true;
            return {
              ...ss,
              status: 'AVAILABLE' as SeatStatus,
              held_by: undefined,
              held_until: undefined
            };
          }
          return ss;
        });

        if (hasExpired) {
          setActivityLogs((logs) => [
            {
              id: `log-auto-${Date.now()}`,
              service_id: activeServiceId,
              user_name: 'System Auto-Release',
              action: 'SEAT_HOLD_EXPIRED',
              details: 'Released expired temporary seat hold(s) back to AVAILABLE',
              created_at: new Date().toISOString()
            },
            ...logs
          ]);
        }

        return updated;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [activeServiceId]);

  // Compute Dashboard Statistics
  const stats: DashboardStats = React.useMemo(() => {
    const totalSeats = seats.length;
    let availableSeats = 0;
    let occupiedSeats = 0;
    let reservedSeats = 0;
    let heldSeats = 0;
    let blockedSeats = 0;

    serviceSeats.forEach((ss) => {
      switch (ss.status) {
        case 'AVAILABLE':
          availableSeats++;
          break;
        case 'OCCUPIED':
          occupiedSeats++;
          break;
        case 'RESERVED':
          reservedSeats++;
          break;
        case 'HELD':
          heldSeats++;
          break;
        case 'BLOCKED':
          blockedSeats++;
          break;
      }
    });

    const nonBlockedTotal = totalSeats - blockedSeats;
    const occupancyPercentage = nonBlockedTotal > 0 ? Math.round((occupiedSeats / nonBlockedTotal) * 100) : 0;

    return {
      totalSeats,
      availableSeats,
      occupiedSeats,
      reservedSeats,
      heldSeats,
      blockedSeats,
      occupancyPercentage
    };
  }, [seats, serviceSeats]);

  // Build quick map of Seat ID -> Full Seat Info
  const seatMap = React.useMemo(() => {
    const map = new Map<string, FullSeatInfo>();
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const rowMap = new Map(rows.map((r) => [r.id, r]));
    const ssMap = new Map(serviceSeats.map((ss) => [ss.seat_id, ss]));

    seats.forEach((seat) => {
      const row = rowMap.get(seat.row_id);
      if (!row) return;
      const section = sectionMap.get(row.section_id);
      if (!section) return;
      const serviceSeat = ssMap.get(seat.id) || {
        id: `ss-temp-${seat.id}`,
        service_id: activeServiceId,
        seat_id: seat.id,
        status: seat.is_blocked ? ('BLOCKED' as SeatStatus) : ('AVAILABLE' as SeatStatus),
        created_at: new Date().toISOString()
      };

      map.set(seat.id, { seat, row, section, serviceSeat });
    });

    return map;
  }, [sections, rows, seats, serviceSeats, activeServiceId]);

  const getFullSeatInfo = useCallback((seatId: string) => seatMap.get(seatId), [seatMap]);
  const getFullSeatInfoList = useCallback(() => Array.from(seatMap.values()), [seatMap]);

  // Switch Active Service
  const setActiveServiceId = (serviceId: string) => {
    setActiveServiceIdState(serviceId);
  };

  // Atomic Concurrency Protected Seat Assignment
  const assignSeats = async (
    seatIds: string[],
    usherId: string,
    usherName: string
  ): Promise<{ success: boolean; message: string }> => {
    // Check current seat states to prevent race condition
    const conflicts: string[] = [];
    seatIds.forEach((id) => {
      const info = seatMap.get(id);
      if (!info) return;
      const status = info.serviceSeat.status;
      if (status === 'OCCUPIED') {
        conflicts.push(`${info.section.code} ${info.row.row_name} Seat ${info.seat.seat_number} is already occupied by another usher`);
      } else if (status === 'BLOCKED') {
        conflicts.push(`${info.section.code} ${info.row.row_name} Seat ${info.seat.seat_number} is blocked`);
      } else if (status === 'RESERVED') {
        conflicts.push(`${info.section.code} ${info.row.row_name} Seat ${info.seat.seat_number} is reserved`);
      }
    });

    if (conflicts.length > 0) {
      return { success: false, message: conflicts[0] };
    }

    const now = new Date().toISOString();
    setServiceSeats((prev) =>
      prev.map((ss) => {
        if (seatIds.includes(ss.seat_id)) {
          return {
            ...ss,
            status: 'OCCUPIED' as SeatStatus,
            assigned_by: usherId,
            assigned_at: now,
            held_by: undefined,
            held_until: undefined,
            updated_at: now
          };
        }
        return ss;
      })
    );

    // Record Activity Log
    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: activeServiceId,
        user_id: usherId,
        user_name: usherName,
        action: 'SEAT_ASSIGNED',
        details: `Assigned ${seatIds.length} seat(s)`,
        created_at: now
      },
      ...prev
    ]);

    return { success: true, message: `Successfully assigned ${seatIds.length} seat(s)!` };
  };

  // Temporary Hold Seats
  const holdSeats = async (
    seatIds: string[],
    usherId: string,
    usherName: string,
    minutes = 2
  ): Promise<{ success: boolean; message: string }> => {
    const heldUntil = new Date(Date.now() + minutes * 60000).toISOString();
    const now = new Date().toISOString();

    setServiceSeats((prev) =>
      prev.map((ss) => {
        if (seatIds.includes(ss.seat_id) && ss.status === 'AVAILABLE') {
          return {
            ...ss,
            status: 'HELD' as SeatStatus,
            held_by: usherId,
            held_until: heldUntil,
            updated_at: now
          };
        }
        return ss;
      })
    );

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: activeServiceId,
        user_id: usherId,
        user_name: usherName,
        action: 'SEAT_HELD',
        details: `Placed temporary ${minutes}-minute hold on ${seatIds.length} seat(s)`,
        created_at: now
      },
      ...prev
    ]);

    return { success: true, message: `Held ${seatIds.length} seat(s) for ${minutes} minutes.` };
  };

  // Release Seats back to AVAILABLE
  const releaseSeats = async (seatIds: string[]) => {
    const now = new Date().toISOString();
    setServiceSeats((prev) =>
      prev.map((ss) => {
        if (seatIds.includes(ss.seat_id)) {
          return {
            ...ss,
            status: 'AVAILABLE' as SeatStatus,
            assigned_by: undefined,
            assigned_at: undefined,
            held_by: undefined,
            held_until: undefined,
            reservation_note: undefined,
            updated_at: now
          };
        }
        return ss;
      })
    );

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: activeServiceId,
        action: 'SEAT_RELEASED',
        details: `Released ${seatIds.length} seat(s) back to AVAILABLE`,
        created_at: now
      },
      ...prev
    ]);
  };

  // Reserve Seats (Admin)
  const reserveSeats = async (seatIds: string[], note: string) => {
    const now = new Date().toISOString();
    setServiceSeats((prev) =>
      prev.map((ss) => {
        if (seatIds.includes(ss.seat_id)) {
          return {
            ...ss,
            status: 'RESERVED' as SeatStatus,
            reservation_note: note,
            updated_at: now
          };
        }
        return ss;
      })
    );

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: activeServiceId,
        action: 'SEAT_RESERVED',
        details: `Reserved ${seatIds.length} seat(s) - Note: ${note}`,
        created_at: now
      },
      ...prev
    ]);
  };

  // Block Seats (Admin)
  const blockSeats = async (seatIds: string[]) => {
    const now = new Date().toISOString();
    setServiceSeats((prev) =>
      prev.map((ss) => {
        if (seatIds.includes(ss.seat_id)) {
          return {
            ...ss,
            status: 'BLOCKED' as SeatStatus,
            updated_at: now
          };
        }
        return ss;
      })
    );

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: activeServiceId,
        action: 'SEAT_BLOCKED',
        details: `Blocked ${seatIds.length} seat(s)`,
        created_at: now
      },
      ...prev
    ]);
  };

  // Unblock Seats (Admin)
  const unblockSeats = async (seatIds: string[]) => {
    const now = new Date().toISOString();
    setServiceSeats((prev) =>
      prev.map((ss) => {
        if (seatIds.includes(ss.seat_id)) {
          return {
            ...ss,
            status: 'AVAILABLE' as SeatStatus,
            updated_at: now
          };
        }
        return ss;
      })
    );

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: activeServiceId,
        action: 'SEAT_UNBLOCKED',
        details: `Unblocked ${seatIds.length} seat(s)`,
        created_at: now
      },
      ...prev
    ]);
  };

  // SMART FIND SEATS ALGORITHM
  // Prioritizes:
  // 1. Consecutive available seats in same row
  // 2. Same section
  // 3. Front/middle row proximity
  const findBestSeats = (
    count: number,
    sectionIdFilter?: string,
    seatTypeFilter?: SeatType
  ): SeatRecommendation[] => {
    const recommendations: SeatRecommendation[] = [];

    // Group seats by section -> row
    const targetSections = sectionIdFilter
      ? sections.filter((s) => s.id === sectionIdFilter)
      : sections;

    targetSections.forEach((section) => {
      const sectionRows = rows
        .filter((r) => r.section_id === section.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      sectionRows.forEach((row) => {
        const rowSeats = seats
          .filter((s) => s.row_id === row.id)
          .sort((a, b) => a.seat_number - b.seat_number);

        // Find consecutive available sequences
        let currentSequence: FullSeatInfo[] = [];

        for (let i = 0; i < rowSeats.length; i++) {
          const seat = rowSeats[i];
          const info = seatMap.get(seat.id);

          if (!info) continue;

          const isAvailable = info.serviceSeat.status === 'AVAILABLE';
          const matchesType = !seatTypeFilter || seat.seat_type === seatTypeFilter;

          if (isAvailable && matchesType) {
            currentSequence.push(info);

            if (currentSequence.length === count) {
              // Found exact consecutive match!
              const rowOrderScore = 100 - row.sort_order * 5; // Closer to stage is better
              const matchScore = 1000 + rowOrderScore;

              recommendations.push({
                id: `rec-${section.code}-${row.row_name}-${currentSequence[0].seat.seat_number}`,
                section,
                row,
                seats: [...currentSequence],
                matchScore,
                matchReason: `${count} consecutive seats together in ${section.name}, ${row.row_name}`
              });

              // Slide sequence window by 1 to check next group
              currentSequence.shift();
            }
          } else {
            currentSequence = [];
          }
        }
      });
    });

    // Sort by highest score & return top 3 options
    return recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  };

  // Service Management Actions
  const createService = async (name: string, serviceTime: string): Promise<Service> => {
    const newService: Service = {
      id: `service-${Date.now()}`,
      church_id: church.id,
      name,
      service_time: serviceTime,
      status: 'scheduled',
      created_at: new Date().toISOString()
    };

    setServices((prev) => [newService, ...prev]);

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        action: 'SERVICE_CREATED',
        details: `Created new service: "${name}" at ${new Date(serviceTime).toLocaleString()}`,
        created_at: new Date().toISOString()
      },
      ...prev
    ]);

    return newService;
  };

  const startService = async (serviceId: string) => {
    const now = new Date().toISOString();
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, status: 'active' as const, updated_at: now } : s))
    );
    setActiveServiceIdState(serviceId);

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: serviceId,
        action: 'SERVICE_STARTED',
        details: 'Service started & live seating activated',
        created_at: now
      },
      ...prev
    ]);
  };

  const completeService = async (serviceId: string) => {
    const now = new Date().toISOString();
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, status: 'completed' as const, updated_at: now } : s))
    );

    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        service_id: serviceId,
        action: 'SERVICE_COMPLETED',
        details: 'Service completed & seating session archived',
        created_at: now
      },
      ...prev
    ]);
  };

  const assignUsherToService = async (serviceId: string, usherId: string, sectionId?: string) => {
    const newAssignment: UsherAssignment = {
      id: `ua-${Date.now()}`,
      service_id: serviceId,
      usher_id: usherId,
      section_id: sectionId,
      created_at: new Date().toISOString()
    };
    setUsherAssignments((prev) => [...prev, newAssignment]);
  };

  // Seating Configuration Editors
  const addSection = (name: string, code: string, color: string) => {
    const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSec: Section = {
      id: `sec-${uid}`,
      auditorium_id: auditorium.id,
      name,
      code,
      color,
      sort_order: sections.length + 1,
      created_at: new Date().toISOString()
    };
    setSections((prev) => [...prev, newSec]);
  };

  const addRow = (sectionId: string, rowName: string) => {
    const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRow: Row = {
      id: `row-${uid}`,
      section_id: sectionId,
      row_name: rowName,
      sort_order: rows.filter((r) => r.section_id === sectionId).length + 1,
      created_at: new Date().toISOString()
    };
    setRows((prev) => [...prev, newRow]);
  };

  const addSeat = (rowId: string, seatNumber: number, seatType: SeatType) => {
    const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSeat: Seat = {
      id: `seat-${uid}`,
      row_id: rowId,
      seat_number: seatNumber,
      seat_type: seatType,
      is_blocked: false,
      x_pos: seatNumber * 30,
      y_pos: 100
    };
    setSeats((prev) => [...prev, newSeat]);

    const newServiceSeat: ServiceSeat = {
      id: `ss-${newSeat.id}`,
      service_id: activeServiceId,
      seat_id: newSeat.id,
      status: 'AVAILABLE',
      created_at: new Date().toISOString()
    };
    setServiceSeats((prev) => [...prev, newServiceSeat]);
  };

  return (
    <SeatingContext.Provider
      value={{
        church,
        auditorium,
        sections,
        rows,
        seats,
        services,
        activeService,
        serviceSeats,
        activityLogs,
        usherAssignments,
        stats,
        setActiveServiceId,
        assignSeats,
        holdSeats,
        releaseSeats,
        reserveSeats,
        blockSeats,
        unblockSeats,
        findBestSeats,
        createService,
        startService,
        completeService,
        assignUsherToService,
        addSection,
        addRow,
        addSeat,
        getFullSeatInfo,
        getFullSeatInfoList
      }}
    >
      {children}
    </SeatingContext.Provider>
  );
};

export const useSeating = () => {
  const context = useContext(SeatingContext);
  if (!context) {
    throw new Error('useSeating must be used within a SeatingProvider');
  }
  return context;
};
