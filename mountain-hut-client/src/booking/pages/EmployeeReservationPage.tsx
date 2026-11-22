import { useEffect, useState, type FormEvent } from "react";
import { getAvailability } from "../api/availability-api.ts";
import { createStaffBooking } from "../api/bookings-api.ts";
import { createHiker } from "../api/hikers-api.ts";
import HikerSearch from "../components/HikerSearch.tsx";
import DayBar from "../../shared/components/DayBar.tsx";
import Step from "../../shared/components/Step.tsx";
import { ApiError } from "../../shared/api/client.ts";
import { formatDay, slotHasStarted, todayString } from "../../shared/utils/date.ts";
import type { SlotAvailability } from "../types/availability.ts";
import type { BookingResult } from "../types/booking.ts";
import type { HikerMatch, NewHiker } from "../types/hiker.ts";

type HikerMode = "existing" | "account" | "temporary";

const HIKER_MODES: { value: HikerMode; label: string }[] = [
  { value: "existing", label: "Existing hiker" },
  { value: "account", label: "New account" },
  { value: "temporary", label: "Just a name" },
];

// Same limit as the backend
const MAX_PARTY_SIZE = 1000;

// Result of one availability request, tagged with the inputs it was loaded for
interface LoadedAvailability {
  key: string;
  slots: SlotAvailability[];
  error: string | null;
}

interface Confirmed {
  booking: BookingResult;
  date: string;
  slot: SlotAvailability;
  hiker: HikerMatch;
  temporaryPassword: string | null;
}

// MH-07 clarifications: a "New account" needs the full details, while
// "Just a name" needs only the name (the phone is optional)
interface AccountDetails {
  name: string;
  surname: string;
  email: string;
  phoneNumber: string;
}

interface QuickDetails {
  name: string;
  phoneNumber: string;
}

const NO_ACCOUNT: AccountDetails = { name: "", surname: "", email: "", phoneNumber: "" };
const NO_QUICK: QuickDetails = { name: "", phoneNumber: "" };

const card = "bg-white border border-stone-200 rounded-lg p-5";
const inputClass = "mt-1 w-full border border-stone-300 rounded px-3 py-2 bg-white";
const primaryButton =
  "px-5 py-2.5 rounded bg-green-700 text-white font-medium hover:bg-green-800 disabled:bg-stone-300";

const seats = (n: number) => `${n} ${n === 1 ? "seat" : "seats"}`;
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

const contact = (hiker: HikerMatch) =>
  [hiker.email, hiker.phoneNumber].filter(Boolean).join(" · ");

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col text-sm">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

// The password of a "New account", to tell the hiker at the desk or on the phone
function TemporaryPassword({ password, email }: { password: string; email: string | null }) {
  return (
    <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1">
      <p>
        Temporary password: <span className="font-mono font-semibold">{password}</span>
      </p>
      <p className="text-sm text-stone-700">
        Tell it to the hiker: they will have to change it at their first login.
        {email && ` It was also sent to ${email}.`}
      </p>
    </div>
  );
}

// The backend's message for a hiker that could not be created
function creationError(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    return "An account with this email already exists: find the hiker under Existing hiker.";
  }
  if (err instanceof ApiError && err.status === 400) {
    return "Some details are not valid: check the email and the phone number.";
  }
  return err instanceof Error ? err.message : String(err);
}

function ConfirmedReservation({ confirmed, onNew }: { confirmed: Confirmed; onNew: () => void }) {
  const { booking, date, slot, hiker, temporaryPassword } = confirmed;
  const tableCode = (tableId: number) =>
    slot.tables.find((t) => t.tableId === tableId)?.code ?? `#${tableId}`;

  return (
    <div className={`${card} space-y-4`}>
      <p className="text-lg font-semibold text-green-700">✓ Reservation confirmed</p>
      <p className="text-2xl font-semibold">
        {booking.reservations
          .map((r) => `${tableCode(r.tableId)} · ${seats(r.seats)}`)
          .join(", ")}
      </p>
      <p className="text-stone-600">
        {hiker.name} {hiker.surname} · {people(booking.partySize)} · {formatDay(date, "short")},{" "}
        {slot.from}–{slot.to}
      </p>
      {temporaryPassword && <TemporaryPassword password={temporaryPassword} email={hiker.email} />}
      <button type="button" onClick={onNew} className={primaryButton}>
        New reservation
      </button>
    </div>
  );
}

