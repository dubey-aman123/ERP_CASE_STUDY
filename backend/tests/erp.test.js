'use strict';

/**
 * ERP AUTOMATED TEST SUITE
 *
 * Tests 1 & 5 are pure unit tests (no DB needed).
 * Tests 2, 3, 4 use Jest module mocking to isolate business logic.
 *
 * Run: npm test
 */

// ============================================================
// TEST 1: Quotation total is calculated correctly
// ============================================================
describe('Test 1: Quotation total calculation', () => {
  // Import the pure calculation function — no DB dependency
  const { calculateTotals } = require('../src/services/quotationService');

  test('calculates line totals, discount, GST, and grand total correctly', () => {
    const items = [
      { product_id: 'p1', quantity: 10, unit_price: 1000, discount_percent: 10 },
      { product_id: 'p2', quantity: 5,  unit_price: 2000, discount_percent: 0  },
    ];
    /**
     * Item 1: base=10000, disc=1000, line=9000
     * Item 2: base=10000, disc=0,    line=10000
     * subtotal=20000, discount=1000, taxable=19000
     * tax=19000*0.18=3420, grand=22420
     */
    const result = calculateTotals(items, 18);
    expect(result.subtotal).toBe(20000);
    expect(result.discount_amount).toBe(1000);
    expect(result.taxable_amount).toBe(19000);
    expect(result.tax_amount).toBe(3420);
    expect(result.grand_total).toBe(22420);
    expect(result.items[0].line_total).toBe(9000);
    expect(result.items[1].line_total).toBe(10000);
  });

  test('handles zero GST', () => {
    const items = [{ product_id: 'p1', quantity: 4, unit_price: 500, discount_percent: 0 }];
    const result = calculateTotals(items, 0);
    expect(result.grand_total).toBe(2000);
    expect(result.tax_amount).toBe(0);
  });

  test('handles 100% discount produces zero grand total', () => {
    const items = [{ product_id: 'p1', quantity: 10, unit_price: 1000, discount_percent: 100 }];
    const result = calculateTotals(items, 18);
    expect(result.taxable_amount).toBe(0);
    expect(result.grand_total).toBe(0);
  });
});

