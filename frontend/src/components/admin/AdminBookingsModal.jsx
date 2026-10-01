import React, { useState, useEffect } from 'react';
import API from '../../api/api';

function parseTime(timeStr) {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  const match12 = clean.match(/^(0?[1-9]|1[0-2]):(\d{1,2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }
  const match24 = clean.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (match24) {
    return { hours: parseInt(match24[1], 10), minutes: parseInt(match24[2], 10) };
  }
  return null;
}

function parseDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const pt = parseTime(timeStr);
    if (pt) {
      d.setHours(pt.hours, pt.minutes, 0, 0);
    }
    return d;
  } catch (e) {
    return null;
  }
}

function getEffectiveEventState(ev) {
  if (!ev) return 'NOT STARTED';
  // If explicitly active or manually activated, the event is ALWAYS ACTIVE / STARTED
  if (ev.isActive === true || ev.status === 'Active' || ev.manuallyActivated === true) {
    return 'STARTED';
  }
  if (ev.eventState === 'STARTED') return 'STARTED';
  if (ev.eventState === 'ENDED') return 'ENDED';

  const now = new Date();
  const sDate = ev.startDate || (ev.date ? new Date(ev.date).toISOString().split('T')[0] : '');
  const eDate = ev.endDate || sDate;
  const startDt = parseDateTime(sDate, ev.startTime || ev.time);
  const endDt = parseDateTime(eDate, ev.endTime);

  if (endDt && now.getTime() >= endDt.getTime()) return 'ENDED';
  if (startDt && now.getTime() >= startDt.getTime()) return 'STARTED';

  return 'NOT STARTED';
}

