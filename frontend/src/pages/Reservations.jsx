import React, { useState } from 'react';
import { useSeating } from '../context/SeatingContext';

export default function Reservations() {
  const { reservations, updateReservation, loading } = useSeating();
  const [search, setSearch] = useState('');

  const filtered = reservations.filter(r =>
    r.guestName?.toLowerCase().includes(search.toLowerCase()) ||
    r.status?.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status) => {
    const map = { confirmed: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-600' };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Reservations</h1>
        <p className="text-sm text-gray-500">Manage seat reservations for services.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by guest name..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Guest', 'Group Size', 'Service', 'Seats', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.guestName}</td>
                  <td className="px-5 py-3 text-gray-600">{r.groupSize}</td>
                  <td className="px-5 py-3 text-gray-600">{r.serviceId?.name || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.seatIds?.join(', ') || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={'text-xs px-2 py-1 rounded-full font-medium capitalize ' + statusBadge(r.status)}>{r.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    {r.status !== 'cancelled' && (
                      <button onClick={() => updateReservation(r._id, { status: 'cancelled' })}
                        className="text-xs text-red-600 hover:underline">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No reservations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
