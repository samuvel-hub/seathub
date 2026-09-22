'use client';

import React, { useState } from 'react';
import { FullSeatInfo } from '@/types/database';
import { FormattedDate } from '@/components/common/FormattedDate';
import { useSeating } from '@/context/SeatingContext';
import { useAuth } from '@/context/AuthContext';
import { X, CheckCircle, Clock, ShieldAlert, Ban, RefreshCw, UserCheck } from 'lucide-react';

interface SeatDetailsModalProps {
  seatInfo: FullSeatInfo | null;
  onClose: () => void;
}

export const SeatDetailsModal: React.FC<SeatDetailsModalProps> = ({ seatInfo, onClose }) => {
  const { assignSeats, holdSeats, releaseSeats, reserveSeats, blockSeats, unblockSeats } = useSeating();
  const { user, role } = useAuth();
  const [reservationNote, setReservationNote] = useState('');
  const [showReserveInput, setShowReserveInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!seatInfo) return null;

  const { seat, row, section, serviceSeat } = seatInfo;
  const status = serviceSeat.status;

  const handleAssign = async () => {
    setLoading(true);
    setErrorMsg('');
    const result = await assignSeats(
      [seat.id],
      user?.id || 'guest-usher',
      user?.full_name || 'Active Usher'
    );
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleHold = async () => {
    setLoading(true);
    setErrorMsg('');
    const result = await holdSeats(
      [seat.id],
      user?.id || 'guest-usher',
      user?.full_name || 'Active Usher',
      2
    );
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleRelease = async () => {
    setLoading(true);
    await releaseSeats([seat.id]);
    setLoading(false);
    onClose();
  };

  const handleReserve = async () => {
    if (!reservationNote.trim()) {
      setErrorMsg('Please specify a reservation note (e.g. Choir, Pastoral VIP)');
      return;
    }
    setLoading(true);
    await reserveSeats([seat.id], reservationNote);
    setLoading(false);
    onClose();
  };

  const handleBlock = async () => {
    setLoading(true);
    await blockSeats([seat.id]);
    setLoading(false);
    onClose();
  };

  const handleUnblock = async () => {
    setLoading(true);
    await unblockSeats([seat.id]);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 text-slate-900 shadow-2xl space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div
              className="w-4 h-10 rounded-r-md"
              style={{ backgroundColor: section.color }}
            />
            <div>
              <h3 className="font-bold text-lg leading-tight text-slate-900">
                {section.name} - {row.row_name}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Seat Number {seat.seat_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Seat Status Badge & Metadata */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Current Status</span>
            <span
              className={`px-3 py-1 rounded-full font-bold uppercase text-[11px] ${
                status === 'AVAILABLE'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : status === 'OCCUPIED'
                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                  : status === 'RESERVED'
                  ? 'bg-purple-100 text-purple-700 border border-purple-300'
                  : status === 'HELD'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-200 text-slate-600 border border-slate-300'
              }`}
            >
              {status}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-500 font-medium">Seat Type</span>
            <span className="capitalize font-bold">{seat.seat_type}</span>
          </div>

          {serviceSeat.reservation_note && (
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500 font-medium">Reservation Note</span>
              <span className="font-bold text-purple-700">{serviceSeat.reservation_note}</span>
            </div>
          )}

          {serviceSeat.assigned_at && (
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500 font-medium">Assigned At</span>
              <FormattedDate date={serviceSeat.assigned_at} format="time" />
            </div>
          )}

          {serviceSeat.held_until && (
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500 font-medium">Hold Expires</span>
              <FormattedDate className="text-amber-700 font-bold" date={serviceSeat.held_until} format="time" />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-3 pt-1">
          {status === 'AVAILABLE' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleAssign}
                disabled={loading}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Assign Seat</span>
              </button>
              <button
                onClick={handleHold}
                disabled={loading}
                className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center space-x-2 shadow-md shadow-amber-500/20 transition-all active:scale-95"
              >
                <Clock className="w-4 h-4" />
                <span>Hold 2 Mins</span>
              </button>
            </div>
          )}

          {status === 'HELD' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleAssign}
                disabled={loading}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-md transition-all active:scale-95"
              >
                <UserCheck className="w-4 h-4" />
                <span>Confirm Assignment</span>
              </button>
              <button
                onClick={handleRelease}
                disabled={loading}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm flex items-center justify-center space-x-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Release Hold</span>
              </button>
            </div>
          )}

          {status === 'OCCUPIED' && (
            <button
              onClick={handleRelease}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm flex items-center justify-center space-x-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Release Seat (Make Available)</span>
            </button>
          )}

          {/* Admin Reserved / Blocked Controls */}
          {role === 'admin' && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Admin Management
              </div>

              {showReserveInput ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Enter reservation note (e.g. Choir, Pastoral)"
                    value={reservationNote}
                    onChange={(e) => setReservationNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleReserve}
                      disabled={loading}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg"
                    >
                      Confirm Reserve
                    </button>
                    <button
                      onClick={() => setShowReserveInput(false)}
                      className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {status !== 'RESERVED' ? (
                    <button
                      onClick={() => setShowReserveInput(true)}
                      className="py-2.5 px-3 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs hover:bg-purple-100 transition-colors"
                    >
                      Reserve Seat
                    </button>
                  ) : (
                    <button
                      onClick={handleRelease}
                      className="py-2.5 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                    >
                      Clear Reserve
                    </button>
                  )}

                  {status !== 'BLOCKED' ? (
                    <button
                      onClick={handleBlock}
                      className="py-2.5 px-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 flex items-center justify-center space-x-1"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Block Seat</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleUnblock}
                      className="py-2.5 px-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs hover:bg-emerald-100"
                    >
                      Unblock Seat
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
