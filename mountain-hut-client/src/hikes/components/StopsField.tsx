import { useState, type KeyboardEvent } from "react";
import { MAX_POINT_LENGTH, MAX_POINTS } from "../utils/hike-time.ts";

interface StopsFieldProps {
  points: string[];
  onChange: (points: string[]) => void;
  inputClass: string;
}

// The stops of the hike, in the order the hiker passes them
export default function StopsField({ points, onChange, inputClass }: StopsFieldProps) {
  const [draft, setDraft] = useState("");
  const value = draft.trim();
  const full = points.length >= MAX_POINTS;

  function add() {
    if (!value || full) return;
    onChange([...points, value]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // add the stop instead of sending the form
      add();
    }
  }

  return (
    <div>
      <label
        htmlFor="intermediatePoint"
        className="block text-xs font-semibold uppercase tracking-wider text-green-700 mb-1.5"
      >
        Stops along the way (optional)
      </label>
      <div className="flex gap-2">
        <input
          id="intermediatePoint"
          value={draft}
          maxLength={MAX_POINT_LENGTH}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Lake shore"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!value || full}
          className="rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition-colors hover:border-green-600 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          Add
        </button>
      </div>

      {points.length > 0 && (
        <ol aria-label="Stops" className="mt-2 flex flex-wrap items-center gap-1.5">
          {points.map((point, i) => (
            <li
              key={`${i}-${point}`}
              className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 py-0.5 pl-3 pr-1 text-sm text-green-900"
            >
              <span>{i + 1}. {point}</span>
              <button
                type="button"
                aria-label={`Remove ${point}`}
                onClick={() => onChange(points.filter((_, j) => j !== i))}
                className="rounded-full px-1.5 text-green-700 hover:bg-green-100 cursor-pointer"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-1 text-xs text-stone-500">
        {full
          ? `You can add up to ${MAX_POINTS} stops.`
          : "Press Enter or Add after each stop, in the order you'll pass them."}
      </p>
    </div>
  );
}