export default function EmployeeReservationPage() {
  const [date, setDate] = useState(todayString());
  // Kept as text so the field can be empty while typing
  const [partySize, setPartySize] = useState("2");
  const [slotId, setSlotId] = useState<number | null>(null);
  const [mode, setMode] = useState<HikerMode>("existing");
  const [hiker, setHiker] = useState<HikerMatch | null>(null);
  const [account, setAccount] = useState<AccountDetails>(NO_ACCOUNT);
  const [quick, setQuick] = useState<QuickDetails>(NO_QUICK);
  // The password of the hiker just created with "New account", until the reservation is done
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedAvailability | null>(null);
  // Changing it loads the availability again, after a booking changed the seats
  const [reload, setReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  const party = Number(partySize);
  const validParty = Number.isInteger(party) && party >= 1 && party <= MAX_PARTY_SIZE;
  const key = validParty ? `${date}|${party}|${reload}` : null;

  useEffect(() => {
    if (!validParty) return;
    const requestKey = `${date}|${party}|${reload}`;
    let ignore = false;

    getAvailability(date, party)
      .then((data) => {
        if (!ignore) setLoaded({ key: requestKey, slots: data.slots, error: null });
      })
      .catch((err: Error) => {
        if (!ignore) setLoaded({ key: requestKey, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date, party, validParty, reload]);

  const current = loaded?.key === key ? loaded : null;
  const slots = current?.slots ?? [];
  const started = (slot: SlotAvailability) => slotHasStarted(date, slot.from);
  // Unlike hikers, staff have no 2-hour limit: they can book until the slot starts
  const bookable = (slot: SlotAvailability) => slot.available && !started(slot);
  const selectedSlot = slots.find((s) => s.slotId === slotId && bookable(s)) ?? null;

  function changeDate(value: string) {
    setDate(value);
    setSlotId(null);
    setError(null);
  }

  function changePartySize(value: string) {
    setPartySize(value);
    setError(null);
  }

  function selectSlot(id: number) {
    setSlotId(id);
    setError(null);
  }

  function changeMode(value: HikerMode) {
    setMode(value);
    setError(null);
  }

  function chooseHiker(value: HikerMatch | null) {
    setHiker(value);
    setTemporaryPassword(null);
    setError(null);
  }

  function changeAccount(field: keyof AccountDetails, value: string) {
    setAccount((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function changeQuick(field: keyof QuickDetails, value: string) {
    setQuick((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function startNew() {
    setConfirmed(null);
    setPartySize("2");
    setSlotId(null);
    setHiker(null);
    setAccount(NO_ACCOUNT);
    setQuick(NO_QUICK);
    setTemporaryPassword(null);
    setMode("existing");
    setReload((r) => r + 1);
  }

  // What the backend needs to create the hiker, or null while something required is missing
  function newHiker(): NewHiker | null {
    if (mode === "account") {
      const details = {
        name: account.name.trim(),
        surname: account.surname.trim(),
        email: account.email.trim(),
        phoneNumber: account.phoneNumber.trim(),
      };
      return Object.values(details).every(Boolean) ? { type: "TEMPORARY", ...details } : null;
    }
    if (mode === "temporary") {
      const name = quick.name.trim();
      const phoneNumber = quick.phoneNumber.trim();
      if (!name) return null;
      return phoneNumber ? { type: "THROWAWAY", name, phoneNumber } : { type: "THROWAWAY", name };
    }
    return null;
  }

  const ready = mode === "existing" ? hiker !== null : newHiker() !== null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot || !ready) return;

    setSubmitting(true);
    setError(null);

    let target = hiker;
    let password = temporaryPassword;
    const details = newHiker();
    if (mode !== "existing" && details) {
      try {
        const created = await createHiker(details);
        target = created;
        password = created.temporaryPassword ?? null;
        // From now on the hiker exists: if the reservation fails, trying again
        // must not create them twice, so they become the chosen hiker
        setHiker(created);
        setTemporaryPassword(password);
        setMode("existing");
        setAccount(NO_ACCOUNT);
        setQuick(NO_QUICK);
      } catch (err) {
        setError(creationError(err));
        setSubmitting(false);
        return;
      }
    }
    if (!target) {
      setSubmitting(false);
      return;
    }

    try {
      const booking = await createStaffBooking({
        hikerId: target.id,
        slotId: selectedSlot.slotId,
        partySize: party,
      });
      setConfirmed({
        booking,
        date,
        slot: selectedSlot,
        hiker: target,
        temporaryPassword: password,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Someone else may have taken the seats in the meantime
      setReload((r) => r + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New reservation</h1>
        <p className="text-stone-600">For hikers who call, write or arrive at the hut.</p>
      </div>

      {confirmed ? (
        <ConfirmedReservation confirmed={confirmed} onNew={startNew} />
      ) : (
        <form onSubmit={handleSubmit} className={`${card} space-y-6`}>
          <Step number={1} title="When and how many">
            <DayBar date={date} onChange={changeDate} />

            <label className="flex flex-col text-sm w-28">
              People
              <input
                type="number"
                min={1}
                max={MAX_PARTY_SIZE}
                step={1}
                value={partySize}
                onChange={(e) => changePartySize(e.target.value)}
                className={inputClass}
              />
            </label>

            {!validParty && (
              <p className="text-sm text-amber-700">Enter a number of people from 1 to {MAX_PARTY_SIZE}</p>
            )}
            {validParty && !current && <p className="text-stone-500">Loading…</p>}
            {current?.error && <p className="text-red-600">Error: {current.error}</p>}
            {current && !current.error && slots.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-stone-300 p-8 text-center text-stone-500">
                No slots on this day
              </div>
            )}

            {slots.length > 0 && (
              <div role="group" aria-label="Time slot" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slots.map((slot) => {
                  const selected = slot.slotId === selectedSlot?.slotId;
                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      aria-pressed={selected}
                      disabled={!bookable(slot)}
                      onClick={() => selectSlot(slot.slotId)}
                      className={`rounded-lg border-2 p-3 text-left transition-colors disabled:bg-stone-100 disabled:border-stone-200 disabled:text-stone-400 ${
                        selected
                          ? "border-green-600 bg-green-50"
                          : "border-stone-200 bg-white hover:border-stone-400"
                      }`}
                    >
                      <span className="block font-semibold">
                        {slot.from}–{slot.to}
                      </span>
                      <span className="block text-sm">
                        {started(slot) ? "Started" : `${seats(slot.availableSeats)} free`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {slots.length > 0 && !slots.some(bookable) && (
              <p className="text-sm text-amber-700">
                No room for {people(party)} on this day: try another day
              </p>
            )}
          </Step>

          {selectedSlot && (
            <Step number={2} title="Who">
              <div role="group" aria-label="Hiker" className="flex flex-wrap gap-2">
                {HIKER_MODES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={mode === option.value}
                    onClick={() => changeMode(option.value)}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      mode === option.value
                        ? "border-green-600 bg-green-50 text-green-800 font-medium"
                        : "border-stone-300 bg-white hover:border-green-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {mode === "existing" &&
                (hiker ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-green-600 bg-green-50 p-3">
                      <div>
                        <p className="font-semibold">
                          {hiker.name} {hiker.surname}
                        </p>
                        <p className="text-sm text-stone-600">{contact(hiker)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => chooseHiker(null)}
                        className="ml-auto text-sm text-stone-600 hover:underline"
                      >
                        Change
                      </button>
                    </div>
                    {/* Created just now, but not reserved yet: the password must not get lost */}
                    {temporaryPassword && (
                      <TemporaryPassword password={temporaryPassword} email={hiker.email} />
                    )}
                  </div>
                ) : (
                  <HikerSearch onSelect={chooseHiker} />
                ))}

              {/* A real account: the hiker gets a password to change at the first login */}
              {mode === "account" && (
                <fieldset className="space-y-3">
                  <legend className="sr-only">New account</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" value={account.name} onChange={(v) => changeAccount("name", v)} required />
                    <Field label="Surname" value={account.surname} onChange={(v) => changeAccount("surname", v)} required />
                    <Field label="Email" type="email" value={account.email} onChange={(v) => changeAccount("email", v)} required />
                    <Field label="Mobile number" type="tel" value={account.phoneNumber} onChange={(v) => changeAccount("phoneNumber", v)} required />
                  </div>
                  <p className="text-sm text-stone-500">
                    A password is generated for the hiker: you'll see it after reserving.
                  </p>
                </fieldset>
              )}

              {/* Just a name: the hiker cannot log in */}
              {mode === "temporary" && (
                <fieldset className="space-y-3">
                  <legend className="sr-only">Just a name</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" value={quick.name} onChange={(v) => changeQuick("name", v)} required />
                    <Field label="Phone (optional)" type="tel" value={quick.phoneNumber} onChange={(v) => changeQuick("phoneNumber", v)} />
                  </div>
                  <p className="text-sm text-stone-500">No account: this hiker won't be able to log in.</p>
                </fieldset>
              )}
            </Step>
          )}

          {selectedSlot && (
            <div className="flex flex-wrap items-center gap-4 border-t border-stone-200 pt-4">
              <p>
                {formatDay(date, "short")}, {selectedSlot.from}–{selectedSlot.to} · {people(party)}
              </p>
              <button
                type="submit"
                disabled={submitting || !ready}
                className={`ml-auto ${primaryButton}`}
              >
                {submitting ? "Reserving…" : "Reserve"}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}