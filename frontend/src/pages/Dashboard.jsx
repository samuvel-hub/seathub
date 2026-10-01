import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSeating } from '../context/SeatingContext';
import QrCodeModal from '../components/common/QrCodeModal';
import AdminBookingsModal from '../components/admin/AdminBookingsModal';

const StatCard = ({ label, value, color, bg }) => (
  <div className={'rounded-2xl border p-5 ' + bg}>
    <div className={'text-xs font-semibold uppercase tracking-wider mb-2 ' + color}>{label}</div>
    <div className={'text-3xl font-bold ' + color}>{value}</div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { stats, activeService, loading, fetchAll } = useSeating();
  const navigate = useNavigate();

  const [selectedQrEvent, setSelectedQrEvent] = useState(null);
  const [selectedBookingsEvent, setSelectedBookingsEvent] = useState(null);
  const [copied, setCopied] = useState(false);

  // Always refresh latest active/deactive status and stats on mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCopyLink = () => {
    if (!activeService) return;
    const eid = activeService.eventId || activeService._id;
    const url = `${window.location.origin}/guest/${eid}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const occupancyRate = stats.total > 0 ? Math.round(((stats.occupied + stats.reserved) / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Event Status Banner */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            {activeService ? (
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  ACTIVE LIVE EVENT
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Event ID: {activeService.eventId || 'EVENT001'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 mb-2">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                NO ACTIVE EVENT
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {activeService ? activeService.name : 'No Active Event Selected'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {activeService ? (
                <>
                  {activeService.date ? new Date(activeService.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  {activeService.time || activeService.startTime ? ` • ${activeService.time || activeService.startTime}` : ''}
                  {activeService.endTime ? ` - ${activeService.endTime}` : ''}
                  {activeService.type ? ` (${activeService.type})` : ''}
                </>
              ) : (
                'Activate an event from the Events page to monitor its real-time seating and attendance.'
              )}
            </p>

            {/* Quick Guest Link Bar on Dashboard (Requirement 3) */}
            {activeService && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-2xl">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    Guest Link
                  </span>
                  <span className="text-xs font-mono text-gray-700 truncate block">
                    {window.location.origin}/guest/{activeService.eventId || activeService._id}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={
                      'px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 ' +
                      (copied
                        ? 'bg-green-600 text-white shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-xs')
                    }
                  >
                    {copied ? '✓ Copied' : '📋 Copy Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQrEvent(activeService)}
                    className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                  >
                    📱 QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBookingsEvent(activeService)}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                  >
                    👥 Bookings
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeService && (
              <button
                onClick={() => navigate(`/events/${activeService._id}/seating`)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-1.5 shadow-sm"
              >
                ⊞ View Seating Map
              </button>
            )}
            <button
              onClick={() => navigate('/find-seats')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-1.5 shadow-sm"
            >
              ⌕ Find Seats
            </button>
            <button
              onClick={() => navigate('/events')}
              className="border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-1.5"
            >
              📅 {user?.role === 'admin' ? 'Manage Events' : 'View Events'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading data...</div>
      ) : (
        <>
          {activeService ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <StatCard label="Total Capacity" value={stats.total} color="text-blue-700" bg="bg-blue-50 border-blue-100" />
              <StatCard label="Available" value={stats.available} color="text-green-700" bg="bg-green-50 border-green-100" />
              <StatCard label="Occupied" value={stats.occupied} color="text-red-700" bg="bg-red-50 border-red-100" />
              <StatCard label="Reserved" value={stats.reserved} color="text-purple-700" bg="bg-purple-50 border-purple-100" />
              <StatCard label="Held" value={stats.held} color="text-yellow-700" bg="bg-yellow-50 border-yellow-100" />
              <StatCard label="Occupancy" value={occupancyRate + '%'} color="text-gray-700" bg="bg-gray-50 border-gray-200" />
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
              <div className="text-amber-700 font-semibold text-base mb-1">
                Currently No Active Event
              </div>
              <p className="text-xs sm:text-sm text-amber-600 mb-4 max-w-md mx-auto">
                No event is marked as active right now. To display live seating metrics and open seating check-in on the dashboard, activate an event from the Events page.
              </p>
              <button
                onClick={() => navigate('/events')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition inline-flex items-center gap-2 shadow-sm"
              >
                Go to Events Page →
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-1">⌕ Find Seats</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-4">Instantly find consecutive available seats for a group.</p>
              <button onClick={() => navigate('/find-seats')} className="text-blue-600 text-xs sm:text-sm font-medium hover:underline">
                Launch Seat Finder →
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-1">📅 Events & Seating</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-4">Select an event to view, manage, or configure its dedicated seating map.</p>
              <button onClick={() => navigate('/events')} className="text-green-600 text-xs sm:text-sm font-medium hover:underline">
                Open Events List →
              </button>
            </div>
          </div>
        </>
      )}

      {/* QR Code Modal */}
      {selectedQrEvent && (
        <QrCodeModal
          event={selectedQrEvent}
          onClose={() => setSelectedQrEvent(null)}
        />
      )}

      {/* Admin Bookings Overview Modal */}
      {selectedBookingsEvent && (
        <AdminBookingsModal
          event={selectedBookingsEvent}
          onClose={() => setSelectedBookingsEvent(null)}
          onRefresh={() => fetchAll()}
        />
      )}
    </div>
  );
}
