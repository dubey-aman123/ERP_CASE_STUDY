# ERP System — Manufacturing & Supply Management

## Overview

A full-stack ERP application implementing the complete manufacturing workflow:

```
Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch
```

Built as a production-quality case study demonstrating:
- PostgreSQL relational design with full data integrity
- Secure JWT authentication + backend RBAC
- Transactional business operations
- PostgreSQL row-level locking for concurrency safety
- Clean layered architecture (controller → service → db)

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Database   | PostgreSQL (with ACID transactions) |
| Backend    | Node.js + Express.js                |
| Auth       | JWT (jsonwebtoken) + bcrypt         |
| Validation | express-validator                   |
| Frontend   | React 18 + Vite                     |
| HTTP       | Axios                               |
| Testing    | Jest + Supertest                    |
| API Docs   | Swagger UI (OpenAPI 3.0)            |

---

## Architecture

```
backend/
├── server.js              # Entry point — DB check + server start
└── src/
    ├── app.js             # Express app, routes, middleware
    ├── config/
    │   ├── index.js       # Centralised env config
    │   └── swagger.js     # OpenAPI 3.0 spec
    ├── db/
    │   ├── pool.js        # PostgreSQL connection pool
    │   ├── migrate.sql    # Full schema with constraints + indexes
    │   ├── migrate.js     # Schema runner
    │   └── seed.js        # Test data seeder
    ├── middleware/
    │   ├── auth.js        # JWT verify + RBAC authorize()
    │   ├── validate.js    # express-validator error aggregator
    │   └── errorHandler.js# Centralised error handler
    ├── controllers/       # HTTP layer — thin wrappers calling services
    ├── services/          # Business logic layer
    │   ├── authService.js
    │   ├── customerService.js
    │   ├── productService.js
    │   ├── enquiryService.js
    │   ├── quotationService.js  # ← Calculates totals server-side
    │   └── salesOrderService.js # ← Concurrency-safe confirmation & dispatch
    ├── routes/            # Route definitions with auth/authorize guards
    ├── validators/
    │   └── rules.js       # All express-validator rule arrays
    └── utils/
        ├── jwt.js         # Sign/verify tokens
        ├── AppError.js    # Operational error class
        └── numberGenerator.js  # Race-safe sequence numbers

frontend/
└── src/
    ├── context/AuthContext.jsx   # JWT storage + role helpers
    ├── services/
    │   ├── api.js                # Axios instance with JWT interceptor
    │   └── erpService.js         # All API call functions
    ├── layouts/                  # AppLayout + Sidebar
    ├── pages/
    │   ├── LoginPage.jsx
    │   ├── CustomersPage.jsx
    │   ├── InventoryPage.jsx
    │   ├── enquiries/
    │   ├── quotations/
    │   └── salesOrders/
    └── utils/helpers.jsx         # formatCurrency, formatDate, etc.
```

---

## ER Diagram

```
┌─────────────┐    ┌────────────┐    ┌──────────────┐
│    users    │    │  customers │    │   products   │
│─────────────│    │────────────│    │──────────────│
│ id (PK)     │    │ id (PK)    │    │ id (PK)      │
│ email UNIQ  │    │company_name│    │product_code  │
│password_hash│    │contact_per │    │ UNIQ         │
│ role        │    │ mobile     │    │product_name  │
│ is_active   │    │ email      │    │ category     │
└─────────────┘    │ city       │    │ unit         │
                   │created_by ─┼───►│ base_price   │
                   │  FK→users  │    └──────┬───────┘
                   └─────┬──────┘           │ 1:1
                         │ 1:N              ▼
                         ▼           ┌────────────┐
                   ┌───────────┐     │ inventory  │
                   │ enquiries │     │────────────│
                   │───────────│     │ id (PK)    │
                   │ id (PK)   │     │product_id  │
                   │enquiry_num│     │ UNIQ FK    │
                   │ UNIQ      │     │physical_qty│
                   │customer_id│     │reserved_qty│
                   │ FK        │     │CHECK:      │
                   │status     │     │ res≤phys   │
                   └─────┬─────┘     └────────────┘
                         │ 1:N
                         ▼
                   ┌─────────────┐
                   │enquiry_items│
                   │─────────────│
                   │ id (PK)     │
                   │ enquiry_id  │
                   │ FK→enquiries│
                   │ product_id  │
                   │ FK→products │
                   │ quantity    │
                   └─────────────┘
                         │
                   (enquiry → quotation)
                         │
                         ▼
                   ┌─────────────┐
                   │ quotations  │
                   │─────────────│
                   │ id (PK)     │
                   │quotation_num│
                   │ UNIQ        │
                   │ enquiry_id  │
                   │ FK          │
                   │ customer_id │
                   │ FK          │
                   │ subtotal    │
                   │discount_amt │
                   │taxable_amt  │
                   │ tax_amount  │
                   │ grand_total │◄─── Calculated by backend
                   │ status      │
                   └─────┬───────┘
                         │ 1:N
                         ▼
                  ┌──────────────┐
                  │quotation_item│
                  │──────────────│
                  │ id (PK)      │
                  │ quotation_id │
                  │ FK           │
                  │ product_id   │
                  │ quantity     │
                  │ unit_price   │
                  │discount_pct  │
                  │ base_amount  │
                  │discount_amt  │
                  │ line_total   │
                  └──────────────┘
                         │
                  (quotation → sales order)
                         │
                         ▼
                  ┌─────────────┐
                  │ sales_orders│
                  │─────────────│
                  │ id (PK)     │
                  │ order_num   │
                  │ UNIQ        │
                  │ quotation_id│
                  │ UNIQ FK     │◄── DB prevents duplicate orders
                  │ customer_id │
                  │ enquiry_id  │
                  │ total_amount│
                  │ status      │
                  └──────┬──────┘
                         │ 1:N
                         ▼
                  ┌──────────────┐
                  │so_items      │
                  │──────────────│
                  │sales_order_id│
                  │ product_id   │
                  │ quantity     │
                  │ unit_price   │
                  │ line_total   │
                  └──────────────┘
                         │
                  (order → dispatch)
                         │
                         ▼
                  ┌──────────────┐
                  │ dispatches   │
                  │──────────────│
                  │ id (PK)      │
                  │dispatch_num  │
                  │ UNIQ         │
                  │sales_order_id│
                  │ UNIQ FK      │◄── DB prevents duplicate dispatch
                  │dispatch_date │
                  │vehicle_number│
                  │ driver_name  │
                  └──────┬───────┘
                         │ 1:N
                         ▼
                  ┌──────────────┐
                  │dispatch_items│
                  │──────────────│
                  │ dispatch_id  │
                  │ product_id   │
                  │ quantity     │
                  └──────────────┘
```

