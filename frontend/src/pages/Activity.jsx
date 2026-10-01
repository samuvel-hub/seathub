import React, { useEffect } from 'react';
import { useSeating } from '../context/SeatingContext';

export default function Activity() {
  const { activityLogs, loading, fetchAll } = useSeating();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const actionColor = (action) => {
    if (action.includes('occupied') || action.includes('ASSIGNED')) return 'bg-red-100 text-red-700';
    if (action.includes('available') || action.includes('RELEASED')) return 'bg-green-100 text-green-700';
    if (action.includes('reserved') || action.includes('RESERVED')) return 'bg-purple-100 text-purple-700';
    if (action.includes('held') || action.includes('HELD')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-xs sm:text-sm text-gray-500">Real-time log of all seat and event changes.</p>
        </div>
        <button onClick={fetchAll} className="border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">↻ Refresh</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Time', 'User', 'Action', 'Seat', 'Details'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activityLogs.map((log, i) => (
                <tr key={log._id || i} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-gray-700">{log.userName || 'System'}</td>
                  <td className="px-5 py-3">
                    <span className={'text-xs px-2 py-1 rounded-full font-medium capitalize ' + actionColor(log.action)}>
                      {log.action.toLowerCase().replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs font-mono">{log.seatId || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{log.details || '—'}</td>
                </tr>
              ))}
              {activityLogs.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No activity recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
