'use client';

import React, { useState, useMemo } from 'react';
import { useSeating } from '@/context/SeatingContext';
import { FullSeatInfo, SeatStatus } from '@/types/database';
import { SeatDetailsModal } from './SeatDetailsModal';
import { Search, Filter, Compass } from 'lucide-react';

export const SeatingMap: React.FC = () => {
  const { sections, rows, seats, getFullSeatInfoList } = useSeating();
  const [selectedSeat, setSelectedSeat] = useState<FullSeatInfo | null>(null);
  const [statusFilter, setStatusFilter] = useState<SeatStatus | 'ALL'>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fullSeatList = getFullSeatInfoList();

  const filteredSeatIds = useMemo(() => {
    const set = new Set<string>();
    const query = searchQuery.trim().toLowerCase();

    fullSeatList.forEach((info) => {
      const statusMatch = statusFilter === 'ALL' || info.serviceSeat.status === statusFilter;
      const sectionMatch = sectionFilter === 'ALL' || info.section.id === sectionFilter;
      
      let textMatch = true;
      if (query) {
        const textStr = `${info.section.name} ${info.section.code} ${info.row.row_name} seat ${info.seat.seat_number}`.toLowerCase();
        textMatch = textStr.includes(query);
      }

      if (statusMatch && sectionMatch && textMatch) {
        set.add(info.seat.id);
      }
    });

    return set;
  }, [fullSeatList, statusFilter, sectionFilter, searchQuery]);

  const getSeatBadgeClass = (status: SeatStatus, isMatch: boolean) => {
    if (!isMatch) return 'opacity-25 scale-90 bg-slate-100 border-slate-200 text-slate-400';

    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20 active:scale-95';
      case 'OCCUPIED':
        return 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-sm shadow-rose-600/20 active:scale-95';
      case 'RESERVED':
        return 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-sm shadow-purple-600/20 active:scale-95';
      case 'HELD':
        return 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-black border-amber-500 shadow-sm shadow-amber-400/30 animate-pulse active:scale-95';
      case 'BLOCKED':
        return 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  };

  const statusOptions: (SeatStatus | 'ALL')[] = ['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'HELD', 'BLOCKED'];

  return (
    <div className="space-y-6">
      
      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search section, row or seat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-500 placeholder-slate-400"
            />
          </div>

          {/* Section Filter */}
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <Compass className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full md:w-auto px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Sections</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} ({sec.code})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 items-center">
          <span className="text-xs font-semibold text-slate-500 flex items-center mr-2">
            <Filter className="w-3.5 h-3.5 mr-1" />
            Status:
          </span>
          {statusOptions.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Stage Banner Header */}
      <div className="relative">
        <div className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 border border-blue-700 rounded-2xl py-3 text-center text-white font-bold uppercase tracking-widest text-sm shadow-md flex items-center justify-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
          <span>STAGE / ALTAR / PULPIT</span>
          <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
        </div>
      </div>

      {/* Interactive 2D Visual Map Container */}
      <div className="bg-slate-100 border border-slate-200 rounded-3xl p-4 md:p-8 overflow-x-auto shadow-sm space-y-12">
        {sections.map((section) => {
          if (sectionFilter !== 'ALL' && section.id !== sectionFilter) return null;

          const sectionRows = rows
            .filter((r) => r.section_id === section.id)
            .sort((a, b) => a.sort_order - b.sort_order);

          return (
            <div
              key={section.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 min-w-[650px] shadow-sm"
            >
              {/* Section Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <span
                    className="w-3 h-6 rounded-sm inline-block"
                    style={{ backgroundColor: section.color }}
                  ></span>
                  <h3 className="font-bold text-slate-900 text-base">{section.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-semibold">
                    {section.code}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {sectionRows.length} Rows
                </span>
              </div>

              {/* Rows and Seats Grid */}
              <div className="space-y-3 pt-2">
                {sectionRows.map((row) => {
                  const rowSeats = seats
                    .filter((s) => s.row_id === row.id)
                    .sort((a, b) => a.seat_number - b.seat_number);

                  return (
                    <div key={row.id} className="flex items-center space-x-3">
                      {/* Row Label */}
                      <div className="w-16 shrink-0 text-xs font-bold text-slate-600 font-mono">
                        {row.row_name}
                      </div>

                      {/* Row Seats */}
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {rowSeats.map((seat) => {
                          const info = fullSeatList.find((s) => s.seat.id === seat.id);
                          if (!info) return null;

                          const isMatch = filteredSeatIds.has(seat.id);
                          const status = info.serviceSeat.status;

                          return (
                            <button
                              key={seat.id}
                              onClick={() => setSelectedSeat(info)}
                              title={`${section.name} ${row.row_name} Seat ${seat.seat_number} (${status})`}
                              className={`w-8 h-8 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center border ${getSeatBadgeClass(
                                status,
                                isMatch
                              )}`}
                            >
                              {seat.seat_number}
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

      {/* Seat Details Modal */}
      <SeatDetailsModal
        seatInfo={selectedSeat}
        onClose={() => setSelectedSeat(null)}
      />

    </div>
  );
};
