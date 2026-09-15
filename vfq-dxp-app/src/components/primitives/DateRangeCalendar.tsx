import { useState } from 'react';
import { Icon } from './Icon';

export interface DateRangeValue {
  from?: string;
  to?: string;
}

interface DateRangeCalendarProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

const CHEVRON_LEFT = 'M15 18l-6-6 6-6';
const CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Monday-start 6x7 day grid for a given month, including the leading/trailing
// days of the adjacent months needed to fill whole weeks.
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}

// Range calendar per Date Specific-Open.svg: month/year header with prev/next
// nav, Mon-start weekday row, 6x7 day grid. Two-click range selection — first
// click sets the start anchor, second sets the end (swapped if picked
// earlier), both anchors render as filled --field-calendar-anchor circles
// with the days between them washed in --field-calendar-range.
export function DateRangeCalendar({ value, onChange, className = '' }: DateRangeCalendarProps) {
  const today = new Date();
  const initial = value.from ? new Date(value.from) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const from = value.from ? new Date(value.from) : undefined;
  const to = value.to ? new Date(value.to) : undefined;

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const pickDay = (day: Date) => {
    if (!from || (from && to)) {
      onChange({ from: toIso(day), to: undefined });
      return;
    }
    if (day.getTime() < from.getTime()) {
      onChange({ from: toIso(day), to: toIso(from) });
    } else {
      onChange({ from: toIso(from), to: toIso(day) });
    }
  };

  const grid = buildGrid(viewYear, viewMonth);

  const isSameDay = (a: Date, b?: Date) => !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isInRange = (d: Date) => !!from && !!to && d.getTime() > from.getTime() && d.getTime() < to.getTime();

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[length:var(--fs-caption)] text-fg-2">{MONTH_NAMES[viewMonth]}</div>
          <div className="text-[length:var(--fs-h5)] font-bold text-fg">{viewYear}</div>
        </div>
        <div className="flex gap-1 pt-1">
          <button type="button" aria-label="Previous month" onClick={goPrev} className="w-6 h-6 flex items-center justify-center text-fg-2 hover:text-fg">
            <Icon path={CHEVRON_LEFT} className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Next month" onClick={goNext} className="w-6 h-6 flex items-center justify-center text-fg-2 hover:text-fg">
            <Icon path={CHEVRON_RIGHT} className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[length:var(--fs-caption)] font-semibold text-fg">
            {w}
          </div>
        ))}
        {grid.map((day) => {
          const inMonth = day.getMonth() === viewMonth;
          const isAnchor = isSameDay(day, from) || isSameDay(day, to);
          const inRange = isInRange(day);
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => pickDay(day)}
              className={`w-8 h-8 mx-auto rounded-full text-[length:var(--fs-body)] flex items-center justify-center
                ${!inMonth ? 'text-[var(--field-icon)]' : 'text-fg'}
                ${isAnchor ? 'bg-[var(--field-calendar-anchor)] text-white font-semibold' : inRange ? 'bg-[var(--field-calendar-range)]/25' : 'hover:bg-surface'}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
