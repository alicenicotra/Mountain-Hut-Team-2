# Mountain Hut — Team 2

A web application for managing meal reservations and dining schedules at an Alpine mountain hut.

Hikers can view real-time table availability, book meals with specific dietary needs and allergen requirements, receive automated email confirmations, and modify existing bookings. Hut staff (employees and managers) can configure daily time slots, allocate tables, manage capacities, and create bookings on behalf of hikers.

---

## Tech Stack

| Layer        | Technologies                                                                                         |
| :----------- | :--------------------------------------------------------------------------------------------------- |
| **Frontend** | React 19 · TypeScript 5.9 · Vite 8 · Tailwind CSS v4 · React Router v8                               |
| **Backend**  | Node.js (v20–v24) · TypeScript · Fastify v5 · Zod · `@fastify/secure-session`                        |
| **Database** | SQLite via `@libsql/client` · Drizzle ORM · Drizzle Kit                                              |
| **Email**    | Nodemailer (SMTP transport) · Mailpit (local dev/testing) · Brevo (production relay)                 |
| **Testing**  | Vitest (client & server unit/integration) · Playwright (cross-browser E2E) · Hurl (auth integration) |
| **API Docs** | OpenAPI 3.0 / Swagger UI (`/docs`)                                                                   |

---

## Project Structure

```text
Mountain-Hut-Team-2/
├── mountain-hut-client/          # React frontend application
│   ├── src/
│   │   ├── api/                  # Backend API client functions (fetch wrappers)
│   │   ├── assets/               # Static assets (images, video)
│   │   ├── components/
│   │   │   ├── auth/             # AuthField
│   │   │   ├── booking/          # ChangeBookingPanel, RequirementsFields
│   │   │   ├── layout/           # AuthShell, Layout, Navbar, RequireRole
│   │   │   └── slots/            # AddTableForm, CopyTablesPicker, CreateSlotForm, SlotList, TimeField
│   │   ├── context/              # AuthProvider, AuthContext
│   │   ├── hooks/                # useAuth
│   │   ├── pages/                # One component per route
│   │   ├── types/                # Shared TypeScript types
│   │   └── utils/                # Date helpers, booking-rules
│   └── tests/
│       ├── unit/                 # Vitest unit tests (api/, components/, pages/, utils/)
│       └── e2e/                  # Playwright end-to-end tests
├── mountain-hut-server/          # Fastify REST API backend
│   ├── src/
│   │   ├── auth/                 # Registration, login, session handlers
│   │   ├── booking/
│   │   │   ├── routes/           # HTTP route handlers (availability, booking, change, staff)
│   │   │   ├── services/         # Business logic (booking, change-booking, availability, notifications)
│   │   │   └── rules/            # Pure domain rules (allocation, booking-rules, change-rules)
│   │   ├── slots/                # Time-slot & table configuration routes and logic
│   │   ├── allergens/            # Allergen list routes
│   │   ├── notifications/        # SMTP email sender and utilities
│   │   ├── db/                   # Drizzle schema, database client, seed script
│   │   ├── config.ts             # Environment variable validation (Zod)
│   │   └── server.ts             # Fastify app factory and entry point
│   ├── tests/
│   │   ├── unit/                 # Vitest unit tests
│   │   └── integration/          # Vitest integration tests and Hurl auth scenarios
│   └── docs/
│       ├── openapi.yaml          # Hand-written OpenAPI 3.0 specification (served at /docs)
│       ├── database.drawio       # Database ER diagram
│       └── archive/              # Superseded per-task design notes (kept for historical context)
├── retrospective/
│   └── sprint-1.md               # Sprint 1 retrospective
├── .github/workflows/            # CI (ci.yml) and E2E (e2e.yml) GitHub Actions workflows
├── flake.nix / flake.lock        # Nix development environment
├── LICENSE                       # EUPL-1.2
└── README.md
```

---

## Prerequisites

