import React from 'react';
import { useSeating } from '../context/SeatingContext';

export default function Reports() {
  const { stats, services, reservations } = useSeating();
  const occupancy = stats.total > 0 ? Math.round(((stats.occupied + stats.reserved) / stats.total) * 100) : 0;
  const activeService = services.find(s => s.isActive);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Live seating statistics and service reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Seat Status Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Available', value: stats.available, color: 'bg-green-500', total: stats.total },
              { label: 'Occupied', value: stats.occupied, color: 'bg-red-500', total: stats.total },
              { label: 'Reserved', value: stats.reserved, color: 'bg-purple-500', total: stats.total },
              { label: 'Held', value: stats.held, color: 'bg-yellow-400', total: stats.total },
              { label: 'Blocked', value: stats.blocked, color: 'bg-gray-300', total: stats.total },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value} / {item.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={'h-full rounded-full ' + item.color}
                    style={{ width: item.total ? (item.value / item.total * 100) + '%' : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="space-y-3">
            {[
              ['Total Capacity', stats.total],
              ['Occupancy Rate', occupancy + '%'],
              ['Active Service', activeService?.name || 'None'],
              ['Total Services', services.length],
              ['Total Reservations', reservations.length],
              ['Confirmed Reservations', reservations.filter(r => r.status === 'confirmed').length],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
