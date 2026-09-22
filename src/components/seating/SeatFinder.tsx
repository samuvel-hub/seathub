'use client';

import React, { useState } from 'react';
import { useSeating } from '@/context/SeatingContext';
import { useAuth } from '@/context/AuthContext';
import { SeatRecommendation, SeatType } from '@/types/database';
import { Search, Users, CheckCircle, Clock, Sparkles, AlertCircle } from 'lucide-react';

export const SeatFinder: React.FC = () => {
  const { sections, findBestSeats, assignSeats, holdSeats } = useSeating();
  const { user } = useAuth();

  const [groupSize, setGroupSize] = useState<number>(4);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSeatType, setSelectedSeatType] = useState<string>('');
  const [recommendations, setRecommendations] = useState<SeatRecommendation[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActionMessage(null);
    const results = findBestSeats(
      groupSize,
      selectedSection || undefined,
      (selectedSeatType as SeatType) || undefined
    );
    setRecommendations(results);
    setHasSearched(true);
  };

  const handleAssignOption = async (rec: SeatRecommendation) => {
    setLoadingId(`assign-${rec.id}`);
    setActionMessage(null);
    const seatIds = rec.seats.map((s) => s.seat.id);

    const result = await assignSeats(
      seatIds,
      user?.id || 'guest-usher',
      user?.full_name || 'Active Usher'
    );

    setLoadingId(null);
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message });
      handleSearch();
    } else {
      setActionMessage({ type: 'error', text: result.message });
    }
  };

  const handleHoldOption = async (rec: SeatRecommendation) => {
    setLoadingId(`hold-${rec.id}`);
    setActionMessage(null);
    const seatIds = rec.seats.map((s) => s.seat.id);

    const result = await holdSeats(
      seatIds,
      user?.id || 'guest-usher',
      user?.full_name || 'Active Usher',
      2
    );

    setLoadingId(null);
    if (result.success) {
      setActionMessage({ type: 'success', text: result.message });
      handleSearch();
    } else {
      setActionMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Find Available Seats</h1>
            <p className="text-xs md:text-sm text-slate-500">
              Enter group size to locate consecutive available seats instantly for incoming visitors.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* People Count */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center">
              <Users className="w-3.5 h-3.5 mr-1 text-blue-600" />
              Number of People:
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={groupSize}
              onChange={(e) => setGroupSize(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-black text-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Preferred Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Preferred Section:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none h-[50px] font-medium"
            >
              <option value="">Any Section</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} ({sec.code})
                </option>
              ))}
            </select>
          </div>

          {/* Seat Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Seat Type:</label>
            <select
              value={selectedSeatType}
              onChange={(e) => setSelectedSeatType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none h-[50px] font-medium"
            >
              <option value="">Standard / Any</option>
              <option value="vip">VIP</option>
              <option value="accessible">Accessible Wheelchair</option>
              <option value="companion">Companion</option>
            </select>
          </div>

          {/* Search Action Button */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all active:scale-95 h-[50px]"
            >
              <Search className="w-4 h-4" />
              <span>Search Seats</span>
            </button>
          </div>

        </form>
      </div>

      {/* Action Result Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center space-x-3 text-sm font-semibold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Recommendations Results List */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider px-1">
            <span>Best Available Options ({recommendations.length})</span>
            <span>Prioritizing consecutive seats</span>
          </div>

          {recommendations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-sm">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-slate-900 font-bold text-lg">No Consecutive Seats Found</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                No single row has {groupSize} consecutive available seats in your selected filters. Try searching for a smaller group size or select "Any Section".
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec, idx) => {
                const seatNumbers = rec.seats.map((s) => s.seat.seat_number).join(', ');
                const isAssigning = loadingId === `assign-${rec.id}`;
                const isHolding = loadingId === `hold-${rec.id}`;

                return (
                  <div
                    key={rec.id}
                    className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-slate-300 transition-all"
                  >
                    {/* Option Details */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold uppercase">
                          Option {idx + 1}
                        </span>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: rec.section.color }}
                        />
                        <h3 className="font-bold text-slate-900 text-lg">
                          {rec.section.name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                        <div>
                          Row: <span className="font-bold text-slate-900">{rec.row.row_name}</span>
                        </div>
                        <div>
                          Seats ({rec.seats.length}):{' '}
                          <span className="font-bold text-emerald-700 font-mono text-sm">{seatNumbers}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 italic">{rec.matchReason}</p>

                      {/* Visual Seat Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rec.seats.map((s) => (
                          <span
                            key={s.seat.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-mono font-bold"
                          >
                            Seat {s.seat.seat_number}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
                      <button
                        onClick={() => handleAssignOption(rec)}
                        disabled={isAssigning || isHolding}
                        className="flex-1 md:flex-initial py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all active:scale-95"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{isAssigning ? 'Assigning...' : 'ASSIGN SEATS'}</span>
                      </button>

                      <button
                        onClick={() => handleHoldOption(rec)}
                        disabled={isAssigning || isHolding}
                        className="flex-1 md:flex-initial py-2.5 px-6 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 font-bold text-xs hover:bg-amber-100 flex items-center justify-center space-x-2 transition-all"
                      >
                        <Clock className="w-4 h-4" />
                        <span>{isHolding ? 'Holding...' : 'Hold 2 Mins'}</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
