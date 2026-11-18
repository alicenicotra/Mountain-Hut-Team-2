import { and, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "../db/database.ts";
import { reservationsTable, tableAvailabilityTable, timeSlotTable } from "../db/schema.ts";
import { todayString } from "./slot-rules.ts";
import { SlotError } from "./slots.ts";
import { addUtcDays, isMonday, planWeekCopy } from "./week-copy-plan.ts";

export interface CopyWeekInput {
  sourceWeekStart: string;
  targetWeekStart: string;
  weeks: number;
}

/** Copy slots and their table associations, not tables or reservations. */
export async function copyWeeklySchedule(input: CopyWeekInput) {
  const { sourceWeekStart, targetWeekStart, weeks } = input;
  if (!isMonday(sourceWeekStart) || !isMonday(targetWeekStart)) {
    throw new SlotError(400, "Week start dates must be Mondays");
  }
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) {
    throw new SlotError(400, "weeks must be between 1 and 12");
  }
  if (targetWeekStart < todayString()) {
    throw new SlotError(400, "Cannot copy a schedule into the past");
  }

  const sourceWeekEnd = addUtcDays(sourceWeekStart, 6);
  const targetEnd = addUtcDays(targetWeekStart, weeks * 7 - 1);

  // Avoid reading the same week we are simultaneously writing to.
  if (sourceWeekStart <= targetEnd && targetWeekStart <= sourceWeekEnd) {
    throw new SlotError(400, "Source and destination weeks must not overlap");
  }

  // One write transaction means a conflict in the last week rolls back ALL copies.
  return db.transaction(
    async (tx) => {
      const sourceSlots = await tx
        .select()
        .from(timeSlotTable)
        .where(and(
          gte(timeSlotTable.date, sourceWeekStart),
          lte(timeSlotTable.date, sourceWeekEnd),
        ));

      if (sourceSlots.length === 0) {
        throw new SlotError(404, "Source week has no slots");
      }

      const plan = planWeekCopy(sourceWeekStart, targetWeekStart, weeks, sourceSlots);
      const destinationSlots = await tx
        .select()
        .from(timeSlotTable)
        .where(and(
          gte(timeSlotTable.date, targetWeekStart),
          lte(timeSlotTable.date, targetEnd),
        ));

      // MH-09 clarification: replacing a destination week is allowed only when
      // none of its existing slots has an active (non-canceled) reservation.
      // Check ALL requested weeks before replacing any slot; the entire operation
      // remains atomic, including deletion of previously canceled reservations.
      const destinationIds = destinationSlots.map((slot) => slot.id);
      if (destinationIds.length > 0) {
        const activeBookings = await tx
          .select({ id: reservationsTable.id })
          .from(reservationsTable)
          .where(and(
            inArray(reservationsTable.slotId, destinationIds),
            ne(reservationsTable.status, "CANCELED"),
          ))
          .limit(1);
        if (activeBookings.length > 0) {
          throw new SlotError(409, "Destination week contains bookings; nothing was copied");
        }
      }

      const links = await tx
        .select({
          slotId: tableAvailabilityTable.slotId,
          tableId: tableAvailabilityTable.tableId,
        })
        .from(tableAvailabilityTable)
        .where(inArray(tableAvailabilityTable.slotId, sourceSlots.map((s) => s.id)));

      const tablesBySourceSlot = new Map<number, number[]>();
      for (const { slotId, tableId } of links) {
        const tableIds = tablesBySourceSlot.get(slotId) ?? [];
        tableIds.push(tableId);
        tablesBySourceSlot.set(slotId, tableIds);
      }

      if (destinationIds.length > 0) {
        // CANCELED rows are historical bookings: remove them first to avoid
        // violating the reservations.slot_id foreign key when slots are deleted.
        // reservation_allergens cascades on reservation deletion; table links
        // cascade when the old slots are deleted.
        await tx.delete(reservationsTable)
          .where(inArray(reservationsTable.slotId, destinationIds));
        await tx.delete(timeSlotTable)
          .where(inArray(timeSlotTable.id, destinationIds));
      }

      for (const item of plan) {
        const [created] = await tx
          .insert(timeSlotTable)
          .values({ date: item.date, from: item.from, to: item.to })
          .returning();
        const tableIds = tablesBySourceSlot.get(item.sourceSlotId) ?? [];
        if (tableIds.length > 0) {
          await tx.insert(tableAvailabilityTable).values(
            tableIds.map((tableId) => ({ slotId: created.id, tableId })),
          );
        }
      }

      return {
        sourceWeekStart,
        targetWeekStart,
        weeks,
        copiedSlots: plan.length,
      };
    },
    { behavior: "immediate" },
  );
}
