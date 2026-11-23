import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import argon2 from "argon2";
import type { Client } from "@libsql/client";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  reservationsTable,
  tableAvailabilityTable,
  tablesTable,
  timeSlotTable,
  usersTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";
import { addUtcDays } from "../../../src/slots/week-copy-plan.ts";

/**
 * MH-130: integration tests for copying a week onto a week that already has
 * slots. MH-09 clarification (12 Nov, course issue #45): this is possible only
 * if the destination has no reservations, and then the copy completely
 * replaces the existing schedule.
 *
 * Real routes and a temporary SQLite database: local.db is never touched.
 */
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __testClient: client, __testCleanup: cleanup };
});

const { db } = await import("../../../src/db/database.ts");
const { __testClient: client, __testCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __testClient: Client;
    __testCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
const app = buildApp({ logger: false });

// A Monday a few weeks ahead, so that every week of the test is in the future
function futureMonday(): string {
  const today = new Date();
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7 || 7) + 14);
  return day.toISOString().slice(0, 10);
}

const sourceWeek = futureMonday();
const targetWeek = addUtcDays(sourceWeek, 7);
const thirdWeek = addUtcDays(sourceWeek, 14);
const password = "copy-week-destination-test";
let employeeCookie = "";

async function createUsers(passwordHash: string) {
  await db.insert(usersTable).values([
    { email: "employee@copy.test", passwordHash, name: "Erin", surname: "Staff", type: "EMPLOYEE" },
    { email: "hiker@copy.test", passwordHash, name: "Hugo", surname: "Hiker", type: "HIKER" },
  ]);
}

async function login(email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  return [response.headers["set-cookie"]].flat().map((c) => String(c).split(";")[0]).join("; ");
}

function copyWeek(weeks = 1) {
  return app.inject({
    method: "POST",
    url: "/api/v1/slots/copy-week",
    payload: { sourceWeekStart: sourceWeek, targetWeekStart: targetWeek, weeks },
    headers: { cookie: employeeCookie },
  });
}

async function tableId(code: string) {
  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.code, code));
  return table.id;
}

async function addSlot(date: string, from: string, to: string, tableCodes: string[]) {
  const [slot] = await db.insert(timeSlotTable).values({ date, from, to }).returning();
  for (const code of tableCodes) {
    await db.insert(tableAvailabilityTable).values({ slotId: slot.id, tableId: await tableId(code) });
  }
  return slot;
}

async function bookSlot(slotId: number, tableCode: string, status: "PLACED" | "CANCELED" = "PLACED") {
  const [hiker] = await db.select().from(usersTable).where(eq(usersTable.email, "hiker@copy.test"));
  await db.insert(reservationsTable).values({
    userId: hiker.id,
    slotId,
    tableId: await tableId(tableCode),
    partySize: 2,
    status,
  });
}

// "Mon 12:00-13:30 T1,T2" for each slot of the week, by day and time
async function scheduleOf(weekStart: string) {
  const slots = await db
    .select()
    .from(timeSlotTable)
    .where(and(gte(timeSlotTable.date, weekStart), lte(timeSlotTable.date, addUtcDays(weekStart, 6))))
    .orderBy(asc(timeSlotTable.date), asc(timeSlotTable.from));
  if (slots.length === 0) return [];

  const links = await db
    .select({ slotId: tableAvailabilityTable.slotId, code: tablesTable.code })
    .from(tableAvailabilityTable)
    .innerJoin(tablesTable, eq(tableAvailabilityTable.tableId, tablesTable.id))
    .where(inArray(tableAvailabilityTable.slotId, slots.map((s) => s.id)))
    .orderBy(asc(tablesTable.code));

  const weekday = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return slots.map((slot) => {
    const codes = links.filter((l) => l.slotId === slot.id).map((l) => l.code);
    return `${weekday(slot.date)} ${slot.from}-${slot.to} ${codes.join(",") || "-"}`;
  });
}

// Monday with two tables, Wednesday without tables, Sunday with one table
const SOURCE_SCHEDULE = ["Mon 12:00-13:30 T1,T2", "Wed 19:00-21:00 -", "Sun 12:00-14:00 T3"];

