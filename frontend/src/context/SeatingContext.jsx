import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api/api';
import { useAuth } from './AuthContext';

const SeatingContext = createContext(null);

export function SeatingProvider({ children }) {
  const { user } = useAuth();
  const [seats, setSeats] = useState([]);
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, reserved: 0, held: 0, blocked: 0 });
  const [services, setServices] = useState([]); // events
  const [activeService, setActiveService] = useState(null); // active event
  const [reservations, setReservations] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentEventId, setCurrentEventId] = useState(null);

  const fetchAll = useCallback(async (eventId = null) => {
    if (!user) return;
    setLoading(true);
    try {
      const servicesRes = await API.get('/services');

      let actLogs = [];
      if (user.role === 'admin') {
        try {
          const actRes = await API.get('/activity?limit=50');
          actLogs = actRes.data;
        } catch (e) {
          // ignore activity log error
        }
      }

      const active = servicesRes.data.find(s => s.isActive || s.status === 'Active');
      setActiveService(active || null);

      const targetEventId = eventId || (active ? active._id : null);
      const seatsUrl = targetEventId ? `/seats?eventId=${targetEventId}` : '/seats';
      const statsUrl = targetEventId ? `/seats/stats?eventId=${targetEventId}` : '/seats/stats';

      const [seatsRes, statsRes] = await Promise.all([
        API.get(seatsUrl),
        API.get(statsUrl),
      ]);

      setSeats(seatsRes.data);
      setStats(statsRes.data);
      setServices(servicesRes.data);
      setActivityLogs(actLogs);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentEventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Load seats specifically for a given event
  const fetchSeatsForEvent = async (eventId) => {
    if (!eventId) return;
    setCurrentEventId(eventId);
    setLoading(true);
    try {
      const [seatsRes, statsRes] = await Promise.all([
        API.get(`/seats?eventId=${eventId}`),
        API.get(`/seats/stats?eventId=${eventId}`),
      ]);
      setSeats(seatsRes.data);
      setStats(statsRes.data);
      return seatsRes.data;
    } catch (err) {
      console.error('Error fetching event seats:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSeat = async (seatId, data, eventId = null) => {
    const targetEventId = eventId || currentEventId || (activeService ? activeService._id : null);
    const url = targetEventId ? `/seats/${seatId}?eventId=${targetEventId}` : `/seats/${seatId}`;
    const res = await API.patch(url, { ...data, eventId: targetEventId });
    setSeats(prev => prev.map(s => (s._id === res.data._id || s.seatId === seatId) ? res.data : s));
    setStats(prev => {
      const newStats = { ...prev };
      const oldSeat = seats.find(s => s._id === res.data._id || s.seatId === seatId);
      if (oldSeat) newStats[oldSeat.status] = Math.max(0, newStats[oldSeat.status] - 1);
      newStats[res.data.status] = (newStats[res.data.status] || 0) + 1;
      return newStats;
    });
    return res.data;
  };

  const createService = async (data) => {
    const res = await API.post('/services', data);
    setServices(prev => [res.data, ...prev]);
    return res.data;
  };

  const updateService = async (id, data) => {
    const res = await API.patch('/services/' + id, data);
    setServices(prev => prev.map(s => {
      if (s._id === id) return res.data;
      if (data.isActive) return { ...s, isActive: false, status: s.status === 'Active' ? 'Upcoming' : s.status };
      return s;
    }));
    if (data.isActive || res.data.isActive) {
      setActiveService(res.data);
    } else if (data.isActive === false || res.data.isActive === false) {
      setActiveService(prev => (prev?._id === id ? null : prev));
    }
    return res.data;
  };

  const deleteService = async (id) => {
    await API.delete('/services/' + id);
    setServices(prev => prev.filter(s => s._id !== id));
  };

  // Section Management
  const addSection = async (eventId, name, code) => {
    const res = await API.post('/seats/sections', { eventId, name, code });
    await fetchSeatsForEvent(eventId);
    return res.data;
  };

  const editSection = async (eventId, sectionCode, newName) => {
    const res = await API.patch('/seats/sections', { eventId, sectionCode, newName });
    await fetchSeatsForEvent(eventId);
    return res.data;
  };

  const deleteSection = async (eventId, sectionCode) => {
    const res = await API.delete('/seats/sections', { data: { eventId, sectionCode } });
    await fetchSeatsForEvent(eventId);
    return res.data;
  };

  // Row Management
  const addRow = async (eventId, sectionCode, rowName, seatCount) => {
    const res = await API.post('/seats/rows', { eventId, sectionCode, rowName, seatCount });
    await fetchSeatsForEvent(eventId);
    return res.data;
  };

  const editRow = async (eventId, sectionCode, rowName, newRowName, newSeatCount) => {
    const res = await API.patch('/seats/rows', { eventId, sectionCode, rowName, newRowName, newSeatCount });
    await fetchSeatsForEvent(eventId);
    return res.data;
  };

  const deleteRow = async (eventId, sectionCode, rowName) => {
    const res = await API.delete('/seats/rows', { data: { eventId, sectionCode, rowName } });
    await fetchSeatsForEvent(eventId);
    return res.data;
  };

  // Admin Manual Seat Assignment
  const assignSeatToAttendee = async ({ eventId, registrationId, seatId, attendeeName, idNumber }) => {
    const res = await API.post('/seats/assign', {
      eventId,
      registrationId,
      seatId,
      attendeeName,
      idNumber,
    });
    await fetchSeatsForEvent(eventId);
    return res.data;
  };

  // Group seats by section for the seating map
  const seatsBySection = seats.reduce((acc, seat) => {
    if (!acc[seat.sectionCode]) acc[seat.sectionCode] = { name: seat.section, code: seat.sectionCode, rows: {} };
    if (!acc[seat.sectionCode].rows[seat.row]) acc[seat.sectionCode].rows[seat.row] = [];
    acc[seat.sectionCode].rows[seat.row].push(seat);
    return acc;
  }, {});

  // Find consecutive available seats
  const findBestSeats = (count) => {
    const results = [];
    for (const secCode of Object.keys(seatsBySection)) {
      const section = seatsBySection[secCode];
      for (const row of Object.keys(section.rows).sort()) {
        const rowSeats = section.rows[row].filter(s => s.status === 'available').sort((a, b) => a.number - b.number);
        for (let i = 0; i <= rowSeats.length - count; i++) {
          const group = rowSeats.slice(i, i + count);
          const isConsecutive = group.every((s, idx) => idx === 0 || s.number === group[idx - 1].number + 1);
          if (isConsecutive && group.length === count) {
            results.push({ section: section.name, row, seats: group, label: section.name + ' — Row ' + row });
            if (results.length >= 3) break;
          }
        }
        if (results.length >= 3) break;
      }
      if (results.length >= 3) break;
    }
    return results;
  };

  return (
    <SeatingContext.Provider value={{
      seats, stats,
      events: services, services,
      activeEvent: activeService, activeService,
      reservations, activityLogs,
      loading, seatsBySection, fetchAll, fetchSeatsForEvent,
      updateSeat,
      createEvent: createService, createService,
      updateEvent: updateService, updateService,
      deleteEvent: deleteService, deleteService,
      addSection, editSection, deleteSection,
      addRow, editRow, deleteRow,
      assignSeatToAttendee,
      findBestSeats,
    }}>
      {children}
    </SeatingContext.Provider>
  );
}

export function useSeating() {
  const ctx = useContext(SeatingContext);
  if (!ctx) throw new Error('useSeating must be inside SeatingProvider');
  return ctx;
}
