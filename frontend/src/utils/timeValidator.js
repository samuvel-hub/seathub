/**
 * timeValidator.js - Frontend Time Range Validator
 * 
 * Rules:
 * 1. Ensure both times are in a recognized format (e.g., "10:00 AM", "14:30").
 * 2. Check that the End Time occurs after the Start Time.
 * 3. If valid, convert both to 24-hour format (HH:MM) and calculate total duration in minutes.
 * 4. If invalid, explain the error clearly.
 * 
 * Output JSON:
 * {
 *   is_valid: boolean,
 *   start_time_24h: string | null,
 *   end_time_24h: string | null,
 *   duration_minutes: number | null,
 *   error: string | null
 * }
 */

export function parseAndValidateTime(timeStr, fieldName = 'Time') {
  if (timeStr === null || timeStr === undefined) {
    return { valid: false, error: `${fieldName} is required.` };
  }
  const clean = String(timeStr).trim();
  if (!clean) {
    return { valid: false, error: `${fieldName} cannot be empty.` };
  }

  // Reject periods/dots used as separators (e.g., "4.99")
  if (clean.includes('.')) {
    return {
      valid: false,
      error: `Invalid ${fieldName.toLowerCase()} format '${clean}'. Use a colon (:) to separate hours and minutes, e.g., '10:00 AM' or '14:30'.`,
    };
  }

  // 12-hour format with AM/PM: e.g. "9:00 AM", "09:00 AM", "12:30 PM", "11:59 pm"
  const match12 = clean.match(/^(0?[1-9]|1[0-2]):(\d{1,2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();

    if (minutes < 0 || minutes > 59) {
      return {
        valid: false,
        error: `Invalid ${fieldName.toLowerCase()} '${clean}'. Minutes must be between 00 and 59.`,
      };
    }

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return {
      valid: true,
      time24: `${hh}:${mm}`,
      totalMinutes: hours * 60 + minutes,
      hours,
      minutes,
    };
  }

  // 24-hour format: e.g. "14:30", "09:00", "0:00", "23:59"
  const match24 = clean.match(/^([01]?\d|2[0-3]):(\d{1,2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);

    if (minutes < 0 || minutes > 59) {
      return {
        valid: false,
        error: `Invalid ${fieldName.toLowerCase()} '${clean}'. Minutes must be between 00 and 59.`,
      };
    }

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return {
      valid: true,
      time24: `${hh}:${mm}`,
      totalMinutes: hours * 60 + minutes,
      hours,
      minutes,
    };
  }

  // Check for common formatting issues to give clear error messages
  const parts = clean.split(/[:\s]/).filter(Boolean);
  if (parts.length >= 2) {
    const hr = parseInt(parts[0], 10);
    const min = parseInt(parts[1], 10);
    if (!isNaN(min) && (min < 0 || min > 59)) {
      return {
        valid: false,
        error: `Invalid ${fieldName.toLowerCase()} '${clean}'. Minutes must be between 00 and 59.`,
      };
    }
    if (!isNaN(hr) && (hr < 0 || hr > 23)) {
      return {
        valid: false,
        error: `Invalid ${fieldName.toLowerCase()} '${clean}'. Hours must be between 00 and 23.`,
      };
    }
  }

  return {
    valid: false,
    error: `Invalid ${fieldName.toLowerCase()} format '${clean}'. Expected format: '10:00 AM' or '14:30'.`,
  };
}

export function validateTimeRange(startTimeStr, endTimeStr, startDate = null, endDate = null) {
  const startRes = parseAndValidateTime(startTimeStr, 'Start Time');
  if (!startRes.valid) {
    return {
      is_valid: false,
      start_time_24h: null,
      end_time_24h: null,
      duration_minutes: null,
      error: startRes.error,
    };
  }

  const endRes = parseAndValidateTime(endTimeStr, 'End Time');
  if (!endRes.valid) {
    return {
      is_valid: false,
      start_time_24h: null,
      end_time_24h: null,
      duration_minutes: null,
      error: endRes.error,
    };
  }

  // If start and end dates are provided and differ (e.g. multi-day event)
  if (startDate && endDate && startDate !== endDate) {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      sDate.setHours(startRes.hours, startRes.minutes, 0, 0);
      eDate.setHours(endRes.hours, endRes.minutes, 0, 0);
      const diffMs = eDate.getTime() - sDate.getTime();
      if (diffMs <= 0) {
        return {
          is_valid: false,
          start_time_24h: startRes.time24,
          end_time_24h: endRes.time24,
          duration_minutes: null,
          error: 'End Time must occur after the Start Time.',
        };
      }
      return {
        is_valid: true,
        start_time_24h: startRes.time24,
        end_time_24h: endRes.time24,
        duration_minutes: Math.round(diffMs / 60000),
        error: null,
      };
    }
  }

  // Same day or time-only calculation
  const duration = endRes.totalMinutes - startRes.totalMinutes;
  if (duration <= 0) {
    return {
      is_valid: false,
      start_time_24h: startRes.time24,
      end_time_24h: endRes.time24,
      duration_minutes: null,
      error: 'End Time must occur after the Start Time.',
    };
  }

  return {
    is_valid: true,
    start_time_24h: startRes.time24,
    end_time_24h: endRes.time24,
    duration_minutes: duration,
    error: null,
  };
}