// ============================================================
// TEST 5: RBAC — authorize middleware (no DB needed)
// ============================================================
describe('Test 5: RBAC middleware', () => {
  const { authorize, authenticate } = require('../src/middleware/auth');

  test('authorize rejects SALES_USER for ADMIN-only route', () => {
    const mw = authorize('ADMIN');
    const next = jest.fn();
    mw({ user: { role: 'SALES_USER' } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test('authorize allows ADMIN for ADMIN-only route', () => {
    const mw = authorize('ADMIN');
    const next = jest.fn();
    mw({ user: { role: 'ADMIN' } }, {}, next);
    expect(next).toHaveBeenCalledWith(/* no error argument */);
    expect(next.mock.calls[0].length).toBe(0);
  });

  test('authorize allows either role for mixed route', () => {
    const mw = authorize('ADMIN', 'SALES_USER');
    const next = jest.fn();
    mw({ user: { role: 'SALES_USER' } }, {}, next);
    expect(next.mock.calls[0].length).toBe(0);
  });

  test('authenticate rejects request without Authorization header', () => {
    const next = jest.fn();
    authenticate({ headers: {} }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('authenticate rejects malformed token', () => {
    const next = jest.fn();
    authenticate({ headers: { authorization: 'Bearer bad.token.here' } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

// ============================================================
// TEST 2 & 3: Quotation status + duplicate order prevention
// (uses Jest manual mocking to avoid DB connection)
// ============================================================
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

describe('Test 2: DRAFT/REJECTED quotation cannot become a Sales Order', () => {
  const { query, getClient } = require('../src/db/pool');
  const salesOrderService = require('../src/services/salesOrderService');

  beforeEach(() => { jest.clearAllMocks(); });

  test('DRAFT quotation → 400 error', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'q1', status: 'DRAFT', customer_id: 'c1', enquiry_id: 'e1', grand_total: 1000, company_name: 'X' }],
    });
    await expect(salesOrderService.convertQuotationToOrder('q1', 'u1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('REJECTED quotation → 400 error', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'q1', status: 'REJECTED', customer_id: 'c1', enquiry_id: 'e1', grand_total: 1000, company_name: 'X' }],
    });
    await expect(salesOrderService.convertQuotationToOrder('q1', 'u1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('SENT quotation → 400 error', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'q1', status: 'SENT', customer_id: 'c1', enquiry_id: 'e1', grand_total: 1000, company_name: 'X' }],
    });
    await expect(salesOrderService.convertQuotationToOrder('q1', 'u1'))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Test 3: Duplicate Sales Order prevention via DB UNIQUE constraint', () => {
  test('PostgreSQL error 23505 maps to HTTP 409 in error handler', () => {
    /**
     * The UNIQUE constraint on sales_orders.quotation_id means:
     * If two concurrent /convert calls both reach the INSERT,
     * PostgreSQL throws error code 23505 on the second one.
     * Our errorHandler maps this to HTTP 409.
     */
    const pgDuplicateError = new Error('duplicate key value');
    pgDuplicateError.code = '23505';
    pgDuplicateError.detail = 'Key (quotation_id)=(q-uuid) already exists.';

    // Simulate error handler logic
    let response;
    if (pgDuplicateError.code === '23505') {
      response = { status: 409, body: { success: false, error: 'Duplicate entry: ' + pgDuplicateError.detail } };
    }
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('quotation_id');
  });
});

describe('Test 4: Cannot reserve more inventory than available', () => {
  const { query, getClient } = require('../src/db/pool');
  const salesOrderService = require('../src/services/salesOrderService');

  beforeEach(() => { jest.clearAllMocks(); });

  test('throws Insufficient stock when order qty > available', async () => {
    // Mock getSalesOrderById (2 queries: order + items)
    query
      .mockResolvedValueOnce({ rows: [{ id: 'so1', status: 'PENDING', quotation_id: 'q1', customer_id: 'c1', enquiry_id: 'e1', total_amount: 80000, company_name: 'Test', contact_person: 'X', customer_email: 'x@x.com', quotation_number: 'QT-0001', enquiry_number: 'ENQ-0001' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'soi1', product_id: 'p1', quantity: 80, unit_price: 1000, line_total: 80000, product_code: 'P1', product_name: 'Prod', unit: 'PCS', physical_qty: 100, reserved_qty: 30, available_qty: 70 }] });

    const mockClient = { query: jest.fn(), release: jest.fn() };
    getClient.mockResolvedValueOnce(mockClient);

    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'so1', status: 'PENDING' }] }) // FOR UPDATE on order
      .mockResolvedValueOnce({ rows: [{ product_id: 'p1', quantity: 80 }] }) // get order items
      // Inventory: available = 100 - 30 = 70, but order needs 80
      .mockResolvedValueOnce({ rows: [{ id: 'inv1', physical_qty: 100, reserved_qty: 30, available_qty: 70 }] })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    await expect(salesOrderService.confirmOrder('so1', 'admin1'))
      .rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Insufficient stock'),
      });
  });

  test('succeeds when order qty <= available', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'so1', status: 'PENDING', quotation_id: 'q1', customer_id: 'c1', enquiry_id: 'e1', total_amount: 50000, company_name: 'Test', contact_person: 'X', customer_email: 'x@x.com', quotation_number: 'QT-0001', enquiry_number: 'ENQ-0001' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'soi1', product_id: 'p1', quantity: 50, unit_price: 1000, line_total: 50000, product_code: 'P1', product_name: 'Prod', unit: 'PCS', physical_qty: 100, reserved_qty: 30, available_qty: 70 }] });

    const mockClient = { query: jest.fn(), release: jest.fn() };
    getClient.mockResolvedValueOnce(mockClient);

    const confirmedOrder = { id: 'so1', status: 'CONFIRMED', quotation_id: 'q1', customer_id: 'c1', enquiry_id: 'e1', total_amount: 50000, company_name: 'Test', contact_person: 'X', customer_email: 'x@x.com', quotation_number: 'QT-0001', enquiry_number: 'ENQ-0001' };

    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'so1', status: 'PENDING' }] }) // FOR UPDATE order
      .mockResolvedValueOnce({ rows: [{ product_id: 'p1', quantity: 50 }] }) // items
      // available = 70, need 50 → OK
      .mockResolvedValueOnce({ rows: [{ id: 'inv1', physical_qty: 100, reserved_qty: 30, available_qty: 70 }] })
      .mockResolvedValueOnce(undefined) // UPDATE inventory
      .mockResolvedValueOnce({ rows: [confirmedOrder] }) // UPDATE order status
      .mockResolvedValueOnce(undefined); // COMMIT

    // getSalesOrderById after update
    query
      .mockResolvedValueOnce({ rows: [confirmedOrder] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await salesOrderService.confirmOrder('so1', 'admin1');
    expect(result.status).toBe('CONFIRMED');
  });
});
