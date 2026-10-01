import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeating } from '../context/SeatingContext';
import { useAuth } from '../context/AuthContext';

export default function FindSeats() {
  const {
    events,
    activeEvent,
    stats,
    seats,
    seatsBySection,
    findBestSeats,
    updateSeat,
    fetchSeatsForEvent,
    fetchAll,
  } = useSeating();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedEventId, setSelectedEventId] = useState(activeEvent?._id || '');
  const [count, setCount] = useState(2);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [attendeeName, setAttendeeName] = useState(user?.name || '');
  const [assignNote, setAssignNote] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sync selectedEventId with activeEvent when available
  useEffect(() => {
    if (activeEvent && !selectedEventId) {
      setSelectedEventId(activeEvent._id);
    }
  }, [activeEvent, selectedEventId]);

  // When event changes, fetch its seats and reset search results
  const handleEventChange = async (e) => {
    const evId = e.target.value;
    setSelectedEventId(evId);
    setSearched(false);
    setResults([]);
    setSuccessMsg('');
    if (evId) {
      await fetchSeatsForEvent(evId);
    }
  };

  const selectedEvent = events.find(e => e._id === selectedEventId) || activeEvent;

  const handleFind = () => {
    setSuccessMsg('');
    const found = findBestSeats(Number(count));
    setResults(found);
    setSearched(true);
  };

  const handleAssign = async (groupSeats, index) => {
    setAssigning(index);
    setSuccessMsg('');
    try {
      const nameToAssign = attendeeName.trim() || user?.name || 'Group Assignment';
      for (const seat of groupSeats) {
        await updateSeat(
          seat._id || seat.seatId,
          {
            status: 'occupied',
            assignedName: nameToAssign,
            notes: assignNote.trim()
          },
          selectedEvent?._id
        );
      }
      setSuccessMsg(`Successfully occupied ${groupSeats.length} seat(s) for "${nameToAssign}"!`);
      // Re-run search to update list with remaining available seats
      const updatedFound = findBestSeats(Number(count));
      setResults(updatedFound);
    } catch (e) {
      alert('Error: ' + (e.response?.data?.message || e.message));
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Find & Occupy Seats</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Select an active event to instantly locate and occupy consecutive available seats for groups or individuals.
            </p>
          </div>
          {selectedEvent && (
            <button
              onClick={() => navigate(`/events/${selectedEvent._id}/seating`)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-1.5 shadow-sm shrink-0"
            >
              ⊞ Full Seating Map
            </button>
          )}
        </div>
      </div>

      {/* Event Selection & Active Event Status Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Select Event
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedEventId}
                onChange={handleEventChange}
                className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                {events.length === 0 && <option value="">No events available</option>}
                {events.map(ev => (
                  <option key={ev._id} value={ev._id}>
                    {ev.isActive || ev.status === 'Active' ? '● [ACTIVE] ' : ''}
                    {ev.name} ({ev.date ? new Date(ev.date).toLocaleDateString() : 'No date'} - {ev.time || ev.startTime || 'TBD'})
                  </option>
                ))}
              </select>

              {activeEvent && selectedEventId !== activeEvent._id && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventId(activeEvent._id);
                    fetchSeatsForEvent(activeEvent._id);
                    setSearched(false);
                    setResults([]);
                  }}
                  className="bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 text-xs px-3 py-2 rounded-xl font-semibold transition shrink-0 flex items-center gap-1"
                >
                  Switch to Active Event
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Selected Event Details & Metrics Badge */}
        {selectedEvent ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm sm:text-base">{selectedEvent.name}</span>
                {selectedEvent.isActive || selectedEvent.status === 'Active' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-300">
                    LIVE ACTIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 text-gray-700">
                    {selectedEvent.status || 'Upcoming'}
                  </span>
                )}
              </div>
              <div className="text-gray-500">
                {selectedEvent.date ? new Date(selectedEvent.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                {selectedEvent.time || selectedEvent.startTime ? ` • ${selectedEvent.time || selectedEvent.startTime}` : ''}
                {selectedEvent.endTime ? ` - ${selectedEvent.endTime}` : ''}
                {selectedEvent.type ? ` • ${selectedEvent.type}` : ''}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-center shadow-2xs">
                <div className="text-[10px] text-gray-400 font-semibold uppercase">Total</div>
                <div className="font-bold text-gray-900">{stats.total}</div>
              </div>
              <div className="bg-white border border-green-200 px-3 py-1.5 rounded-lg text-center shadow-2xs">
                <div className="text-[10px] text-green-600 font-semibold uppercase">Available</div>
                <div className="font-bold text-green-700">{stats.available}</div>
              </div>
              <div className="bg-white border border-red-200 px-3 py-1.5 rounded-lg text-center shadow-2xs">
                <div className="text-[10px] text-red-600 font-semibold uppercase">Occupied</div>
                <div className="font-bold text-red-700">{stats.occupied}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            Please select an event above to find and occupy seats.
          </div>
        )}
      </div>

      {/* Seat Search & Occupy Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Search Parameters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of Consecutive Seats</label>
            <input
              type="number"
              min="1"
              max="20"
              value={count}
              onChange={e => setCount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Assign To / Attendee Name</label>
            <input
              type="text"
              value={attendeeName}
              onChange={e => setAttendeeName(e.target.value)}
              placeholder="e.g. John Doe or Family Name"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Note (Displays in Report)</label>
            <input
              type="text"
              value={assignNote}
              onChange={e => setAssignNote(e.target.value)}
              placeholder="e.g. VIP guest / Needs wheelchair access"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleFind}
              disabled={!selectedEventId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              ⌕ Find Available Seats
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs sm:text-sm text-green-800 font-medium flex items-center gap-2">
            <span>✓</span> {successMsg}
          </div>
        )}
      </div>

      {/* Search Results */}
      {searched && (
        results.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">😔</div>
            <p className="text-red-700 font-medium text-sm sm:text-base">
              No {count} consecutive available seats found in {selectedEvent?.name || 'this event'}
            </p>
            <p className="text-xs text-red-500 mt-1">
              Try searching for fewer seats or view the full seating map to select individual open seats.
            </p>
            {selectedEvent && (
              <button
                onClick={() => navigate(`/events/${selectedEvent._id}/seating`)}
                className="mt-3 bg-white border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs"
              >
                Open Seating Map →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">
                Found {results.length} Group Recommendation{results.length > 1 ? 's' : ''} in {selectedEvent?.name}
              </h2>
              <span className="text-xs text-gray-500">Click &quot;Occupy Seats&quot; to assign immediately</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {results.map((rec, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-blue-200 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-gray-900 text-sm sm:text-base">{rec.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Seat Numbers: <span className="font-semibold text-gray-800">{rec.seats.map(s => s.number).join(', ')}</span>
                      </div>
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {rec.seats.map(s => (
                          <span
                            key={s.seatId}
                            className="bg-green-100 border border-green-200 text-green-800 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {s.row}{s.number}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAssign(rec.seats, idx)}
                        disabled={assigning === idx}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                      >
                        {assigning === idx ? 'Occupying...' : `Occupy ${rec.seats.length} Seats`}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
