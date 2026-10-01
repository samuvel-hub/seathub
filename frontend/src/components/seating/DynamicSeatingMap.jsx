import React from 'react';

const STATUS_COLORS = {
  available: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs shadow-emerald-500/20 active:scale-95 cursor-pointer',
  occupied:  'bg-red-500 text-white cursor-not-allowed opacity-95',
  reserved:  'bg-purple-500 text-white cursor-not-allowed opacity-90',
  held:      'bg-amber-400 text-white cursor-not-allowed opacity-90',
  blocked:   'bg-gray-400 text-white cursor-not-allowed opacity-75',
};

/**
 * DynamicSeatingMap - Unified Single Source of Truth Seating Renderer
 * Renders Standard Row & Column and Section-Based (LEFT / CENTER / RIGHT) layouts
 * Used identically on the Guest Page and in Admin Live Preview.
 */
export default function DynamicSeatingMap({
  event,
  seats = [],
  onSeatClick,
  myBooking = null,
  isPreview = false,
}) {
  const layoutType = event?.seatingLayoutType === 'section_based' ? 'section_based' : 'standard';
  const stageLabel = event?.stageLabel || event?.seatingLayoutConfig?.stageLabel || '▲ STAGE / PODIUM ▲';
  const config = event?.seatingLayoutConfig || {};

  // Build a lookup map by seatNo and seatId for fast access
  const seatMap = React.useMemo(() => {
    const map = new Map();
    seats.forEach((s) => {
      const key = (s.seatNo || `${s.row}${s.number}`).toUpperCase();
      map.set(key, s);
      if (s.seatId) map.set(s.seatId.toUpperCase(), s);
    });
    return map;
  }, [seats]);

  // Render an individual seat button
  const renderSeatButton = (seatOrMeta) => {
    const rawSeatNo = (seatOrMeta.seatNo || `${seatOrMeta.row}${seatOrMeta.number}`).toUpperCase();
    const liveSeat = seatMap.get(rawSeatNo) || seatOrMeta;
    const isAvailable = liveSeat.status === 'available';
    const isMyBookedSeat = myBooking && (myBooking.seatNo?.toUpperCase() === rawSeatNo);

    // Display label: if seatNo has a section prefix (e.g. "LEFT-A1"), show "A1"
    const displayLabel = seatOrMeta.displayName || (
      rawSeatNo.includes('-') ? rawSeatNo.split('-').slice(1).join('-') : rawSeatNo
    );

    // CHANGE 6: When booked, seat must immediately change to RED = Occupied. Do NOT leave booked seat blue!
    const seatColorClass = isMyBookedSeat
      ? 'bg-red-600 text-white ring-4 ring-red-300 shadow-md font-black'
      : (STATUS_COLORS[liveSeat.status] || 'bg-gray-200 text-gray-500');

    return (
      <button
        key={liveSeat._id || liveSeat.seatId || rawSeatNo}
        type="button"
        disabled={!isAvailable && !isPreview}
        onClick={() => {
          if (!isPreview && onSeatClick) {
            onSeatClick(liveSeat);
          }
        }}
        title={
          isAvailable
            ? `Click to book Seat ${rawSeatNo}`
            : `Seat ${rawSeatNo} is ${liveSeat.status || 'occupied'}`
        }
        className={
          'w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all shrink-0 select-none ' +
          seatColorClass
        }
      >
        <span>{displayLabel}</span>
      </button>
    );
  };

  // =========================================================================
  // 1. STANDARD ROW & COLUMN LAYOUT (Change 4.1)
  // =========================================================================
  if (layoutType === 'standard') {
    let rowsToRender = [];
    if (Array.isArray(config.rows) && config.rows.length > 0) {
      rowsToRender = config.rows.map((r) => {
        const rowSeats = [];
        const count = r.seatsPerRow || r.seatCount || 10;
        for (let n = 1; n <= count; n++) {
          const sNo = `${r.row}${n}`;
          const found = seatMap.get(sNo.toUpperCase());
          rowSeats.push(found || {
            seatNo: sNo,
            row: r.row,
            number: n,
            section: 'Main Floor',
            sectionCode: 'MAIN',
            status: 'available',
          });
        }
        return { rowLetter: r.row, seats: rowSeats };
      });
    } else {
      const grouped = seats.reduce((acc, s) => {
        const r = s.row || 'A';
        if (!acc[r]) acc[r] = [];
        acc[r].push(s);
        return acc;
      }, {});
      rowsToRender = Object.keys(grouped).sort().map((r) => ({
        rowLetter: r,
        seats: grouped[r].sort((a, b) => a.number - b.number),
      }));
    }

    return (
      <div className="space-y-6">
        {/* Stage Banner */}
        <div className="w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 text-white py-3 rounded-2xl text-center shadow-xs">
          <span className="text-xs sm:text-sm font-extrabold tracking-widest uppercase">
            {stageLabel}
          </span>
        </div>

        {/* Rows and Seats Grid */}
        <div className="overflow-x-auto pb-4 pt-2">
          <div className="min-w-max space-y-3.5">
            {rowsToRender.map(({ rowLetter, seats: rowSeats }) => (
              <div key={rowLetter} className="flex items-center gap-3 min-w-max">
                <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200/80 flex items-center justify-center font-bold text-xs text-gray-700 shrink-0 shadow-2xs sticky left-0 z-10 bg-white/95 backdrop-blur-xs">
                  {rowLetter}
                </div>
                <div className="flex items-center gap-2 flex-nowrap shrink-0">
                  {rowSeats.map((seat) => renderSeatButton(seat))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. SECTION-BASED LAYOUT: LEFT, CENTER, RIGHT (Change 4.2)
  // =========================================================================
  if (layoutType === 'section_based') {
    let sectionsToRender = [];
    if (Array.isArray(config.sections) && config.sections.length > 0) {
      sectionsToRender = config.sections;
    } else {
      // Group existing seats by section/sectionCode
      const secMap = {};
      seats.forEach((s) => {
        const c = s.sectionCode || s.section || 'MAIN';
        if (!secMap[c]) secMap[c] = { name: s.section || c, code: c, rows: {} };
        const r = s.row || 'A';
        if (!secMap[c].rows[r]) secMap[c].rows[r] = [];
        secMap[c].rows[r].push(s);
      });
      sectionsToRender = Object.values(secMap).map((sec) => ({
        name: sec.name,
        code: sec.code,
        rows: Object.keys(sec.rows).sort().map((r) => ({
          row: r,
          seatsPerRow: sec.rows[r].length,
        })),
      }));
    }

    // Default to Left / Center / Right if empty
    if (sectionsToRender.length === 0) {
      sectionsToRender = [
        { name: 'Left Section', code: 'LEFT', rows: [{ row: 'A', seatsPerRow: 4 }, { row: 'B', seatsPerRow: 4 }] },
        { name: 'Center Section', code: 'CENTER', rows: [{ row: 'A', seatsPerRow: 8 }, { row: 'B', seatsPerRow: 8 }] },
        { name: 'Right Section', code: 'RIGHT', rows: [{ row: 'A', seatsPerRow: 4 }, { row: 'B', seatsPerRow: 4 }] },
      ];
    }

    const isThreeSection = sectionsToRender.length === 3;

    return (
      <div className="space-y-6">
        {/* Stage Banner */}
        <div className="w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 text-white py-3 rounded-2xl text-center shadow-xs">
          <span className="text-xs sm:text-sm font-extrabold tracking-widest uppercase">
            {stageLabel}
          </span>
        </div>

        {/* Clean Structured Sections (side by side for LEFT, CENTER, RIGHT) */}
        <div className={
          isThreeSection
            ? 'grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-x-auto pb-4 items-start'
            : 'space-y-6 overflow-x-auto pb-4'
        }>
          {sectionsToRender.map((sec, secIdx) => (
            <div
              key={sec.code || sec.name || secIdx}
              className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4 min-w-0"
            >
              {/* Section Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <h3 className="font-extrabold text-sm sm:text-base text-gray-900 tracking-wide uppercase">
                    {sec.name}
                  </h3>
                </div>
                {sec.code && (
                  <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-100">
                    {sec.code}
                  </span>
                )}
              </div>

              {/* Rows inside Section - Horizontal scroll ensures all seats in a row remain in one continuous line */}
              <div className="space-y-3 overflow-x-auto pb-2 min-w-0">
                {(sec.rows || []).map((r) => {
                  const actualSeatsInSecRow = seats.filter(
                    (s) =>
                      (s.sectionCode === sec.code || s.section === sec.name) &&
                      (s.row || 'A') === r.row
                  );
                  const maxNumInDb = actualSeatsInSecRow.reduce(
                    (max, s) => Math.max(max, s.number || 0),
                    0
                  );
                  // Dynamic seat count: exactly follows admin configuration or database, no hard-coded limits
                  const count = Math.max(r.seatsPerRow || 0, maxNumInDb, actualSeatsInSecRow.length, 1);

                  const rowSeats = [];
                  for (let n = 1; n <= count; n++) {
                    const sNoWithPrefix = `${sec.code || 'SEC'}-${r.row}${n}`;
                    const rawSNo = `${r.row}${n}`;
                    const found = seatMap.get(sNoWithPrefix.toUpperCase()) || seatMap.get(rawSNo.toUpperCase());
                    rowSeats.push(
                      found || {
                        seatNo: sNoWithPrefix,
                        displayName: `${r.row}${n}`,
                        row: r.row,
                        number: n,
                        section: sec.name,
                        sectionCode: sec.code,
                        status: 'available',
                      }
                    );
                  }

                  return (
                    <div key={r.row} className="flex items-center gap-2.5 min-w-max">
                      {/* Pinned Row Label on the Left */}
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center font-extrabold text-xs text-slate-800 shrink-0 shadow-xs sticky left-0 z-20">
                        {r.row}
                      </div>
                      {/* Continuous single row of seats without wrapping */}
                      <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
                        {rowSeats.map((seat) => renderSeatButton(seat))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }


  return null;
}
