import { useState, type FormEvent } from "react";
import { copyWeek } from "../api/slots-api.ts";
import { todayString } from "../../shared/utils/date.ts";
import { mondayOf } from "../utils/week-date.ts";
import Icon from "../../shared/components/Icon.tsx";
import { inputBase, primaryButton } from "../../shared/styles.ts";

interface CopyWeekFormProps {
  selectedDate: string;
  onCopied: (targetWeekStart: string, copiedSlots: number, weeks: number) => void;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CopyWeekForm({ selectedDate, onCopied }: CopyWeekFormProps) {
  const [sourceDate, setSourceDate] = useState(selectedDate);
  const [targetDate, setTargetDate] = useState(addDays(mondayOf(selectedDate), 7));
  const [weeks, setWeeks] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceWeekStart = mondayOf(sourceDate);
  const targetWeekStart = mondayOf(targetDate);
  const sourceWeekEnd = addDays(sourceWeekStart, 6);
  const weeksNumber = Number(weeks);
  const validWeeks = weeks.trim() !== "" && Number.isInteger(weeksNumber) &&
    weeksNumber >= 1 && weeksNumber <= 12;
  const targetEnd = validWeeks ? addDays(targetWeekStart, weeksNumber * 7 - 1) : "";
  const overlaps = !!targetEnd && sourceWeekStart <= targetEnd && targetWeekStart <= sourceWeekEnd;
  const invalid = !sourceWeekStart || !targetWeekStart || !validWeeks ||
    targetWeekStart < todayString() || overlaps;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await copyWeek({ sourceWeekStart, targetWeekStart, weeks: weeksNumber });
      onCopied(targetWeekStart, result.copiedSlots, weeksNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy the schedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-base text-stone-600">
        Repeat slots and their table assignments across up to 12 weeks. Existing bookings are never copied.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-stone-700">
          Source week
          <input
            aria-label="Source week"
            type="date"
            value={sourceDate}
            onChange={(event) => { setSourceDate(event.target.value); setError(null); }}
            className={`mt-1 block w-full ${inputBase}`}
            required
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">Monday {sourceWeekStart}</span>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          First destination week
          <input
            aria-label="First destination week"
            type="date"
            value={targetDate}
            onChange={(event) => { setTargetDate(event.target.value); setError(null); }}
            className={`mt-1 block w-full ${inputBase}`}
            required
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">Monday {targetWeekStart}</span>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Number of weeks
          <input
            aria-label="Number of weeks"
            type="number"
            min={1}
            max={12}
            step={1}
            value={weeks}
            onChange={(event) => { setWeeks(event.target.value); setError(null); }}
            className={`mt-1 block w-full ${inputBase}`}
            required
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">1–12 consecutive weeks</span>
        </label>
      </div>
      {targetWeekStart < todayString() && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Icon name="warning" className="w-5 h-5" />
          The destination week must not start in the past.</p>
      )}
      {overlaps && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Icon name="warning" className="w-5 h-5" />
          Source and destination weeks cannot overlap.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-sm text-stone-500 max-w-xl">
          <Icon name="info" className="w-5 h-5 mt-0.5" />
          <span>
          Existing slots in destination weeks are replaced.
          If any destination week has active bookings,
          nothing is copied.
          </span>
        </p>
        <button
          type="submit"
          disabled={invalid || submitting}
          className={primaryButton}
        >
          <Icon name="repeat" className="w-5 h-5" />
          {submitting ? "Copying…" : "Copy week"}
        </button>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="warning" className="w-5 h-5" />
          {error}
        </p>
      )}
    </form>
  );
}
