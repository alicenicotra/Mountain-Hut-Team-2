import Icon from "../../shared/components/Icon.tsx";
import type { TimeSlot } from "../types/slot.ts";

interface SlotListProps {
  slots: TimeSlot[];
}

// Decorative only: afternoon slots and later get a moon, earlier ones a sun
const isEvening = (from: string) => Number(from.slice(0, 2)) >= 16;

export default function SlotList({ slots }: SlotListProps) {
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center text-stone-500">
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-stone-400 shadow-xs">
          <Icon name="calendar" className="w-6 h-6" />
        </span>
        <p>No slots yet</p>
        <p className="text-sm text-stone-400">Create one with the “New slot” form</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {slots.map((slot, index) => {
        const evening = isEvening(slot.from);
        return (
          <li
            key={slot.id}
            style={{ animationDelay: `${index * 60}ms` }}
            className={`relative overflow-hidden bg-white border border-stone-200 rounded-xl p-4 pl-6 space-y-3 shadow-xs transition-shadow hover:shadow-md animate-fade-up before:absolute before:inset-y-0 before:left-0 before:w-1.5 ${
              evening ? "before:bg-indigo-400" : "before:bg-amber-400"
            }`}
          >
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-lg ${
                    evening ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Icon name={evening ? "moon" : "sun"} className="w-5 h-5" />
                </span>
                <p className="text-xl font-semibold text-stone-900">
                  {slot.from}–{slot.to}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                  slot.totalSeats > 0
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <Icon name="users" className="w-4 h-4" />
                {slot.totalSeats} seats
              </span>
            </div>

            {slot.tables.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {slot.tables.map((table) => (
                  <li
                    key={table.id}
                    className="text-sm px-2.5 py-1 rounded-md border border-stone-200 bg-stone-50 text-stone-700"
                  >
                    {table.code} · {table.seats}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
