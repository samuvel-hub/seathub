import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api/api';
import { useAuth } from './AuthContext';

const SeatingContext = createContext(null);

export function SeatingProvider({ children }) {
  const { user } = useAuth();
  const [seats, setSeats] = useState([]);
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, reserved: 0, held: 0, blocked: 0 });
  const [services, setServices] = useState([]);
  const [activeService, setActiveService] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [seatsRes, statsRes, servicesRes, resvRes, actRes] = await Promise.all([
        API.get('/seats'),
        API.get('/seats/stats'),
        API.get('/services'),
        API.get('/reservations'),
        API.get('/activity?limit=50'),
      ]);
      setSeats(seatsRes.data);
      setStats(statsRes.data);
      setServices(servicesRes.data);
      setReservations(resvRes.data);
      setActivityLogs(actRes.data);
      const active = servicesRes.data.find(s => s.isActive);
      setActiveService(active || servicesRes.data[0] || null);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateSeat = async (seatId, data) => {
    const res = await API.patch('/seats/' + seatId, data);
    setSeats(prev => prev.map(s => s.seatId === seatId ? res.data : s));
    setStats(prev => {
      const newStats = { ...prev };
      const oldSeat = seats.find(s => s.seatId === seatId);
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
      if (data.isActive) return { ...s, isActive: false };
      return s;
    }));
    if (data.isActive) {
      setActiveService(res.data);
    } else if (data.isActive === false) {
      setActiveService(prev => (prev?._id === id ? null : prev));
    }
    return res.data;
  };

  const deleteService = async (id) => {
    await API.delete('/services/' + id);
    setServices(prev => prev.filter(s => s._id !== id));
  };

  const createReservation = async (data) => {
    const res = await API.post('/reservations', data);
    setReservations(prev => [res.data, ...prev]);
    return res.data;
  };

  const updateReservation = async (id, data) => {
    const res = await API.patch('/reservations/' + id, data);
    setReservations(prev => prev.map(r => r._id === id ? res.data : r));
    if (data.status === 'cancelled') await fetchAll();
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
      seats, stats, services, activeService, reservations, activityLogs,
      loading, seatsBySection, fetchAll,
      updateSeat, createService, updateService, deleteService,
      createReservation, updateReservation, findBestSeats,
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
