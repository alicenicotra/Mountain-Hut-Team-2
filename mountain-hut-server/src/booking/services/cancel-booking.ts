import { and, eq } from "drizzle-orm";
import { db } from "../../db/database.ts";
import {
  reservationsTable,
  timeSlotTable,
  usersTable,
} from "../../db/schema.ts";
import { BookingError } from "./booking.ts";
import { hutSlotStartMs } from "../rules/booking-rules.ts";

export interface CancelBookingInput {
  bookingId: number;
  /** Trusted user ID supplied by the authenticated HTTP session. */
  userId: number;
  now?: Date;
}

export interface CancelBookingResult {
  id: number;
  status: "CANCELED";
}

/**
 * Cancels a booking atomically, updating all associated table reservation rows
 * to status "CANCELED".
 *
 * Enforces:
 * - Only registered HIKERs can cancel bookings.
 * - Only the owner of the booking can cancel it (404 otherwise to prevent enumeration).
 * - Only PLACED bookings can be canceled (409 if already CANCELED or FULFILLED).
 * - Bookings cannot be canceled after the time slot has started or is in the past (409).
 */
export async function cancelBooking(
  input: CancelBookingInput,
): Promise<CancelBookingResult> {
  const { bookingId, userId, now = new Date() } = input;

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) throw new BookingError(404, "User not found");
    if (user.type !== "HIKER") {
      throw new BookingError(403, "Only hikers can cancel bookings");
    }

    const [selected] = await tx
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.id, bookingId))
      .limit(1);

    // Do not disclose another hiker's booking or status.
    if (!selected || selected.userId !== userId) {
      throw new BookingError(404, "Booking not found");
    }

    if (selected.status !== "PLACED") {
      throw new BookingError(409, "Only placed bookings may be canceled");
    }

    const [slot] = await tx
      .select()
      .from(timeSlotTable)
      .where(eq(timeSlotTable.id, selected.slotId))
      .limit(1);
    if (!slot) {
      throw new BookingError(404, "Time slot not found");
    }

    const slotStartEpoch = hutSlotStartMs(slot.date, slot.from);
    if (now.getTime() >= slotStartEpoch) {
      throw new BookingError(409, "Time slot has already started");
    }

    // A booking may span multiple rows across tables.
    // In list-bookings and change-booking, rows belonging to the same logical booking
    // share userId, slotId, createdAt, and status "PLACED".
    await tx
      .update(reservationsTable)
      .set({ status: "CANCELED" })
      .where(
        and(
          eq(reservationsTable.userId, userId),
          eq(reservationsTable.slotId, selected.slotId),
          eq(reservationsTable.createdAt, selected.createdAt),
          eq(reservationsTable.status, "PLACED"),
        ),
      );

    return {
      id: bookingId,
      status: "CANCELED",
    };
  });
}