- **[Node.js](https://nodejs.org/)** >= 20.x (LTS recommended; tested on v22 and v24)
- **npm** >= 10.x
- **[Docker](https://www.docker.com/)** _(optional)_ — to run Mailpit locally for email capture during development
- SQLite is file-based and embedded — no external database server is required.

---

## Quick Start

### 1. Backend

From the repository root:

```bash
cd mountain-hut-server
npm install

# 1. Copy and fill in environment variables
cp .env.template .env

# 2. Push the Drizzle schema to SQLite (creates local.db)
npm run db:init

# 3. Seed demo users, tables, time slots, and allergens
npm run db:seed

# 4. Start the development server
npm run dev
```

The API server starts on **`http://localhost:3000`**.
Interactive API documentation is available at **`http://localhost:3000/docs`**.
All routes are prefixed with `/api/v1` (e.g. `GET /api/v1/availability`).

---

### 2. Frontend

In a separate terminal:

```bash
cd mountain-hut-client
npm install

# Start the Vite development server
npm run dev
```

The frontend application starts on **`http://localhost:5173`**.
Vite proxies all `/api` requests to `http://localhost:3000`, so `/api/v1/...` calls reach the backend automatically.

---

### 3. Local Email Capture (Mailpit)

The backend sends booking confirmation emails via SMTP. During local development, all outgoing messages are intercepted by **[Mailpit](https://mailpit.axllent.org/)** — a local fake SMTP server — so no real email is ever sent.

```bash
docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
# If the container already exists: docker start mailpit
```

| URL                     | Purpose                                           |
| :---------------------- | :------------------------------------------------ |
| `http://localhost:8025` | Web inbox — inspect captured confirmation emails  |
| `localhost:1025`        | SMTP endpoint — pre-configured in `.env.template` |

> If Docker is not available the application continues to run normally. Failed email deliveries are logged without blocking bookings.

---

## Demo Accounts

The seed script (`npm run db:seed`) creates the following test accounts:

| Role         | Email                       | Password       | Notes                                          |
| :----------- | :-------------------------- | :------------- | :--------------------------------------------- |
| **Hiker**    | `giulia.verdi@example.com`  | `giuliaverdi`  | Has existing booking history                   |
| **Hiker**    | `mario.rossi@example.com`   | `mariorossi`   | Standard hiker account                         |
| **Employee** | `luca.neri@example.com`     | `lucaneri`     | Staff account — manages slots & staff bookings |
| **Employee** | `test.employee@example.com` | `Password123!` | Secondary staff account for testing            |

New hiker accounts can also be registered directly from the frontend at `/register`.

---

## Using the Application

### As a Hiker

1. **Register or log in** at `/login` (or `/register` for a new account).
2. **Check availability and book** (`/booking`):
   - Select a date and party size to view real-time slot availability.
   - Choose a time slot, then select dietary allergens (Milk, Eggs, Peanuts, Wheat, etc.) and add free-text requirements or notes.
   - Confirm the booking. Table allocation is computed automatically to minimise unused seats.
   - Bookings close **2 hours before the slot start time**.
   - A confirmation email with the booking reference, date, time, and requirements is sent to the hiker's registered address. Check `http://localhost:8025` during development.
3. **Manage bookings** (`/my-bookings`):
   - View upcoming and past reservations.
   - Modify party size or time slot within **48 hours of the original booking creation**, provided the slot's 2-hour cutoff has not passed.

### As Hut Staff (Employee / Manager)

1. **Log in** with a staff account (e.g. `luca.neri@example.com`).
2. **Manage slots and tables** (`/employee/slots`):
   - Navigate day by day to create lunch and dinner slots.
   - Assign available tables (T1–T6) to specific slots.
   - Copy the previous day's table layout or apply presets.
3. **Staff reservations** (`/employee/slots` → staff booking form):
   - Book on behalf of a hiker by supplying the hiker's registered ID.
   - Staff bookings bypass the 2-hour cutoff but cannot be placed after the slot ends.

---

## Running Tests

### Backend

```bash
cd mountain-hut-server

# All tests (unit + integration)
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Frontend

```bash
cd mountain-hut-client

# All Vitest unit tests
npm test

# Unit tests only
npm run test:unit

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# ESLint check
npm run lint

# TypeScript check + production build
npm run build
```

### End-to-End (Playwright)

Requires both servers to be running (backend on port 3000, frontend on port 5173).

```bash
cd mountain-hut-client

# Install browser binaries (first time only)
npx playwright install chromium

# Run the E2E suite
npm run test:e2e
```

---

## Production Email Configuration

To send real emails in production, replace the Mailpit SMTP settings with an external relay such as [Brevo](https://www.brevo.com/) in `mountain-hut-server/.env`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-account-email@example.com
SMTP_PASS=your-brevo-smtp-key
MAIL_FROM_ADDRESS=reservations@mountain-hut.example
MAIL_FROM_NAME="Mountain Hut Reservations"
MAIL_REPLY_TO=info@mountain-hut.example
```

> `SMTP_PASS` is the **SMTP key** generated in the Brevo dashboard, not the Brevo account password. No code changes are required — only configuration.

---

## Git & Contribution Workflow

1. Branch from `dev`:
   ```bash
   git checkout dev && git pull origin dev
   git checkout -b feature/MH-xx-short-description
   ```
2. Commit with the task reference:
   ```bash
   git commit -m "MH-xx: concise description of change"
   ```
3. Push and open a Pull Request targeting **`dev`**.
4. All CI checks must pass before merging: ESLint, TypeScript build, backend tests, frontend tests, E2E tests.

---

## License

This project is licensed under the **[European Union Public Licence v1.2 (EUPL-1.2)](https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12)** — see [LICENSE](LICENSE).
