# 🏔️ Mountain Hut Reservation System

Welcome to the **Mountain Hut** web application! This platform lets hikers book meals and register mountain hikes, while allowing hut staff to manage dining slots, tables, and daily menus.

---

## 🚀 How to Run the App

You can run the entire system in **one command using Docker** (recommended), or run it **locally with Node.js**.

### Option A: Using Docker (Easiest)

> **Prerequisite:** [Docker Desktop](https://www.docker.com/) installed and running.

1. **Start everything:**
   ```bash
   docker compose up
   ```
2. **Open in your browser:**
   - **Frontend App:** [http://localhost](http://localhost)
   - **Backend API:** [http://localhost:3000](http://localhost:3000)

*The database is automatically created and populated with demo data on first start.*

---

### Option B: Running Locally (Node.js)

> **Prerequisite:** [Node.js](https://nodejs.org/) (v20 or newer).

Open two terminal windows:

#### 1. Backend Server
```bash
cd mountain-hut-server
npm install
npm run db:init     # Sets up the database
npm run db:seed     # Loads sample data
npm run dev         # Starts the server on http://localhost:3000
```

#### 2. Frontend App
```bash
cd mountain-hut-client
npm install
npm run dev         # Starts the app on http://localhost:5173
```

Now open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👤 Sample Accounts to Test

The system comes pre-seeded with ready-to-use accounts:

| Role | Email | Password | What you can do |
| :--- | :--- | :--- | :--- |
| **Hut Staff (Employee)** | `test.employee@example.com` | `Password123!` | Configure meal slots, manage menus, and reserve tables on behalf of hikers. |
| **Hiker** | `mario.rossi@example.com` | `mariorossi` | Browse availability, book meals with dietary notes, cancel bookings, and register hikes. |

*You can also click **Register** on the website to create a brand new hiker account.*

---

## 🎯 Main Features

### For Hikers:
- **Table Booking:** Check live seat availability by date and party size, select dining times, and specify dietary/allergen requirements.
- **My Bookings:** View upcoming and past reservations, and cancel upcoming meals within the cancellation window.
- **Mountain Hikes:** Register planned hiking itineraries (departure/return times, trails, and emergency contacts) to keep the hut informed of your safety.

### For Hut Staff:
- **Manage Slots & Tables:** Open dining slots for lunch or dinner, allocate tables, and set capacity limits for any day.
- **Manage Menus:** View standard templates (*Regular*, *Vegan*, *Vegetarian*) and create custom menus from available dishes.
- **Staff Reservations:** Directly reserve tables for hikers walking in or calling on the phone, with optional quick-account creation.

---

## 🧪 Running Tests (Optional)

To verify the codebase:

- **Frontend tests:** `cd mountain-hut-client && npm test`
- **Backend tests:** `cd mountain-hut-server && npm test`
- **End-to-End tests:** `cd mountain-hut-client && npx playwright test`