### Key Constraints & Their Purpose

| Constraint | Table | Why |
|---|---|---|
| `UNIQUE(email)` | users | One account per email |
| `UNIQUE(product_code)` | products | Prevents duplicate SKUs |
| `UNIQUE(product_id)` | inventory | One stock record per product |
| `CHECK(reserved_qty <= physical_qty)` | inventory | DB-enforced stock integrity |
| `UNIQUE(enquiry_number)` | enquiries | Race-safe with PostgreSQL sequences |
| `UNIQUE(quotation_number)` | quotations | Same |
| `UNIQUE(quotation_id)` | sales_orders | **Prevents duplicate orders from same quotation** |
| `UNIQUE(order_number)` | sales_orders | Unique order reference |
| `UNIQUE(sales_order_id)` | dispatches | **Prevents duplicate dispatch** |

---

## Prerequisites

- **Node.js** v18+
- **npm** v9+
- **PostgreSQL** v14+

### PostgreSQL Installation (Windows)
1. Download from https://www.postgresql.org/download/windows/
2. Install with default settings, remember the **postgres** user password
3. After install, open **pgAdmin** or **psql** to verify it's running
4. Create the database:
   ```sql
   CREATE DATABASE erp_db;
   ```

---

## Installation & Setup

### 1. Clone / open the project

```bash
cd "ERP PROJECT"
```

### 2. Backend setup

```bash
cd backend
npm install
```

Copy and edit environment file:
```bash
copy .env.example .env
```

Edit `.env` — set your PostgreSQL password:
```
DB_PASSWORD=your_postgres_password
JWT_SECRET=change_this_to_a_long_random_secret
```

### 3. Run database migration

```bash
npm run migrate
```

This creates all tables, constraints, sequences, and indexes.

### 4. Seed test data

```bash
npm run seed
```

This inserts:
- 2 users (ADMIN + SALES_USER)
- 6 industrial products
- Initial inventory
- 3 sample customers

### 5. Start the backend

```bash
npm run dev
```

Backend runs on: **http://localhost:5000**
API Docs (Swagger): **http://localhost:5000/api-docs**

### 6. Frontend setup

