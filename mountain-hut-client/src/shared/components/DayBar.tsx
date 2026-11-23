import { formatDay, openPicker, shiftDate, todayString } from "../utils/date.ts";
import Icon from "./Icon.tsx";

interface DayBarProps {
  date: string;
  onChange: (date: string) => void;
}

const dayButton =
  "flex items-center justify-center w-10 h-10 rounded-lg border border-stone-300 bg-white text-stone-700 shadow-xs transition-all hover:border-green-600 hover:text-green-800 hover:bg-green-50 active:scale-95 cursor-pointer";

export default function DayBar({ date, onChange }: DayBarProps) {
  const isToday = date === todayString();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(shiftDate(date, -1))}
        className={dayButton}
      >
        <Icon name="chevronLeft" className="w-5 h-5" />
      </button>
      <input
        type="date"
        aria-label="Day"
        value={date}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        onClick={(e) => openPicker(e.currentTarget)}
        className="h-10 border border-stone-300 rounded-lg px-3 text-base bg-white shadow-xs cursor-pointer transition-colors hover:border-green-600 focus:outline-hidden focus:border-green-600 focus:ring-2 focus:ring-green-600/25"
      />
      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(shiftDate(date, 1))}
        className={dayButton}
      >
        <Icon name="chevronRight" className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-3 sm:ml-auto">
        <Icon name="calendar" className="w-6 h-6 text-green-700" />
        <p key={date} className="text-xl font-semibold text-stone-900 animate-fade-up">{formatDay(date)}</p>
        {isToday && (
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold" aria-hidden="true">
            Today
          </span>
        )}
      </div>
    </div>
  );
}
