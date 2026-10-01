import React, { useState } from 'react';
import { useSeating } from '../../context/SeatingContext';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-800 border-green-300',
  occupied:  'bg-red-100 text-red-800 border-red-300',
  reserved:  'bg-blue-100 text-blue-800 border-blue-300',
  held:      'bg-yellow-100 text-yellow-800 border-yellow-300',
  blocked:   'bg-gray-200 text-gray-600 border-gray-300',
};

export default function SeatDetailsModal({ seat, onClose }) {
  const { updateSeat } = useSeating();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const seatIsOccupied = seat.status === 'occupied';
  const seatIsBlocked  = seat.status === 'blocked';
  const seatIsReserved = seat.status === 'reserved';

  // Non-admin can only book available seats
  const isReadOnly = !isAdmin && (seatIsOccupied || seatIsBlocked || seatIsReserved);

  const [status, setStatus] = useState(!isAdmin && seat.status === 'available' ? 'occupied' : seat.status);
  const [category] = useState(
    (seat.category && seat.category !== 'men' && seat.category !== 'women') ? seat.category : 'general'
  );
  const [notes, setNotes] = useState(seat.notes || '');
  const [assignedName, setAssignedName] = useState(
    seat.assignedName || (user?.name && user.name !== 'Guest Attendee' ? user.name : '')
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isAdmin && (seatIsOccupied || seatIsBlocked || seatIsReserved)) {
      alert('Only administrators can modify occupied, reserved, or blocked seats.');
      return;
    }
    if (!isAdmin && (status === 'blocked' || status === 'reserved')) {
      alert('Only administrators can block or reserve seats.');
      return;
    }

    setSaving(true);
    try {
      const finalName = assignedName.trim() || (isAdmin ? '' : 'Guest Attendee');
      await updateSeat(
        seat._id || seat.seatId,
        {
          status: isAdmin ? status : 'occupied',
          category,
          notes: notes.trim(),
          assignedName: finalName,
        },
        seat.serviceId
      );
      onClose();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  // Decide if a status button should be disabled for admin view
  const isStatusDisabled = (s) => {
    if (isAdmin) return false;
    if (seatIsOccupied || seatIsBlocked || seatIsReserved) return true;
    if (s === 'blocked' || s === 'reserved') return true;
    return false;
  };

  const allStatuses = ['available', 'occupied', 'reserved', 'held', 'blocked'];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {!isAdmin && seat.status === 'available' ? 'Book Seat' : 'Seat Details'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {seat.section} — Row {seat.row}, Seat #{seat.number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Lock banners for guests */}
          {!isAdmin && seatIsOccupied && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-3.5">
              <span className="text-xl">🔒</span>
              <div>
                <p className="text-sm font-semibold text-red-700">Seat Already Occupied</p>
                <p className="text-xs text-red-500 mt-0.5">
                  This seat is taken{seat.assignedName ? ' by ' + seat.assignedName : ''}. Only an <strong>Admin</strong> can release or reassign it.
                </p>
              </div>
            </div>
          )}

          {!isAdmin && seatIsBlocked && (
            <div className="flex items-start gap-3 bg-gray-100 border border-gray-300 rounded-2xl p-3.5">
              <span className="text-xl">🚫</span>
              <div>
                <p className="text-sm font-semibold text-gray-700">Seat is Blocked</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  This seat is temporarily blocked. Only an <strong>Admin</strong> can unblock it.
                </p>
              </div>
            </div>
          )}

          {!isAdmin && seatIsReserved && (
            <div className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-2xl p-3.5">
              <span className="text-xl">🟣</span>
              <div>
                <p className="text-sm font-semibold text-purple-700">Reserved Seat</p>
                <p className="text-xs text-purple-500 mt-0.5">
                  This seat is reserved for pastoral staff, choir, or special guests.
                </p>
              </div>
            </div>
          )}

          {/* Attendee Booking Fields (Guest Flow) */}
          {!isAdmin && seat.status === 'available' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800">
                You are booking <strong>Row {seat.row}, Seat {seat.number}</strong> in {seat.section}. Please enter attendee details below to confirm.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Attendee / Family Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={assignedName}
                  onChange={e => setAssignedName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Optional Notes (Special needs, etc.)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional note..."
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Admin Controls */}
          {isAdmin && (
            <div className="space-y-4">
              {/* Status Buttons */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {allStatuses.map(s => {
                    const disabled = isStatusDisabled(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => !disabled && setStatus(s)}
                        disabled={disabled}
                        className={
                          'w-full px-2 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ' +
                          (disabled
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : status === s
                              ? STATUS_COLORS[s] + ' ring-2 ring-blue-500 font-bold'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50')
                        }
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Name</label>
                <input
                  value={assignedName}
                  onChange={e => setAssignedName(e.target.value)}
                  placeholder="Attendee name..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 font-medium transition"
          >
            {isReadOnly ? 'Close' : 'Cancel'}
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={
                'flex-1 text-white rounded-xl py-2.5 text-sm font-semibold transition shadow-sm disabled:opacity-50 cursor-pointer ' +
                (!isAdmin
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20')
              }
            >
              {saving
                ? 'Processing...'
                : !isAdmin
                  ? 'Confirm Booking'
                  : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
