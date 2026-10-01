import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSeating } from '../context/SeatingContext';
import { useAuth } from '../context/AuthContext';
import DynamicSeatingMap from '../components/seating/DynamicSeatingMap';
import SeatDetailsModal from '../components/seating/SeatDetailsModal';
import API from '../api/api';

const STATUS_COLORS = {
  available: 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer shadow-xs',
  occupied:  'bg-red-500 hover:bg-red-600 text-white cursor-pointer shadow-xs',
  reserved:  'bg-purple-500 hover:bg-purple-600 text-white cursor-pointer shadow-xs',
  held:      'bg-amber-400 hover:bg-amber-500 text-white cursor-pointer shadow-xs',
  blocked:   'bg-gray-300 text-gray-600 hover:bg-gray-400 cursor-pointer',
};

export default function SeatingMapPage() {
  const { eventId: paramEventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { fetchSeatsForEvent } = useSeating();

  const [currentEvent, setCurrentEvent] = useState(null);
  const [localSeats, setLocalSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'preview'

  // Editable Layout State
  const [localLayoutType, setLocalLayoutType] = useState('standard');
  const [localStageLabel, setLocalStageLabel] = useState('▲ STAGE / PODIUM ▲');
  const [localConfig, setLocalConfig] = useState({ rows: [] });

  // Selected Seat & Objects
  const [selectedSeatForModal, setSelectedSeatForModal] = useState(null);

  // Status & Feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Booked Seat Warning Modal
  const [bookedSeatWarning, setBookedSeatWarning] = useState(null);

  // Section-Based Modals
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionForm, setNewSectionForm] = useState({ name: 'Left Section', rows: 4, seatsPerRow: 6 });
  const [editingSectionIndex, setEditingSectionIndex] = useState(null);
  const [editSectionForm, setEditSectionForm] = useState({ name: '', rows: 5, seatsPerRow: 10 });

  const effectiveEventId = paramEventId || currentEvent?._id;

  // Helper to load event & seats
  const loadEventAndSeats = async () => {
    if (!paramEventId) return;
    setLoading(true);
    try {
      const evRes = await API.get(`/events/${paramEventId}`);
      const ev = evRes.data;
      setCurrentEvent(ev);

      const rawType = ev.seatingLayoutType === 'section_based' ? 'section_based' : 'standard';
      setLocalLayoutType(rawType);
      setLocalStageLabel(ev.stageLabel || ev.seatingLayoutConfig?.stageLabel || '▲ STAGE / PODIUM ▲');

      const seatsRes = await API.get(`/seats/${ev.eventId || ev._id}`);
      const fetchedSeats = seatsRes.data || [];
      setLocalSeats(fetchedSeats);

      // Initialize config
      if (ev.seatingLayoutConfig && Object.keys(ev.seatingLayoutConfig).length > 0) {
        const cfg = JSON.parse(JSON.stringify(ev.seatingLayoutConfig));
        // If section_based but sections missing, set default LEFT, CENTER, RIGHT
        if (rawType === 'section_based' && (!cfg.sections || cfg.sections.length === 0)) {
          cfg.sections = [
            {
              id: 'sec-left',
              name: 'Left Section',
              code: 'LEFT',
              rows: ['A', 'B', 'C'].map((r) => ({ row: r, seatsPerRow: 4 })),
            },
            {
              id: 'sec-center',
              name: 'Center Section',
              code: 'CENTER',
              rows: ['A', 'B', 'C'].map((r) => ({ row: r, seatsPerRow: 8 })),
            },
            {
              id: 'sec-right',
              name: 'Right Section',
              code: 'RIGHT',
              rows: ['A', 'B', 'C'].map((r) => ({ row: r, seatsPerRow: 4 })),
            },
          ];
        }
        setLocalConfig(cfg);
      } else {
        // Derive initial defaults based on type
        if (rawType === 'section_based') {
          // Default Section-Based Layout uses LEFT, CENTER, RIGHT
          setLocalConfig({
            stageLabel: ev.stageLabel || 'STAGE / PODIUM',
            sections: [
              {
                id: 'sec-left',
                name: 'Left Section',
                code: 'LEFT',
                rows: ['A', 'B', 'C'].map((r) => ({ row: r, seatsPerRow: 4 })),
              },
              {
                id: 'sec-center',
                name: 'Center Section',
                code: 'CENTER',
                rows: ['A', 'B', 'C'].map((r) => ({ row: r, seatsPerRow: 8 })),
              },
              {
                id: 'sec-right',
                name: 'Right Section',
                code: 'RIGHT',
                rows: ['A', 'B', 'C'].map((r) => ({ row: r, seatsPerRow: 4 })),
              },
            ],
          });
        } else {
          // Standard
          const distinctRows = Array.from(new Set(fetchedSeats.map((s) => s.row || 'A'))).sort();
          if (distinctRows.length > 0) {
            setLocalConfig({
              stageLabel: ev.stageLabel || 'STAGE / PODIUM',
              rows: distinctRows.map((r) => ({
                row: r,
                seatsPerRow: fetchedSeats.filter((s) => s.row === r).length || 10,
              })),
            });
          } else {
            setLocalConfig({
              stageLabel: ev.stageLabel || 'STAGE / PODIUM',
              rows: [
                { row: 'A', seatsPerRow: 10 },
                { row: 'B', seatsPerRow: 10 },
                { row: 'C', seatsPerRow: 10 },
                { row: 'D', seatsPerRow: 10 },
              ],
            });
          }
        }
      }
    } catch (err) {
      console.error('Error loading event layout:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventAndSeats();
  }, [paramEventId]);

  // Map of existing seats by Seat Number
  const liveSeatMap = useMemo(() => {
    const map = new Map();
    localSeats.forEach((s) => {
      const key = (s.seatNo || `${s.row}${s.number}`).toUpperCase();
      map.set(key, s);
      if (s.seatId) map.set(s.seatId.toUpperCase(), s);
    });
    return map;
  }, [localSeats]);

  // Helper: check if a seat is currently booked
  const isSeatBooked = (seatNo) => {
    const s = liveSeatMap.get(seatNo?.toUpperCase());
    return s && (s.status === 'occupied' || s.status === 'reserved');
  };

  // Helper: check if any seat in a list is booked
  const getBookedSeatsInList = (seatNos) => {
    const booked = [];
    seatNos.forEach((sNo) => {
      const s = liveSeatMap.get(sNo?.toUpperCase());
      if (s && (s.status === 'occupied' || s.status === 'reserved')) {
        booked.push({ seatNo: s.seatNo, name: s.assignedName, status: s.status });
      }
    });
    return booked;
  };

  // Helper to generate next available letter row
  const getNextRowLetter = (existingLetters) => {
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i);
      if (!existingLetters.includes(char)) return char;
    }
    return `R${existingLetters.length + 1}`;
  };

  // =============================================================
  // 1. STANDARD ROW & COLUMN OPERATIONS (Unchanged)
  // =============================================================
  const handleAddRowStandard = () => {
    const existingRowLetters = (localConfig.rows || []).map((r) => r.row);
    const nextLetter = getNextRowLetter(existingRowLetters);
    const updatedRows = [...(localConfig.rows || []), { row: nextLetter, seatsPerRow: 10 }];
    setLocalConfig({ ...localConfig, rows: updatedRows });
  };

  const handleDeleteRowStandard = (rowIndex, rowLetter) => {
    const count = localConfig.rows[rowIndex]?.seatsPerRow || 10;
    const seatNos = [];
    for (let n = 1; n <= count; n++) seatNos.push(`${rowLetter}${n}`);

    const booked = getBookedSeatsInList(seatNos);
    if (booked.length > 0) {
      setBookedSeatWarning({
        message: 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
        affectedSeats: booked,
        onConfirm: () => {
          const updated = localConfig.rows.filter((_, idx) => idx !== rowIndex);
          setLocalConfig({ ...localConfig, rows: updated });
        },
      });
      return;
    }

    const updated = localConfig.rows.filter((_, idx) => idx !== rowIndex);
    setLocalConfig({ ...localConfig, rows: updated });
  };

  const handleCopyRowStandard = (rowIndex) => {
    const sourceRow = localConfig.rows[rowIndex];
    if (!sourceRow) return;

    const existingRowLetters = (localConfig.rows || []).map((r) => r.row);
    const nextLetter = getNextRowLetter(existingRowLetters);

    const newRow = { row: nextLetter, seatsPerRow: sourceRow.seatsPerRow || 10 };
    const updated = [...localConfig.rows];
    updated.splice(rowIndex + 1, 0, newRow);
    setLocalConfig({ ...localConfig, rows: updated });
    setActionMsg(`✓ Duplicated Row ${sourceRow.row} → Row ${nextLetter} with ${newRow.seatsPerRow} seats`);
  };

  const handleUpdateRowSeatsCount = (rowIndex, newCount) => {
    const count = Math.max(1, Math.min(100, Number(newCount) || 1));
    const targetRow = localConfig.rows[rowIndex];
    if (!targetRow) return;

    if (count < targetRow.seatsPerRow) {
      const removedSeatNos = [];
      for (let n = count + 1; n <= targetRow.seatsPerRow; n++) {
        removedSeatNos.push(`${targetRow.row}${n}`);
      }
      const booked = getBookedSeatsInList(removedSeatNos);
      if (booked.length > 0) {
        setBookedSeatWarning({
          message: 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
          affectedSeats: booked,
          onConfirm: () => {
            const updated = [...localConfig.rows];
            updated[rowIndex] = { ...targetRow, seatsPerRow: count };
            setLocalConfig({ ...localConfig, rows: updated });
          },
        });
        return;
      }
    }

    const updated = [...localConfig.rows];
    updated[rowIndex] = { ...targetRow, seatsPerRow: count };
    setLocalConfig({ ...localConfig, rows: updated });
  };

  const handleRenameRowStandard = (rowIndex, newLetter) => {
    const clean = newLetter.trim().toUpperCase();
    if (!clean) return;
    const targetRow = localConfig.rows[rowIndex];
    if (!targetRow) return;

    const seatNos = [];
    for (let n = 1; n <= (targetRow.seatsPerRow || 10); n++) {
      seatNos.push(`${targetRow.row}${n}`);
    }
    const booked = getBookedSeatsInList(seatNos);
    if (booked.length > 0) {
      setBookedSeatWarning({
        message: 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
        affectedSeats: booked,
        onConfirm: () => {
          const updated = [...localConfig.rows];
          updated[rowIndex] = { ...targetRow, row: clean };
          setLocalConfig({ ...localConfig, rows: updated });
        },
      });
      return;
    }

    const updated = [...localConfig.rows];
    updated[rowIndex] = { ...targetRow, row: clean };
    setLocalConfig({ ...localConfig, rows: updated });
  };

  // =============================================================
  // 2. SIMPLIFIED SECTION-BASED LAYOUT OPERATIONS
  // =============================================================
  const handleOpenAddSectionModal = () => {
    const secCount = (localConfig.sections || []).length + 1;
    setNewSectionForm({
      name: secCount === 1 ? 'Main Floor' : secCount === 2 ? 'VIP' : `Section ${secCount}`,
      rows: 5,
      seatsPerRow: 10,
    });
    setShowAddSectionModal(true);
  };

  const handleCreateSectionSubmit = (e) => {
    e.preventDefault();
    const name = newSectionForm.name.trim() || 'Main Floor';
    const numRows = Math.max(1, Math.min(26, Number(newSectionForm.rows) || 1));
    const seatsPerRow = Math.max(1, Math.min(50, Number(newSectionForm.seatsPerRow) || 1));

    // Generate clean section code (e.g. MAIN, VIP, BALCONY)
    const code = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || `SEC${(localConfig.sections || []).length + 1}`;

    const rows = [];
    for (let i = 0; i < numRows; i++) {
      rows.push({
        row: String.fromCharCode(65 + i),
        seatsPerRow,
      });
    }

    const newSec = {
      id: `sec-${Date.now()}`,
      name,
      code,
      rows,
    };

    setLocalConfig({
      ...localConfig,
      sections: [...(localConfig.sections || []), newSec],
    });
    setShowAddSectionModal(false);
    setActionMsg(`✓ Created section "${name}" with ${numRows} rows × ${seatsPerRow} seats`);
  };

  const handleOpenEditSection = (secIndex) => {
    const sec = localConfig.sections[secIndex];
    if (!sec) return;
    setEditingSectionIndex(secIndex);
    setEditSectionForm({
      name: sec.name,
      rows: sec.rows?.length || 5,
      seatsPerRow: sec.rows?.[0]?.seatsPerRow || 10,
    });
  };

  const handleSaveEditSectionSubmit = (e) => {
    e.preventDefault();
    if (editingSectionIndex === null) return;
    const sec = localConfig.sections[editingSectionIndex];
    if (!sec) return;

    const newName = editSectionForm.name.trim() || sec.name;
    const newRowCount = Math.max(1, Math.min(26, Number(editSectionForm.rows) || 1));
    const newSeatsPerRow = Math.max(1, Math.min(50, Number(editSectionForm.seatsPerRow) || 1));

    // Check if decreasing rows or seats affects existing booked seats
    const existingRows = sec.rows || [];
    const removedSeatNos = [];

    // If rows decreased
    if (newRowCount < existingRows.length) {
      for (let rIdx = newRowCount; rIdx < existingRows.length; rIdx++) {
        const r = existingRows[rIdx];
        for (let n = 1; n <= r.seatsPerRow; n++) {
          removedSeatNos.push(`${sec.code}-${r.row}${n}`);
        }
      }
    }
    // If seats per row decreased
    if (newSeatsPerRow < (existingRows[0]?.seatsPerRow || 10)) {
      for (let rIdx = 0; rIdx < Math.min(newRowCount, existingRows.length); rIdx++) {
        const r = existingRows[rIdx];
        for (let n = newSeatsPerRow + 1; n <= r.seatsPerRow; n++) {
          removedSeatNos.push(`${sec.code}-${r.row}${n}`);
        }
      }
    }

    const booked = getBookedSeatsInList(removedSeatNos);
    if (booked.length > 0) {
      setBookedSeatWarning({
        message: 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
        affectedSeats: booked,
        onConfirm: () => {
          applySectionEdit(editingSectionIndex, newName, newRowCount, newSeatsPerRow);
        },
      });
      return;
    }

    applySectionEdit(editingSectionIndex, newName, newRowCount, newSeatsPerRow);
  };

  const applySectionEdit = (secIndex, newName, newRowCount, newSeatsPerRow) => {
    const sec = localConfig.sections[secIndex];
    const newCode = newName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || sec.code;

    const updatedRows = [];
    for (let i = 0; i < newRowCount; i++) {
      const letter = String.fromCharCode(65 + i);
      updatedRows.push({
        row: letter,
        seatsPerRow: newSeatsPerRow,
      });
    }

    const updatedSections = [...localConfig.sections];
    updatedSections[secIndex] = {
      ...sec,
      name: newName,
      code: newCode,
      rows: updatedRows,
    };

    setLocalConfig({ ...localConfig, sections: updatedSections });
    setEditingSectionIndex(null);
    setActionMsg(`✓ Updated section "${newName}"`);
  };

  const handleDuplicateSection = (secIndex) => {
    const source = localConfig.sections[secIndex];
    if (!source) return;

    const newCode = `${source.code}2`.slice(0, 6);
    const newSec = {
      id: `sec-${Date.now()}`,
      name: `${source.name} (Copy)`,
      code: newCode,
      rows: (source.rows || []).map((r) => ({ row: r.row, seatsPerRow: r.seatsPerRow })),
    };

    const updated = [...localConfig.sections];
    updated.splice(secIndex + 1, 0, newSec);
    setLocalConfig({ ...localConfig, sections: updated });
    setActionMsg(`✓ Duplicated Section "${source.name}"`);
  };

  const handleDeleteSection = (secIndex) => {
    const sec = localConfig.sections[secIndex];
    if (!sec) return;

    const seatNos = [];
    (sec.rows || []).forEach((r) => {
      for (let n = 1; n <= (r.seatsPerRow || 6); n++) {
        seatNos.push(`${sec.code}-${r.row}${n}`);
      }
    });

    const booked = getBookedSeatsInList(seatNos);
    if (booked.length > 0) {
      setBookedSeatWarning({
        message: 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
        affectedSeats: booked,
        onConfirm: () => {
          const updated = localConfig.sections.filter((_, idx) => idx !== secIndex);
          setLocalConfig({ ...localConfig, sections: updated });
        },
      });
      return;
    }

    const updated = localConfig.sections.filter((_, idx) => idx !== secIndex);
    setLocalConfig({ ...localConfig, sections: updated });
    setActionMsg(`✓ Deleted section "${sec.name}"`);
  };

  const handleAddRowToSection = (secIndex) => {
    const sec = localConfig.sections[secIndex];
    if (!sec) return;

    const existingLetters = (sec.rows || []).map((r) => r.row);
    const nextLetter = getNextRowLetter(existingLetters);
    const defaultSeats = sec.rows?.[0]?.seatsPerRow || 10;

    const newRows = [...(sec.rows || []), { row: nextLetter, seatsPerRow: defaultSeats }];
    const updatedSecs = [...localConfig.sections];
    updatedSecs[secIndex] = { ...sec, rows: newRows };
    setLocalConfig({ ...localConfig, sections: updatedSecs });
    setActionMsg(`✓ Added Row ${nextLetter} to ${sec.name}`);
  };

  const handleDeleteRowFromSection = (secIndex, rowIndex) => {
    const sec = localConfig.sections[secIndex];
    if (!sec) return;
    const r = sec.rows[rowIndex];
    if (!r) return;

    const seatNos = [];
    for (let n = 1; n <= (r.seatsPerRow || 6); n++) {
      seatNos.push(`${sec.code}-${r.row}${n}`);
    }

    const booked = getBookedSeatsInList(seatNos);
    if (booked.length > 0) {
      setBookedSeatWarning({
        message: 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
        affectedSeats: booked,
        onConfirm: () => {
          const newRows = sec.rows.filter((_, idx) => idx !== rowIndex);
          const updatedSecs = [...localConfig.sections];
          updatedSecs[secIndex] = { ...sec, rows: newRows };
          setLocalConfig({ ...localConfig, sections: updatedSecs });
        },
      });
      return;
    }

    const newRows = sec.rows.filter((_, idx) => idx !== rowIndex);
    const updatedSecs = [...localConfig.sections];
    updatedSecs[secIndex] = { ...sec, rows: newRows };
    setLocalConfig({ ...localConfig, sections: updatedSecs });
  };

  const handleCopyRowInSection = (secIndex, rowIndex) => {
    const sec = localConfig.sections[secIndex];
    if (!sec) return;
    const sourceRow = sec.rows[rowIndex];
    if (!sourceRow) return;

    const existingLetters = (sec.rows || []).map((r) => r.row);
    const nextLetter = getNextRowLetter(existingLetters);

    const newRow = { row: nextLetter, seatsPerRow: sourceRow.seatsPerRow || 10 };
    const newRows = [...sec.rows];
    newRows.splice(rowIndex + 1, 0, newRow);
    const updatedSecs = [...localConfig.sections];
    updatedSecs[secIndex] = { ...sec, rows: newRows };
    setLocalConfig({ ...localConfig, sections: updatedSecs });
    setActionMsg(`✓ Copied Row ${sourceRow.row} → Row ${nextLetter}`);
  };

  const handleUpdateRowSeatsCountInSection = (secIndex, rowIndex, newCount) => {
    const count = Math.max(1, Math.min(100, Number(newCount) || 1));
    const sec = localConfig.sections[secIndex];
    if (!sec) return;
    const targetRow = sec.rows[rowIndex];
    if (!targetRow) return;

    if (count < (targetRow.seatsPerRow || 10)) {
      const removedSeatNos = [];
      for (let n = count + 1; n <= (targetRow.seatsPerRow || 10); n++) {
        removedSeatNos.push(`${sec.code}-${targetRow.row}${n}`);
      }
      const booked = getBookedSeatsInList(removedSeatNos);
      if (booked.length > 0) {
        setBookedSeatWarning({
          message: 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
          affectedSeats: booked,
          onConfirm: () => {
            const updatedRows = [...sec.rows];
            updatedRows[rowIndex] = { ...targetRow, seatsPerRow: count };
            const updatedSecs = [...localConfig.sections];
            updatedSecs[secIndex] = { ...sec, rows: updatedRows };
            setLocalConfig({ ...localConfig, sections: updatedSecs });
          },
        });
        return;
      }
    }

    const updatedRows = [...sec.rows];
    updatedRows[rowIndex] = { ...targetRow, seatsPerRow: count };
    const updatedSecs = [...localConfig.sections];
    updatedSecs[secIndex] = { ...sec, rows: updatedRows };
    setLocalConfig({ ...localConfig, sections: updatedSecs });
  };


  // =============================================================
  // SAVE LAYOUT (Preserves exact layout for Admin and Guest)
  // =============================================================
  const handleSaveLayout = async (force = false) => {
    setActionLoading(true);
    setActionMsg('');

    const generatedSeats = [];

    if (localLayoutType === 'section_based') {
      for (const sec of localConfig.sections || []) {
        for (const r of sec.rows || []) {
          const actualSeatsInSecRow = localSeats.filter(
            (s) =>
              (s.sectionCode === sec.code || s.section === sec.name) &&
              (s.row || 'A') === r.row
          );
          const maxNumInDb = actualSeatsInSecRow.reduce(
            (max, s) => Math.max(max, s.number || 0),
            0
          );
          const count = Math.max(r.seatsPerRow || 0, maxNumInDb, 1);
          for (let n = 1; n <= count; n++) {
            const sNo = `${sec.code}-${r.row}${n}`;
            const existing = liveSeatMap.get(sNo.toUpperCase()) || liveSeatMap.get(`${r.row}${n}`);
            generatedSeats.push({
              seatId: `${sec.code}-${r.row}-${n}`,
              seatNo: sNo,
              section: sec.name,
              sectionCode: sec.code,
              row: r.row,
              number: n,
              category: existing?.category || 'general',
              status: existing?.status || 'available',
              assignedName: existing?.assignedName,
              bookingId: existing?.bookingId,
            });
          }
        }
      }
    } else {
      // Standard Row & Column
      for (const r of localConfig.rows || []) {
        const count = r.seatsPerRow || 10;
        for (let n = 1; n <= count; n++) {
          const sNo = `${r.row}${n}`;
          const existing = liveSeatMap.get(sNo.toUpperCase());
          generatedSeats.push({
            seatId: `SEC-A-${r.row}-${n}`,
            seatNo: sNo,
            section: 'Main Floor',
            sectionCode: 'MAIN',
            row: r.row,
            number: n,
            category: existing?.category || 'general',
            status: existing?.status || 'available',
            assignedName: existing?.assignedName,
            bookingId: existing?.bookingId,
          });
        }
      }
    }

    try {
      const payloadConfig = {
        ...localConfig,
        stageLabel: localStageLabel,
      };

      const res = await API.put(`/events/${effectiveEventId}/layout`, {
        seatingLayoutType: localLayoutType,
        seatingLayoutConfig: payloadConfig,
        stageLabel: localStageLabel,
        seats: generatedSeats,
        force,
      });

      setActionMsg('✓ Seating layout and seats saved successfully!');
      if (res.data.event) setCurrentEvent(res.data.event);
      if (res.data.seats) setLocalSeats(res.data.seats);
      await fetchSeatsForEvent(effectiveEventId);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.warning) {
        setBookedSeatWarning({
          message: err.response.data.message || 'Warning:\nThis seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
          affectedSeats: err.response.data.bookedSeats || [],
          onConfirm: () => handleSaveLayout(true),
        });
      } else {
        alert(err.response?.data?.message || err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium text-sm">Loading event seating layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Event Banner */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/events')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              ← Back to Events
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold">
              {currentEvent?.category || 'General'}
            </span>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-mono font-medium">
              {currentEvent?.eventId || 'EVENT'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {currentEvent?.name || 'Seating Configuration'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Layout: <span className="font-semibold text-gray-800 capitalize">{localLayoutType.replace('_', ' ')}</span> · Single source of truth for Admin and Guests.
          </p>
        </div>

        {/* Tab Selector & Save Layout Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-gray-100 p-1 rounded-2xl flex items-center text-xs font-bold">
            <button
              onClick={() => setActiveTab('editor')}
              className={
                'px-3.5 py-1.5 rounded-xl transition cursor-pointer ' +
                (activeTab === 'editor'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900')
              }
            >
              🛠️ Seating Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={
                'px-3.5 py-1.5 rounded-xl transition cursor-pointer ' +
                (activeTab === 'preview'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900')
              }
            >
              👁️ Guest Live Preview
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => handleSaveLayout(false)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-2xl transition shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {actionLoading ? 'Saving...' : '💾 Save Layout'}
            </button>
          )}

          <button
            onClick={() => loadEventAndSeats()}
            className="border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs px-3 py-2 rounded-2xl transition cursor-pointer"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold px-4 py-3 rounded-2xl flex items-center justify-between animate-in fade-in">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-600 hover:text-emerald-900 text-lg leading-none cursor-pointer">&times;</button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: GUEST LIVE PREVIEW                                 */}
      {/* ========================================================= */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-center justify-between text-xs text-blue-800">
            <div>
              <span className="font-bold block">Guest Live Preview Mode</span>
              <span>This renders your saved seating layout using the exact same DynamicSeatingMap component that guests see.</span>
            </div>
            <span className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg text-[11px]">
              Exact Guest View
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <DynamicSeatingMap
              event={{
                ...currentEvent,
                seatingLayoutType: localLayoutType,
                stageLabel: localStageLabel,
                seatingLayoutConfig: localConfig,
              }}
              seats={localSeats}
              isPreview={true}
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SEATING LAYOUT EDITOR                              */}
      {/* ========================================================= */}
      {activeTab === 'editor' && (
        <div className="space-y-6">
          {/* Layout Controls Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-xs font-bold text-gray-700 whitespace-nowrap">Stage / Front Label:</label>
              <input
                type="text"
                value={localStageLabel}
                onChange={(e) => setLocalStageLabel(e.target.value)}
                placeholder="e.g. ▲ STAGE / PODIUM ▲"
                className="w-full max-w-xs border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-medium">Layout Type:</span>
                <select
                  value={localLayoutType}
                  onChange={(e) => setLocalLayoutType(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="standard">1. Standard Row & Column</option>
                  <option value="section_based">2. Section-Based Layout (Left / Center / Right)</option>
                </select>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 1. STANDARD ROW & COLUMN EDITOR                               */}
          {/* ------------------------------------------------------------- */}
          {localLayoutType === 'standard' && (
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Standard Row & Column Editor</h3>
                  <p className="text-xs text-gray-500">Add, rename, copy, or delete rows. Simple uniform arrangement.</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleAddRowStandard}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-blue-200 transition cursor-pointer flex items-center gap-1"
                  >
                    + Add Row
                  </button>
                )}
              </div>

              {/* Stage Banner */}
              <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 text-white rounded-2xl py-2.5 text-center font-extrabold text-xs tracking-widest shadow-xs">
                {localStageLabel}
              </div>

              {/* Rows List */}
              <div className="space-y-4">
                {(localConfig.rows || []).map((r, rIdx) => {
                  const seatsInRow = [];
                  for (let n = 1; n <= (r.seatsPerRow || 10); n++) {
                    const sNo = `${r.row}${n}`;
                    const live = liveSeatMap.get(sNo.toUpperCase());
                    seatsInRow.push(live || { seatNo: sNo, status: 'available' });
                  }

                  return (
                    <div key={rIdx} className="p-4 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 uppercase">Row:</span>
                          <input
                            type="text"
                            maxLength={4}
                            value={r.row}
                            onChange={(e) => handleRenameRowStandard(rIdx, e.target.value)}
                            className="w-14 text-center font-black text-sm bg-white border border-gray-300 rounded-lg py-1 uppercase focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-400">({r.seatsPerRow || 10} seats)</span>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-0.5">
                              <span className="text-[11px] text-gray-500 font-medium">Seats:</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateRowSeatsCount(rIdx, (r.seatsPerRow || 10) - 1)}
                                className="w-5 h-5 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold px-1">{r.seatsPerRow || 10}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateRowSeatsCount(rIdx, (r.seatsPerRow || 10) + 1)}
                                className="w-5 h-5 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopyRowStandard(rIdx)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-indigo-200 transition cursor-pointer"
                            >
                              📋 Copy Row
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRowStandard(rIdx, r.row)}
                              className="border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                            >
                              ✕ Delete
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="overflow-x-auto pb-1">
                        <div className="flex items-center gap-2 min-w-max">
                          {seatsInRow.map((s, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => setSelectedSeatForModal(s)}
                              title={`Seat ${s.seatNo} · Status: ${s.status}`}
                              className={
                                'w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all shrink-0 ' +
                                (STATUS_COLORS[s.status] || STATUS_COLORS.available)
                              }
                            >
                              <span>{s.seatNo}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* 2. SIMPLIFIED SECTION-BASED LAYOUT BUILDER                     */}
          {/* ------------------------------------------------------------- */}
          {localLayoutType === 'section_based' && (
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Section-Based Layout Builder</h3>
                  <p className="text-xs text-gray-500">
                    Create structured sections (e.g. Main Floor, VIP, Balcony). What you see here is exactly what guests will see.
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleOpenAddSectionModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    + Add Section
                  </button>
                )}
              </div>

              {/* Stage Banner */}
              <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 text-white rounded-2xl py-2.5 text-center font-extrabold text-xs tracking-widest shadow-xs">
                {localStageLabel}
              </div>

              {/* Sections Visual Preview & Editor Cards */}
              <div className="space-y-6">
                {(localConfig.sections || []).map((sec, secIdx) => (
                  <div
                    key={sec.id || sec.code || secIdx}
                    className="border border-gray-200 rounded-3xl p-5 sm:p-6 bg-white space-y-4 shadow-xs"
                  >
                    {/* Section Header with Simple Controls: Edit, Duplicate, Delete */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <h4 className="font-extrabold text-sm sm:text-base text-gray-900 tracking-wide uppercase">
                          SECTION: {sec.name}
                        </h4>
                        {sec.code && (
                          <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                            {sec.code}
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSection(secIdx)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateSection(secIdx)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-200 cursor-pointer transition flex items-center gap-1"
                            title="Duplicate this section"
                          >
                            📋 Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(secIdx)}
                            className="border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Visual Rows in this Section */}
                    <div className="space-y-3">
                      {(sec.rows || []).map((r, rIdx) => {
                        const actualSeatsInSecRow = localSeats.filter(
                          (s) =>
                            (s.sectionCode === sec.code || s.section === sec.name) &&
                            (s.row || 'A') === r.row
                        );
                        const maxNumInDb = actualSeatsInSecRow.reduce(
                          (max, s) => Math.max(max, s.number || 0),
                          0
                        );
                        const count = Math.max(r.seatsPerRow || 0, maxNumInDb, 1);
                        const seatsInRow = [];
                        for (let n = 1; n <= count; n++) {
                          const sNoWithPrefix = `${sec.code}-${r.row}${n}`;
                          const rawSNo = `${r.row}${n}`;
                          const live = liveSeatMap.get(sNoWithPrefix.toUpperCase()) || liveSeatMap.get(rawSNo.toUpperCase());
                          seatsInRow.push(
                            live || {
                              seatNo: sNoWithPrefix,
                              row: r.row,
                              number: n,
                              status: 'available',
                            }
                          );
                        }

                        return (
                          <div key={rIdx} className="p-3 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 font-bold text-gray-700">
                                <span className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center font-bold text-[11px] text-gray-700">
                                  {r.row}
                                </span>
                                <span>Row {r.row}</span>
                                <span className="text-gray-400 font-normal">({count} seats)</span>
                              </div>

                              {isAdmin && (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-0.5">
                                    <span className="text-[11px] text-gray-500 font-medium">Seats:</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateRowSeatsCountInSection(secIdx, rIdx, count - 1)}
                                      className="w-5 h-5 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                                      title="Decrease seats in this row"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-bold px-1">{count}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateRowSeatsCountInSection(secIdx, rIdx, count + 1)}
                                      className="w-5 h-5 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                                      title="Increase seats in this row"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyRowInSection(secIdx, rIdx)}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-xl border border-indigo-200/80 transition shadow-2xs hover:shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                    title="Copy this row"
                                  >
                                    <span className="text-xs">📋</span>
                                    <span>Copy Row</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRowFromSection(secIdx, rIdx)}
                                    className="border border-red-200 hover:border-red-300 bg-white hover:bg-red-50 text-red-600 text-xs font-bold px-2.5 py-1 rounded-xl transition shadow-2xs hover:shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                    title="Delete this row"
                                  >
                                    <span className="text-xs font-bold text-red-500">✕</span>
                                    <span>Delete Row</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Seats Row - Continuous single row without wrapping */}
                            <div className="overflow-x-auto pb-1">
                              <div className="flex items-center gap-1.5 min-w-max">
                                {seatsInRow.map((s, sIdx) => (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => setSelectedSeatForModal(s)}
                                    title={`Seat ${s.row}${s.number} (${sec.name}) · Status: ${s.status}`}
                                    className={
                                      'w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all shrink-0 select-none ' +
                                      (STATUS_COLORS[s.status] || STATUS_COLORS.available)
                                    }
                                  >
                                    {s.row}{s.number}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Row Button at bottom of section */}
                    {isAdmin && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddRowToSection(secIdx)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-blue-200 cursor-pointer transition flex items-center gap-1"
                        >
                          + Add Row to {sec.name}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {(localConfig.sections || []).length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-3xl space-y-3">
                    <p className="text-gray-400 text-sm">No sections created yet.</p>
                    <button
                      onClick={handleOpenAddSectionModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                    >
                      + Create First Section
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}


        </div>
      )}

      {/* ========================================================= */}
      {/* ADD SECTION MODAL (Section-Based Layout)                   */}
      {/* ========================================================= */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-black text-gray-900">+ Add Section</h3>
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSectionSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Section Name:</label>
                <input
                  type="text"
                  required
                  value={newSectionForm.name}
                  onChange={(e) => setNewSectionForm({ ...newSectionForm, name: e.target.value })}
                  placeholder="e.g. Main Floor, VIP, Balcony"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Number of Rows:</label>
                  <input
                    type="number"
                    min={1}
                    max={26}
                    required
                    value={newSectionForm.rows}
                    onChange={(e) => setNewSectionForm({ ...newSectionForm, rows: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Seats per Row:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={newSectionForm.seatsPerRow}
                    onChange={(e) => setNewSectionForm({ ...newSectionForm, seatsPerRow: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT SECTION MODAL (Section-Based Layout)                  */}
      {/* ========================================================= */}
      {editingSectionIndex !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-black text-gray-900">Edit Section</h3>
              <button
                type="button"
                onClick={() => setEditingSectionIndex(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditSectionSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Section Name:</label>
                <input
                  type="text"
                  required
                  value={editSectionForm.name}
                  onChange={(e) => setEditSectionForm({ ...editSectionForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Number of Rows:</label>
                  <input
                    type="number"
                    min={1}
                    max={26}
                    required
                    value={editSectionForm.rows}
                    onChange={(e) => setEditSectionForm({ ...editSectionForm, rows: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Seats per Row:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={editSectionForm.seatsPerRow}
                    onChange={(e) => setEditSectionForm({ ...editSectionForm, seatsPerRow: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSectionIndex(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Save Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BOOKED SEAT PROTECTION WARNING MODAL                      */}
      {/* ========================================================= */}
      {bookedSeatWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 border border-amber-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mx-auto">
              ⚠️
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-900">Warning</h3>
              <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                This seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?
              </p>
            </div>

            {bookedSeatWarning.affectedSeats?.length > 0 && (
              <div className="bg-amber-50 rounded-2xl p-3.5 max-h-36 overflow-y-auto text-xs text-amber-900 space-y-1.5 border border-amber-200/60">
                <span className="font-bold block">Affected Booked Seats:</span>
                {bookedSeatWarning.affectedSeats.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between font-mono">
                    <span className="font-bold">{s.seatNo}</span>
                    <span className="font-sans text-gray-600">{s.name || 'Booked Guest'} ({s.status})</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBookedSeatWarning(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-xs sm:text-sm text-gray-600 hover:bg-gray-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const onConfirm = bookedSeatWarning.onConfirm;
                  setBookedSeatWarning(null);
                  if (onConfirm) await onConfirm();
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-2.5 text-xs sm:text-sm font-bold shadow-md shadow-amber-600/20 cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seat Details Modal for viewing attendee status */}
      {selectedSeatForModal && (
        <SeatDetailsModal
          seat={selectedSeatForModal}
          onClose={() => {
            setSelectedSeatForModal(null);
            loadEventAndSeats();
          }}
        />
      )}
    </div>
  );
}
