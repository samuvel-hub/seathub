'use client';

import React, { useState } from 'react';
import { FormattedDate } from '@/components/common/FormattedDate';
import { useSeating } from '@/context/SeatingContext';
import { History, Search, User, Clock, CheckCircle, BookmarkCheck, Ban, RefreshCw } from 'lucide-react';

export default function ActivityLogPage() {
  const { activityLogs } = useSeating();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = activityLogs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      (log.user_name && log.user_name.toLowerCase().includes(q))
    );
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'SEAT_ASSIGNED':
        return { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle };
      case 'SEAT_HELD':
        return { color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock };
      case 'SEAT_RELEASED':
      case 'SEAT_HOLD_EXPIRED':
        return { color: 'bg-slate-100 text-slate-700 border-slate-300', icon: RefreshCw };
      case 'SEAT_RESERVED':
        return { color: 'bg-purple-100 text-purple-800 border-purple-300', icon: BookmarkCheck };
      case 'SEAT_BLOCKED':
        return { color: 'bg-rose-100 text-rose-800 border-rose-300', icon: Ban };
      default:
        return { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: History };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <History className="w-6 h-6 text-blue-600" />
            <span>Audit Activity Log</span>
          </h1>
          <p className="text-xs text-slate-500">
            Realtime audit log tracking seat assignments, holds, reservations, and service events.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium">
            No activity logs match your search.
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pl-6 py-2">
            {filteredLogs.map((log) => {
              const badge = getActionBadge(log.action);
              const Icon = badge.icon;

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 hover:border-slate-300 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border flex items-center space-x-1 ${badge.color}`}>
                          <Icon className="w-3 h-3" />
                          <span>{log.action}</span>
                        </span>
                        <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{log.user_name || 'System'}</span>
                        </span>
                      </div>

                      <FormattedDate className="text-[11px] text-slate-500 font-semibold" date={log.created_at} format="time" />
                    </div>

                    <p className="text-xs text-slate-700 font-semibold">{log.details}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
