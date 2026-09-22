'use client';

import React, { useState } from 'react';
import { useSeating } from '@/context/SeatingContext';
import { useAuth } from '@/context/AuthContext';
import { BookmarkCheck, Plus, Trash2 } from 'lucide-react';

export default function ReservationsPage() {
  const { sections, rows, seats, reserveSeats, releaseSeats, getFullSeatInfoList } = useSeating();
  const { role } = useAuth();

  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || '');
  const [selectedRowId, setSelectedRowId] = useState<string>('');
  const [startSeatNum, setStartSeatNum] = useState<number>(1);
  const [endSeatNum, setEndSeatNum] = useState<number>(5);
  const [reservationNote, setReservationNote] = useState<string>('Pastoral Staff & Guests');
  const [showAddForm, setShowAddForm] = useState(false);

  const fullList = getFullSeatInfoList();
  const reservedSeatList = fullList.filter((info) => info.serviceSeat.status === 'RESERVED');

  const sectionRows = rows.filter((r) => r.section_id === selectedSectionId);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRowId || !reservationNote.trim()) return;

    const rowSeats = seats.filter(
      (s) => s.row_id === selectedRowId && s.seat_number >= startSeatNum && s.seat_number <= endSeatNum
    );

    const seatIds = rowSeats.map((s) => s.id);
    if (seatIds.length > 0) {
      await reserveSeats(seatIds, reservationNote);
      setShowAddForm(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <BookmarkCheck className="w-6 h-6 text-purple-600" />
            <span>Admin Seat Reservations</span>
          </h1>
          <p className="text-xs text-slate-500">
            Reserved seats are protected and cannot normally be assigned by ushers.
          </p>
        </div>

        {role === 'admin' && (
          <button
            onClick={() => setShowAddForm(true)}
            className="py-3 px-5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-2 shadow-md shadow-purple-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Reservation</span>
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleCreateReservation} className="bg-white border border-purple-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">Reserve Range of Seats</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Section:</label>
              <select
                value={selectedSectionId}
                onChange={(e) => {
                  setSelectedSectionId(e.target.value);
                  setSelectedRowId('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} ({sec.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Row:</label>
              <select
                value={selectedRowId}
                onChange={(e) => setSelectedRowId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
                required
              >
                <option value="">Select Row</option>
                {sectionRows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.row_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">From Seat # to To Seat #:</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  min={1}
                  value={startSeatNum}
                  onChange={(e) => setStartSeatNum(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold"
                />
                <input
                  type="number"
                  min={1}
                  value={endSeatNum}
                  onChange={(e) => setEndSeatNum(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold mb-1 block">Reservation Reason / Note:</label>
              <input
                type="text"
                placeholder="e.g. Choir, Pastoral VIP"
                value={reservationNote}
                onChange={(e) => setReservationNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium"
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md"
            >
              Confirm Reservation
            </button>
          </div>
        </form>
      )}

      {/* Reserved Seats List Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Active Reservations ({reservedSeatList.length})</h2>

        {reservedSeatList.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No active seat reservations. Click "New Reservation" above to reserve seats for staff or special guests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-3">Section</th>
                  <th className="p-3">Row</th>
                  <th className="p-3">Seat Number</th>
                  <th className="p-3">Reservation Note</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservedSeatList.map((info) => (
                  <tr key={info.seat.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{info.section.name} ({info.section.code})</td>
                    <td className="p-3 font-mono text-purple-700 font-bold">{info.row.row_name}</td>
                    <td className="p-3 font-mono font-bold">Seat {info.seat.seat_number}</td>
                    <td className="p-3 italic text-slate-500 font-medium">{info.serviceSeat.reservation_note || 'Reserved'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => releaseSeats([info.seat.id])}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-600 transition-colors"
                        title="Clear Reservation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
