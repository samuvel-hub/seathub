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

  // Non-admin: read-only if seat is occupied or blocked
  const isReadOnly = !isAdmin && (seatIsOccupied || seatIsBlocked);

  const [status, setStatus] = useState(seat.status);
  const [notes, setNotes] = useState(seat.notes || '');
  const [assignedName, setAssignedName] = useState(seat.assignedName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isAdmin && seatIsOccupied) {
      alert('Only admins can change an occupied seat.');
      return;
    }
    if (!isAdmin && (status === 'blocked' || seatIsBlocked)) {
      alert('Only admins can block or unblock seats.');
      return;
    }
    setSaving(true);
    try {
      await updateSeat(seat.seatId, { status, notes, assignedName });
      onClose();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  // Decide if a status button should be disabled
  const isStatusDisabled = (s) => {
    if (isAdmin) return false;       // Admin can do anything
    if (seatIsOccupied) return true; // User: occupied seat is fully locked
    if (seatIsBlocked) return true;  // User: blocked seat is fully locked
    if (s === 'blocked') return true; // User: can never block
    return false;
  };

  const allStatuses = ['available', 'occupied', 'reserved', 'held', 'blocked'];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Seat Details</h2>
              <p className="text-sm text-gray-500">{seat.section} — Row {seat.row}, Seat {seat.number}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-6 space-y-4">

          {/* 🔒 Occupied lock banner — shown to non-admin */}
          {!isAdmin && seatIsOccupied && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
              <span className="text-xl mt-0.5">🔒</span>
              <div>
                <p className="text-sm font-semibold text-red-700">Seat Already Occupied</p>
                <p className="text-xs text-red-500 mt-0.5">
                  This seat is taken{assignedName ? ' by ' + assignedName : ''}. Only an <strong>Admin</strong> can release or reassign it.
                </p>
              </div>
            </div>
          )}

          {/* 🚫 Blocked lock banner — shown to non-admin */}
          {!isAdmin && seatIsBlocked && (
            <div className="flex items-start gap-3 bg-gray-100 border border-gray-300 rounded-xl p-3">
              <span className="text-xl mt-0.5">🚫</span>
              <div>
                <p className="text-sm font-semibold text-gray-700">Seat is Blocked</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Only an <strong>Admin</strong> can unblock this seat.
                </p>
              </div>
            </div>
          )}

          {/* Status Buttons */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {allStatuses.map(s => {
                const disabled = isStatusDisabled(s);
                const isOccupiedOrBlockedBtn = s === 'blocked' || (seatIsOccupied && !isAdmin);
                return (
                  <div key={s} className="relative">
                    <button
                      onClick={() => !disabled && setStatus(s)}
                      disabled={disabled}
                      title={disabled && !isAdmin ? 'Admin only' : ''}
                      className={
                        'w-full px-2 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ' +
                        (disabled
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : status === s
                            ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-blue-400'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50')
                      }
                    >
                      {s}
                    </button>
                    {/* Admin badge on restricted buttons */}
                    {disabled && !isAdmin && (
                      <span className="absolute -top-2 -right-1 bg-orange-500 text-white text-[9px] px-1 rounded-full leading-4 font-semibold pointer-events-none">
                        Admin
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {!isAdmin && !seatIsOccupied && !seatIsBlocked && (
              <p className="mt-2 text-xs text-orange-500">
                🔒 Blocking seats and releasing occupied seats require Admin access.
              </p>
            )}
          </div>

          {/* Assigned To */}
          {(status === 'occupied' || status === 'reserved') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
              <input
                value={assignedName}
                onChange={e => !isReadOnly && setAssignedName(e.target.value)}
                readOnly={isReadOnly}
                placeholder={isReadOnly ? (assignedName || '—') : 'Guest name...'}
                className={
                  'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ' +
                  (isReadOnly
                    ? 'border-gray-100 bg-gray-50 text-gray-500 cursor-default'
                    : 'border-gray-200 focus:ring-2 focus:ring-blue-500')
                }
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => !isReadOnly && setNotes(e.target.value)}
              readOnly={isReadOnly}
              rows={2}
              placeholder={isReadOnly ? (notes || '—') : 'Optional notes...'}
              className={
                'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ' +
                (isReadOnly
                  ? 'border-gray-100 bg-gray-50 text-gray-500 cursor-default'
                  : 'border-gray-200 focus:ring-2 focus:ring-blue-500')
              }
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {isReadOnly ? 'Close' : 'Cancel'}
          </button>
          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
