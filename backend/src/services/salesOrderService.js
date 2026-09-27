'use strict';

const { query, getClient } = require('../db/pool');
const AppError = require('../utils/AppError');
const { generateNumber } = require('../utils/numberGenerator');

/**
 * QUOTATION → SALES ORDER CONVERSION
 *
 * Rules:
 *  1. Quotation must be in ACCEPTED status.
 *  2. A quotation can only generate ONE sales order.
 *     Enforced by UNIQUE constraint on sales_orders.quotation_id.
 *     Even if two concurrent requests try to convert the same quotation,
 *     only one INSERT will succeed; the second gets a PostgreSQL 23505 error.
 *  3. The entire conversion runs inside a single transaction so partial
 *     state (quotation updated but no order created, or vice versa) cannot occur.
 */
async function convertQuotationToOrder(quotationId, userId) {
  const { rows: qRows } = await query(
    `SELECT q.*, c.company_name FROM quotations q
     JOIN customers c ON c.id = q.customer_id
     WHERE q.id = $1`,
    [quotationId]
  );
  if (!qRows[0]) throw new AppError('Quotation not found.', 404);
  const quotation = qRows[0];

  if (quotation.status !== 'ACCEPTED') {
    throw new AppError(
      `Only ACCEPTED quotations can be converted to orders. Current status: ${quotation.status}.`,
      400
    );
  }

  // Fetch quotation line items
  const { rows: qItems } = await query(
    'SELECT * FROM quotation_items WHERE quotation_id = $1',
    [quotationId]
  );

  const order_number = await generateNumber('seq_order_number', 'SO');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Insert Sales Order — will throw 23505 if duplicate (UNIQUE on quotation_id)
    const { rows: soRows } = await client.query(
      `INSERT INTO sales_orders
         (order_number, quotation_id, customer_id, enquiry_id, total_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        order_number, quotationId, quotation.customer_id,
        quotation.enquiry_id, quotation.grand_total, userId,
      ]
    );
    const order = soRows[0];

    // Copy line items from quotation as a price snapshot
    for (const qi of qItems) {
      await client.query(
        `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, qi.product_id, qi.quantity, qi.unit_price, qi.line_total]
      );
    }

    await client.query('COMMIT');
    return getSalesOrderById(order.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * CONFIRM ORDER + INVENTORY RESERVATION
 *
 * CONCURRENCY STRATEGY:
 *   We use PostgreSQL's SELECT ... FOR UPDATE on each inventory row.
 *   This acquires a row-level exclusive lock for the duration of the transaction.
 *
 *   Scenario: Available = 100, Request A reserves 80, Request B reserves 50.
 *   - Both requests enter their transactions.
 *   - Request A locks inventory rows with FOR UPDATE.
 *   - Request B's FOR UPDATE on the same rows BLOCKS (waits at DB level).
 *   - Request A checks availability (100 >= 80 ✓), updates reserved_qty to 80, commits.
 *   - Request B's lock is granted. It now reads reserved_qty = 80, available = 20.
 *   - 20 < 50, so Request B fails with "Insufficient stock".
 *
 *   This is superior to optimistic locking for this scenario because:
 *   - It prevents the ABA problem.
 *   - No retry logic needed — the second transaction simply fails with a clear error.
 *   - It uses a standard PostgreSQL primitive, not application-level logic.
 */
async function confirmOrder(orderId, adminId) {
  const order = await getSalesOrderById(orderId);

  if (order.status !== 'PENDING') {
    throw new AppError(`Order is already ${order.status}. Cannot confirm.`, 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the sales order row to prevent concurrent confirmations of the same order
    const { rows: lockedOrder } = await client.query(
      `SELECT id, status FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (lockedOrder[0].status !== 'PENDING') {
      throw new AppError('Order was already confirmed by another request.', 409);
    }

    // Get order items
    const { rows: items } = await client.query(
      'SELECT * FROM sales_order_items WHERE sales_order_id = $1',
      [orderId]
    );

    // Lock each inventory row (FOR UPDATE) and check availability
    for (const item of items) {
      const { rows: invRows } = await client.query(
        `SELECT id, physical_qty, reserved_qty,
                (physical_qty - reserved_qty) AS available_qty
         FROM inventory WHERE product_id = $1 FOR UPDATE`,
        [item.product_id]
      );

      if (!invRows[0]) {
        throw new AppError(`No inventory record for product ${item.product_id}.`, 400);
      }
      const inv = invRows[0];
      if (parseFloat(inv.available_qty) < parseFloat(item.quantity)) {
        throw new AppError(
          `Insufficient stock. Available: ${inv.available_qty}, Required: ${item.quantity} for product.`,
          400
        );
      }

      // Increase reserved quantity (physical stays the same)
      await client.query(
        `UPDATE inventory
         SET reserved_qty = reserved_qty + $1, updated_at = NOW()
         WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // Update order status
    const { rows: updatedOrder } = await client.query(
      `UPDATE sales_orders
       SET status = 'CONFIRMED', confirmed_by = $1, confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [adminId, orderId]
    );

    await client.query('COMMIT');
    return updatedOrder[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * DISPATCH ORDER
 *
 * When goods are physically shipped:
 *   physical_qty -= dispatched_quantity  (goods leave the warehouse)
 *   reserved_qty -= dispatched_quantity  (reservation is fulfilled)
 *   available_qty stays the same (was already excluded from available)
 *
 * The UNIQUE constraint on dispatches.sales_order_id prevents duplicate dispatch.
 * All inventory updates run in a single transaction.
 */
async function dispatchOrder(orderId, data, adminId) {
  const order = await getSalesOrderById(orderId);

  if (order.status !== 'CONFIRMED') {
    throw new AppError(
      `Only CONFIRMED orders can be dispatched. Current status: ${order.status}.`,
      400
    );
  }

  const { vehicle_number, driver_name, dispatch_date, items: dispatchItems } = data;

  // Validate dispatch quantities against order quantities
  const orderItemMap = {};
  for (const oi of order.items) {
    orderItemMap[oi.product_id] = parseFloat(oi.quantity);
  }

  for (const di of dispatchItems) {
    const orderedQty = orderItemMap[di.product_id];
    if (orderedQty === undefined) {
      throw new AppError(`Product ${di.product_id} is not in this order.`, 400);
    }
    if (parseFloat(di.quantity) > orderedQty) {
      throw new AppError(
        `Dispatch quantity (${di.quantity}) exceeds order quantity (${orderedQty}) for product.`,
        400
      );
    }
  }

  const dispatch_number = await generateNumber('seq_dispatch_number', 'DSP');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock sales order
    await client.query(
      'SELECT id FROM sales_orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    // Insert dispatch record — UNIQUE on sales_order_id prevents duplicate
    const { rows: dRows } = await client.query(
      `INSERT INTO dispatches (dispatch_number, sales_order_id, dispatch_date, vehicle_number, driver_name, dispatched_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        dispatch_number, orderId,
        dispatch_date || new Date().toISOString().split('T')[0],
        vehicle_number, driver_name, adminId,
      ]
    );
    const dispatch = dRows[0];

    for (const di of dispatchItems) {
      // Lock inventory row
      const { rows: invRows } = await client.query(
        `SELECT id, physical_qty, reserved_qty FROM inventory WHERE product_id = $1 FOR UPDATE`,
        [di.product_id]
      );
      const inv = invRows[0];
      if (!inv) throw new AppError(`Inventory not found for product ${di.product_id}.`, 400);

      const qty = parseFloat(di.quantity);
      if (qty > parseFloat(inv.reserved_qty)) {
        throw new AppError(`Cannot dispatch ${qty} — only ${inv.reserved_qty} reserved.`, 400);
      }

      // Reduce both physical and reserved (fulfills the reservation)
      await client.query(
        `UPDATE inventory
         SET physical_qty = physical_qty - $1,
             reserved_qty = reserved_qty - $1,
             updated_at = NOW()
         WHERE product_id = $2`,
        [qty, di.product_id]
      );

      await client.query(
        `INSERT INTO dispatch_items (dispatch_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [dispatch.id, di.product_id, qty]
      );
    }

    // Update order status to DISPATCHED
    await client.query(
      `UPDATE sales_orders SET status = 'DISPATCHED', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );

    await client.query('COMMIT');
    return getSalesOrderById(orderId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancelOrder(orderId) {
  const order = await getSalesOrderById(orderId);
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw new AppError(`Cannot cancel order with status ${order.status}.`, 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // If CONFIRMED, release reservations before cancelling
    if (order.status === 'CONFIRMED') {
      for (const item of order.items) {
        await client.query(
          `UPDATE inventory
           SET reserved_qty = reserved_qty - $1, updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    await client.query(
      `UPDATE sales_orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAllSalesOrders() {
  const { rows } = await query(
    `SELECT so.*, c.company_name, q.quotation_number, e.enquiry_number
     FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id
     JOIN quotations q ON q.id = so.quotation_id
     JOIN enquiries e ON e.id = so.enquiry_id
     ORDER BY so.created_at DESC`
  );
  return rows;
}

async function getSalesOrderById(id) {
  const { rows } = await query(
    `SELECT so.*, c.company_name, c.contact_person, c.email AS customer_email,
            q.quotation_number, e.enquiry_number
     FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id
     JOIN quotations q ON q.id = so.quotation_id
     JOIN enquiries e ON e.id = so.enquiry_id
     WHERE so.id = $1`,
    [id]
  );
  if (!rows[0]) throw new AppError('Sales order not found.', 404);
  const order = rows[0];

  const { rows: items } = await query(
    `SELECT soi.*, p.product_code, p.product_name, p.unit,
            COALESCE(i.physical_qty, 0) AS physical_qty,
            COALESCE(i.reserved_qty, 0) AS reserved_qty,
            COALESCE(i.physical_qty, 0) - COALESCE(i.reserved_qty, 0) AS available_qty
     FROM sales_order_items soi
     JOIN products p ON p.id = soi.product_id
     LEFT JOIN inventory i ON i.product_id = soi.product_id
     WHERE soi.sales_order_id = $1`,
    [id]
  );
  order.items = items;
  return order;
}

module.exports = {
  convertQuotationToOrder,
  confirmOrder,
  dispatchOrder,
  cancelOrder,
  getAllSalesOrders,
  getSalesOrderById,
};
