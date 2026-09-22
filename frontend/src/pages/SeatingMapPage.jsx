import React, { useState } from 'react';
import { useSeating } from '../context/SeatingContext';
import { useAuth } from '../context/AuthContext';
import SeatDetailsModal from '../components/seating/SeatDetailsModal';
import API from '../api/api';

const STATUS_STYLES = {
  available: 'bg-green-400 hover:bg-green-500 text-white cursor-pointer',
  occupied:  'bg-red-500 hover:bg-red-600 text-white cursor-pointer',
  reserved:  'bg-purple-500 hover:bg-purple-600 text-white cursor-pointer',
  held:      'bg-yellow-400 hover:bg-yellow-500 text-white cursor-pointer',
  blocked:   'bg-gray-300 text-gray-500 cursor-not-allowed',
};

const BLOCKED_ADMIN_STYLE = 'bg-gray-300 text-gray-600 border-2 border-dashed border-gray-500 cursor-pointer hover:bg-gray-400';

export default function SeatingMapPage() {
  const { seatsBySection, loading, fetchAll } = useSeating();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Section config state (admin only)
  const [showConfig, setShowConfig] = useState(false);
  const [configSection, setConfigSection] = useState('');
  const [rowCount, setRowCount] = useState(1);
  const [colCount, setColCount] = useState(1);
  const [configMsg, setConfigMsg] = useState('');
  const [configLoading, setConfigLoading] = useState(false);

  const [deleteRowCount, setDeleteRowCount] = useState(1);
  const [deleteColCount, setDeleteColCount] = useState(1);

  const sections = Object.values(seatsBySection).sort((a, b) => a.code?.localeCompare(b.code));

  const handleAddRows = async () => {
    if (!configSection) return setConfigMsg('Please select a section.');
    setConfigLoading(true); setConfigMsg('');
    try {
      const res = await API.post('/seats/add-rows', { sectionCode: configSection, count: Number(rowCount) });
      setConfigMsg('✅ ' + res.data.message);
      fetchAll();
    } catch (e) {
      setConfigMsg('❌ ' + (e.response?.data?.message || e.message));
    } finally { setConfigLoading(false); }
  };

  const handleAddColumns = async () => {
    if (!configSection) return setConfigMsg('Please select a section.');
    setConfigLoading(true); setConfigMsg('');
    try {
      const res = await API.post('/seats/add-columns', { sectionCode: configSection, count: Number(colCount) });
      setConfigMsg('✅ ' + res.data.message);
      fetchAll();
    } catch (e) {
      setConfigMsg('❌ ' + (e.response?.data?.message || e.message));
    } finally { setConfigLoading(false); }
  };

  const handleDeleteRows = async () => {
    if (!configSection) return setConfigMsg('Please select a section.');
    if (!window.confirm(`Are you sure you want to delete the last ${deleteRowCount} row(s) from ${configSection}?`)) return;
    setConfigLoading(true); setConfigMsg('');
    try {
      const res = await API.post('/seats/delete-rows', { sectionCode: configSection, count: Number(deleteRowCount) });
      setConfigMsg('✅ ' + res.data.message);
      fetchAll();
    } catch (e) {
      setConfigMsg('❌ ' + (e.response?.data?.message || e.message));
    } finally { setConfigLoading(false); }
  };

  const handleDeleteColumns = async () => {
    if (!configSection) return setConfigMsg('Please select a section.');
    if (!window.confirm(`Are you sure you want to delete the last ${deleteColCount} seat(s) from each row in ${configSection}?`)) return;
    setConfigLoading(true); setConfigMsg('');
    try {
      const res = await API.post('/seats/delete-columns', { sectionCode: configSection, count: Number(deleteColCount) });
      setConfigMsg('✅ ' + res.data.message);
      fetchAll();
    } catch (e) {
      setConfigMsg('❌ ' + (e.response?.data?.message || e.message));
    } finally { setConfigLoading(false); }
  };

  const selectedSectionInfo = configSection ? seatsBySection[configSection] : null;
  const sectionRowCount = selectedSectionInfo ? Object.keys(selectedSectionInfo.rows).length : 0;
  const sectionColCount = selectedSectionInfo
    ? Math.max(...Object.values(selectedSectionInfo.rows).map(r => r.length))
    : 0;


  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Live Interactive Seating Map</h1>
            <p className="text-sm text-gray-500 mt-1">Click any seat to assign, hold, or update its status.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowConfig(!showConfig); setConfigMsg(''); }}
              className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ' +
                (showConfig ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50')}
            >
              ⚙ Configure Sections
            </button>
          )}
        </div>
      </div>

      {/* Admin — Section Configuration Panel */}
      {isAdmin && showConfig && (
        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            <h2 className="font-semibold text-gray-900">Section Configuration</h2>
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Admin Only</span>
          </div>

          {/* Section Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Select Section</label>
            <select
              value={configSection}
              onChange={e => { setConfigSection(e.target.value); setConfigMsg(''); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72"
            >
              <option value="">— Choose a section —</option>
              {sections.map(s => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
            {selectedSectionInfo && (
              <p className="mt-1 text-xs text-gray-400">
                Current: <strong>{sectionRowCount} rows</strong> × <strong>{sectionColCount} seats per row</strong> = {sectionRowCount * sectionColCount} total seats
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Add Rows */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">➕ Add Rows</h3>
              <p className="text-xs text-blue-600 mb-3">Adds new rows at the bottom of the section with the same seat width.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="10" value={rowCount}
                  onChange={e => setRowCount(e.target.value)}
                  className="w-20 border border-blue-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-blue-600">row(s)</span>
                <button
                  onClick={handleAddRows}
                  disabled={configLoading || !configSection}
                  className="ml-auto bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {configLoading ? 'Adding...' : 'Add Rows'}
                </button>
              </div>
            </div>

            {/* Add Columns */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-2">➕ Add Seats per Row</h3>
              <p className="text-xs text-green-600 mb-3">Extends every existing row in the section with additional seats.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="20" value={colCount}
                  onChange={e => setColCount(e.target.value)}
                  className="w-20 border border-green-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs text-green-600">seat(s)/row</span>
                <button
                  onClick={handleAddColumns}
                  disabled={configLoading || !configSection}
                  className="ml-auto bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {configLoading ? 'Adding...' : 'Add Seats'}
                </button>
              </div>
            </div>

            {/* Delete Rows */}
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-rose-800 mb-2">➖ Delete Rows</h3>
              <p className="text-xs text-rose-600 mb-3">Deletes the last N rows from this section (cannot delete occupied seats).</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max={Math.max(1, sectionRowCount - 1)} value={deleteRowCount}
                  onChange={e => setDeleteRowCount(e.target.value)}
                  className="w-20 border border-rose-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <span className="text-xs text-rose-600">row(s)</span>
                <button
                  onClick={handleDeleteRows}
                  disabled={configLoading || !configSection}
                  className="ml-auto bg-rose-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
                >
                  {configLoading ? 'Deleting...' : 'Delete Rows'}
                </button>
              </div>
            </div>

            {/* Delete Columns */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">➖ Delete Seats per Row</h3>
              <p className="text-xs text-amber-600 mb-3">Removes the last N seats from each row in this section (cannot delete occupied seats).</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max={Math.max(1, sectionColCount - 1)} value={deleteColCount}
                  onChange={e => setDeleteColCount(e.target.value)}
                  className="w-20 border border-amber-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-600">seat(s)/row</span>
                <button
                  onClick={handleDeleteColumns}
                  disabled={configLoading || !configSection}
                  className="ml-auto bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {configLoading ? 'Deleting...' : 'Delete Seats'}
                </button>
              </div>
            </div>
          </div>

          {/* Feedback message */}
          {configMsg && (
            <div className={'rounded-xl px-4 py-2 text-sm font-medium ' +
              (configMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
              {configMsg}
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search section, row or seat..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="flex gap-2 flex-wrap">
          {['all', 'available', 'occupied', 'reserved', 'held', 'blocked'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ' +
                (filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={fetchAll} className="ml-auto text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">↻ Refresh</button>
      </div>

      <div className="bg-blue-600 rounded-2xl p-3 text-center text-white font-semibold text-sm tracking-widest">
        ● STAGE / ALTAR / PULPIT ●
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading seats...</div>
      ) : (
        sections.map(section => {
          const rows = Object.keys(section.rows).sort();
          return (
            <div key={section.code} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h2 className="font-semibold text-gray-900">{section.name}</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{section.code}</span>
                <span className="ml-auto text-xs text-gray-400">{rows.length} Rows</span>
              </div>
              <div className="space-y-2">
                {rows.map(row => {
                  const rowSeats = section.rows[row].filter(s => {
                    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
                    const matchSearch = !search || s.row.toLowerCase().includes(search.toLowerCase()) ||
                      String(s.number).includes(search) || s.section.toLowerCase().includes(search.toLowerCase());
                    return matchStatus && matchSearch;
                  }).sort((a, b) => a.number - b.number);
                  if (!rowSeats.length) return null;
                  return (
                    <div key={row} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12 shrink-0">Row {row}</span>
                      <div className="flex flex-wrap gap-1">
                        {rowSeats.map(seat => {
                            const isBlocked = seat.status === 'blocked';
                            const canClick = !isBlocked || isAdmin;
                            const seatStyle = isBlocked && isAdmin
                              ? BLOCKED_ADMIN_STYLE
                              : (STATUS_STYLES[seat.status] || STATUS_STYLES.available);
                            return (
                              <button key={seat.seatId}
                                onClick={() => canClick && setSelectedSeat(seat)}
                                className={'w-7 h-7 rounded text-xs font-medium transition-all ' + seatStyle}
                                title={
                                  seat.section + ' Row ' + seat.row + ' #' + seat.number +
                                  ' — ' + seat.status +
                                  (isBlocked && isAdmin ? ' (click to unblock)' : '') +
                                  (isBlocked && !isAdmin ? ' (admin only)' : '')
                                }>
                                {seat.number}
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
        })
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 justify-center">
          {Object.entries(STATUS_STYLES).map(([status, cls]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={'w-5 h-5 rounded ' + cls.split(' ')[0]}></div>
              <span className="text-xs text-gray-600 capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedSeat && <SeatDetailsModal seat={selectedSeat} onClose={() => setSelectedSeat(null)} />}
    </div>
  );
}