async function seedSourceWeek() {
  await addSlot(sourceWeek, "12:00", "13:30", ["T1", "T2"]);
  await addSlot(addUtcDays(sourceWeek, 2), "19:00", "21:00", []);
  await addSlot(addUtcDays(sourceWeek, 6), "12:00", "14:00", ["T3"]);
}

beforeAll(async () => {
  await app.ready();
  const passwordHash = await argon2.hash(password);
  await resetTestDatabase(client);
  await createUsers(passwordHash);
  employeeCookie = await login("employee@copy.test");
});

beforeEach(async () => {
  // Keeps the users, so the session cookie stays valid
  await client.execute("PRAGMA foreign_keys = OFF");
  for (const table of ["reservation_allergens", "reservations", "table_availability", "time_slots", "tables"]) {
    await client.execute(`DELETE FROM ${table}`);
  }
  await client.execute("PRAGMA foreign_keys = ON");
  await db.insert(tablesTable).values([
    { code: "T1", seats: 2 },
    { code: "T2", seats: 4 },
    { code: "T3", seats: 6 },
  ]);
  await seedSourceWeek();
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("MH-09 copy a week: the destination week", () => {
  it("copies into an empty week the same weekdays, times and tables", async () => {
    const response = await copyWeek();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ copiedSlots: 3 });
    expect(await scheduleOf(targetWeek)).toEqual(SOURCE_SCHEDULE);
    expect(await scheduleOf(sourceWeek)).toEqual(SOURCE_SCHEDULE);
  });

  it("makes the copied slots available to hikers", async () => {
    await copyWeek();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/availability?date=${targetWeek}&partySize=5`,
    });

    expect(response.statusCode).toBe(200);
    const [monday] = response.json().slots;
    expect(monday).toMatchObject({ from: "12:00", to: "13:30", availableSeats: 6, available: true });
  });

  it("replaces a week without bookings, also the slots that do not overlap", async () => {
    await addSlot(targetWeek, "12:30", "13:00", ["T3"]); // overlaps the Monday copy
    await addSlot(addUtcDays(targetWeek, 4), "08:00", "09:00", ["T1"]); // Friday, no overlap

    const response = await copyWeek();

    expect(response.statusCode).toBe(201);
    expect(await scheduleOf(targetWeek)).toEqual(SOURCE_SCHEDULE);
  });

  it("refuses a week with a booking, and changes nothing", async () => {
    const friday = await addSlot(addUtcDays(targetWeek, 4), "08:00", "09:00", ["T1"]);
    await bookSlot(friday.id, "T1");

    const response = await copyWeek();

    expect(response.statusCode).toBe(409);
    expect(await scheduleOf(targetWeek)).toEqual(["Fri 08:00-09:00 T1"]);
    expect(await db.select().from(reservationsTable)).toHaveLength(1);
  });

  // Team decision: a canceled booking is not an active one
  it("replaces a week whose only bookings are canceled", async () => {
    const friday = await addSlot(addUtcDays(targetWeek, 4), "08:00", "09:00", ["T1"]);
    await bookSlot(friday.id, "T1", "CANCELED");

    const response = await copyWeek();

    expect(response.statusCode).toBe(201);
    expect(await scheduleOf(targetWeek)).toEqual(SOURCE_SCHEDULE);
  });

  it("with more weeks, a booking in a later week stops the whole copy", async () => {
    const thursday = await addSlot(addUtcDays(thirdWeek, 3), "19:00", "20:00", ["T2"]);
    await bookSlot(thursday.id, "T2");

    const response = await copyWeek(2);

    expect(response.statusCode).toBe(409);
    expect(await scheduleOf(targetWeek)).toEqual([]);
    expect(await scheduleOf(thirdWeek)).toEqual(["Thu 19:00-20:00 T2"]);
  });

  it("replaces only the destination weeks, not the week after them", async () => {
    await addSlot(addUtcDays(thirdWeek, 1), "12:00", "13:00", ["T1"]);

    const response = await copyWeek(1);

    expect(response.statusCode).toBe(201);
    expect(await scheduleOf(thirdWeek)).toEqual(["Tue 12:00-13:00 T1"]);
  });
});
