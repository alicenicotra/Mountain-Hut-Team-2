import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import {
  menusTable,
  tablesTable,
  timeSlotMenuTable,
  timeSlotTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";
import { todayString } from "../../../src/slots/slot-rules.ts";

/**
 * Integration tests for the slot ↔ menu assignment feature.
 *
 * Story: As an employee, I want to specify the menus for the defined slots,
 * so that hikers know when the hut is providing the service.
 *
 * Only the database connection is replaced with a temporary SQLite database;
 * routes, validation, and queries are the real ones.
 */
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return {
    db,
    __integrationTestClient: client,
    __integrationTestCleanup: cleanup,
  };
});

// Imported after vi.mock so that the routes use the temporary SQLite database
const { db: testDb } = await import("../../../src/db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");

const app = buildApp({ logger: false });

// ---------------------------------------------------------------------------
// Fixed fixtures (IDs are stable because the counter restarts on each reset)
// ---------------------------------------------------------------------------

const T1 = { id: 1, code: "T1", seats: 4 };

const M1 = { id: 1, name: "Standard Menu", type: "TEMPLATE" as const };
const M2 = { id: 2, name: "Vegetarian Menu", type: "TEMPLATE" as const };

function dayFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return todayString(d);
}

const DAY = dayFromToday(10);
const OTHER_DAY = dayFromToday(11);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const TEST_PASSWORD = "test-password-for-slot-menu";
let passwordHash = "";

async function insertUser(email: string, type: string) {
  await client.execute({
    sql: `INSERT INTO users(email, password_hash, name, surname, type)
          VALUES (?, ?, 'Test', 'User', ?)`,
    args: [email, passwordHash, type],
  });
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: TEST_PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  const setCookie = res.headers["set-cookie"];
  return [setCookie]
    .flat()
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.split(";")[0])
    .join("; ");
}

