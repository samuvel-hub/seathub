'use client';

import React from 'react';
import { FormattedDate } from '@/components/common/FormattedDate';
import { useSeating } from '@/context/SeatingContext';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  const { stats, sections, services, activeService, getFullSeatInfoList } = useSeating();
  const fullList = getFullSeatInfoList();

  const sectionBreakdown = sections.map((sec) => {
    const secSeats = fullList.filter((s) => s.section.id === sec.id);
    const total = secSeats.length;
    const occupied = secSeats.filter((s) => s.serviceSeat.status === 'OCCUPIED').length;
    const available = secSeats.filter((s) => s.serviceSeat.status === 'AVAILABLE').length;
    const reserved = secSeats.filter((s) => s.serviceSeat.status === 'RESERVED').length;
    const held = secSeats.filter((s) => s.serviceSeat.status === 'HELD').length;
    const blocked = secSeats.filter((s) => s.serviceSeat.status === 'BLOCKED').length;
    const nonBlocked = total - blocked;
    const percentage = nonBlocked > 0 ? Math.round((occupied / nonBlocked) * 100) : 0;

    return {
      section: sec,
      total,
      occupied,
      available,
      reserved,
      held,
      blocked,
      percentage
    };
  });

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-2">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <span>Auditorium Seating Reports & Analytics</span>
        </h1>
        <p className="text-xs md:text-sm text-slate-500">
          Capacity breakdown and live section occupancy metrics for {activeService?.name || 'current service'}.
        </p>
      </div>

      {/* Primary Capacity Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-2 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Capacity</span>
          <div className="text-3xl font-black text-slate-900">{stats.totalSeats}</div>
          <span className="text-[11px] text-slate-400">Total auditorium seats</span>
        </div>

        <div className="bg-white border border-emerald-200 rounded-3xl p-5 space-y-2 shadow-sm">
          <span className="text-xs font-bold text-emerald-700 uppercase">Available</span>
          <div className="text-3xl font-black text-emerald-600">{stats.availableSeats}</div>
          <span className="text-[11px] text-slate-500">Ready for visitors</span>
        </div>

        <div className="bg-white border border-rose-200 rounded-3xl p-5 space-y-2 shadow-sm">
          <span className="text-xs font-bold text-rose-700 uppercase">Occupied</span>
          <div className="text-3xl font-black text-rose-600">{stats.occupiedSeats}</div>
          <span className="text-[11px] text-slate-500">Seated visitors</span>
        </div>

        <div className="bg-white border border-indigo-200 rounded-3xl p-5 space-y-2 shadow-sm">
          <span className="text-xs font-bold text-indigo-700 uppercase">Occupancy Rate</span>
          <div className="text-3xl font-black text-indigo-600">{stats.occupancyPercentage}%</div>
          <span className="text-[11px] text-slate-500">Of active seats occupied</span>
        </div>
      </div>

      {/* Section Occupancy Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Section Occupancy Breakdown</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="p-3">Section</th>
                <th className="p-3">Code</th>
                <th className="p-3">Total Seats</th>
                <th className="p-3">Occupied</th>
                <th className="p-3">Available</th>
                <th className="p-3">Reserved</th>
                <th className="p-3">Held</th>
                <th className="p-3">Blocked</th>
                <th className="p-3">Occupancy %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sectionBreakdown.map((row) => (
                <tr key={row.section.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-slate-900 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.section.color }} />
                    <span>{row.section.name}</span>
                  </td>
                  <td className="p-3 font-mono text-slate-500">{row.section.code}</td>
                  <td className="p-3 font-bold">{row.total}</td>
                  <td className="p-3 text-rose-600 font-bold">{row.occupied}</td>
                  <td className="p-3 text-emerald-600 font-bold">{row.available}</td>
                  <td className="p-3 text-purple-600 font-bold">{row.reserved}</td>
                  <td className="p-3 text-amber-600 font-bold">{row.held}</td>
                  <td className="p-3 text-slate-400 font-bold">{row.blocked}</td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-900">{row.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service History Summary */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Service History Log</h2>
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
                <FormattedDate className="text-xs text-slate-500" date={s.service_time} />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-white border border-slate-200 text-slate-700">
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
