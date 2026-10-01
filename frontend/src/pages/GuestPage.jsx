import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../api/api';
import DynamicSeatingMap from '../components/seating/DynamicSeatingMap';

const STATUS_COLORS = {
  available: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs shadow-emerald-500/20 active:scale-95 cursor-pointer',
  occupied:  'bg-red-500 text-white cursor-not-allowed opacity-90',
  reserved:  'bg-purple-500 text-white cursor-not-allowed opacity-90',
  held:      'bg-amber-400 text-white cursor-not-allowed opacity-90',
  blocked:   'bg-gray-300 text-gray-500 cursor-not-allowed',
};

export default function GuestPage() {
  const { eventId: routeEventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(Boolean(routeEventId));
  const [error, setError] = useState('');
  const [searchEventIdInput, setSearchEventIdInput] = useState('');
  const [searching, setSearching] = useState(false);

  // Booking Form Modal state
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [formData, setFormData] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [bookingLoading, setBookingLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [bookingError, setBookingError] = useState('');

  // Success Message Modal / State
  const [successBooking, setSuccessBooking] = useState(null);

  // Active user's confirmed booking for this event (from session or localStorage)
  const [myBooking, setMyBooking] = useState(null);

  // Attendance State (Change 15)
  const [selectedAttendanceStatus, setSelectedAttendanceStatus] = useState('At Venue');
  const [attendanceMsg, setAttendanceMsg] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Cancellation State (Change 13)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Load Event and its Seats
  const loadEventData = useCallback(async () => {
    if (!routeEventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Event details
      const eventRes = await API.get(`/events/${routeEventId}`);
      setEvent(eventRes.data);

      // 2. Fetch Event Seats (strictly for this event)
      const seatsRes = await API.get(`/seats/${routeEventId}`);
      setSeats(seatsRes.data);

      // 3. Check for saved local booking for this event
      const stored = localStorage.getItem(`seathub_guest_booking_${eventRes.data.eventId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setMyBooking(parsed);
          if (parsed.attendanceStatus) {
            setSelectedAttendanceStatus(parsed.attendanceStatus);
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    } catch (err) {
      console.error('Error loading guest event:', err);
      setError(err.response?.data?.message || 'Event not found or failed to load.');
    } finally {
      setLoading(false);
    }
  }, [routeEventId]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  // Click on a seat
  const handleSeatClick = (seat) => {
    if (seat.status !== 'available') {
      return;
    }
    setValidationError('');
    setBookingError('');
    setFormData({});
    setCustomFieldValues({});
    setSelectedSeat(seat);
  };

  // Submit Booking (Dynamic booking requirements with proper validation - Change 7)
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    setValidationError('');
    setBookingError('');

    const seatNumber = selectedSeat.seatNo || `${selectedSeat.row}${selectedSeat.number}`;
    const reqs = event?.bookingRequirements;

    // Validate standard requirements if configured
    if (reqs?.fields && Array.isArray(reqs.fields)) {
      for (const field of reqs.fields) {
        if (field.enabled && field.required) {
          const val = (formData[field.id] || '').trim();
          if (!val) {
            setValidationError(`Please enter your ${field.label}.`);
            return;
          }
        }
      }
    } else {
      // Default: require at least Name or ID
      const nameVal = (formData.fullName || formData.name || '').trim();
      const idVal = (formData.studentId || formData.memberId || formData.guestId || formData.phone || '').trim();
      if (!nameVal && !idVal) {
        setValidationError('Please enter your name and phone/ID.');
        return;
      }
    }

    // CHANGE 7: Full Name Validation
    const nameVal = (formData.fullName || formData.name || '').trim();
    if (nameVal) {
      const nameRegex = /^[A-Za-z\s.'-]+$/;
      if (!nameRegex.test(nameVal) || nameVal.length < 2 || /\d/.test(nameVal)) {
        setValidationError('Please enter a valid person\'s name (letters and spaces only).');
        return;
      }
    }

    // Phone Number Validation: 10 digits starting with 7, 8, 9; or with 0, 91, or +91 prefix
    const phoneVal = (formData.phone || '').trim();
    if (phoneVal) {
      const phoneRegex = /^(?:\+91|91|0)?[789]\d{9}$/;
      if (!phoneRegex.test(phoneVal)) {
        setValidationError('Enter a valid phone number (10 digits starting with 7, 8, or 9, or with 0, 91, or +91 prefix).');
        return;
      }
    }

    // Validate custom requirements if configured
    if (reqs?.customFields && Array.isArray(reqs.customFields)) {
      for (const cField of reqs.customFields) {
        if (cField.enabled && cField.required) {
          const val = customFieldValues[cField.id];
          if (val === undefined || val === null || String(val).trim() === '') {
            setValidationError(`Please provide ${cField.label}.`);
            return;
          }
        }
      }
    }

    setBookingLoading(true);
    try {
      const cleanName = (formData.fullName || formData.name || 'Guest Attendee').trim();
      const cleanPhone = (formData.phone || '').trim();
      const cleanId = (formData.studentId || formData.memberId || formData.guestId || cleanPhone || 'GUEST').trim();

      const payload = {
        eventId: event.eventId,
        seatNo: seatNumber,
        seatId: selectedSeat.seatId,
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        guestId: cleanId,
        ...formData,
        customFields: customFieldValues,
      };

      const res = await API.post('/bookings', payload);
      const confirmed = res.data.booking;
      setSuccessBooking(confirmed);
      setMyBooking(confirmed);
      localStorage.setItem(`seathub_guest_booking_${event.eventId}`, JSON.stringify(confirmed));

      // Close modal and reset fields
      setSelectedSeat(null);
      setFormData({});
      setCustomFieldValues({});

      // Refresh seats immediately to reflect occupied status (CHANGE 6: turns RED)
      await loadEventData();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Sorry, this seat has already been booked. Please select another seat.';
      setBookingError(errMsg);
      const seatsRes = await API.get(`/seats/${routeEventId}`).catch(() => null);
      if (seatsRes) setSeats(seatsRes.data);
    } finally {
      setBookingLoading(false);
    }
  };

  // CHANGE 13: Cancel Booking Handler
  const handleConfirmCancellation = async () => {
    if (!myBooking?._id && !myBooking?.bookingId) return;
    const bId = myBooking._id || myBooking.bookingId;
    setCancelling(true);
    try {
      await API.post(`/bookings/${bId}/cancel`);
      localStorage.removeItem(`seathub_guest_booking_${event.eventId}`);
      setMyBooking(null);
      setShowCancelModal(false);
      await loadEventData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel booking.');
    } finally {
      setCancelling(false);
    }
  };

  // CHANGE 15: Submit Attendance Handler
  const handleSubmitAttendance = async () => {
    if (!myBooking?._id && !myBooking?.bookingId) return;
    const bId = myBooking._id || myBooking.bookingId;
    setAttendanceLoading(true);
    setAttendanceMsg('');
    try {
      const res = await API.post(`/bookings/${bId}/attendance`, {
        attendanceStatus: selectedAttendanceStatus,
      });
      const updatedBooking = res.data.booking || { ...myBooking, attendanceStatus: selectedAttendanceStatus };
      setMyBooking(updatedBooking);
      localStorage.setItem(`seathub_guest_booking_${event.eventId}`, JSON.stringify(updatedBooking));
      setAttendanceMsg('✓ Attendance status updated successfully.');
      setTimeout(() => setAttendanceMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating attendance status.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Group seats by row for clean visualization
  const seatsByRow = seats.reduce((acc, seat) => {
    const r = seat.row || 'A';
    if (!acc[r]) acc[r] = [];
    acc[r].push(seat);
    return acc;
  }, {});

  const rowKeys = Object.keys(seatsByRow).sort();

  // Calculate statistics
  const totalSeats = seats.length;
  const availableSeats = seats.filter(s => s.status === 'available').length;
  const occupiedSeats = seats.filter(s => s.status === 'occupied').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 font-medium text-sm">Loading event seating...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    const handleSearchSubmit = (e) => {
      e.preventDefault();
      const clean = searchEventIdInput.trim().toUpperCase();
      if (!clean) return;
      navigate(`/guest/${clean}`);
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-xl">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {routeEventId ? 'Event Not Found' : 'Enter Event ID'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {error ||
                (routeEventId
                  ? `We couldn't locate an event matching "${routeEventId}". Please verify the Event ID created by your admin.`
                  : 'Please enter the Event ID created by your administrator to view the seating map.')}
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="space-y-3 pt-2 text-left">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Event ID (Created by Admin)
              </label>
              <input
                type="text"
                autoFocus
                required
                value={searchEventIdInput}
                onChange={(e) => setSearchEventIdInput(e.target.value.toUpperCase())}
                placeholder="e.g. EVENT001"
                className="w-full bg-slate-50 border border-gray-200 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold tracking-wider placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm py-2.5 rounded-xl transition shadow-xs cursor-pointer"
            >
              Go to Event Seating →
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100">
            <Link
              to="/login"
              className="inline-block text-xs font-semibold text-blue-600 hover:underline"
            >
              ← Back to SeatHub Home / Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
              <span className="text-white font-black text-sm">SH</span>
            </div>
            <div>
              <div className="font-extrabold text-gray-900 text-base leading-tight tracking-tight">SEATHUB</div>
              <div className="text-[10px] text-gray-400 font-medium">Guest Booking Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              GUEST MODE
            </span>
            <Link
              to="/login"
              title="Return to login or switch to another event"
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <span>← Switch Event</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Event Header Banner (Requirement 13) */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                  {event.name}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Event ID: {event.eventId}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>📅 {new Date(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>⏰ <strong>{event.startTime || event.time || '09:00 AM'}</strong> – <strong>{event.endTime || '10:30 AM'}</strong></span>
                {event.type && (
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium text-xs">
                    {event.type}
                  </span>
                )}
              </div>
            </div>

            {/* Live Counts */}
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Available</div>
                <div className="text-xl font-black text-emerald-700">{availableSeats}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-center">
                <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Occupied</div>
                <div className="text-xl font-black text-red-700">{occupiedSeats}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Guest Booking Display Card (Requirement 6 & 13 & 15) */}
        {myBooking && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-2 border-emerald-400 rounded-3xl p-6 sm:p-8 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-emerald-200 text-emerald-900 uppercase tracking-wider">
                    ✓ YOUR BOOKING
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Seat Confirmed for {event.name}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs sm:text-sm">
                    <div className="min-w-0 pr-2">
                      <span className="text-gray-500 block text-[11px] uppercase font-bold">Name</span>
                      <strong className="text-gray-900 text-base block break-words" title={myBooking.name}>
                        {myBooking.name}
                      </strong>
                    </div>
                    <div className="min-w-0 pr-2">
                      <span className="text-gray-500 block text-[11px] uppercase font-bold">
                        {myBooking.phone || (myBooking.guestId && (/^(\+91|91|0)?[789]\d{9}$/.test(myBooking.guestId) || /^\d{10,13}$/.test(myBooking.guestId))) ? 'Mobile Number' : (myBooking.studentId ? 'Student ID' : (myBooking.memberId ? 'Member ID' : 'Mobile Number'))}
                      </span>
                      <strong className="text-gray-900 text-base font-mono block break-all" title={myBooking.phone || myBooking.guestId}>
                        {myBooking.phone || myBooking.guestId}
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-500 block text-[11px] uppercase font-bold">Seat Number</span>
                      <strong className="text-red-700 text-xl font-black bg-white px-3 py-1 rounded-xl shadow-xs inline-block">
                        {myBooking.seatNo}
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-500 block text-[11px] uppercase font-bold">Status</span>
                      <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-600 text-white">
                        Booked
                      </span>
                    </div>
                  </div>
                </div>

                {/* CHANGE 13: Cancel Booking Button (Available ONLY before event starts) */}
                {(event.eventState === 'NOT STARTED' || (!event.eventState && !event.isActive)) ? (
                  <div className="pt-2 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="border border-red-300 hover:border-red-400 hover:bg-red-50 text-red-600 font-bold px-4 py-2.5 rounded-2xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      ✕ Cancel Booking
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400 italic">
                    Cancellation unavailable once event starts
                  </div>
                )}
              </div>
            </div>

            {/* CHANGE 15: Guest Attendance Tracking */}
            <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h4 className="text-xs font-black text-gray-900 tracking-wider uppercase">
                    ATTENDANCE STATUS
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {event.eventState === 'STARTED'
                      ? 'Please update your current attendance status.'
                      : event.eventState === 'ENDED'
                      ? 'Event has ended. Attendance is finalized.'
                      : 'Attendance update will be available when the event starts.'}
                  </p>
                </div>

                {myBooking.attendanceStatus && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Current Status:</span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-gray-900 border border-slate-200 flex items-center gap-1.5">
                      {myBooking.attendanceStatus === 'At Venue' ? '🟢 I am at the venue' : myBooking.attendanceStatus === 'On the Way' ? '🟡 I am on the way' : myBooking.attendanceStatus === 'Not Attending' ? '🔴 I am not able to attend' : '⚪ No Update'}
                    </span>
                  </div>
                )}
              </div>

              {/* Before Start Message */}
              {event.eventState === 'NOT STARTED' && (
                <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs text-blue-900 font-semibold flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>Attendance update will be available when the event starts.</span>
                </div>
              )}

              {/* While Event is Started */}
              {event.eventState === 'STARTED' && (
                <div className="space-y-3">
                  {attendanceMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl animate-in fade-in flex items-center gap-2">
                      <span>{attendanceMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { value: 'At Venue', label: 'I am at the venue', icon: '🟢', bg: 'border-emerald-300 bg-emerald-50/60 text-emerald-950' },
                      { value: 'On the Way', label: 'I am on the way', icon: '🟡', bg: 'border-amber-300 bg-amber-50/60 text-amber-950' },
                      { value: 'Not Attending', label: 'I am not able to attend', icon: '🔴', bg: 'border-red-300 bg-red-50/60 text-red-950' },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={
                          'border-2 rounded-2xl p-3.5 flex items-center gap-2.5 cursor-pointer transition text-xs font-bold ' +
                          (selectedAttendanceStatus === opt.value
                            ? opt.bg + ' ring-2 ring-blue-500/40 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700')
                        }
                      >
                        <input
                          type="radio"
                          name="attendance"
                          value={opt.value}
                          checked={selectedAttendanceStatus === opt.value}
                          onChange={() => setSelectedAttendanceStatus(opt.value)}
                          className="w-4 h-4 text-blue-600 cursor-pointer"
                        />
                        <span>{opt.icon} {opt.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSubmitAttendance}
                      disabled={attendanceLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {attendanceLoading ? 'Updating...' : 'Submit Status'}
                    </button>
                    <span className="text-[11px] text-gray-400">
                      The latest status replaces your previous status. You can update while the event is running.
                    </span>
                  </div>
                </div>
              )}

              {/* When Event has Ended */}
              {event.eventState === 'ENDED' && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600 font-medium">
                  Event has ended. Attendance tracking is now closed.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Seating Map Section (Requirement 13) */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Available Seats
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Click on any green seat to enter your Name and ID and confirm your booking.
              </p>
            </div>

            {/* Status Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-500"></span>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-red-500"></span>
                <span>Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-purple-500"></span>
                <span>Reserved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-gray-300"></span>
                <span>Blocked</span>
              </div>
            </div>
          </div>

          {/* Interactive Dynamic Seat Grid (Single Source of Truth) */}
          <DynamicSeatingMap
            event={event}
            seats={seats}
            onSeatClick={handleSeatClick}
            myBooking={myBooking}
          />
        </div>
      </main>

      {/* Booking Form Modal (Requirement 5 & 14) */}
      {selectedSeat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50/50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black text-gray-900">Book Your Seat</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {event.name} ({event.eventId})
                </p>
              </div>
              <button
                onClick={() => setSelectedSeat(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 rounded-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmBooking} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Selected Seat Badge */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                    Selected Seat
                  </span>
                  <div className="text-xl font-black text-blue-900 mt-0.5">
                    {selectedSeat.seatNo || `${selectedSeat.row}${selectedSeat.number}`}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Available
                </span>
              </div>

              {/* Validation / Booking Error Alert */}
              {validationError && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl font-medium flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{validationError}</span>
                </div>
              )}
              {bookingError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl font-medium flex items-center gap-2">
                  <span>❌</span>
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Dynamic Standard Fields */}
              {(() => {
                const reqFields = event?.bookingRequirements?.fields;
                const standardFields = Array.isArray(reqFields) && reqFields.length > 0
                  ? reqFields.filter(f => f.enabled).map(f => f.id === 'phone' && (!f.label || f.label === 'Phone Number') ? { ...f, label: 'Mobile Number' } : f)
                  : [
                      { id: 'fullName', label: 'Full Name', required: true, type: 'text' },
                      { id: 'phone', label: 'Mobile Number', required: true, type: 'tel' }
                    ];

                return standardFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.id === 'gender' ? (
                      <select
                        value={formData[field.id] || ''}
                        required={field.required}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, [field.id]: e.target.value }));
                          if (validationError) setValidationError('');
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <input
                        type={field.id === 'email' ? 'email' : (field.id === 'age' ? 'number' : (field.id === 'phone' ? 'tel' : 'text'))}
                        required={field.required}
                        inputMode={field.id === 'phone' ? 'tel' : undefined}
                        maxLength={field.id === 'phone' ? 13 : undefined}
                        placeholder={field.id === 'phone' ? 'e.g. 9876543210 or +919876543210' : `Enter your ${field.label.toLowerCase()}`}
                        value={formData[field.id] || ''}
                        onChange={(e) => {
                          const val = field.id === 'phone' ? e.target.value.replace(/[^\d+]/g, '').slice(0, 13) : e.target.value;
                          setFormData(prev => ({ ...prev, [field.id]: val }));
                          if (validationError) setValidationError('');
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                      />
                    )}
                  </div>
                ));
              })()}

              {/* Dynamic Custom Fields */}
              {Array.isArray(event?.bookingRequirements?.customFields) &&
                event.bookingRequirements.customFields.filter(c => c.enabled !== false).map((cField) => (
                  <div key={cField.id} className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {cField.label} {cField.required && <span className="text-red-500">*</span>}
                    </label>
                    {cField.type === 'dropdown' ? (
                      <select
                        value={customFieldValues[cField.id] || ''}
                        required={cField.required}
                        onChange={(e) => {
                          setCustomFieldValues(prev => ({ ...prev, [cField.id]: e.target.value }));
                          if (validationError) setValidationError('');
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="">Select an option</option>
                        {(cField.options || []).map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : cField.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(customFieldValues[cField.id])}
                          required={cField.required}
                          onChange={(e) => {
                            setCustomFieldValues(prev => ({ ...prev, [cField.id]: e.target.checked }));
                            if (validationError) setValidationError('');
                          }}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700">{cField.label}</span>
                      </label>
                    ) : (
                      <input
                        type={cField.type === 'email' ? 'email' : (cField.type === 'number' ? 'number' : (cField.type === 'phone' ? 'tel' : 'text'))}
                        value={customFieldValues[cField.id] || ''}
                        required={cField.required}
                        inputMode={cField.type === 'phone' ? 'tel' : undefined}
                        maxLength={cField.type === 'phone' ? 13 : undefined}
                        placeholder={cField.type === 'phone' ? 'e.g. 9876543210 or +919876543210' : `Enter ${cField.label.toLowerCase()}`}
                        onChange={(e) => {
                          const val = cField.type === 'phone' ? e.target.value.replace(/[^\d+]/g, '').slice(0, 13) : e.target.value;
                          setCustomFieldValues(prev => ({ ...prev, [cField.id]: val }));
                          if (validationError) setValidationError('');
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                      />
                    )}
                  </div>
                ))}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedSeat(null)}
                  disabled={bookingLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {bookingLoading ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Booking Modal (Requirement 6 & 12) */}
      {successBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-emerald-100 text-center p-6 sm:p-8 space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black shadow-inner">
              ✓
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                Seat Successfully Booked!
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Your reservation has been confirmed in the system.
              </p>
            </div>

            {/* Ticket Details Box (CHANGE 12) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">Guest Name:</span>
                <strong className="text-gray-900">{successBooking.name}</strong>
              </div>
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">
                  {successBooking.phone || (successBooking.guestId && (/^(\+91|91|0)?[789]\d{9}$/.test(successBooking.guestId) || /^\d{10,13}$/.test(successBooking.guestId))) ? 'Mobile Number:' : (successBooking.studentId ? 'Student ID:' : (successBooking.memberId ? 'Member ID:' : 'Mobile Number:'))}
                </span>
                <strong className="text-gray-900 font-mono break-all pl-2">{successBooking.phone || successBooking.guestId}</strong>
              </div>
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">Seat Number:</span>
                <strong className="text-red-700 text-base font-black">{successBooking.seatNo}</strong>
              </div>
              <div className="flex justify-between border-b border-gray-200/60 pb-2">
                <span className="text-gray-500">Event Name:</span>
                <strong className="text-gray-900">{successBooking.eventName || event.name}</strong>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-500">Booking Status:</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  Booked / Occupied
                </span>
              </div>
            </div>

            <button
              onClick={() => setSuccessBooking(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Done & View Seating
            </button>
          </div>
        </div>
      )}

      {/* CHANGE 13: Cancel Booking Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-xl mx-auto font-bold">
              ✕
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">
                Are you sure you want to cancel your seat?
              </h3>
              <p className="text-xs text-gray-500">
                Seat {myBooking?.seatNo} will be released and made available for other attendees.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                disabled={cancelling}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 cursor-pointer transition disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