let employeeCookie = "";
let hikerCookie = "";

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function createSlot(
  overrides: Record<string, unknown> = {},
  cookie: string = employeeCookie,
) {
  return app.inject({
    method: "POST",
    url: "/api/v1/slots",
    payload: {
      date: DAY,
      from: "12:00",
      to: "13:00",
      tableIds: [T1.id],
      ...overrides,
    },
    headers: cookie ? { cookie } : {},
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await app.ready();
  passwordHash = await argon2.hash(TEST_PASSWORD);

  // Insert users once — session cookies remain valid for all tests because
  // the user rows always get the same IDs after each resetTestDatabase call
  await insertUser("employee@menu-test.com", "EMPLOYEE");
  await insertUser("hiker@menu-test.com", "HIKER");

  employeeCookie = await login("employee@menu-test.com");
  hikerCookie = await login("hiker@menu-test.com");
});

beforeEach(async () => {
  await resetTestDatabase(client);

  // Re-create users after the reset (IDs are stable so cookies stay valid)
  await insertUser("employee@menu-test.com", "EMPLOYEE");
  await insertUser("hiker@menu-test.com", "HIKER");

  // Seed one table and two menus for every test
  await testDb.insert(tablesTable).values([T1]);
  await testDb.insert(menusTable).values([M1, M2]);
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

// ---------------------------------------------------------------------------
// Helper: read timeslot_menu rows directly from the DB
// ---------------------------------------------------------------------------

async function slotMenuRows(slotId: number) {
  return testDb
    .select()
    .from(timeSlotMenuTable)
    .where(eq(timeSlotMenuTable.slotId, slotId));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/slots — menu assignment", () => {
  it("creates a slot with a single menu and persists the association", async () => {
    const res = await createSlot({ menuIds: [M1.id] });

    expect(res.statusCode).toBe(201);
    const slot = res.json();
    expect(slot.id).toBeTypeOf("number");

    const rows = await slotMenuRows(slot.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].menuId).toBe(M1.id);
  });

  it("creates a slot with multiple menus and persists all associations", async () => {
    const res = await createSlot({ menuIds: [M1.id, M2.id] });

    expect(res.statusCode).toBe(201);
    const slot = res.json();

    const rows = await slotMenuRows(slot.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.menuId).sort()).toEqual([M1.id, M2.id].sort());
  });

  it("creates a slot with an empty menuIds array and stores no associations", async () => {
    const res = await createSlot({ menuIds: [] });

    expect(res.statusCode).toBe(201);
    const slot = res.json();

    const rows = await slotMenuRows(slot.id);
    expect(rows).toHaveLength(0);
  });

  it("creates a slot without the menuIds field and stores no associations", async () => {
    // menuIds is omitted entirely — the schema defaults it to []
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/slots",
      payload: { date: DAY, from: "12:00", to: "13:00", tableIds: [T1.id] },
      headers: { cookie: employeeCookie },
    });

    expect(res.statusCode).toBe(201);
    const slot = res.json();

    const rows = await slotMenuRows(slot.id);
    expect(rows).toHaveLength(0);
  });

  it("returns 404 when a single menuId does not exist", async () => {
    const res = await createSlot({ menuIds: [99999] });

    expect(res.statusCode).toBe(404);
    // No slot should have been inserted
    const slots = await testDb.select().from(timeSlotTable);
    expect(slots).toHaveLength(0);
  });

  it("returns 404 when any menuId in a mixed list does not exist", async () => {
    const res = await createSlot({ menuIds: [M1.id, 99999] });

    expect(res.statusCode).toBe(404);
    const slots = await testDb.select().from(timeSlotTable);
    expect(slots).toHaveLength(0);
  });

  it("returns 401 when the user is not logged in", async () => {
    const res = await createSlot({ menuIds: [M1.id] }, "" /* no cookie */);

    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when the user is a hiker (not staff)", async () => {
    const res = await createSlot({ menuIds: [M1.id] }, hikerCookie);

    expect(res.statusCode).toBe(403);
  });

  it("assigns the same menu to two different slots without conflicts", async () => {
    const res1 = await createSlot({
      date: DAY,
      from: "12:00",
      to: "13:00",
      menuIds: [M1.id],
    });
    const res2 = await createSlot({
      date: OTHER_DAY,
      from: "12:00",
      to: "13:00",
      menuIds: [M1.id],
    });

    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);

    const rows1 = await slotMenuRows(res1.json().id);
    const rows2 = await slotMenuRows(res2.json().id);
    expect(rows1).toHaveLength(1);
    expect(rows2).toHaveLength(1);
  });

  it("assigns a CANCELED menu to a slot (verifyIds does not filter by type)", async () => {
    // Cancel M1 directly in the DB
    await testDb
      .update(menusTable)
      .set({ type: "CANCELED" })
      .where(eq(menusTable.id, M1.id));

    // The route should still accept it because verifyIds only checks existence
    const res = await createSlot({ menuIds: [M1.id] });

    expect(res.statusCode).toBe(201);
    const rows = await slotMenuRows(res.json().id);
    expect(rows).toHaveLength(1);
    expect(rows[0].menuId).toBe(M1.id);
  });
});

describe("Menu assignment persistence — DB constraints", () => {
  it("rejects a duplicate menuId within the same slot (composite PK)", async () => {
    // The schema has a composite primary key on (slotId, menuId), so sending
    // the same id twice should trigger a DB-level UNIQUE violation.
    // The server will respond with a 500 (unhandled DB error) or similar;
    // what matters is that the request does NOT succeed with a 201.
    const res = await createSlot({ menuIds: [M1.id, M1.id] });

    expect(res.statusCode).not.toBe(201);
  });
});

describe("GET /api/v1/slots — menus not (yet) exposed in response", () => {
  it("GET /api/v1/slots/:id does not include a menus field (known design gap)", async () => {
    const created = (await createSlot({ menuIds: [M1.id] })).json();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/slots/${created.id}`,
    });

    expect(res.statusCode).toBe(200);
    // The menu association is persisted but the response does not expose it yet
    expect(res.json()).not.toHaveProperty("menus");
  });

  it("GET /api/v1/slots?date= does not include menus in any slot (known design gap)", async () => {
    await createSlot({ menuIds: [M1.id, M2.id] });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/slots?date=${DAY}`,
    });

    expect(res.statusCode).toBe(200);
    const slots: unknown[] = res.json();
    expect(slots).toHaveLength(1);
    expect(slots[0]).not.toHaveProperty("menus");
  });
});
