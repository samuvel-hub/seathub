import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSeating } from '../context/SeatingContext';

const StatCard = ({ label, value, color, bg }) => (
  <div className={'rounded-2xl border p-5 ' + bg}>
    <div className={'text-xs font-semibold uppercase tracking-wider mb-2 ' + color}>{label}</div>
    <div className={'text-3xl font-bold ' + color}>{value}</div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { stats, activeService, loading } = useSeating();
  const navigate = useNavigate();
  const occupancyRate = stats.total > 0 ? Math.round(((stats.occupied + stats.reserved) / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            {activeService && <div className="text-xs font-semibold text-green-600 mb-1">● ACTIVE LIVE SERVICE</div>}
            <h1 className="text-2xl font-bold text-gray-900">{activeService?.name || 'No Active Service'}</h1>
            <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/find-seats')}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
              ⌕ Find Seats
            </button>
            <button onClick={() => navigate('/seating/map')}
              className="border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-1">
              ⊞ Seating Map
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading data...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Capacity" value={stats.total} color="text-blue-700" bg="bg-blue-50 border-blue-100" />
            <StatCard label="Available" value={stats.available} color="text-green-700" bg="bg-green-50 border-green-100" />
            <StatCard label="Occupied" value={stats.occupied} color="text-red-700" bg="bg-red-50 border-red-100" />
            <StatCard label="Reserved" value={stats.reserved} color="text-purple-700" bg="bg-purple-50 border-purple-100" />
            <StatCard label="Held" value={stats.held} color="text-yellow-700" bg="bg-yellow-50 border-yellow-100" />
            <StatCard label="Occupancy" value={occupancyRate + '%'} color="text-gray-700" bg="bg-gray-50 border-gray-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-1">⌕ Find Seats</h3>
              <p className="text-sm text-gray-500 mb-4">Instantly find consecutive available seats for a group.</p>
              <button onClick={() => navigate('/find-seats')} className="text-blue-600 text-sm font-medium hover:underline">Launch Seat Finder →</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-1">⊞ Live Seating Map</h3>
              <p className="text-sm text-gray-500 mb-4">View and manage all 700 seats across 4 sections in real time.</p>
              <button onClick={() => navigate('/seating/map')} className="text-green-600 text-sm font-medium hover:underline">Open Seating Map →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
