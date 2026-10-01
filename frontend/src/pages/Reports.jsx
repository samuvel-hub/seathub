import React, { useState, useEffect } from 'react';
import { useSeating } from '../context/SeatingContext';
import API from '../api/api';

export default function Reports() {
  const { stats, services, activeService, fetchAll } = useSeating();
  const [selectedEventId, setSelectedEventId] = useState(activeService?._id || '');
  const [eventSeats, setEventSeats] = useState([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sync selectedEventId with activeService when available
  useEffect(() => {
    if (activeService && !selectedEventId) {
      setSelectedEventId(activeService._id);
    }
  }, [activeService, selectedEventId]);

  // Fetch seats whenever selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) return;
    setLoadingSeats(true);
    API.get(`/seats?eventId=${selectedEventId}`)
      .then(res => setEventSeats(res.data))
      .catch(err => console.error('Error fetching report seats:', err))
      .finally(() => setLoadingSeats(false));
  }, [selectedEventId]);

  const selectedEvent = services.find(s => s._id === selectedEventId) || activeService;
  const occupancy = stats.total > 0 ? Math.round(((stats.occupied + stats.reserved) / stats.total) * 100) : 0;

  // Filter seats that have an assigned name or note or are occupied/reserved
  const bookedSeats = eventSeats.filter(s =>
    s.status === 'occupied' || s.status === 'reserved' || s.assignedName || s.notes
  );

  const filteredBookedSeats = bookedSeats.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.assignedName && s.assignedName.toLowerCase().includes(q)) ||
      (s.notes && s.notes.toLowerCase().includes(q)) ||
      (s.seatId && s.seatId.toLowerCase().includes(q)) ||
      (s.section && s.section.toLowerCase().includes(q)) ||
      (s.row && s.row.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Seating & Attendee Reports</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Live seating occupancy, attendee assignments, and special notes.</p>
        </div>
        <div className="w-full sm:w-auto min-w-[240px]">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Select Event</label>
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {services.length === 0 && <option value="">No events available</option>}
            {services.map(ev => (
              <option key={ev._id} value={ev._id}>
                {ev.isActive || ev.status === 'Active' ? '● [ACTIVE] ' : ''}
                {ev.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Seat Status Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Available', value: stats.available, color: 'bg-green-500', total: stats.total },
              { label: 'Occupied', value: stats.occupied, color: 'bg-red-500', total: stats.total },
              { label: 'Reserved', value: stats.reserved, color: 'bg-purple-500', total: stats.total },
              { label: 'Held', value: stats.held, color: 'bg-yellow-400', total: stats.total },
              { label: 'Blocked', value: stats.blocked, color: 'bg-gray-300', total: stats.total },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value} / {item.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={'h-full rounded-full ' + item.color}
                    style={{ width: item.total ? (item.value / item.total * 100) + '%' : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="space-y-3">
            {[
              ['Total Capacity', stats.total],
              ['Occupancy Rate', occupancy + '%'],
              ['Selected Event', selectedEvent?.name || 'None'],
              ['Assigned / Occupied Seats', bookedSeats.length],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booked Seats with Attendee Names & Notes Table */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              Attendee Seat Details & Notes ({filteredBookedSeats.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              List of all booked seats showing the attendee name, designation, seat number, and special note.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search attendee, seat, note..."
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </div>
        </div>

        {loadingSeats ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading seat details...</div>
        ) : filteredBookedSeats.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
            {bookedSeats.length === 0
              ? 'No occupied or assigned seats for this event yet.'
              : 'No seats match your search query.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold">
                  <th className="py-3 px-4">Seat</th>
                  <th className="py-3 px-4">Section & Row</th>
                  <th className="py-3 px-4">Attendee Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBookedSeats.map(seat => (
                  <tr key={seat._id || seat.seatId} className="hover:bg-gray-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {seat.seatId}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-gray-800">{seat.section}</div>
                      <div className="text-[11px] text-gray-400">Row {seat.row}, Seat {seat.number}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {seat.assignedName ? (
                        <span className="font-semibold text-gray-900">{seat.assignedName}</span>
                      ) : (
                        <span className="text-gray-400 italic">Unspecified</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        {seat.category === 'men' || seat.category === 'women' ? 'General' : (seat.category || 'General')}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={
                        'px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ' +
                        (seat.status === 'occupied'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : seat.status === 'reserved'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200')
                      }>
                        {seat.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {seat.notes ? (
                        <div className="bg-amber-50/60 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-medium max-w-xs break-words">
                          📝 {seat.notes}
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-xs">No note</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
