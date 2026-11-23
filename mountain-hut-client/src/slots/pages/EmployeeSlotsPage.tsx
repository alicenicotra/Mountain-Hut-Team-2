import { useEffect, useState } from "react";
import { getSlots, getTables } from "../api/slots-api.ts";
import { getSlotMenus, type SlotMenu } from "../api/slot-menus-api.ts";
import AddTableForm from "../components/AddTableForm.tsx";
import CreateSlotForm from "../components/CreateSlotForm.tsx";
import SlotList from "../components/SlotList.tsx";
import CopyWeekForm from "../components/CopyWeekForm.tsx";
import DayBar from "../../shared/components/DayBar.tsx";
import PageHeader from "../../shared/components/PageHeader.tsx";
import SectionTitle from "../../shared/components/SectionTitle.tsx";
import Icon from "../../shared/components/Icon.tsx";
import { sectionCard as card } from "../../shared/styles.ts";
import { todayString } from "../../shared/utils/date.ts";
import type { Table, TimeSlot } from "../types/slot.ts";

interface SlotsResult {
  date: string;
  slots: TimeSlot[];
  error: string | null;
}

const byStartTime = (a: TimeSlot, b: TimeSlot) => a.from.localeCompare(b.from);

export default function EmployeeSlotsPage() {
  const [date, setDate] = useState(todayString());
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [menus, setMenus] = useState<SlotMenu[]>([]);
  const [menusError, setMenusError] = useState<string | null>(null);
  // Remembers which date the slots belong to: while it differs from `date`
  // the slots of the newly chosen day are still loading
  const [slotsResult, setSlotsResult] = useState<SlotsResult | null>(null);
  const [reloadSlots, setReloadSlots] = useState(0);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    getTables()
      .then((data) => {
        if (!ignore) setTables(data);
      })
      .catch((err: Error) => {
        if (!ignore) setTablesError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    getSlots(date)
      .then((slots) => {
        if (!ignore) setSlotsResult({ date, slots, error: null });
      })
      .catch((err: Error) => {
        if (!ignore) setSlotsResult({ date, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date, reloadSlots]);

  useEffect(() => {
    let ignore = false;
    getSlotMenus()
      .then((available) => {
        if (!ignore) {
          setMenus(available);
          setMenusError(null);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) setMenusError(err instanceof Error ? err.message : String(err));
      });
    return () => { ignore = true; };
  }, []);

  const loadingSlots = slotsResult?.date !== date;

  function handleSlotCreated(slot: TimeSlot) {
    setSlotsResult((current) =>
      current && current.date === slot.date
        ? { ...current, slots: [...current.slots, slot].sort(byStartTime) }
        : current,
    );
  }

  function handleWeekCopied(targetWeekStart: string, copiedSlots: number, weeks: number) {
    setCopyNotice(`Copied ${copiedSlots} slots into ${weeks} ${weeks === 1 ? "week" : "weeks"}`);
    setSlotsResult(null);
    setDate(targetWeekStart);
    setReloadSlots((previous) => previous + 1);
  }

  return (
    // Wider than the default layout column: the page needs room for the table grid
    <div className="relative left-1/2 -translate-x-1/2 w-[min(80rem,calc(100vw-2rem))] space-y-6">
      <PageHeader
        icon="calendar"
        eyebrow="Staff · Planning"
        title="Slots and tables"
        subtitle="Hikers can only book the slots defined here."
      />

      <div className={card}>
        <DayBar date={date} onChange={setDate} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr] items-start">
        <section className={`${card} space-y-4 lg:sticky lg:top-20`}>
          <SectionTitle icon="clock" title="Slots of the day" hint="Opening times hikers can choose from" />
          {loadingSlots ? (
            <div className="flex items-center gap-3 py-6 text-stone-500">
              <span className="w-5 h-5 rounded-full border-2 border-green-600 border-t-transparent animate-spin" aria-hidden="true" />
              <p>Loading…</p>
            </div>
          ) : slotsResult.error ? (
            <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              <Icon name="warning" className="w-6 h-6" />
              <span>Error: {slotsResult.error}</span>
            </p>
          ) : (
            <SlotList slots={slotsResult.slots} />
          )}
        </section>

        <div className="space-y-6">
          <section className={`${card} space-y-5`} style={{ animationDelay: "80ms" }}>
            <SectionTitle icon="plus" title="New slot" hint="Pick a time, the tables and the menus" />
            {tablesError ? (
              <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                <Icon name="warning" className="w-6 h-6" />
                <span>Error: {tablesError}</span>
              </p>
            ) : (
              <CreateSlotForm
                // A new day starts with an empty form
                key={date}
                date={date}
                tables={tables}
                menus={menus}
                menusError={menusError}
                onCreated={handleSlotCreated}
              />
            )}
          </section>

          <section className={`${card} space-y-4`} style={{ animationDelay: "160ms" }}>
            <SectionTitle icon="repeat" title="Copy weekly schedule" />
            <CopyWeekForm key={date} selectedDate={date} onCopied={handleWeekCopied} />
            {copyNotice && (
              <p role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800 animate-pop-in">
                <Icon name="check" className="w-5 h-5" />
                {copyNotice}
              </p>
            )}
          </section>

          <section className={`${card} space-y-4`} style={{ animationDelay: "240ms" }}>
            <SectionTitle icon="tables" title="Add a table" hint={`${tables.length} tables in the hut`} />
            <AddTableForm onCreated={(table) => setTables((ts) => [...ts, table])} />
          </section>
        </div>
      </div>
    </div>
  );
}
