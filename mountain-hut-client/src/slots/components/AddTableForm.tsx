import { useState, type FormEvent } from "react";
import { createTable } from "../api/slots-api.ts";
import type { Table } from "../types/slot.ts";
import Icon from "../../shared/components/Icon.tsx";
import { inputBase, secondaryButton } from "../../shared/styles.ts";

interface AddTableFormProps {
  onCreated: (table: Table) => void;
}

// MH-89: keep in sync with the limit in the backend table schema
const MAX_TABLE_SEATS = 20;

const labelClass = "flex flex-col gap-1 text-sm font-medium text-stone-700";

export default function AddTableForm({ onCreated }: AddTableFormProps) {
  const [code, setCode] = useState("");
  // Kept as text so the field can be empty while typing
  const [seats, setSeats] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > MAX_TABLE_SEATS) {
      setError(`Seats must be a whole number between 1 and ${MAX_TABLE_SEATS}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const table = await createTable({ code: code.trim(), seats: seatCount });
      onCreated(table);
      setCode("");
      setSeats("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <label className={labelClass}>
          Table code
          <input
            required
            maxLength={20}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputBase} w-32`}
          />
        </label>
        <label className={labelClass}>
          Seats
          <input
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={MAX_TABLE_SEATS}
            step={1}
            placeholder={`1–${MAX_TABLE_SEATS}`}
            value={seats}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
            }}
            onChange={(e) => setSeats(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className={`${inputBase} w-24`}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className={secondaryButton}
        >
          <Icon name="plus" className="w-5 h-5" />
          {submitting ? "Adding…" : "Add table"}
        </button>
      </div>
      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="warning" className="w-5 h-5" />
          <span>Error: {error}</span>
        </p>
      )}
    </form>
  );
}