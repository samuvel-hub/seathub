import React, { useState } from 'react';
import { useSeating } from '../context/SeatingContext';

export default function FindSeats() {
  const { findBestSeats, updateSeat } = useSeating();
  const [count, setCount] = useState(2);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [assigning, setAssigning] = useState(null);

  const handleFind = () => {
    const found = findBestSeats(Number(count));
    setResults(found);
    setSearched(true);
  };

  const handleAssign = async (groupSeats, index) => {
    setAssigning(index);
    try {
      for (const seat of groupSeats) {
        await updateSeat(seat.seatId, { status: 'occupied', assignedName: 'Group Assignment' });
      }
      alert('Seats assigned successfully!');
      setResults([]);
      setSearched(false);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Find Seats</h1>
        <p className="text-sm text-gray-500 mt-1">Instantly find consecutive available seats for a group.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-3">Number of seats needed</label>
        <div className="flex items-center gap-4">
          <input type="number" min="1" max="20" value={count}
            onChange={e => setCount(e.target.value)}
            className="w-28 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={handleFind}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            ⌕ Find Seats
          </button>
        </div>
      </div>

      {searched && (
        results.length === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-2xl mb-2">😔</div>
            <p className="text-red-700 font-medium">No {count} consecutive seats available</p>
            <p className="text-sm text-red-500">Try a smaller group size</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Top {results.length} Recommendation{results.length > 1 ? 's' : ''}</h2>
            {results.map((rec, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{rec.label}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Seats: {rec.seats.map(s => s.number).join(', ')}
                    </div>
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {rec.seats.map(s => (
                        <span key={s.seatId} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-lg font-medium">
                          {s.row}{s.number}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAssign(rec.seats, idx)}
                    disabled={assigning === idx}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                    {assigning === idx ? 'Assigning...' : 'Assign Seats'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
