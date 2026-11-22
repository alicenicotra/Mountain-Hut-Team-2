import { useState, type FormEvent } from "react";
import type { SlotMenu } from "../api/slot-menus-api.ts";
import { createSlot } from "../api/slots-api.ts";
import { formatDay, normalizeTime, todayString } from "../../shared/utils/date.ts";
import CopyTablesPicker from "./CopyTablesPicker";
import TimeField from "./TimeField";
import Step from "../../shared/components/Step.tsx";
import Icon from "../../shared/components/Icon.tsx";
import { primaryButton } from "../../shared/styles.ts";
import type { Table, TimeSlot } from "../types/slot.ts";

interface CreateSlotFormProps {
  date: string;
  tables: Table[];
  menus?: SlotMenu[];
  menusError?: string | null;
  onCreated: (slot: TimeSlot) => void;
}

const PRESETS = [
  { label: "Lunch", from: "12:00", to: "14:00" },
  { label: "Dinner", from: "19:00", to: "21:00" },
];

// Suggestions for the time fields, every 30 minutes from 06:00 to 23:30
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const chip =
  "inline-flex items-center gap-2 px-4 py-2 rounded-full border text-base transition-all cursor-pointer active:scale-95";
const link =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer";

export default function CreateSlotForm({ date, tables, menus = [], menusError = null, onCreated }: CreateSlotFormProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Seats are never typed in: they follow from the selected tables
  const selectedSeats = tables
    .filter((t) => selectedTableIds.includes(t.id))
    .reduce((sum, t) => sum + t.seats, 0);
  const fromTime = normalizeTime(from);
  const toTime = normalizeTime(to);
  const isPast = date < todayString();

  function selectTables(tableIds: number[]) {
    setSelectedTableIds(tableIds);
    setCopiedFrom(null);
  }

  function toggleTable(tableId: number) {
    selectTables(
      selectedTableIds.includes(tableId)
        ? selectedTableIds.filter((id) => id !== tableId)
        : [...selectedTableIds, tableId],
    );
  }

  function toggleMenu(menuId: number) {
    setSelectedMenuIds((current) => current.includes(menuId)
      ? current.filter((id) => id !== menuId)
      : [...current, menuId]);
  }

  function copyTables(slot: TimeSlot) {
    setSelectedTableIds(slot.tables.map((t) => t.id));
    setCopiedFrom(`${formatDay(slot.date, "short")}, ${slot.from}–${slot.to}`);
    setPickerOpen(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fromTime || !toTime) {
      setError("Check the times, e.g. 12:30");
      return;
    }

    setSubmitting(true);
    try {
      const slot = await createSlot({
        date,
        from: fromTime,
        to: toTime,
        tableIds: selectedTableIds,
        ...(selectedMenuIds.length > 0 ? { menuIds: selectedMenuIds } : {}),
      });
      onCreated(slot);
      setSuccess(`Slot ${slot.from}–${slot.to} created`);
      setFrom("");
      setTo("");
      selectTables([]);
      setSelectedMenuIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Step number={1} title="Time">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const selected = fromTime === preset.from && toTime === preset.to;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (selected) {
                    setFrom("");
                    setTo("");
                  } else {
                    setFrom(preset.from);
                    setTo(preset.to);
                  }
                }}
                className={`${chip} ${
                  selected
                    ? "border-green-600 bg-green-50 text-green-900 shadow-sm"
                    : "border-stone-300 bg-white text-stone-700 hover:border-green-600 hover:text-green-800"
                }`}
              >
                {preset.label} {preset.from}–{preset.to}
                <Icon
                  name={preset.label === "Dinner" ? "moon" : "sun"}
                  className={`w-5 h-5 ${preset.label === "Dinner" ? "text-indigo-500" : "text-amber-500"}`}
                />
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <TimeField label="Start" value={from} onChange={setFrom} listId="slot-times" />
          <span className="pt-9 text-xl text-stone-400">–</span>
          <TimeField label="End" value={to} onChange={setTo} listId="slot-times" />
        </div>
        <datalist id="slot-times">
          {TIME_OPTIONS.map((time) => (
            <option key={time} value={time} />
          ))}
        </datalist>
      </Step>

      <Step
        number={2}
        title="Tables"
        actions={
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${link} text-sky-700 hover:bg-sky-50`}
            >
              <Icon name="copy" className="w-4 h-4" />
              Copy from another slot
            </button>
            <button
              type="button"
              onClick={() => selectTables(tables.map((t) => t.id))}
              className={`${link} text-green-700 hover:bg-green-50`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => selectTables([])}
              className={`${link} text-stone-600 hover:bg-stone-100`}
            >
              None
            </button>
          </>
        }
      >
        {pickerOpen && (
          <CopyTablesPicker
            targetDate={date}
            onPick={copyTables}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {copiedFrom && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-sm text-sky-800 animate-pop-in">
            <Icon name="copy" className="w-4 h-4" />
            Copied from {copiedFrom}
          </p>
        )}

        {tables.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-stone-300 p-6 text-center text-base text-stone-500">No tables yet</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {tables.map((table) => {
              const selected = selectedTableIds.includes(table.id);
              return (
                <button
                  key={table.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTable(table.id)}
                  className={`rounded-xl border-2 p-3 text-left transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
                    selected
                      ? "border-green-600 bg-green-50 shadow-sm"
                      : "border-stone-200 bg-white hover:border-stone-400"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-xl font-semibold text-stone-900">{table.code}</span>
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white animate-pop-in"
                      >
                        <Icon name="check" className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
                    <Icon name="users" className="w-4 h-4 text-stone-400" />
                    {table.seats} seats
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Step>

      <Step number={3} title="Menus">
        {menusError ? (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Icon name="warning" className="w-5 h-5" />
            Could not load menus: {menusError}. You can still create the slot without menus.
          </p>
        ) : menus.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <Icon name="info" className="w-5 h-5" />
            No menus available yet. Create them in Manage menus before assigning them to a slot.
          </p>
        ) : (
          <>
            <details className="group rounded-xl border border-stone-300 bg-white shadow-xs open:shadow-sm">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-base font-medium text-stone-800 list-none [&::-webkit-details-marker]:hidden">
                <Icon name="book" className="w-5 h-5 text-green-700" />
                Select menus ({selectedMenuIds.length} selected)
                <Icon name="chevronRight" className="ml-auto w-5 h-5 text-stone-400 transition-transform group-open:rotate-90" />
              </summary>
              <div role="group" aria-label="Menus for this slot" className="grid gap-2 border-t border-stone-200 p-3 sm:grid-cols-2">
                {menus.map((menu) => (
                  <label key={menu.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-base transition-colors hover:border-green-200 hover:bg-green-50 has-checked:border-green-300 has-checked:bg-green-50">
                    <input
                      type="checkbox"
                      checked={selectedMenuIds.includes(menu.id)}
                      onChange={() => toggleMenu(menu.id)}
                      className="w-4 h-4 accent-green-700"
                    />
                    <span>{menu.name}</span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                        menu.type === "TEMPLATE" ? "bg-stone-100 text-stone-600" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {menu.type === "TEMPLATE" ? "Default" : "Custom"}
                    </span>
                  </label>
                ))}
              </div>
            </details>
            <p className="text-sm text-stone-500">
              The selected menus will be offered for this time slot.
            </p>
          </>
        )}
      </Step>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-green-200 bg-linear-to-r from-green-50 to-white p-4">
        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 text-green-800">
          <Icon name="users" className="w-6 h-6" />
        </span>
        <p className="text-stone-700">
          <span className="text-2xl font-semibold text-stone-900">{selectedSeats}</span> seats
          <span className="text-sm text-stone-500"> · {selectedTableIds.length} tables</span>
        </p>
        <button
          type="submit"
          disabled={submitting || isPast}
          className={`ml-auto ${primaryButton}`}
        >
          {submitting
            ? "Creating…"
            : fromTime && toTime
              ? `Create slot ${fromTime}–${toTime}`
              : "Create slot"}
        </button>
      </div>

      {isPast && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Icon name="warning" className="w-5 h-5" />
          This day is in the past
        </p>
      )}
      {!isPast && selectedTableIds.length === 0 && (from || to) && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Icon name="warning" className="w-5 h-5" />
          0 seats: nobody can book this slot
        </p>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="warning" className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <p className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 animate-pop-in">
          <Icon name="check" className="w-5 h-5" />
          {success}
        </p>
      )}
    </form>
  );
}
