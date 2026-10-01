import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeating } from '../context/SeatingContext';
import { useAuth } from '../context/AuthContext';
import API from '../api/api';
import QrCodeModal from '../components/common/QrCodeModal';
import AdminBookingsModal from '../components/admin/AdminBookingsModal';

const EVENT_TYPES = ['Service', 'Study', 'Meeting', 'Event', 'Other'];

const EVENT_CATEGORIES = [
  'College / Academic',
  'Fest / Cultural',
  'Seminar / Conference',
  'Workshop',
  'Meeting',
  'Church / Religious',
  'Community',
  'Other',
];

const CATEGORY_STAGE_SUGGESTIONS = {
  'College / Academic': 'AUDITORIUM STAGE',
  'Fest / Cultural': 'MAIN STAGE',
  'Seminar / Conference': 'PRESENTER PODIUM',
  'Workshop': 'SPEAKER STAGE',
  'Meeting': 'HEAD TABLE / SCREEN',
  'Church / Religious': 'STAGE / ALTAR',
  'Community': 'COMMUNITY STAGE',
  'Other': 'STAGE / PODIUM',
};

const DEFAULT_BOOKING_REQUIREMENTS = {
  fields: [
    { id: 'fullName', label: 'Full Name', enabled: true, required: true },
    { id: 'phone', label: 'Phone Number', enabled: true, required: true },
    { id: 'email', label: 'Email Address', enabled: false, required: false },
    { id: 'memberId', label: 'Member ID', enabled: false, required: false },
    { id: 'studentId', label: 'Student ID', enabled: false, required: false },
    { id: 'gender', label: 'Gender', enabled: false, required: false },
    { id: 'age', label: 'Age', enabled: false, required: false },
    { id: 'address', label: 'Address', enabled: false, required: false },
  ],
  customFields: [],
};

export function parseDateTime(dateStr, timeStr) {
  if (!timeStr) return null;
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return null;

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return null;
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (meridiem === 'PM') {
    if (hours < 12) hours += 12;
  } else if (meridiem === 'AM') {
    if (hours === 12) hours = 0;
  }
  if (hours < 0 || hours > 23) return null;

  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, 0, 0);
  return dt;
}

export { validateTimeRange, parseAndValidateTime } from '../utils/timeValidator';
import { validateTimeRange } from '../utils/timeValidator';

export function validateStartEndDateTime(startDate, startTime, endDate, endTime) {
  if (!startTime || !endTime) return '';
  const result = validateTimeRange(startTime, endTime, startDate, endDate);
  return result.is_valid ? '' : result.error;
}

