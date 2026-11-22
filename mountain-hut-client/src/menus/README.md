# MH-162 — Manage Menus frontend

Route: `/employee/menus` (EMPLOYEE / MANAGER only).

This page uses the menu/dish response contracts from the work-in-progress
`feature/backend-menu-support` branch, not yet merged into `dev` at the time
of implementation:

- `GET /api/v1/menus` — `{ id, name, type, dishes[] }[]`
- `POST /api/v1/menus` — `{ name, type: "MODIFIED", dishes: number[] }` -> `{ id }`
- `GET /api/v1/dishes` — `{ id, name, description, course }[]`

Saving a menu **always creates a new `MODIFIED` menu**; the UI does not
silently overwrite a `TEMPLATE` or an existing custom menu.

## Known backend dependencies

- `POST /api/v1/dishes` is not implemented yet. In real backend mode the
  new-dish form is intentionally read-only. In `VITE_USE_MOCKS=true` mode it
  works with in-memory demo data.
- `ingredients` are not exposed by the backend dish schema. They are NOT the
  same as allergens. Ingredient checkboxes in the form are demo-only until a
  dedicated persistence contract is agreed.
- The current `menu_dishes` join table has no position column; the numbered
  course slots are an editing aid and order cannot yet be promised after a
  reload. Add an explicit `position`/`sortOrder` if persistent ordering is needed.
- Assignment of menus to time slots and weekly schedule reuse are separate
  integrations; this frontend does not alter slot creation or copying.
- Mock data is only active with `VITE_USE_MOCKS=true`, matching the existing
  client convention. Production mode never falls back to fake data.

## Manual verification

1. Log in as EMPLOYEE or MANAGER; open **Manage menus** in the navbar.
2. Select a default menu and verify its numbered dishes appear on the right.
3. Change a dish, enter a unique name, and save a **custom copy**.
4. Create a blank menu using **New menu** and select at least one dish.
5. In mock mode, create a dish with a name, category, ingredients, and select
   the new dish from a course dropdown.
6. In backend mode, check that the dish form explains the missing API rather
   than falsely claiming success.

Tests: `npm test -- tests/unit/menus` from `mountain-hut-client`.
