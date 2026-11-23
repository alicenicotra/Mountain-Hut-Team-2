# Mountain Hut — Backend

Fastify REST API backend for the Mountain Hut reservation system, built with TypeScript, Drizzle ORM, and SQLite.

---

## Quick Start

```bash
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
All routes are prefixed with `/api/v1` (e.g. `GET /api/v1/availability`).

---

## npm Scripts

| Command                    | Description                                            |
| :------------------------- | :----------------------------------------------------- |
| `npm run dev`              | Start the server with `nodemon` (hot reload)           |
| `npm run db:init`          | Push the Drizzle schema to SQLite (`drizzle-kit push`) |
| `npm run db:seed`          | Seed demo data (`src/db/seed.ts`)                      |
| `npm test`                 | Run all Vitest tests (unit + integration)              |
| `npm run test:unit`        | Run only `tests/unit/`                                 |
| `npm run test:integration` | Run only `tests/integration/`                          |
| `npm run test:watch`       | Run Vitest in watch mode                               |
| `npm run test:coverage`    | Generate V8 code coverage report                       |

---

## API Documentation

With the server running, open **`http://localhost:3000/docs`** to view the interactive Swagger UI.

The specification is maintained by hand in [`docs/openapi.yaml`](docs/openapi.yaml). When adding or changing a route, update that file as well — `tests/integration/openapi/openapi.route-specification.test.ts` fails if a declared route is missing from it.

---

## Source Structure

```text
mountain-hut-server/src/
├── auth/
│   ├── auth-repository.ts    # Database queries for user lookup and creation
│   ├── auth-routes.ts        # POST /api/v1/auth/register, /login, /logout; GET /api/v1/auth/me
│   └── auth-schema.ts        # Zod schemas for auth request/response bodies
├── booking/
│   ├── routes/
│   │   ├── availability-routes.ts     # GET /api/v1/availability
│   │   ├── booking-routes.ts          # POST /api/v1/bookings
│   │   ├── change-booking-routes.ts   # PATCH /api/v1/bookings/:bookingId
│   │   └── staff-booking-routes.ts    # POST /api/v1/staff/bookings
│   ├── services/
│   │   ├── availability.ts            # Seat availability computation
│   │   ├── booking.ts                 # Reservation creation (transaction + allocation)
│   │   ├── booking.notification.ts    # Triggers confirmation email after booking
│   │   ├── change-booking.ts          # Booking modification (transaction + allocation)
│   │   └── list-bookings.ts           # GET /api/v1/bookings/mine — hiker booking history
│   └── rules/
│       ├── allocation.ts              # Table allocation algorithm (minimise tables/waste)
│       ├── booking-rules.ts           # 2-hour cutoff, slot bookability checks
│       └── change-rules.ts            # 48-hour change-window logic
├── slots/
│   ├── slot-routes.ts        # GET/POST/DELETE /api/v1/slots and /api/v1/tables
│   ├── slot-rules.ts         # Date validation rules for slot creation
│   ├── slots.ts              # Slot service functions
│   └── tables.ts             # Table service functions
├── allergens/
│   ├── allergen-routes.ts    # GET /api/v1/allergens
│   └── allergens.ts          # Allergen list data
├── notifications/
│   ├── sender.ts             # SmtpEmailSender class and emailSender singleton
│   └── utils.ts              # Email template rendering (subject, plain text, HTML)
├── db/
│   ├── schema.ts             # Drizzle table definitions (users, time_slots, tables, reservations, …)
│   ├── database.ts           # @libsql/client + Drizzle client setup
│   └── seed.ts               # Demo data seed script
├── config.ts                 # Zod-validated environment variable loading
└── server.ts                 # Fastify app factory (buildApp) and entry point
```

---

## Test Structure

```text
mountain-hut-server/tests/
├── test-database.ts                              # In-memory SQLite factory for integration tests
├── unit/
│   ├── allergens/
│   │   └── allergen-routes.error-response.test.ts
│   ├── booking/
│   │   ├── allocation.table-selection.test.ts
│   │   ├── availability-routes.query-behavior.test.ts
│   │   ├── booking-rules.booking-cutoff.test.ts
│   │   └── change-rules.booking-change-window.test.ts
│   ├── config/
│   │   └── config.environment-validation.test.ts
│   ├── db/
│   │   └── schema.table-definitions.test.ts
│   ├── notifications/
│   │   ├── confirmation.email-content.test.ts
│   │   └── sender.smtp-delivery.test.ts
│   ├── server/
│   │   └── server.app-startup.test.ts
│   └── slots/
│       └── slot-rules.slot-date-validation.test.ts
└── integration/
    ├── allergens/
    │   └── allergens.allergen-api.test.ts
    ├── auth/
    │   ├── login/     # Hurl scenarios (successful-login, wrong-password, …)
    │   └── register/  # Hurl scenarios (successful-registration, user-already-exists, …)
    ├── booking/
    │   ├── booking-routes.booking-endpoints.test.ts
    │   ├── change-booking-routes.booking-change-endpoint.test.ts
    │   └── change-booking.booking-lifecycle.test.ts
    ├── notifications/
    │   └── confirmation.booking-email.test.ts
    ├── openapi/
    │   └── openapi.route-specification.test.ts
    └── slots/
        └── slot-routes.slot-and-table-routes.test.ts
```

---

## Email Notifications

The backend sends booking confirmation emails via SMTP using [Nodemailer](https://nodemailer.com/).

### Local Development (Mailpit)

Emails are intercepted by [Mailpit](https://mailpit.axllent.org/) — no real messages are sent.

```bash
docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
# If the container already exists: docker start mailpit
```

The `.env.template` defaults point to Mailpit out of the box:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

Open `http://localhost:8025` to inspect captured emails.

### Production (Brevo)

To send real emails, update the SMTP variables in `.env` with your Brevo credentials. No code changes are required.

1. Create a free account at [brevo.com](https://www.brevo.com/) (free plan: up to 300 emails/day).
2. Go to **SMTP & API → SMTP** and generate an SMTP key.
3. Set the following variables:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-brevo-account-email>
SMTP_PASS=<your-brevo-smtp-key>
MAIL_FROM_ADDRESS=reservations@mountain-hut.example
MAIL_FROM_NAME=Mountain Hut Reservations
MAIL_REPLY_TO=reservations@mountain-hut.example
```

> `SMTP_PASS` is the **SMTP key** from the Brevo dashboard, not the Brevo account password.

---

## Docs Directory

| File                                           | Description                                                                      |
| :--------------------------------------------- | :------------------------------------------------------------------------------- |
| [`docs/openapi.yaml`](docs/openapi.yaml)       | Hand-written OpenAPI 3.0 spec; served by Swagger UI at `/docs`                   |
| [`docs/database.drawio`](docs/database.drawio) | Database ER diagram (draw.io format)                                             |
| [`docs/archive/`](docs/archive/)               | Superseded per-task design notes kept for historical context — not authoritative |