export default function Events() {
  const { events, services, createEvent, updateEvent, deleteEvent, loading, fetchAll } = useSeating();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  // QR Code & Bookings Modals
  const [selectedQrEvent, setSelectedQrEvent] = useState(null);
  const [selectedBookingsEvent, setSelectedBookingsEvent] = useState(null);
  const [copiedEventId, setCopiedEventId] = useState(null);
  const [confirmEventAction, setConfirmEventAction] = useState(null); // { type: 'start' | 'end', event: ev }

  // Create Event Form state (Requirements 1, 2, 3, 4)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createForm, setCreateForm] = useState({
    name: '',
    eventId: '',
    category: 'College / Academic',
    stageLabel: 'AUDITORIUM STAGE',
    type: 'Event',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00 AM',
    endDate: new Date().toISOString().split('T')[0],
    endTime: '10:30 AM',
    seatingLayoutType: 'standard',
    bookingRequirements: JSON.parse(JSON.stringify(DEFAULT_BOOKING_REQUIREMENTS)),
  });
  const [creating, setCreating] = useState(false);

  // Edit Event Modal state
  const [editingEvent, setEditingEvent] = useState(null);
  const [editStep, setEditStep] = useState(1);
  const [editForm, setEditForm] = useState({
    name: '',
    eventId: '',
    category: 'College / Academic',
    stageLabel: 'STAGE / PODIUM',
    type: 'Event',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    status: 'Upcoming',
    bookingRequirements: JSON.parse(JSON.stringify(DEFAULT_BOOKING_REQUIREMENTS)),
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Real-time Start & End Time validation (End Time must be after Start Time)
  const createTimeError = validateStartEndDateTime(
    createForm.startDate,
    createForm.startTime,
    createForm.endDate,
    createForm.endTime
  );
  const editTimeError = validateStartEndDateTime(
    editForm.startDate,
    editForm.startTime,
    editForm.endDate,
    editForm.endTime
  );

  // User "Other" Event Registration Modal state
  const [registerModalEvent, setRegisterModalEvent] = useState(null);
  const [regForm, setRegForm] = useState({ fullName: '', idNumber: '' });
  const [registering, setRegistering] = useState(false);
  const [regSuccessMsg, setRegSuccessMsg] = useState('');
  const [userBookings, setUserBookings] = useState({}); // eventId -> registration

  const allEvents = events || services || [];

  // Fetch current user's registrations for "Other" events to display their assigned seat
  useEffect(() => {
    async function loadUserRegistrations() {
      if (!user) return;
      try {
        const bookingsMap = {};
        for (const ev of allEvents) {
          if (ev.type === 'Other') {
            const res = await API.get(`/registrations/my?eventId=${ev._id}`).catch(() => null);
            if (res && res.data) {
              bookingsMap[ev._id] = res.data;
            }
          }
        }
        setUserBookings(bookingsMap);
      } catch (e) {
        console.error('Error loading user bookings:', e);
      }
    }
    if (allEvents.length > 0) {
      loadUserRegistrations();
    }
  }, [allEvents.length, user]);

  const handleCopyLink = (ev) => {
    const eid = ev.eventId || ev._id;
    const url = `${window.location.origin}/guest/${eid}`;
    navigator.clipboard.writeText(url);
    setCopiedEventId(eid);
    setTimeout(() => setCopiedEventId(null), 2500);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      alert('Event Name is required.');
      setCreateStep(1);
      return;
    }
    if (!createForm.eventId.trim()) {
      alert('Event ID is required.');
      setCreateStep(1);
      return;
    }
    if (createTimeError) {
      alert(createTimeError);
      setCreateStep(1);
      return;
    }
    setCreating(true);
    try {
      const created = await createEvent({
        name: createForm.name.trim(),
        eventId: createForm.eventId ? createForm.eventId.trim().toUpperCase() : undefined,
        category: createForm.category,
        stageLabel: createForm.stageLabel,
        type: createForm.type,
        date: createForm.startDate,
        startDate: createForm.startDate,
        endDate: createForm.endDate || createForm.startDate,
        startTime: createForm.startTime,
        endTime: createForm.endTime,
        seatingLayoutType: createForm.seatingLayoutType,
        bookingRequirements: createForm.bookingRequirements,
      });
      setShowCreateModal(false);
      setCreateStep(1);
      setCreateForm({
        name: '',
        eventId: '',
        category: 'College / Academic',
        stageLabel: 'AUDITORIUM STAGE',
        type: 'Event',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '09:00 AM',
        endDate: new Date().toISOString().split('T')[0],
        endTime: '10:30 AM',
        seatingLayoutType: 'standard',
        bookingRequirements: JSON.parse(JSON.stringify(DEFAULT_BOOKING_REQUIREMENTS)),
      });
      await fetchAll();
      if (created?._id) {
        navigate(`/events/${created._id}/seating`);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (ev) => {
    setEditingEvent(ev);
    setEditStep(1);
    const sDate = ev.startDate ? new Date(ev.startDate).toISOString().split('T')[0] : (ev.date ? new Date(ev.date).toISOString().split('T')[0] : '');
    const eDate = ev.endDate ? new Date(ev.endDate).toISOString().split('T')[0] : sDate;

    setEditForm({
      name: ev.name,
      eventId: ev.eventId || '',
      category: ev.category || 'College / Academic',
      stageLabel: ev.stageLabel || CATEGORY_STAGE_SUGGESTIONS[ev.category || 'College / Academic'] || 'STAGE / PODIUM',
      type: ev.type || 'Event',
      startDate: sDate,
      endDate: eDate,
      startTime: ev.startTime || ev.time || '09:00 AM',
      endTime: ev.endTime || '10:30 AM',
      status: ev.status || (ev.isActive ? 'Active' : 'Upcoming'),
      bookingRequirements: ev.bookingRequirements || JSON.parse(JSON.stringify(DEFAULT_BOOKING_REQUIREMENTS)),
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;
    if (!editForm.name.trim()) {
      alert('Event Name is required.');
      return;
    }
    if (!editForm.eventId.trim()) {
      alert('Event ID is required.');
      return;
    }
    if (editTimeError) {
      alert(editTimeError);
      setEditStep(1);
      return;
    }
    setSavingEdit(true);
    try {
      await updateEvent(editingEvent._id, {
        name: editForm.name,
        eventId: editForm.eventId.trim().toUpperCase(),
        category: editForm.category,
        stageLabel: editForm.stageLabel,
        type: editForm.type,
        date: editForm.startDate,
        startDate: editForm.startDate,
        endDate: editForm.endDate || editForm.startDate,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        status: editForm.status,
        isActive: editForm.status === 'Active',
        bookingRequirements: editForm.bookingRequirements,
      });
      setEditingEvent(null);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmStartOrEnd = async () => {
    if (!confirmEventAction) return;
    const { type, event: ev } = confirmEventAction;
    try {
      if (type === 'start') {
        await API.post(`/events/${ev._id}/start`);
      } else if (type === 'end') {
        await API.post(`/events/${ev._id}/end`);
      }
      setConfirmEventAction(null);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleSetActive = async (id) => {
    try {
      await updateEvent(id, { isActive: true, status: 'Active', eventState: 'STARTED', manuallyActivated: true });
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleSetInactive = async (id) => {
    try {
      await updateEvent(id, { isActive: false, status: 'Inactive', eventState: 'NOT STARTED', manuallyActivated: false });
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this Event and its Seating Map?')) return;
    await deleteEvent(id);
    await fetchAll();
  };

  const handleOpenRegisterModal = (ev) => {
    setRegisterModalEvent(ev);
    setRegForm({
      fullName: user?.name || '',
      idNumber: '',
    });
    setRegSuccessMsg('');
  };

  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    if (!registerModalEvent) return;
    setRegistering(true);
    setRegSuccessMsg('');
    try {
      const res = await API.post('/registrations', {
        eventId: registerModalEvent._id,
        fullName: regForm.fullName,
        idNumber: regForm.idNumber,
      });
      setRegSuccessMsg('Registration submitted successfully! Waiting for Admin seat assignment.');
      setUserBookings(prev => ({ ...prev, [registerModalEvent._id]: res.data.registration }));
      setTimeout(() => {
        setRegisterModalEvent(null);
        setRegSuccessMsg('');
      }, 2000);
    } catch (err) {
      alert(err.response?.data?.message || 'Error submitting registration');
    } finally {
      setRegistering(false);
    }
  };

  const getStatusBadge = (status, isActive) => {
    const s = status || (isActive ? 'Active' : 'Upcoming');
    if (s === 'Active') {
      return <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold">● Active</span>;
    }
    if (s === 'Upcoming') {
      return <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-semibold">Upcoming</span>;
    }
    return <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium">Inactive</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage college events, conferences, seminars, cultural fests, church services, and meetings with custom seating maps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1 shadow-sm cursor-pointer"
            >
              + New Event
            </button>
          )}
          <button
            onClick={() => fetchAll()}
            className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-xl text-sm transition cursor-pointer"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {allEvents.map(s => {
          const userBooking = userBookings[s._id];
          const isOther = s.type === 'Other';
          const isInactive = s.status === 'Inactive';
          const isEventActive = s.isActive || s.status === 'Active';
          const state = isEventActive ? 'STARTED' : (s.eventState || 'NOT STARTED');

          return (
            <div
              key={s._id}
              className={
                'bg-white border rounded-2xl p-4 sm:p-6 shadow-sm transition-all ' +
                (isEventActive
                  ? 'border-emerald-300 ring-2 ring-emerald-100'
                  : 'border-gray-200 hover:border-gray-300')
              }
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{s.name}</h2>
                    <span
                      onClick={() => {
                        const eid = s.eventId || 'EVENT001';
                        navigator.clipboard.writeText(eid);
                        setCopiedEventId(s.eventId || s._id);
                        setTimeout(() => setCopiedEventId(null), 2000);
                      }}
                      className="text-xs font-mono font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1 shadow-2xs"
                      title="Click to copy Event ID for Guests"
                    >
                      <span>ID: {s.eventId || 'EVENT001'}</span>
                      {copiedEventId === (s.eventId || s._id) && (
                        <span className="text-[10px] font-sans font-bold text-green-700">✓</span>
                      )}
                    </span>

                    {/* Dynamic Event State Badge */}
                    {isEventActive ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-extrabold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        ACTIVE
                      </span>
                    ) : state === 'ENDED' ? (
                      <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full font-bold">
                        ENDED
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold">
                        NOT STARTED
                      </span>
                    )}

                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                      {s.category || 'General'}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                      {s.type || 'Event'}
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                    <span>
                      📅 {new Date(s.startDate || s.date).toLocaleDateString()}
                      {s.endDate && new Date(s.endDate).toLocaleDateString() !== new Date(s.startDate || s.date).toLocaleDateString()
                        ? ` – ${new Date(s.endDate).toLocaleDateString()}`
                        : ''}
                    </span>
                    <span>⏰ <strong>{s.startTime || s.time || '09:00 AM'}</strong> – <strong>{s.endTime || '10:30 AM'}</strong></span>
                  </div>

                  {/* User Assigned Seat Display */}
                  {userBooking && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl max-w-md">
                      <div className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                        {userBooking.status === 'assigned' ? '✓ Your Booking Confirmed' : '⏳ Registration Pending'}
                      </div>
                      <div className="text-xs text-blue-800 mt-1 space-y-0.5">
                        <div>Name: <strong>{userBooking.fullName}</strong> · ID: <strong>{userBooking.idNumber}</strong></div>
                        {userBooking.seatLabel ? (
                          <div className="text-sm font-black text-blue-900 mt-1">
                            YOUR SEAT: <span className="text-indigo-600 bg-white px-2 py-0.5 rounded shadow-xs">{userBooking.seatLabel}</span>
                          </div>
                        ) : (
                          <div className="text-xs italic text-blue-600 mt-1">Waiting for Admin to manually assign your seat.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions Grid */}
                <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                  {/* Seating Map Button */}
                  <button
                    onClick={() => navigate(`/events/${s._id}/seating`)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
                  >
                    ⊞ Seating Map
                  </button>

                  {/* View Bookings Button */}
                  <button
                    onClick={() => {
                      const isAct = s.isActive || s.status === 'Active';
                      setSelectedBookingsEvent({
                        ...s,
                        isActive: isAct,
                        status: isAct ? 'Active' : s.status,
                        eventState: isAct ? 'STARTED' : (s.eventState || 'NOT STARTED'),
                      });
                    }}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    👥 Bookings
                  </button>

                  {/* CHANGE 9: QR Code Button Only (No Guest Link) */}
                  <button
                    type="button"
                    onClick={() => setSelectedQrEvent(s)}
                    className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    📱 QR Code
                  </button>

                  {/* Event Active / Deactivate Controls */}
                  {isAdmin && (
                    <>
                      {isEventActive ? (
                        <button
                          type="button"
                          onClick={() => handleSetInactive(s._id)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Click to deactivate event"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetActive(s._id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm transition flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Click to set event active"
                        >
                          Set Active
                        </button>
                      )}

                      {/* Edit button */}
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(s._id)}
                        className="border border-red-200 text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </>
                  )}

                  {/* Registrations button for Other events (Admin) */}
                  {isAdmin && isOther && (
                    <button
                      onClick={() => navigate(`/events/${s._id}/registrations`)}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition"
                    >
                      👥 Registrations
                    </button>
                  )}

                  {/* Register button for Other events (User) */}
                  {!isAdmin && isOther && !userBooking && !isInactive && (
                    <button
                      onClick={() => handleOpenRegisterModal(s)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs"
                    >
                      Register for Event
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {allEvents.length === 0 && !loading && (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl p-6 text-gray-400 text-sm">
            No events found. Click "+ New Event" to create one.
          </div>
        )}
      </div>

      {/* CREATE EVENT MODAL (Requirements 1, 2, 3, 4) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 space-y-5 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">+ Create New Event</h2>
                <p className="text-xs text-gray-400 mt-0.5">Configure event context, booking requirements, and seating layout</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer">
                &times;
              </button>
            </div>

            {/* 3 Step Tabs: Event Details, Booking Requirements, Seating Layout */}
            <div className="flex border-b border-gray-100 shrink-0">
              {[
                { step: 1, label: '1. Event Details' },
                { step: 2, label: '2. Booking Requirements' },
                { step: 3, label: '3. Seating Layout' },
              ].map(t => (
                <button
                  key={t.step}
                  type="button"
                  onClick={() => setCreateStep(t.step)}
                  className={
                    'flex-1 py-2.5 text-xs sm:text-sm font-bold border-b-2 text-center transition cursor-pointer ' +
                    (createStep === t.step
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreate} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* TAB 1: EVENT DETAILS */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Event Name *</label>
                      <input
                        required
                        type="text"
                        value={createForm.name}
                        onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                        placeholder="e.g. Annual College Summit"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Event ID *</label>
                      <input
                        required
                        type="text"
                        value={createForm.eventId}
                        onChange={e => setCreateForm({ ...createForm, eventId: e.target.value.toUpperCase() })}
                        placeholder="e.g. EVENT001"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Event Category / Context *</label>
                      <select
                        value={createForm.category}
                        onChange={e => {
                          const cat = e.target.value;
                          setCreateForm({
                            ...createForm,
                            category: cat,
                            stageLabel: CATEGORY_STAGE_SUGGESTIONS[cat] || 'STAGE / PODIUM',
                          });
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {EVENT_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Stage / Front Label</label>
                      <input
                        type="text"
                        value={createForm.stageLabel}
                        onChange={e => setCreateForm({ ...createForm, stageLabel: e.target.value })}
                        placeholder="e.g. STAGE / PODIUM"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Event Type *</label>
                    <select
                      value={createForm.type}
                      onChange={e => setCreateForm({ ...createForm, type: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {EVENT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Start Date *</label>
                      <input
                        required
                        type="date"
                        value={createForm.startDate}
                        onChange={e => {
                          const s = e.target.value;
                          setCreateForm({
                            ...createForm,
                            startDate: s,
                            endDate: createForm.endDate < s ? s : createForm.endDate,
                          });
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Start Time *</label>
                      <input
                        required
                        type="text"
                        value={createForm.startTime}
                        onChange={e => setCreateForm({ ...createForm, startTime: e.target.value })}
                        placeholder="09:00 AM"
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          createTimeError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-gray-200 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">End Date *</label>
                      <input
                        required
                        type="date"
                        value={createForm.endDate}
                        onChange={e => setCreateForm({ ...createForm, endDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">End Time *</label>
                      <input
                        required
                        type="text"
                        value={createForm.endTime}
                        onChange={e => setCreateForm({ ...createForm, endTime: e.target.value })}
                        placeholder="10:30 AM"
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          createTimeError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-gray-200 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                  {createTimeError && (
                    <div className="text-xs text-red-600 font-semibold flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-in fade-in">
                      <span>⚠️</span>
                      <span>{createTimeError}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">Automatic transition: When current date/time reaches Start Time, Event becomes STARTED; when it reaches End Time, Event becomes ENDED.</p>
                </div>
              )}

              {/* TAB 2: BOOKING REQUIREMENTS */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 text-xs text-blue-800">
                    Choose what information attendees must provide when booking a seat for this event.
                  </div>

                  {/* Standard Fields Table */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-600 grid grid-cols-12 gap-2">
                      <span className="col-span-6">Standard Field</span>
                      <span className="col-span-3 text-center">Enabled</span>
                      <span className="col-span-3 text-center">Required</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {createForm.bookingRequirements.fields.map((f, idx) => (
                        <div key={f.id} className="px-4 py-2.5 text-xs grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50">
                          <span className="col-span-6 font-medium text-gray-800">{f.label}</span>
                          <div className="col-span-3 flex justify-center">
                            <input
                              type="checkbox"
                              checked={f.enabled}
                              onChange={e => {
                                const checked = e.target.checked;
                                const updated = [...createForm.bookingRequirements.fields];
                                updated[idx] = { ...f, enabled: checked, required: checked ? f.required : false };
                                setCreateForm({
                                  ...createForm,
                                  bookingRequirements: { ...createForm.bookingRequirements, fields: updated }
                                });
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </div>
                          <div className="col-span-3 flex justify-center">
                            <input
                              type="checkbox"
                              disabled={!f.enabled}
                              checked={f.required}
                              onChange={e => {
                                const checked = e.target.checked;
                                const updated = [...createForm.bookingRequirements.fields];
                                updated[idx] = { ...f, required: checked };
                                setCreateForm({
                                  ...createForm,
                                  bookingRequirements: { ...createForm.bookingRequirements, fields: updated }
                                });
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-40 cursor-pointer"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Fields Section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Custom Fields</h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newField = {
                            id: 'custom_' + Date.now(),
                            label: '',
                            type: 'text',
                            enabled: true,
                            required: false,
                            options: [],
                          };
                          setCreateForm({
                            ...createForm,
                            bookingRequirements: {
                              ...createForm.bookingRequirements,
                              customFields: [...(createForm.bookingRequirements.customFields || []), newField],
                            }
                          });
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer"
                      >
                        + Add Custom Field
                      </button>
                    </div>

                    {(createForm.bookingRequirements.customFields || []).length === 0 ? (
                      <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl text-center">
                        No custom fields added. Click "+ Add Custom Field" to capture Department, Class, Organization, etc.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {createForm.bookingRequirements.customFields.map((cf, cIdx) => (
                          <div key={cf.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Field Label (e.g. Department, Organization)"
                                value={cf.label}
                                onChange={e => {
                                  const updated = [...createForm.bookingRequirements.customFields];
                                  updated[cIdx].label = e.target.value;
                                  setCreateForm({
                                    ...createForm,
                                    bookingRequirements: { ...createForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500"
                              />
                              <select
                                value={cf.type}
                                onChange={e => {
                                  const updated = [...createForm.bookingRequirements.customFields];
                                  updated[cIdx].type = e.target.value;
                                  setCreateForm({
                                    ...createForm,
                                    bookingRequirements: { ...createForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                              >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="phone">Phone</option>
                                <option value="dropdown">Dropdown</option>
                                <option value="checkbox">Checkbox</option>
                              </select>
                              <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={cf.required}
                                  onChange={e => {
                                    const updated = [...createForm.bookingRequirements.customFields];
                                    updated[cIdx].required = e.target.checked;
                                    setCreateForm({
                                      ...createForm,
                                      bookingRequirements: { ...createForm.bookingRequirements, customFields: updated }
                                    });
                                  }}
                                  className="w-3.5 h-3.5 text-blue-600 rounded"
                                />
                                Req
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = createForm.bookingRequirements.customFields.filter((_, i) => i !== cIdx);
                                  setCreateForm({
                                    ...createForm,
                                    bookingRequirements: { ...createForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="text-red-500 hover:text-red-700 text-sm px-1.5 font-bold cursor-pointer"
                              >
                                &times;
                              </button>
                            </div>
                            {cf.type === 'dropdown' && (
                              <input
                                type="text"
                                placeholder="Options separated by commas (e.g. Computer Science, Mechanical, Electrical)"
                                value={(cf.options || []).join(', ')}
                                onChange={e => {
                                  const updated = [...createForm.bookingRequirements.customFields];
                                  updated[cIdx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  setCreateForm({
                                    ...createForm,
                                    bookingRequirements: { ...createForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SEATING LAYOUT OPTIONS */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <div className="text-xs text-gray-500">
                    Select a seating layout template for this event. You can customize every row, section, and seat after creation.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Standard Row & Column */}
                    <div
                      onClick={() => setCreateForm({ ...createForm, seatingLayoutType: 'standard' })}
                      className={
                        'border-2 rounded-2xl p-3.5 cursor-pointer transition flex flex-col justify-between ' +
                        (createForm.seatingLayoutType === 'standard'
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white')
                      }
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-gray-900">Standard Row & Column</span>
                          {createForm.seatingLayoutType === 'standard' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                          Simple uniform grid (e.g. Rows A, B, C with 10 seats).
                        </p>
                      </div>

                      {/* Visual Mini Preview */}
                      <div className="bg-gray-100 rounded-xl p-2 space-y-1">
                        <div className="h-2 bg-blue-500 rounded-md w-full"></div>
                        <div className="grid grid-cols-5 gap-1 pt-0.5">
                          {[...Array(10)].map((_, i) => (
                            <div key={i} className="h-2.5 bg-emerald-500 rounded-xs"></div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 2. Section-Based Layout (LEFT, CENTER, RIGHT) */}
                    <div
                      onClick={() => setCreateForm({ ...createForm, seatingLayoutType: 'section_based' })}
                      className={
                        'border-2 rounded-2xl p-3.5 cursor-pointer transition flex flex-col justify-between ' +
                        (createForm.seatingLayoutType === 'section_based'
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white')
                      }
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-gray-900">Section-Based Layout</span>
                          {createForm.seatingLayoutType === 'section_based' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                          Structured LEFT, CENTER, RIGHT sections with configurable rows/seats.
                        </p>
                      </div>

                      {/* Visual Mini Preview */}
                      <div className="bg-gray-100 rounded-xl p-2 space-y-1">
                        <div className="h-2 bg-blue-500 rounded-md w-full"></div>
                        <div className="grid grid-cols-3 gap-1 pt-0.5">
                          <div className="bg-emerald-100 border border-emerald-400 rounded-xs h-6 flex items-center justify-center text-[7px] font-bold text-emerald-800">LEFT</div>
                          <div className="bg-emerald-200 border border-emerald-500 rounded-xs h-6 flex items-center justify-center text-[7px] font-bold text-emerald-800">CENTER</div>
                          <div className="bg-emerald-100 border border-emerald-400 rounded-xs h-6 flex items-center justify-center text-[7px] font-bold text-emerald-800">RIGHT</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Navigation & Submit Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100 shrink-0">
                {createStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCreateStep(s => s - 1)}
                    className="border border-gray-200 rounded-xl py-2.5 px-4 text-xs sm:text-sm text-gray-600 hover:bg-gray-50 cursor-pointer font-medium"
                  >
                    ← Back
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="border border-gray-200 rounded-xl py-2.5 px-4 text-xs sm:text-sm text-gray-600 hover:bg-gray-50 cursor-pointer font-medium"
                >
                  Cancel
                </button>

                {createStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (createStep === 1 && !createForm.name.trim()) {
                        alert('Please enter an Event Name.');
                        return;
                      }
                      if (createStep === 1 && !createForm.eventId.trim()) {
                        alert('Please enter an Event ID.');
                        return;
                      }
                      if (createStep === 1 && createTimeError) {
                        alert(createTimeError);
                        return;
                      }
                      setCreateStep(s => s + 1);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer shadow-sm"
                  >
                    Next: {createStep === 1 ? 'Booking Requirements →' : 'Seating Layout →'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition disabled:opacity-50 shadow-sm cursor-pointer"
                  >
                    {creating ? 'Creating Event...' : 'Create Event & Initialize Layout'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EVENT MODAL */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 space-y-5 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit Event Configuration</h2>
                <p className="text-xs text-gray-400">{editingEvent.name} ({editingEvent.eventId || 'No ID'})</p>
              </div>
              <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer">
                &times;
              </button>
            </div>

            {/* Direct Seating Map Link Banner */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs sm:text-sm font-bold text-indigo-900">Seating Layout & Map</div>
                <div className="text-[11px] text-indigo-600">Open the Seating Layout Editor to configure rows, sections, and seats</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = editingEvent._id;
                  setEditingEvent(null);
                  navigate(`/events/${id}/seating`);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3.5 py-2 rounded-xl font-semibold transition shadow-xs cursor-pointer"
              >
                🛠️ Open Seating Editor
              </button>
            </div>

            {/* Step Tabs for Edit Modal */}
            <div className="flex border-b border-gray-100 shrink-0">
              {[
                { step: 1, label: '1. Event Details' },
                { step: 2, label: '2. Booking Requirements' },
              ].map(t => (
                <button
                  key={t.step}
                  type="button"
                  onClick={() => setEditStep(t.step)}
                  className={
                    'flex-1 py-2 text-xs sm:text-sm font-bold border-b-2 text-center transition cursor-pointer ' +
                    (editStep === t.step
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {editStep === 1 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Event Name *</label>
                      <input
                        required
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Event ID *</label>
                      <input
                        required
                        type="text"
                        value={editForm.eventId}
                        onChange={e => setEditForm({ ...editForm, eventId: e.target.value.toUpperCase() })}
                        placeholder="e.g. EVENT001"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Category / Context</label>
                      <select
                        value={editForm.category}
                        onChange={e => {
                          const cat = e.target.value;
                          setEditForm({
                            ...editForm,
                            category: cat,
                            stageLabel: CATEGORY_STAGE_SUGGESTIONS[cat] || editForm.stageLabel,
                          });
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {EVENT_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Stage / Front Label</label>
                      <input
                        type="text"
                        value={editForm.stageLabel}
                        onChange={e => setEditForm({ ...editForm, stageLabel: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Event Type</label>
                      <select
                        value={editForm.type}
                        onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {EVENT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Status</label>
                      <select
                        value={editForm.status}
                        onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="Upcoming">Upcoming</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Start Date *</label>
                      <input
                        required
                        type="date"
                        value={editForm.startDate}
                        onChange={e => {
                          const s = e.target.value;
                          setEditForm({
                            ...editForm,
                            startDate: s,
                            endDate: editForm.endDate < s ? s : editForm.endDate,
                          });
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Start Time *</label>
                      <input
                        type="text"
                        value={editForm.startTime}
                        onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                        placeholder="09:00 AM"
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          editTimeError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-gray-200 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">End Date *</label>
                      <input
                        required
                        type="date"
                        value={editForm.endDate}
                        onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">End Time *</label>
                      <input
                        type="text"
                        value={editForm.endTime}
                        onChange={e => setEditForm({ ...editForm, endTime: e.target.value })}
                        placeholder="10:30 AM"
                        className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                          editTimeError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-gray-200 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                  {editTimeError && (
                    <div className="text-xs text-red-600 font-semibold flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-in fade-in">
                      <span>⚠️</span>
                      <span>{editTimeError}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 2: BOOKING REQUIREMENTS EDIT */
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-600 grid grid-cols-12 gap-2">
                      <span className="col-span-6">Standard Field</span>
                      <span className="col-span-3 text-center">Enabled</span>
                      <span className="col-span-3 text-center">Required</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {(editForm.bookingRequirements?.fields || DEFAULT_BOOKING_REQUIREMENTS.fields).map((f, idx) => (
                        <div key={f.id} className="px-4 py-2 text-xs grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50">
                          <span className="col-span-6 font-medium text-gray-800">{f.label}</span>
                          <div className="col-span-3 flex justify-center">
                            <input
                              type="checkbox"
                              checked={f.enabled}
                              onChange={e => {
                                const checked = e.target.checked;
                                const fieldsList = editForm.bookingRequirements?.fields || DEFAULT_BOOKING_REQUIREMENTS.fields;
                                const updated = [...fieldsList];
                                updated[idx] = { ...f, enabled: checked, required: checked ? f.required : false };
                                setEditForm({
                                  ...editForm,
                                  bookingRequirements: { ...(editForm.bookingRequirements || {}), fields: updated }
                                });
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </div>
                          <div className="col-span-3 flex justify-center">
                            <input
                              type="checkbox"
                              disabled={!f.enabled}
                              checked={f.required}
                              onChange={e => {
                                const checked = e.target.checked;
                                const fieldsList = editForm.bookingRequirements?.fields || DEFAULT_BOOKING_REQUIREMENTS.fields;
                                const updated = [...fieldsList];
                                updated[idx] = { ...f, required: checked };
                                setEditForm({
                                  ...editForm,
                                  bookingRequirements: { ...(editForm.bookingRequirements || {}), fields: updated }
                                });
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-40 cursor-pointer"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Fields in Edit Form */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Custom Fields</h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newField = {
                            id: 'custom_' + Date.now(),
                            label: '',
                            type: 'text',
                            enabled: true,
                            required: false,
                            options: [],
                          };
                          setEditForm({
                            ...editForm,
                            bookingRequirements: {
                              ...(editForm.bookingRequirements || {}),
                              customFields: [...(editForm.bookingRequirements?.customFields || []), newField],
                            }
                          });
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer"
                      >
                        + Add Custom Field
                      </button>
                    </div>

                    {(editForm.bookingRequirements?.customFields || []).length === 0 ? (
                      <div className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl text-center">
                        No custom fields configured.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editForm.bookingRequirements.customFields.map((cf, cIdx) => (
                          <div key={cf.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Field Label (e.g. Department, Organization)"
                                value={cf.label}
                                onChange={e => {
                                  const updated = [...editForm.bookingRequirements.customFields];
                                  updated[cIdx].label = e.target.value;
                                  setEditForm({
                                    ...editForm,
                                    bookingRequirements: { ...editForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                              />
                              <select
                                value={cf.type}
                                onChange={e => {
                                  const updated = [...editForm.bookingRequirements.customFields];
                                  updated[cIdx].type = e.target.value;
                                  setEditForm({
                                    ...editForm,
                                    bookingRequirements: { ...editForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                              >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="phone">Phone</option>
                                <option value="dropdown">Dropdown</option>
                                <option value="checkbox">Checkbox</option>
                              </select>
                              <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={cf.required}
                                  onChange={e => {
                                    const updated = [...editForm.bookingRequirements.customFields];
                                    updated[cIdx].required = e.target.checked;
                                    setEditForm({
                                      ...editForm,
                                      bookingRequirements: { ...editForm.bookingRequirements, customFields: updated }
                                    });
                                  }}
                                  className="w-3.5 h-3.5 text-blue-600 rounded"
                                />
                                Req
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = editForm.bookingRequirements.customFields.filter((_, i) => i !== cIdx);
                                  setEditForm({
                                    ...editForm,
                                    bookingRequirements: { ...editForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="text-red-500 hover:text-red-700 text-sm px-1.5 font-bold cursor-pointer"
                              >
                                &times;
                              </button>
                            </div>
                            {cf.type === 'dropdown' && (
                              <input
                                type="text"
                                placeholder="Options separated by commas"
                                value={(cf.options || []).join(', ')}
                                onChange={e => {
                                  const updated = [...editForm.bookingRequirements.customFields];
                                  updated[cIdx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                  setEditForm({
                                    ...editForm,
                                    bookingRequirements: { ...editForm.bookingRequirements, customFields: updated }
                                  });
                                }}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || Boolean(editTimeError)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER "OTHER" EVENT REGISTRATION MODAL */}
      {registerModalEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Register for Event</h3>
                <p className="text-xs text-gray-400">{registerModalEvent.name}</p>
              </div>
              <button onClick={() => setRegisterModalEvent(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                &times;
              </button>
            </div>

            {regSuccessMsg && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs font-medium text-green-800 text-center">
                {regSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSubmitRegistration} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Full Name *</label>
                <input
                  required
                  type="text"
                  value={regForm.fullName}
                  onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">ID *</label>
                <input
                  required
                  type="text"
                  value={regForm.idNumber}
                  onChange={e => setRegForm({ ...regForm, idNumber: e.target.value })}
                  placeholder="e.g. 12345"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisterModalEvent(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 shadow-sm"
                >
                  {registering ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal (Requirement 3 & 14) */}
      {selectedQrEvent && (
        <QrCodeModal
          event={selectedQrEvent}
          onClose={() => setSelectedQrEvent(null)}
        />
      )}

      {/* Admin Bookings Overview Modal (Requirement 12) */}
      {selectedBookingsEvent && (
        <AdminBookingsModal
          event={selectedBookingsEvent}
          onClose={() => setSelectedBookingsEvent(null)}
          onRefresh={() => fetchAll()}
        />
      )}

      {/* CHANGE 14: Confirmation Modal for Start / End Event */}
      {confirmEventAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border border-gray-100">
            <div className={
              'w-12 h-12 rounded-2xl flex items-center justify-center text-xl mx-auto ' +
              (confirmEventAction.type === 'start' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600')
            }>
              {confirmEventAction.type === 'start' ? '▶' : '■'}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">
                {confirmEventAction.type === 'start' ? 'Start this event now?' : 'End this event now?'}
              </h3>
              <p className="text-xs text-gray-500">
                {confirmEventAction.event?.name} ({confirmEventAction.event?.eventId || 'EVENT'})
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmEventAction(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStartOrEnd}
                className={
                  'flex-1 text-white rounded-xl py-2.5 text-xs sm:text-sm font-bold shadow-md cursor-pointer transition ' +
                  (confirmEventAction.type === 'start'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-600/20')
                }
              >
                {confirmEventAction.type === 'start' ? 'Start Event' : 'End Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
