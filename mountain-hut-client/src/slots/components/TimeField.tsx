import { useState } from "react";
import { normalizeTime } from "../../shared/utils/date.ts";

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // id of a <datalist> with suggested times
  listId: string;
}

// Plain text field instead of <input type="time">: the time can be typed
// freely or picked from the suggestions, and is tidied up to "HH:MM" on blur
export default function TimeField({ label, value, onChange, listId }: TimeFieldProps) {
  const [editing, setEditing] = useState(false);
  const invalid = !editing && value !== "" && normalizeTime(value) === null;

  return (
    <label className="flex flex-col gap-1.5 text-base font-medium text-stone-700">
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required
        placeholder="hh:mm"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          onChange(normalizeTime(value) ?? value);
        }}
        aria-invalid={invalid}
        className={`w-32 border rounded-lg px-3 py-2 text-lg font-medium bg-white shadow-xs transition-colors focus:outline-hidden focus:ring-2 ${
          invalid
            ? "border-red-500 focus:ring-red-500/25"
            : "border-stone-300 hover:border-green-600 focus:border-green-600 focus:ring-green-600/25"
        }`}
      />
      {invalid && <span className="text-sm font-normal text-red-600">e.g. 12:30</span>}
    </label>
  );
}
