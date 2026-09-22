'use client';

import React, { useState, useEffect } from 'react';

interface FormattedDateProps {
  date?: string | Date | number | null;
  format?: 'datetime' | 'time' | 'date';
  fallback?: string;
  className?: string;
}

export function FormattedDate({
  date,
  format = 'datetime',
  fallback = '',
  className
}: FormattedDateProps) {
  const [formatted, setFormatted] = useState<string>(fallback);

  useEffect(() => {
    if (!date) return;
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        setFormatted(fallback);
        return;
      }
      if (format === 'time') {
        setFormatted(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else if (format === 'date') {
        setFormatted(d.toLocaleDateString());
      } else {
        setFormatted(d.toLocaleString());
      }
    } catch {
      setFormatted(fallback);
    }
  }, [date, format, fallback]);

  return <span className={className} suppressHydrationWarning>{formatted || fallback}</span>;
}
