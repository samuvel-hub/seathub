'use client';

import React from 'react';
import { SeatingMap } from '@/components/seating/SeatingMap';

export default function LiveMapPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Live Interactive Seating Map</h1>
        <p className="text-xs md:text-sm text-gray-500">
          Real-time visualization of all ~800 seats across auditorium sections. Tap any seat to assign, hold, or view metadata.
        </p>
      </div>

      <SeatingMap />
    </div>
  );
}
