import { useEffect, useState } from "react";
import { getSlots } from "../api/slots-api.ts";
import { formatDay, shiftDate } from "../../shared/utils/date.ts";
import type { TimeSlot } from "../types/slot.ts";
import Icon from "../../shared/components/Icon.tsx";

interface CopyTablesPickerProps {
  // Day of the slot being created: the picker starts from the day before
  targetDate: string;
  onPick: (slot: TimeSlot) => void;
  onClose: () => void;
}

interface SlotsResult {
  date: string;
  slots: TimeSlot[];
  error: string | null;
}

const arrow =
  "flex items-center justify-center w-9 h-9 rounded-lg border border-sky-200 bg-white text-sky-900 transition-colors hover:border-sky-500 hover:bg-sky-100 cursor-pointer";

export default function CopyTablesPicker({ targetDate, onPick, onClose }: CopyTablesPickerProps) {
  const [date, setDate] = useState(() => shiftDate(targetDate, -1));
  const [result, setResult] = useState<SlotsResult | null>(null);

  useEffect(() => {
    let ignore = false;

    getSlots(date)
      .then((slots) => {
        if (!ignore) setResult({ date, slots, error: null });
      })
      .catch((err: Error) => {
        if (!ignore) setResult({ date, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date]);

  const loading = result?.date !== date;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-4 shadow-inner animate-fade-up">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-base font-semibold text-sky-900">
          <Icon name="copy" className="w-5 h-5" />
          Copy from
        </span>
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => setDate(shiftDate(date, -1))}
          className={arrow}
        >
          <Icon name="chevronLeft" className="w-5 h-5" />
        </button>
        <input
          type="date"
          aria-label="Day to copy from"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          className="h-9 border border-sky-200 rounded-lg px-2 bg-white text-base cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
        />
        <button
          type="button"
          aria-label="Next day"
          onClick={() => setDate(shiftDate(date, 1))}
          className={arrow}
        >
          <Icon name="chevronRight" className="w-5 h-5" />
        </button>
        <span className="text-base text-sky-900">{formatDay(date, "short")}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="ml-auto flex items-center justify-center w-9 h-9 rounded-full text-sky-900 transition-colors hover:bg-sky-100 hover:text-sky-600 cursor-pointer"
        >
          <Icon name="close" className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <p className="text-base text-stone-500">Loading…</p>
      ) : result.error ? (
        <p className="text-base text-red-600">Error: {result.error}</p>
      ) : result.slots.length === 0 ? (
        <p className="text-base text-stone-500">No slots on this day</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              disabled={slot.tables.length === 0}
              onClick={() => onPick(slot)}
              className="px-3 py-2.5 rounded-lg border border-sky-200 bg-white text-left text-base shadow-xs transition-all hover:border-sky-500 hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-sky-200 disabled:hover:shadow-xs"
            >
              <span className="block font-semibold text-stone-900">
                {slot.from}–{slot.to} · {slot.totalSeats} seats
              </span>
              <span className="block text-sm text-stone-500">
                {slot.tables.length > 0
                  ? slot.tables.map((t) => t.code).join(", ")
                  : "No tables"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
