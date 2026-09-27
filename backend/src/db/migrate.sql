-- =============================================================================
-- ERP DATABASE SCHEMA MIGRATION
-- Implements the full relational model for the manufacturing ERP system.
-- All foreign keys, unique constraints, NOT NULL constraints, and indexes
-- are declared here so the database enforces integrity — not just the app layer.
-- =============================================================================

-- Enable uuid generation (requires PostgreSQL >= 13 or pgcrypto)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USERS
-- Stores authentication credentials and role.
-- Passwords are stored as bcrypt hashes — never plain text.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  -- RBAC role: constrains what operations a user may perform via API middleware
  role         VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'SALES_USER')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CUSTOMERS
-- Represents the buying company. One customer can have many enquiries.
-- =============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name   VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  mobile         VARCHAR(20) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  city           VARCHAR(100) NOT NULL,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- =============================================================================
-- PRODUCTS
-- Master catalog of industrial products.
-- base_price is the default unit price used when creating quotation lines.
-- NUMERIC(12,2) avoids floating-point rounding errors in monetary arithmetic.
-- =============================================================================
CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code VARCHAR(50) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category     VARCHAR(100) NOT NULL,
  unit         VARCHAR(20) NOT NULL,     -- e.g., PCS, KG, SET
  base_price   NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);

-- =============================================================================
-- INVENTORY
-- One row per product. physical_qty is the actual stock on hand.
-- reserved_qty is stock allocated to confirmed orders but not yet dispatched.
-- available = physical_qty - reserved_qty (computed, not stored, to avoid drift)
--
-- CONCURRENCY NOTE:
--   When confirming orders we use SELECT ... FOR UPDATE on the inventory row.
--   This acquires a row-level exclusive lock inside the transaction, forcing
--   concurrent confirmations to queue behind each other. This guarantees that
--   two simultaneous confirmations cannot both read the same available_qty and
--   both succeed — the second will wait, then recheck and fail if stock is gone.
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID UNIQUE NOT NULL REFERENCES products(id),
  physical_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (physical_qty >= 0),
  reserved_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  -- DB-level guard: cannot reserve more than physical stock
  CONSTRAINT chk_reserved_le_physical CHECK (reserved_qty <= physical_qty),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ENQUIRIES
-- Represents a customer's initial request for pricing on certain products.
-- Workflow: NEW → QUOTED → WON | LOST
-- =============================================================================
CREATE TABLE IF NOT EXISTS enquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_number  VARCHAR(50) UNIQUE NOT NULL,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  enquiry_date    DATE NOT NULL,
  required_date   DATE,
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'NEW'
                    CHECK (status IN ('NEW', 'QUOTED', 'WON', 'LOST')),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON enquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);

-- =============================================================================
-- ENQUIRY_ITEMS
-- Line items for an enquiry — each referencing a product.
-- =============================================================================
CREATE TABLE IF NOT EXISTS enquiry_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id  UUID NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_items_enquiry ON enquiry_items(enquiry_id);

-- =============================================================================
-- QUOTATIONS
-- Formal price offer sent to a customer in response to an enquiry.
-- grand_total is stored after backend calculation (NOT trusted from client).
-- Workflow: DRAFT → SENT → ACCEPTED | REJECTED
-- =============================================================================
CREATE TABLE IF NOT EXISTS quotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number VARCHAR(50) UNIQUE NOT NULL,
  enquiry_id       UUID NOT NULL REFERENCES enquiries(id),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  quotation_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE NOT NULL,
  gst_percent      NUMERIC(5,2) NOT NULL DEFAULT 18.00 CHECK (gst_percent >= 0),
  -- Backend calculates and stores these — never trusting client totals
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxable_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total      NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_enquiry ON quotations(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

-- =============================================================================
-- QUOTATION_ITEMS
-- Line items for a quotation.
-- line_total = (quantity × unit_price) × (1 - discount_percent/100)
-- GST is applied at the quotation level on the aggregate taxable_amount.
-- =============================================================================
CREATE TABLE IF NOT EXISTS quotation_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id     UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  base_amount      NUMERIC(14,2) NOT NULL,   -- quantity × unit_price
  discount_amount  NUMERIC(14,2) NOT NULL,   -- base_amount × discount_percent / 100
  line_total       NUMERIC(14,2) NOT NULL,   -- base_amount - discount_amount
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- =============================================================================
-- SALES_ORDERS
-- Created from an ACCEPTED quotation. One-to-one with quotation enforced by
-- the UNIQUE constraint on quotation_id — prevents duplicate order creation
-- even under concurrent requests (DB-level guard, not just app logic).
-- Workflow: PENDING → CONFIRMED → DISPATCHED | CANCELLED
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     VARCHAR(50) UNIQUE NOT NULL,
  quotation_id     UUID UNIQUE NOT NULL REFERENCES quotations(id), -- UNIQUE prevents duplicates
  customer_id      UUID NOT NULL REFERENCES customers(id),
  enquiry_id       UUID NOT NULL REFERENCES enquiries(id),
  order_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount     NUMERIC(14,2) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED')),
  confirmed_by     UUID REFERENCES users(id),
  confirmed_at     TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);

-- =============================================================================
-- SALES_ORDER_ITEMS
-- Line items copied from the accepted quotation at conversion time.
-- Snapshot ensures historical accuracy even if product prices change later.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales_order_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id),
  quantity       NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(14,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_so_items_order ON sales_order_items(sales_order_id);

-- =============================================================================
-- DISPATCHES
-- Records the physical shipment of goods for a confirmed sales order.
-- A sales order may have at most one dispatch (enforced by UNIQUE on sales_order_id).
-- Dispatch physically reduces inventory (physical_qty and reserved_qty both drop).
-- =============================================================================
CREATE TABLE IF NOT EXISTS dispatches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id UUID UNIQUE NOT NULL REFERENCES sales_orders(id), -- UNIQUE prevents duplicate dispatch
  dispatch_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number VARCHAR(50) NOT NULL,
  driver_name    VARCHAR(255) NOT NULL,
  dispatched_by  UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatches_order ON dispatches(sales_order_id);

-- =============================================================================
-- DISPATCH_ITEMS
-- Line-level dispatch quantities. Must not exceed the order quantities.
-- =============================================================================
CREATE TABLE IF NOT EXISTS dispatch_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id  UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  quantity     NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON dispatch_items(dispatch_id);

-- =============================================================================
-- SEQUENCE HELPERS
-- We generate human-readable numbers (ENQ-0001, QT-0001, etc.) using sequences
-- so they are always unique and never require a SELECT MAX() race condition.
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_enquiry_number START 1;
CREATE SEQUENCE IF NOT EXISTS seq_quotation_number START 1;
CREATE SEQUENCE IF NOT EXISTS seq_order_number START 1;
CREATE SEQUENCE IF NOT EXISTS seq_dispatch_number START 1;