```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs on: **http://localhost:5173**

---

## Test Credentials

| Role       | Email                | Password   |
|------------|----------------------|------------|
| ADMIN      | admin@example.com    | Admin@123  |
| SALES_USER | sales@example.com    | Sales@123  |

---

## Running Tests

```bash
cd backend
npm test
```

Tests run without a live database using Jest mocks:

| # | Test | What It Proves |
|---|------|----------------|
| 1 | Quotation total calculation | Backend correctly computes subtotal, discount, GST, grand total |
| 2 | DRAFT/REJECTED → Order | Status validation rejects conversion (returns 400) |
| 3 | Duplicate order prevention | `UNIQUE(quotation_id)` prevents double orders (DB 23505 → HTTP 409) |
| 4 | Inventory reservation limit | Rejects confirm when order qty > available qty |
| 5 | RBAC enforcement | `authorize('ADMIN')` returns 403 for SALES_USER |

---

## API Overview

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | Public | Get JWT |
| GET/POST | /api/customers | Any | List/create customers |
| GET/POST | /api/products | Any/Admin | List products; create (Admin) |
| GET | /api/products/inventory | Any | Stock levels |
| PATCH | /api/products/inventory/:id | Admin | Adjust physical stock |
| GET/POST | /api/enquiries | Any | List/create enquiries |
| GET | /api/enquiries/:id | Any | Enquiry detail |
| GET/POST | /api/quotations | Any | List/create quotations |
| GET | /api/quotations/:id | Any | Quotation detail |
| PATCH | /api/quotations/:id/status | Any | Update status (with transition rules) |
| POST | /api/quotations/:id/convert | Any | Convert to Sales Order |
| GET | /api/sales-orders | Any | List orders |
| GET | /api/sales-orders/:id | Any | Order detail |
| POST | /api/sales-orders/:id/confirm | **Admin** | Confirm + reserve stock |
| POST | /api/sales-orders/:id/dispatch | **Admin** | Dispatch + update inventory |
| POST | /api/sales-orders/:id/cancel | **Admin** | Cancel order |

Full interactive docs: **http://localhost:5000/api-docs**

---

## Inventory Concurrency Approach

### The Problem
Two simultaneous `POST /sales-orders/:id/confirm` requests both see available stock = 100.
Both check: "100 ≥ my_order_qty". Both pass. Both update reserved_qty.
Result: double reservation, stock goes negative. **This is a race condition.**

### The Solution: PostgreSQL `SELECT ... FOR UPDATE`

```sql
-- Inside a transaction, when checking/reserving inventory:
SELECT id, physical_qty, reserved_qty, (physical_qty - reserved_qty) AS available_qty
FROM inventory
WHERE product_id = $1
FOR UPDATE;   -- ← Acquires an exclusive row-level lock
```

**How it works:**
1. Request A begins a transaction and issues `SELECT ... FOR UPDATE` on the inventory row.
   PostgreSQL grants A an exclusive lock. A checks stock (100 available), reserves 80 → commits.
2. Request B also issues `SELECT ... FOR UPDATE` on the **same** row.
   PostgreSQL **blocks** B at the database level (B waits, not spins).
3. Once A commits, B's lock is granted. B re-reads the row — reserved_qty is now 80, available = 20.
4. B needs 50 but only 20 is available → B throws `Insufficient stock` error and rolls back.

**Result:** Only one request succeeds. No application-level retry logic needed. No race condition possible.

This is the same strategy used by banking applications for account balance updates.

### Additional DB-level Guards
- `CHECK (reserved_qty <= physical_qty)` on the inventory table
- `UNIQUE (quotation_id)` on sales_orders — prevents duplicate order creation even under concurrency
- `UNIQUE (sales_order_id)` on dispatches — prevents duplicate dispatch

---

## Important Business Rules

1. **Totals calculated server-side** — The quotation service recalculates all amounts. Client-submitted totals are ignored. (`quotationService.js::calculateTotals`)

2. **Status transitions are validated** — Quotation can only move DRAFT→SENT→ACCEPTED/REJECTED. Reverse or skip transitions are rejected.

3. **Only ACCEPTED quotations convert** — DRAFT or REJECTED quotations throw a 400 error on `/convert`.

4. **One order per quotation** — `UNIQUE(quotation_id)` on `sales_orders`. Concurrent `/convert` calls return HTTP 409.

5. **Confirmation doesn't touch physical stock** — Only `reserved_qty` increases. Physical qty only changes on dispatch.

6. **Dispatch requires CONFIRMED status** — Cannot dispatch PENDING, CANCELLED, or already DISPATCHED orders.

7. **Cancelled CONFIRMED orders release reservations** — The cancel handler decrements `reserved_qty` before setting status to CANCELLED.

8. **Sequence numbers are race-safe** — `nextval('seq_enquiry_number')` is atomic in PostgreSQL. No `SELECT MAX()+1` pattern.

9. **Passwords never stored as plain text** — bcrypt with cost factor 12.

10. **Role checked on backend every request** — `authorize('ADMIN')` middleware runs on the server regardless of what the frontend shows.

---

## Known Limitations

- No pagination on list endpoints (acceptable for demo scale)
- No email notifications
- Single dispatch per order (can be extended to partial shipments)
- No refresh token (JWT is 8h, re-login required after expiry)
- No file upload for dispatch proof

---

## Demo Flow (5 minutes)

1. **Login as SALES_USER** (`sales@example.com`)
2. Create a Customer → Customers page
3. Create an Enquiry → select products → Enquiries page
4. Create a Quotation from the enquiry detail
5. Mark Quotation as Sent → then Accept it
6. Convert Accepted Quotation → Sales Order created
7. **Logout, login as ADMIN** (`admin@example.com`)
8. Open the Sales Order → view inventory availability
9. Click "Confirm & Reserve Stock" → inventory reserved_qty increases
10. Click "Process Dispatch" → fill vehicle/driver → inventory physical_qty decreases
11. Go to Inventory page → verify updated quantities