function formatBookingTime(timestamp) {
  if (!timestamp) return '-';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return String(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (e) {
    return String(timestamp);
  }
}

export default function AdminBookingsModal({ event, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ event: {}, overview: [], summary: {} });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [preEventFilter, setPreEventFilter] = useState('booked'); // 'booked', 'all', 'available'
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const eventId = event?.eventId || event?._id;

  const loadOverview = async () => {
    if (!eventId) return;
    try {
      const res = await API.get(`/bookings/${eventId}/overview`);
      setData(res.data);
    } catch (err) {
      console.error('Error loading bookings overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadOverview();
    // Poll every 5 seconds for live attendance and status updates
    const timer = setInterval(() => {
      loadOverview();
    }, 5000);
    return () => clearInterval(timer);
  }, [eventId]);

  const currentEvent = { ...event, ...(data.event || {}) };
  // Check whether event is active either from props, server data, or effective state
  const isEventActive =
    currentEvent.isActive === true ||
    currentEvent.status === 'Active' ||
    currentEvent.manuallyActivated === true ||
    event?.isActive === true ||
    event?.status === 'Active';

  const eventState = isEventActive ? 'STARTED' : getEffectiveEventState(currentEvent);
  const isStarted = isEventActive || eventState === 'STARTED';
  const isEnded = !isStarted && eventState === 'ENDED';
  const isPreEvent = !isStarted && !isEnded;

  // Active view mode:
  // When event is ACTIVE or STARTED: ALWAYS strictly 'attendance' (Image 1: Live Event Attendance Summary).
  // When event is NOT STARTED (upcoming pre-event): 'bookings' (Image 2: Booking Overview Summary & Booked Guests).
  const activeViewMode = isStarted || isEnded ? 'attendance' : 'bookings';

  const handleCancelBooking = async (item) => {
    if (!item.bookingId) {
      // If booked via direct assignment, release seat via seat PATCH
      if (window.confirm(`Release seat ${item.seatNo} assigned to ${item.name}?`)) {
        setActionLoading(true);
        try {
          await API.patch(`/seats/${item.seatId || item.seatNo}?eventId=${eventId}`, {
            status: 'available',
            assignedName: '',
            assignedId: '',
          });
          setMsg(`✓ Seat ${item.seatNo} released to available.`);
          await loadOverview();
          if (onRefresh) onRefresh();
        } catch (e) {
          alert('Error: ' + (e.response?.data?.message || e.message));
        } finally {
          setActionLoading(false);
        }
      }
      return;
    }

    if (window.confirm(`Cancel booking for ${item.name} (Seat ${item.seatNo})?`)) {
      setActionLoading(true);
      try {
        await API.delete(`/bookings/${item.bookingId}`);
        setMsg(`✓ Booking for seat ${item.seatNo} cancelled.`);
        await loadOverview();
        if (onRefresh) onRefresh();
      } catch (e) {
        alert('Error cancelling booking: ' + (e.response?.data?.message || e.message));
      } finally {
        setActionLoading(false);
      }
    }
  };

  const overviewList = data.overview || [];
  const totalCount = overviewList.length;
  const bookedCount = overviewList.filter((s) => s.status === 'Booked').length;
  const availableCount = overviewList.filter((s) => s.status === 'Available').length;

  const summary = data.summary || {
    totalSeats: totalCount,
    booked: bookedCount,
    available: availableCount,
    atVenue: overviewList.filter((s) => s.attendance === 'At Venue').length,
    onTheWay: overviewList.filter((s) => s.attendance === 'On the Way').length,
    notAttending: overviewList.filter((s) => s.attendance === 'Not Attending').length,
    noUpdate: overviewList.filter((s) => s.status === 'Booked' && (!s.attendance || s.attendance === 'No Update')).length,
  };

  const renderAttendanceBadge = (item) => {
    if (item.status !== 'Booked') {
      return <span className="text-gray-400 text-xs">-</span>;
    }
    const att = item.attendance;
    if (att === 'At Venue') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span>🟢</span> At Venue
        </span>
      );
    }
    return <span className="text-gray-400 text-xs">-</span>;
  };

  // Filter list depending on current view mode
  const filtered = overviewList.filter((item) => {
    const isOccupied = item.status === 'Booked';
    const isAvailable = item.status === 'Available';

    if (activeViewMode === 'bookings') {
      if (preEventFilter === 'occupied' && !isOccupied) return false;
      if (preEventFilter === 'booked' && !isOccupied) return false;
      if (preEventFilter === 'available' && !isAvailable) return false;
    } else {
      if ((statusFilter === 'occupied' || statusFilter === 'booked') && !isOccupied) return false;
      if (statusFilter === 'available' && !isAvailable) return false;
      if (statusFilter === 'at_venue' && item.attendance !== 'At Venue') return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.seatNo.toLowerCase().includes(q) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.guestId && item.guestId.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.section && item.section.toLowerCase().includes(q)) ||
      (item.attendance && item.attendance.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider font-mono">
                {event.eventId || 'EVENT'}
              </span>

              {isPreEvent && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  📅 Upcoming · Pre-Event Bookings
                </span>
              )}

              {isStarted && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  Live Event Started
                </span>
              )}

              {isEnded && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-200 text-gray-800 border border-gray-300">
                  ■ Event Ended · Final Record
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
              {event.name}
            </h2>
            <p className="text-xs text-gray-500">
              {isPreEvent
                ? 'Pre-Event Booking Management — Complete list of reserved seats and attendees'
                : isStarted
                ? 'Live Attendance Tracking — Monitor guest arrival and attendance status in real-time'
                : 'Final Event Summary — Complete record of bookings and recorded attendance'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
              title="Close"
            >
              &times;
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SUMMARY SECTION */}
        {/* ========================================================= */}

        {/* 1. BEFORE EVENT STARTS: Show clean 3-part summary (Image 2) */}
        {activeViewMode === 'bookings' ? (
          <div className="px-4 sm:px-6 pt-4 pb-2">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Booking Overview Summary
            </div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Seats
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  {summary.totalSeats ?? totalCount}
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 sm:p-4 text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Available
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                  {summary.available ?? availableCount}
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 sm:p-4 text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Occupied
                </div>
                <div className="text-xl sm:text-2xl font-black text-red-700 mt-1">
                  {summary.booked ?? bookedCount}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 2. AFTER EVENT STARTS / IS ACTIVE: Show Available, Occupied, Total Seats, and At Venue */
          <div className="px-4 sm:px-6 pt-4 pb-2">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Live Event Seating & Attendance Summary
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">TOTAL SEATS</div>
                <div className="text-lg sm:text-2xl font-black text-slate-800 mt-0.5">{summary.totalSeats ?? totalCount}</div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 sm:p-3 text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> AVAILABLE
                </div>
                <div className="text-lg sm:text-2xl font-black text-emerald-700 mt-0.5">{summary.available ?? availableCount}</div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 sm:p-3 text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> OCCUPIED
                </div>
                <div className="text-lg sm:text-2xl font-black text-red-700 mt-0.5">{summary.booked ?? bookedCount}</div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 sm:p-3 text-center">
                <div className="text-[10px] sm:text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> AT VENUE
                </div>
                <div className="text-lg sm:text-2xl font-black text-blue-700 mt-0.5">{summary.atVenue ?? 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="px-4 sm:px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              ⌕
            </span>
            <input
              type="text"
              placeholder={
                activeViewMode === 'bookings'
                  ? 'Search by guest name, guest ID, phone number, or seat...'
                  : 'Search by seat, guest name, ID, or status...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeViewMode === 'bookings' ? (
              <select
                value={preEventFilter}
                onChange={(e) => setPreEventFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
              >
                <option value="all">All Seats ({totalCount})</option>
                <option value="available">Available Seats ({availableCount})</option>
                <option value="occupied">Occupied Seats ({bookedCount})</option>
              </select>
            ) : (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
              >
                <option value="all">All Seats ({totalCount})</option>
                <option value="available">Available ({availableCount})</option>
                <option value="occupied">Occupied ({bookedCount})</option>
                <option value="at_venue">🟢 At Venue ({summary.atVenue ?? 0})</option>
              </select>
            )}

            <button
              onClick={loadOverview}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              title="Refresh Data"
            >
              ↻
            </button>
          </div>
        </div>

        {msg && (
          <div className="mx-6 my-1 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span>{msg}</span>
            <button
              onClick={() => setMsg('')}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* TABLES SECTION */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2">
          {loading && overviewList.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Loading booking data...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {activeViewMode === 'bookings' && preEventFilter === 'booked' && bookedCount === 0
                ? 'No guests have booked seats yet for this event.'
                : 'No matching records found.'}
            </div>
          ) : activeViewMode === 'bookings' ? (
            /* =================================================== */
            /* 1. PRE-EVENT BOOKING MANAGEMENT TABLE                */
            /* Guest Name | Guest ID | Phone Number | Booked Seat | */
            /* Booking Status | Booking Time | Action               */
            /* =================================================== */
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-3 px-4">Guest Name</th>
                    <th className="py-3 px-4">Guest ID</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Booked Seat</th>
                    <th className="py-3 px-4">Booking Status</th>
                    <th className="py-3 px-4">Booking Time</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((item) => {
                    const isBooked = item.status === 'Booked';
                    return (
                      <tr
                        key={item.seatNo}
                        className={isBooked ? 'bg-indigo-50/15 hover:bg-indigo-50/30 transition' : 'hover:bg-gray-50/60 transition'}
                      >
                        {/* Guest Name */}
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {isBooked && item.name && item.name !== '-' ? (
                            item.name
                          ) : (
                            <span className="text-gray-400 font-normal">-</span>
                          )}
                        </td>

                        {/* Guest ID */}
                        <td className="py-3 px-4 font-mono text-gray-700">
                          {isBooked && item.guestId && item.guestId !== '-' ? (
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold text-gray-800">
                              {item.guestId}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Phone Number */}
                        <td className="py-3 px-4 font-mono text-gray-700">
                          {isBooked && item.phone && item.phone !== '-' ? (
                            item.phone
                          ) : isBooked && item.guestId && /^\+?\d{10,13}$/.test(item.guestId) ? (
                            item.guestId
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Booked Seat (Exact Seat prominently displayed, e.g. CENTER-A1, LEFT-B4, A1) */}
                        <td className="py-3 px-4">
                          <span className="inline-block font-mono font-bold text-indigo-950 bg-indigo-50/80 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs sm:text-sm tracking-wide shadow-2xs">
                            {item.seatNo}
                          </span>
                        </td>

                        {/* Booking Status */}
                        <td className="py-3 px-4">
                          {isBooked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                              Occupied
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Available
                            </span>
                          )}
                        </td>

                        {/* Booking Time */}
                        <td className="py-3 px-4 font-mono text-gray-600 text-xs">
                          {isBooked && item.bookingTime ? (
                            formatBookingTime(item.bookingTime)
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right">
                          {isBooked ? (
                            <button
                              onClick={() => handleCancelBooking(item)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition border border-red-200 cursor-pointer"
                            >
                              Release Seat
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* =================================================== */
            /* 2. ATTENDANCE MANAGEMENT TABLE                       */
            /* Guest Name | Seat | Booking Status | Attendance |    */
            /* Action                                               */
            /* =================================================== */
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-3 px-4">Guest Name</th>
                    <th className="py-3 px-4">Seat</th>
                    <th className="py-3 px-4">Booking Status</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((item) => {
                    const isBooked = item.status === 'Booked';
                    return (
                      <tr
                        key={item.seatNo}
                        className={isBooked ? 'bg-red-50/15 hover:bg-red-50/30 transition' : 'hover:bg-gray-50/60 transition'}
                      >
                        {/* Guest Name */}
                        <td className="py-3 px-4 font-medium text-gray-800">
                          {item.name !== '-' ? (
                            <div>
                              <div className="font-semibold text-gray-900">{item.name}</div>
                              {item.guestId && item.guestId !== '-' && (
                                <div className="text-[11px] text-gray-500 font-mono">
                                  {/^\+?\d{10,13}$/.test(item.guestId) ? `Mobile: ${item.guestId}` : `ID: ${item.guestId}`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Seat */}
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          <span className="inline-block bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md text-xs sm:text-sm">
                            {item.seatNo}
                          </span>
                        </td>

                        {/* Booking Status */}
                        <td className="py-3 px-4">
                          {isBooked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                              Occupied
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Available
                            </span>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="py-3 px-4">
                          {renderAttendanceBadge(item)}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right">
                          {isBooked ? (
                            <button
                              onClick={() => handleCancelBooking(item)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition border border-red-200 cursor-pointer"
                            >
                              Release Seat
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-gray-500">
            Showing {filtered.length} of {totalCount} seats • Total Booked: {bookedCount} • Available: {availableCount}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 transition cursor-pointer self-end sm:self-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
