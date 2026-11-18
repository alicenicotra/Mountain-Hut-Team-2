import { describe, it, expect, vi, beforeEach } from "vitest";
import { cancelBooking } from "../../../src/booking/services/cancel-booking.ts";
import { db } from "../../../src/db/database.ts";

// Mock db
vi.mock("../../../src/db/database.ts", () => ({
  db: { transaction: vi.fn() },
}));

describe("cancelBooking (Unit Tests)", () => {
  // Happy Path data
  const validUser = { id: 1, type: "HIKER" };
  const validReservation = {
    id: 100,
    userId: 1,
    slotId: 50,
    status: "PLACED",
    createdAt: new Date("2026-11-10T10:00:00Z"),
  };
  const validSlot = {
    id: 50,
    date: "2026-11-20",
    from: "12:00", // (in the future compared to fixedNow)
  };
  const fixedNow = new Date("2026-11-18T10:00:00Z");

  let mockUpdateSet: ReturnType<typeof vi.fn>;
  let mockUpdateWhere: ReturnType<typeof vi.fn>;

  function setupTransactionMocks(
    userResult: any[],
    reservationResult: any[],
    slotResult: any[],
  ) {
    const mockLimit = vi
      .fn()
      .mockResolvedValueOnce(userResult) // 1st query: usersTable
      .mockResolvedValueOnce(reservationResult) // 2nd query: reservationsTable
      .mockResolvedValueOnce(slotResult); // 3rd query: timeSlotTable

    mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });

    const fakeTx = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: mockLimit }),
        }),
      }),
      update: () => ({
        set: mockUpdateSet,
      }),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      return callback(fakeTx as any);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a valid PLACED booking in the future", async () => {
    setupTransactionMocks([validUser], [validReservation], [validSlot]);

    const result = await cancelBooking({
      bookingId: 100,
      userId: 1,
      now: fixedNow,
    });

    expect(result).toEqual({ id: 100, status: "CANCELED" });
    expect(mockUpdateSet).toHaveBeenCalledWith({ status: "CANCELED" });
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("throws 404 if user does not exist", async () => {
    setupTransactionMocks([], [], []);

    await expect(
      cancelBooking({ bookingId: 100, userId: 999, now: fixedNow }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found",
    });
  });

  it("throws 403 if user is not a HIKER", async () => {
    setupTransactionMocks([{ id: 2, type: "EMPLOYEE" }], [], []);

    await expect(
      cancelBooking({ bookingId: 100, userId: 2, now: fixedNow }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only hikers can cancel bookings",
    });
  });

  it("throws 404 if booking belongs to another user (prevents enumeration)", async () => {
    const otherUserReservation = { ...validReservation, userId: 99 };
    setupTransactionMocks([validUser], [otherUserReservation], []);

    await expect(
      cancelBooking({ bookingId: 100, userId: 1, now: fixedNow }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Booking not found",
    });
  });

  it("throws 409 if booking is already CANCELED or FULFILLED", async () => {
    const canceledReservation = { ...validReservation, status: "CANCELED" };
    setupTransactionMocks([validUser], [canceledReservation], []);

    await expect(
      cancelBooking({ bookingId: 100, userId: 1, now: fixedNow }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Only placed bookings may be canceled",
    });
  });

  it("throws 409 if the time slot has already started (boundary check)", async () => {
    const exactStartTime = new Date("2026-11-20T12:00:00Z");
    setupTransactionMocks([validUser], [validReservation], [validSlot]);

    await expect(
      cancelBooking({ bookingId: 100, userId: 1, now: exactStartTime }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Time slot has already started",
    });
  });

  it("throws 404 if time slot is not found", async () => {
    // 1) valid user
    // 2) valid PLACED booking
    // 3) 3rd query (on timeSlotTable) returns an empty returns an empty array
    setupTransactionMocks([validUser], [validReservation], []);

    await expect(
      cancelBooking({ bookingId: 100, userId: 1, now: fixedNow }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Time slot not found",
    });

    // ensure that no update is performed if a slot is missing
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
