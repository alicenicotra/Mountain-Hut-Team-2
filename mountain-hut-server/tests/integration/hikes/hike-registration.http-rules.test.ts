import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { hikesTable, usersTable } from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

/**
 * MH-141: integration tests for MH-20 (register a hike), through the real
 * routes and a temporary SQLite database: local.db is never touched.
 * They cover what staff need when a hiker does not come back (context.md and
 * the MH-21 notes): times, contacts, the hike details and the list order.
 */
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __testClient: client, __testCleanup: cleanup };
});

const { db, __testClient: client, __testCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    db: typeof import("../../../src/db/database.ts")["db"];
    __testClient: Client;
    __testCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
const app = buildApp({ logger: false });

const PASSWORD = "hike-http-rules-test";
const nextYear = new Date().getUTCFullYear() + 1;
let anna = "";
let bruno = "";
let staff = "";

async function login(email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  return [response.headers["set-cookie"]].flat().map((c) => String(c).split(";")[0]).join("; ");
}

function registerHike(cookie: string, hike: object) {
  return app.inject({ method: "POST", url: "/api/v1/hikes", headers: { cookie }, payload: hike });
}

function readHikes(cookie: string, url: "/api/v1/hikes" | "/api/v1/hikes/mine") {
  return app.inject({ method: "GET", url, headers: { cookie } });
}

// A valid hike on a day of next year; times are local hut times (Europe/Rome)
function hikeOn(day: string, from = "08:00", to = "17:00", offset = "+01:00") {
  return {
    departureAt: `${nextYear}-${day}T${from}:00${offset}`,
    expectedReturnAt: `${nextYear}-${day}T${to}:00${offset}`,
    destination: "Monviso summit",
    routeDescription: "Via the Chiaretto lake",
  };
}

beforeAll(async () => {
  await app.ready();
  const passwordHash = await argon2.hash(PASSWORD);
  await resetTestDatabase(client);
  await db.insert(usersTable).values([
    { email: "anna@hike.test", passwordHash, name: "Anna", surname: "Alpine", type: "HIKER", phoneNumber: "+39 333 1111111" },
    { email: "bruno@hike.test", passwordHash, name: "Bruno", surname: "Bivouac", type: "HIKER", phoneNumber: "+39 333 2222222" },
    { email: "staff@hike.test", passwordHash, name: "Erin", surname: "Staff", type: "EMPLOYEE" },
  ]);
  anna = await login("anna@hike.test");
  bruno = await login("bruno@hike.test");
  staff = await login("staff@hike.test");
});

beforeEach(async () => {
  await db.delete(hikesTable);
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("MH-20 register a hike: rules over HTTP", () => {
  it("stores the times in UTC, in winter and in summer time", async () => {
    const winter = await registerHike(anna, hikeOn("01-15", "08:00", "17:00", "+01:00"));
    const summer = await registerHike(anna, hikeOn("07-15", "08:00", "17:00", "+02:00"));

    expect(winter.statusCode).toBe(201);
    expect(summer.statusCode).toBe(201);
    expect(winter.json()).toMatchObject({
      departureAt: `${nextYear}-01-15T07:00:00.000Z`,
      expectedReturnAt: `${nextYear}-01-15T16:00:00.000Z`,
    });
    expect(summer.json()).toMatchObject({
      departureAt: `${nextYear}-07-15T06:00:00.000Z`,
      expectedReturnAt: `${nextYear}-07-15T15:00:00.000Z`,
    });
  });

  it("saves a hike without an emergency contact, and staff still see the hiker's phone", async () => {
    const response = await registerHike(anna, hikeOn("03-10"));

    expect(response.statusCode).toBe(201);
    expect(response.json().emergencyContactPhone).toBeNull();
    const [hike] = (await readHikes(staff, "/api/v1/hikes")).json();
    expect(hike.emergencyContactPhone).toBeNull();
    expect(hike.hiker).toEqual({ name: "Anna", surname: "Alpine", phoneNumber: "+39 333 1111111" });
  });

  it("lists hikes for staff by expected return, the earliest first", async () => {
    await registerHike(anna, hikeOn("03-12", "08:00", "18:00"));
    await registerHike(bruno, hikeOn("03-12", "09:00", "12:00"));
    await registerHike(anna, hikeOn("03-11", "08:00", "20:00"));

    const response = await readHikes(staff, "/api/v1/hikes");

    expect(response.statusCode).toBe(200);
    expect(response.json().map((h: { expectedReturnAt: string }) => h.expectedReturnAt)).toEqual([
      `${nextYear}-03-11T19:00:00.000Z`,
      `${nextYear}-03-12T11:00:00.000Z`,
      `${nextYear}-03-12T17:00:00.000Z`,
    ]);
  });

  it("lists a hiker's own hikes with the latest departure first", async () => {
    await registerHike(anna, hikeOn("04-02"));
    await registerHike(anna, hikeOn("04-20"));
    await registerHike(anna, hikeOn("04-10"));

    const response = await readHikes(anna, "/api/v1/hikes/mine");

    expect(response.statusCode).toBe(200);
    expect(response.json().map((h: { departureAt: string }) => h.departureAt.slice(0, 10))).toEqual([
      `${nextYear}-04-20`,
      `${nextYear}-04-10`,
      `${nextYear}-04-02`,
    ]);
  });

  it("shows staff the hikes of every hiker, each with its own hiker", async () => {
    await registerHike(anna, { ...hikeOn("05-01"), destination: "Monviso summit" });
    await registerHike(bruno, { ...hikeOn("05-02"), destination: "Colle delle Traversette" });

    const hikes = (await readHikes(staff, "/api/v1/hikes")).json();

    expect(hikes.map((h: { destination: string; hiker: { name: string } }) =>
      `${h.destination} - ${h.hiker.name}`)).toEqual([
      "Monviso summit - Anna",
      "Colle delle Traversette - Bruno",
    ]);
  });

  it("gives back the hike as sent, without extra spaces and with the points in order", async () => {
    const response = await registerHike(anna, {
      ...hikeOn("06-05"),
      destination: "  Monviso summit ",
      routeDescription: " Via the Chiaretto lake  ",
      intermediatePoints: [" Lago Chiaretto", "Viso Mozzo ", "Passo delle Sagnette"],
      emergencyContactPhone: " +39 347 0000000 ",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      destination: "Monviso summit",
      routeDescription: "Via the Chiaretto lake",
      intermediatePoints: ["Lago Chiaretto", "Viso Mozzo", "Passo delle Sagnette"],
      emergencyContactPhone: "+39 347 0000000",
    });
    const [mine] = (await readHikes(anna, "/api/v1/hikes/mine")).json();
    expect(mine).toEqual(response.json());
  });
});
