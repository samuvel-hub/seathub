'use client';

import React, { useState } from 'react';
import { useSeating } from '@/context/SeatingContext';
import { SeatType } from '@/types/database';
import { Plus, Grid, Layers, ShieldAlert, Check } from 'lucide-react';

export const SeatingConfigEditor: React.FC = () => {
  const { auditorium, sections, rows, seats, addSection, addRow, addSeat, blockSeats, unblockSeats } = useSeating();

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || '');
  const [newSecName, setNewSecName] = useState('');
  const [newSecCode, setNewSecCode] = useState('');
  const [newSecColor, setNewSecColor] = useState('#2563eb');
  const [showAddSec, setShowAddSec] = useState(false);

  const [newRowName, setNewRowName] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);

  const [newSeatCount] = useState<number>(10);
  const [newSeatType, setNewSeatType] = useState<SeatType>('standard');

  const currentSection = sections.find((s) => s.id === activeSectionId) || sections[0];
  const sectionRows = rows.filter((r) => r.section_id === currentSection?.id);

  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecName || !newSecCode) return;
    addSection(newSecName, newSecCode, newSecColor);
    setNewSecName('');
    setNewSecCode('');
    setShowAddSec(false);
  };

  const handleCreateRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRowName || !currentSection) return;
    addRow(currentSection.id, newRowName);
    setNewRowName('');
    setShowAddRow(false);
  };

  const handleBulkAddSeats = (rowId: string) => {
    const existingSeats = seats.filter((s) => s.row_id === rowId);
    const startNum = existingSeats.length + 1;
    for (let i = 0; i < newSeatCount; i++) {
      addSeat(rowId, startNum + i, newSeatType);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Grid className="w-5 h-5 text-blue-600" />
            <span>Auditorium Layout Builder</span>
          </h1>
          <p className="text-xs text-slate-500">
            {auditorium.name} ({seats.length} total active seats configured across {sections.length} sections)
          </p>
        </div>

        <button
          onClick={() => setShowAddSec(true)}
          className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center space-x-2 shadow-md shadow-blue-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Section</span>
        </button>
      </div>

      {/* Add Section Form Panel */}
      {showAddSec && (
        <form onSubmit={handleCreateSection} className="bg-white border border-blue-200 rounded-2xl p-4 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Create New Section</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Section Name (e.g. Balcony Left)"
              value={newSecName}
              onChange={(e) => setNewSecName(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
            />
            <input
              type="text"
              placeholder="Code (e.g. SEC-E)"
              value={newSecCode}
              onChange={(e) => setNewSecCode(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900"
            />
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={newSecColor}
                onChange={(e) => setNewSecColor(e.target.value)}
                className="w-10 h-9 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
              />
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg"
              >
                Save Section
              </button>
              <button
                type="button"
                onClick={() => setShowAddSec(false)}
                className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Section Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSectionId(sec.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 ${
              currentSection?.id === sec.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }} />
            <span>{sec.name}</span>
          </button>
        ))}
      </div>

      {/* Active Section Rows Configuration */}
      {currentSection && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{currentSection.name} ({currentSection.code})</h2>
              <p className="text-xs text-slate-500">Configure rows and seats in this section</p>
            </div>

            <button
              onClick={() => setShowAddRow(true)}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>

          {showAddRow && (
            <form onSubmit={handleCreateRow} className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <input
                type="text"
                placeholder="Row Name (e.g. Row M)"
                value={newRowName}
                onChange={(e) => setNewRowName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900"
              />
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg">
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddRow(false)}
                className="px-3 py-2 bg-slate-200 text-slate-700 text-xs rounded-lg"
              >
                Cancel
              </button>
            </form>
          )}

          {/* Rows List */}
          <div className="space-y-4">
            {sectionRows.map((row) => {
              const rowSeats = seats.filter((s) => s.row_id === row.id);

              return (
                <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-slate-900 text-sm font-mono">{row.row_name}</span>
                      <span className="text-xs text-slate-500 font-semibold">({rowSeats.length} seats)</span>
                    </div>

                    {/* Bulk Add Seats Button */}
                    <div className="flex items-center space-x-2">
                      <select
                        value={newSeatType}
                        onChange={(e) => setNewSeatType(e.target.value as SeatType)}
                        className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-800 font-medium"
                      >
                        <option value="standard">Standard</option>
                        <option value="vip">VIP</option>
                        <option value="accessible">Accessible</option>
                        <option value="companion">Companion</option>
                      </select>
                      <button
                        onClick={() => handleBulkAddSeats(row.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add 10 Seats</span>
                      </button>
                    </div>
                  </div>

                  {/* Seat Grid Preview */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {rowSeats.map((st) => (
                      <div
                        key={`${st.id}-${st.seat_number}`}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center space-x-1 ${
                          st.is_blocked
                            ? 'bg-slate-200 text-slate-400 border-slate-300'
                            : st.seat_type === 'vip'
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : st.seat_type === 'accessible'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-white text-slate-800 border-slate-200 shadow-sm'
                        }`}
                      >
                        <span>{st.seat_number}</span>
                        <button
                          onClick={() => (st.is_blocked ? unblockSeats([st.id]) : blockSeats([st.id]))}
                          className="hover:text-rose-600 ml-1 text-[10px]"
                          title={st.is_blocked ? 'Unblock Seat' : 'Block Seat'}
                        >
                          {st.is_blocked ? <Check className="w-3 h-3 text-emerald-600" /> : <ShieldAlert className="w-3 h-3 text-rose-600" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
};
