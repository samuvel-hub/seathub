'use client';

import React from 'react';
import { FormattedDate } from '@/components/common/FormattedDate';
import { useSeating } from '@/context/SeatingContext';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  Armchair,
  CheckCircle,
  Users,
  BookmarkCheck,
  Clock,
  Ban,
  Percent,
  Radio,
  Search,
  MapPin,
  Calendar,
  ArrowRight
} from 'lucide-react';

export default function DashboardPage() {
  const { stats, activeService } = useSeating();
  const { role } = useAuth();

  const statCards = [
    {
      label: 'Total Capacity',
      value: stats.totalSeats,
      icon: Armchair,
      color: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      label: 'Available Seats',
      value: stats.availableSeats,
      icon: CheckCircle,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      label: 'Occupied Seats',
      value: stats.occupiedSeats,
      icon: Users,
      color: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    {
      label: 'Reserved Seats',
      value: stats.reservedSeats,
      icon: BookmarkCheck,
      color: 'bg-purple-50 text-purple-700 border-purple-200'
    },
    {
      label: 'Temporary Holds',
      value: stats.heldSeats,
      icon: Clock,
      color: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      label: 'Blocked Seats',
      value: stats.blockedSeats,
      icon: Ban,
      color: 'bg-slate-100 text-slate-700 border-slate-200'
    },
    {
      label: 'Occupancy Rate',
      value: `${stats.occupancyPercentage}%`,
      icon: Percent,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    }
  ];

  return (
    <div className="space-y-8">
      
      {/* Active Service Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Active Live Service</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            {activeService?.name || 'Sunday Morning Worship'}
          </h1>
          <p className="text-xs text-slate-500 flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <FormattedDate
              date={activeService?.service_time}
              fallback="Scheduled Service"
            />
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Link
            href="/find-seats"
            className="flex-1 md:flex-initial py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <Search className="w-4 h-4" />
            <span>Find Seats</span>
          </Link>

          <Link
            href="/seating/map"
            className="flex-1 md:flex-initial py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-200 flex items-center justify-center space-x-2 transition-all"
          >
            <MapPin className="w-4 h-4" />
            <span>Seating Map</span>
          </Link>
        </div>
      </div>

      {/* Metrics Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`p-5 rounded-3xl border ${card.color} shadow-sm space-y-3 transition-transform hover:-translate-y-0.5`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                  {card.label}
                </span>
                <Icon className="w-5 h-5 opacity-90" />
              </div>
              <div className="text-2xl md:text-3xl font-black">{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Search className="w-5 h-5 text-blue-600" />
            <span>Usher Seat Finder</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Enter the size of an arriving family or visitor group (e.g., 4 people) to find consecutive open seats instantly without manually searching rows.
          </p>
          <Link
            href="/find-seats"
            className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-500"
          >
            <span>Launch Seat Finder</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <span>Live Interactive Seating Map</span>
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            View the 2D visual layout of all ~800 seats across auditorium sections. Monitor real-time usher updates as visitors sit down.
          </p>
          <Link
            href="/seating/map"
            className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-600 hover:text-emerald-500"
          >
            <span>Open Seating Map</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

    </div>
  );
}
