import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/api';
import { useSeating } from '../context/SeatingContext';
import { useAuth } from '../context/AuthContext';

export default function EventRegistrations() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { seats, seatsBySection, fetchSeatsForEvent, assignSeatToAttendee } = useSeating();

  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Assignment Modal / Drawer state
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successModal, setSuccessModal] = useState(null);

  const fetchRegistrations = async () => {
    try {
      const [evRes, regRes] = await Promise.all([
        API.get('/services/' + eventId),
        API.get('/registrations?eventId=' + eventId),
      ]);
      setEvent(evRes.data);
      setRegistrations(regRes.data);
      await fetchSeatsForEvent(eventId);
    } catch (err) {
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [eventId]);

  const handleOpenAssignModal = (attendee) => {
    setSelectedAttendee(attendee);
    setSelectedSeat(null);
    setErrorMsg('');
  };

  const handleSeatClick = (seat) => {
    if (seat.status !== 'available') return;
    setSelectedSeat(seat);
    setErrorMsg('');
  };

  const handleConfirmAssignment = async () => {
    if (!selectedAttendee || !selectedSeat) {
      setErrorMsg('Please select an available seat first.');
      return;
    }

    setAssigning(true);
    setErrorMsg('');
    try {
      const res = await assignSeatToAttendee({
        eventId,
        registrationId: selectedAttendee._id,
        seatId: selectedSeat.seatId,
        attendeeName: selectedAttendee.fullName,
        idNumber: selectedAttendee.idNumber,
      });

      // Show clear success confirmation
      setSuccessModal({
        name: selectedAttendee.fullName,
        idNumber: selectedAttendee.idNumber,
        seatLabel: res.seatLabel || (selectedSeat.section + ' Row ' + selectedSeat.row + ' Seat ' + selectedSeat.number),
        seatId: selectedSeat.seatId,
        eventName: event?.name || 'Event',
        status: 'Occupied',
      });

      setSelectedAttendee(null);
      setSelectedSeat(null);
      await fetchRegistrations();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Sorry, this seat is no longer available.');
    } finally {
      setAssigning(false);
    }
  };

  const filteredRegistrations = registrations.filter(r =>
    r.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    r.idNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.status?.toLowerCase().includes(search.toLowerCase())
  );

  const sections = Object.values(seatsBySection).sort((a, b) => a.code?.localeCompare(b.code));

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading registrations...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/events')}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                ← Back to Events
              </button>
              <span className="text-gray-300">|</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                Event Registrations
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{event?.name}</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Type: <strong>{event?.type}</strong> · {event?.startTime} - {event?.endTime} · Manage attendee registrations & manual seat assignments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/events/${eventId}/seating`)}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition"
            >
              ⊞ View Seating Map
            </button>
            <button
              onClick={fetchRegistrations}
              className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-xl text-xs sm:text-sm transition"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Registrations List */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by attendee name or ID..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-xs text-gray-500">
            Total Attendees: <strong>{registrations.length}</strong> (Assigned: {registrations.filter(r => r.status === 'assigned').length}, Pending: {registrations.filter(r => r.status === 'pending').length})
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Full Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Assigned Seat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Registered At</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRegistrations.map(r => (
                <tr key={r._id} className="hover:bg-gray-50/80 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.fullName}</td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">{r.idNumber}</td>
                  <td className="px-4 py-3">
                    {r.seatLabel ? (
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                        {r.seatLabel}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Not Assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'text-xs px-2 py-0.5 rounded-full font-medium capitalize ' +
                        (r.status === 'assigned'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800')
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(r.registrationTime || r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'pending' ? (
                      <button
                        onClick={() => handleOpenAssignModal(r)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition shadow-sm"
                      >
                        [Assign Seat]
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenAssignModal(r)}
                        className="text-xs text-gray-600 hover:text-blue-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50"
                      >
                        Change Seat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRegistrations.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                    No registrations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Seat Assignment Modal / Map Drawer */}
      {selectedAttendee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs text-blue-600 font-semibold uppercase">Admin Manual Seat Assignment</div>
                <h2 className="text-lg font-bold text-gray-900 mt-0.5">
                  Assign Seat for: {selectedAttendee.fullName} (ID: {selectedAttendee.idNumber})
                </h2>
              </div>
              <button
                onClick={() => setSelectedAttendee(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Modal Body: Interactive Seating Map */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                👉 <strong>Instruction</strong>: Click an <strong>AVAILABLE</strong> seat to select it. Occupied, held, or blocked seats cannot be assigned.
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Stage indicator */}
              <div className="bg-blue-600 text-white text-center py-2 rounded-xl font-semibold text-xs tracking-wider">
                ● STAGE / ALTAR / PLATFORM ●
              </div>

              {/* Section Grids */}
              {sections.map(section => {
                const rows = Object.keys(section.rows).sort();
                return (
                  <div key={section.code} className="border border-gray-200 rounded-xl p-4 bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-gray-800 text-sm">{section.name}</div>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{section.code}</span>
                    </div>

                    <div className="space-y-2 overflow-x-auto pb-2">
                      {rows.map(row => {
                        const rowSeats = section.rows[row].sort((a, b) => a.number - b.number);
                        return (
                          <div key={row} className="flex items-center gap-2 min-w-max">
                            <span className="text-xs text-gray-400 w-10 shrink-0">Row {row}</span>
                            <div className="flex gap-1">
                              {rowSeats.map(seat => {
                                const isAvail = seat.status === 'available';
                                const isSelected = selectedSeat?.seatId === seat.seatId;

                                let btnStyle = 'bg-gray-200 text-gray-400 cursor-not-allowed';
                                if (isAvail) {
                                  btnStyle = 'bg-green-500 hover:bg-green-600 text-white cursor-pointer';
                                } else if (seat.status === 'occupied') {
                                  btnStyle = 'bg-red-400 text-white cursor-not-allowed opacity-60';
                                } else if (seat.status === 'blocked') {
                                  btnStyle = 'bg-gray-400 text-white cursor-not-allowed opacity-60';
                                } else if (seat.status === 'held') {
                                  btnStyle = 'bg-yellow-400 text-white cursor-not-allowed opacity-60';
                                }

                                if (isSelected) {
                                  btnStyle = 'bg-indigo-600 text-white ring-4 ring-indigo-300 scale-105 font-bold cursor-pointer';
                                }

                                return (
                                  <button
                                    key={seat.seatId}
                                    type="button"
                                    onClick={() => handleSeatClick(seat)}
                                    disabled={!isAvail}
                                    title={`${seat.section} Row ${seat.row} #${seat.number} - ${seat.status}`}
                                    className={'w-8 h-8 rounded text-xs font-semibold transition-all flex items-center justify-center ' + btnStyle}
                                  >
                                    {seat.number}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                {selectedSeat ? (
                  <div className="text-sm text-gray-800">
                    Selected Seat: <strong className="text-indigo-600 text-base">{selectedSeat.section} — Row {selectedSeat.row} #{selectedSeat.number}</strong>
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Available</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">No seat selected yet. Tap an available green/blue/pink seat above.</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAttendee(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  disabled={!selectedSeat || assigning}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-xl text-sm disabled:opacity-50 transition flex items-center gap-2 shadow-sm"
                >
                  {assigning ? 'Assigning...' : 'Assign Seat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Success Message Modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">SEAT BOOKED SUCCESSFULLY</h3>
              <p className="text-xs text-gray-500 mt-1">Your seat is successfully booked.</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name:</span>
                <span className="font-semibold text-gray-900">{successModal.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ID:</span>
                <span className="font-semibold text-gray-900 font-mono">{successModal.idNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Event:</span>
                <span className="font-semibold text-gray-900">{successModal.eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seat Status:</span>
                <span className="font-semibold text-red-600">Occupied</span>
              </div>
              <div className="pt-2 border-t border-gray-200 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wider">YOUR SEAT</div>
                <div className="text-2xl font-black text-blue-600 mt-0.5">{successModal.seatLabel}</div>
              </div>
            </div>

            <button
              onClick={() => setSuccessModal(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
