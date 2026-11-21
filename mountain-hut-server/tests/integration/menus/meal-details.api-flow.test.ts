import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import {
  allergensTable,
  dishAllergenTable,
  dishesTable,
  usersTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

/**
 * MH-135: integration tests for MH-11 (view meal details), through the real
 * routes and a temporary SQLite database: local.db is never touched.
 * Staff define menus and slots through the API (MH-10), then a guest reads
 * them from GET /meals, as the story's "user" would.
 * Dishes and allergens have no API yet, so they are inserted as the catalog.
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

const PASSWORD = "meal-flow-test";
const nextYear = new Date().getUTCFullYear() + 1;
const DAY = `${nextYear}-07-15`;
let staff = "";

// Catalog: ids are fixed so the expected responses are easy to read
const MILK = 1;
const GLUTEN = 2;
const POLENTA = 1; // MAIN, no allergens
const STRUDEL = 2; // DESSERT, milk + gluten
const TAGLIERE = 3; // APPETIZER, milk

async function login(email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  return [response.headers["set-cookie"]].flat().map((c) => String(c).split(";")[0]).join("; ");
}

async function createMenu(name: string, dishes: number[]) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/menus",
    headers: { cookie: staff },
    payload: { name, type: "TEMPLATE", dishes },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

function createSlot(date: string, from: string, to: string, menuIds: number[]) {
  return app.inject({
    method: "POST",
    url: "/api/v1/slots",
    headers: { cookie: staff },
    payload: { date, from, to, menuIds },
  });
}

// No cookie: the story is "as a user", guests included
function getMeals(date: string) {
  return app.inject({ method: "GET", url: `/api/v1/meals?date=${date}` });
}

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetTestDatabase(client);
  const passwordHash = await argon2.hash(PASSWORD);
  await db.insert(usersTable).values([
    { email: "staff@meal.test", passwordHash, name: "Erin", surname: "Staff", type: "EMPLOYEE" },
    { email: "anna@meal.test", passwordHash, name: "Anna", surname: "Alpine", type: "HIKER" },
  ]);
  await db.insert(allergensTable).values([
    { id: MILK, name: "Milk" },
    { id: GLUTEN, name: "Gluten" },
  ]);
  await db.insert(dishesTable).values([
    { id: POLENTA, name: "Polenta", description: "With mushrooms", course: "MAIN" },
    { id: STRUDEL, name: "Strudel", description: null, course: "DESSERT" },
    { id: TAGLIERE, name: "Tagliere", description: "Local cheese", course: "APPETIZER" },
  ]);
  await db.insert(dishAllergenTable).values([
    { dishId: STRUDEL, allergenId: MILK },
    { dishId: STRUDEL, allergenId: GLUTEN },
    { dishId: TAGLIERE, allergenId: MILK },
  ]);
  staff = await login("staff@meal.test");
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("MH-11 view meal details: menus defined by staff, read by a guest", () => {
  it("shows a guest the menu that staff specified for a slot, with dishes and allergens", async () => {
    const alpino = await createMenu("Menu Alpino", [STRUDEL, POLENTA, TAGLIERE]);
    const light = await createMenu("Menu Leggero", [POLENTA]);
    const slot = await createSlot(DAY, "12:00", "14:00", [alpino, light]);
    expect(slot.statusCode).toBe(201);

    const response = await getMeals(DAY);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        slotId: slot.json().id,
        date: DAY,
        from: "12:00",
        to: "14:00",
        menus: [
          {
            id: alpino,
            name: "Menu Alpino",
            type: "TEMPLATE",
            allergens: [
              { id: GLUTEN, name: "Gluten" },
              { id: MILK, name: "Milk" },
            ],
            dishes: [
              {
                id: TAGLIERE,
                name: "Tagliere",
                description: "Local cheese",
                course: "APPETIZER",
                allergens: [{ id: MILK, name: "Milk" }],
              },
              {
                id: POLENTA,
                name: "Polenta",
                description: "With mushrooms",
                course: "MAIN",
                allergens: [],
              },
              {
                id: STRUDEL,
                name: "Strudel",
                description: null,
                course: "DESSERT",
                allergens: [
                  { id: GLUTEN, name: "Gluten" },
                  { id: MILK, name: "Milk" },
                ],
              },
            ],
          },
          {
            id: light,
            name: "Menu Leggero",
            type: "TEMPLATE",
            allergens: [],
            dishes: [
              {
                id: POLENTA,
                name: "Polenta",
                description: "With mushrooms",
                course: "MAIN",
                allergens: [],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("stops showing a menu that staff cancel, but keeps its meal time", async () => {
    const alpino = await createMenu("Menu Alpino", [STRUDEL]);
    const light = await createMenu("Menu Leggero", [POLENTA]);
    expect((await createSlot(DAY, "19:00", "21:00", [alpino, light])).statusCode).toBe(201);

    const cancel = await app.inject({
      method: "DELETE",
      url: `/api/v1/menus/${alpino}`,
      headers: { cookie: staff },
    });
    expect(cancel.statusCode).toBe(204);

    const meals = (await getMeals(DAY)).json();
    expect(meals).toHaveLength(1);
    expect(meals[0].from).toBe("19:00");
    expect(meals[0].menus.map((menu: { name: string }) => menu.name)).toEqual(["Menu Leggero"]);

    // Once its last menu is canceled, the meal time is still listed, with no menu
    await app.inject({ method: "DELETE", url: `/api/v1/menus/${light}`, headers: { cookie: staff } });
    const after = (await getMeals(DAY)).json();
    expect(after).toHaveLength(1);
    expect(after[0].menus).toEqual([]);
  });

  it("does not create a slot with a menu that does not exist", async () => {
    const alpino = await createMenu("Menu Alpino", [POLENTA]);

    const response = await createSlot(DAY, "12:00", "14:00", [alpino, alpino + 100]);

    expect(response.statusCode).toBe(404);
    expect((await getMeals(DAY)).json()).toEqual([]);
  });

  it("shows the same meals to every user: guests, hikers and staff", async () => {
    const alpino = await createMenu("Menu Alpino", [STRUDEL, POLENTA]);
    expect((await createSlot(DAY, "12:00", "14:00", [alpino])).statusCode).toBe(201);
    const hiker = await login("anna@meal.test");

    const guest = await getMeals(DAY);
    const asHiker = await app.inject({
      method: "GET",
      url: `/api/v1/meals?date=${DAY}`,
      headers: { cookie: hiker },
    });
    const asStaff = await app.inject({
      method: "GET",
      url: `/api/v1/meals?date=${DAY}`,
      headers: { cookie: staff },
    });

    expect(guest.statusCode).toBe(200);
    expect(guest.json()[0].menus[0].name).toBe("Menu Alpino");
    expect(asHiker.statusCode).toBe(200);
    expect(asHiker.json()).toEqual(guest.json());
    expect(asStaff.statusCode).toBe(200);
    expect(asStaff.json()).toEqual(guest.json());
  });

  it("shows only the meal times of the requested day, not the ones next to it", async () => {
    const alpino = await createMenu("Menu Alpino", [POLENTA]);
    const before = `${nextYear}-07-14`;
    const after = `${nextYear}-07-16`;
    for (const date of [before, DAY, after]) {
      expect((await createSlot(date, "19:00", "21:00", [alpino])).statusCode).toBe(201);
    }
    expect((await createSlot(DAY, "12:00", "14:00", [alpino])).statusCode).toBe(201);

    const meals = (await getMeals(DAY)).json();

    expect(meals.map((meal: { date: string; from: string }) => [meal.date, meal.from])).toEqual([
      [DAY, "12:00"],
      [DAY, "19:00"],
    ]);
  });
});
