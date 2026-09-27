'use strict';

const { query, getClient } = require('../db/pool');
const AppError = require('../utils/AppError');
const { generateNumber } = require('../utils/numberGenerator');

/**
 * QUOTATION TOTAL CALCULATION
 *
 * For each line item:
 *   base_amount    = quantity × unit_price
 *   discount_amt   = base_amount × (discount_percent / 100)
 *   line_total     = base_amount - discount_amt
 *
 * At quotation level:
 *   subtotal        = SUM(base_amount)
 *   discount_amount = SUM(discount_amt)
 *   taxable_amount  = SUM(line_total)
 *   tax_amount      = taxable_amount × (gst_percent / 100)
 *   grand_total     = taxable_amount + tax_amount
 *
 * The backend ALWAYS recalculates these. The client's submitted totals are ignored.
 * This prevents a malicious or buggy frontend from creating incorrect invoices.
 */
function calculateTotals(items, gstPercent) {
  let subtotal = 0;
  let totalDiscount = 0;
  const calculatedItems = items.map((item) => {
    const qty = parseFloat(item.quantity);
    const price = parseFloat(item.unit_price);
    const discPct = parseFloat(item.discount_percent || 0);

    const base_amount = qty * price;
    const discount_amount = base_amount * (discPct / 100);
    const line_total = base_amount - discount_amount;

    subtotal += base_amount;
    totalDiscount += discount_amount;

    return {
      ...item,
      base_amount: parseFloat(base_amount.toFixed(2)),
      discount_amount: parseFloat(discount_amount.toFixed(2)),
      line_total: parseFloat(line_total.toFixed(2)),
    };
  });

  const taxable_amount = subtotal - totalDiscount;
  const tax_amount = taxable_amount * (parseFloat(gstPercent) / 100);
  const grand_total = taxable_amount + tax_amount;

  return {
    items: calculatedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount_amount: parseFloat(totalDiscount.toFixed(2)),
    taxable_amount: parseFloat(taxable_amount.toFixed(2)),
    tax_amount: parseFloat(tax_amount.toFixed(2)),
    grand_total: parseFloat(grand_total.toFixed(2)),
  };
}

async function createQuotation(data, userId) {
  const { enquiry_id, valid_until, gst_percent = 18, notes, items } = data;

  // Verify enquiry exists
  const { rows: enqRows } = await query(
    'SELECT id, customer_id, status FROM enquiries WHERE id = $1',
    [enquiry_id]
  );
  if (!enqRows[0]) throw new AppError('Enquiry not found.', 404);
  if (enqRows[0].status === 'LOST') throw new AppError('Cannot create quotation for a LOST enquiry.', 400);

  const customer_id = enqRows[0].customer_id;
  const totals = calculateTotals(items, gst_percent);
  const quotation_number = await generateNumber('seq_quotation_number', 'QT');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO quotations
         (quotation_number, enquiry_id, customer_id, valid_until, gst_percent,
          subtotal, discount_amount, taxable_amount, tax_amount, grand_total, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        quotation_number, enquiry_id, customer_id, valid_until, gst_percent,
        totals.subtotal, totals.discount_amount, totals.taxable_amount,
        totals.tax_amount, totals.grand_total, notes || null, userId,
      ]
    );
    const quotation = rows[0];

    for (const item of totals.items) {
      await client.query(
        `INSERT INTO quotation_items
           (quotation_id, product_id, quantity, unit_price, discount_percent,
            base_amount, discount_amount, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          quotation.id, item.product_id, item.quantity, item.unit_price,
          item.discount_percent || 0, item.base_amount,
          item.discount_amount, item.line_total,
        ]
      );
    }

    // Update enquiry status to QUOTED
    await client.query(
      `UPDATE enquiries SET status = 'QUOTED', updated_at = NOW() WHERE id = $1`,
      [enquiry_id]
    );

    await client.query('COMMIT');
    return getQuotationById(quotation.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAllQuotations() {
  const { rows } = await query(
    `SELECT q.*, c.company_name, e.enquiry_number
     FROM quotations q
     JOIN customers c ON c.id = q.customer_id
     JOIN enquiries e ON e.id = q.enquiry_id
     ORDER BY q.created_at DESC`
  );
  return rows;
}

async function getQuotationById(id) {
  const { rows } = await query(
    `SELECT q.*, c.company_name, c.contact_person, c.email AS customer_email,
            e.enquiry_number
     FROM quotations q
     JOIN customers c ON c.id = q.customer_id
     JOIN enquiries e ON e.id = q.enquiry_id
     WHERE q.id = $1`,
    [id]
  );
  if (!rows[0]) throw new AppError('Quotation not found.', 404);
  const quotation = rows[0];

  const { rows: items } = await query(
    `SELECT qi.*, p.product_code, p.product_name, p.unit
     FROM quotation_items qi
     JOIN products p ON p.id = qi.product_id
     WHERE qi.quotation_id = $1`,
    [id]
  );
  quotation.items = items;
  return quotation;
}

/**
 * Status transition validation.
 * Allowed transitions:
 *   DRAFT → SENT
 *   SENT  → ACCEPTED
 *   SENT  → REJECTED
 *   (ACCEPTED and REJECTED are terminal — no further change)
 */
const ALLOWED_TRANSITIONS = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
};

async function updateQuotationStatus(id, newStatus, userId) {
  const quotation = await getQuotationById(id);
  const allowed = ALLOWED_TRANSITIONS[quotation.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition quotation from ${quotation.status} to ${newStatus}.`,
      400
    );
  }

  const { rows } = await query(
    `UPDATE quotations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newStatus, id]
  );

  // If rejected, mark enquiry as LOST
  if (newStatus === 'REJECTED') {
    await query(
      `UPDATE enquiries SET status = 'LOST', updated_at = NOW() WHERE id = $1`,
      [quotation.enquiry_id]
    );
  }
  // If accepted, mark enquiry as WON
  if (newStatus === 'ACCEPTED') {
    await query(
      `UPDATE enquiries SET status = 'WON', updated_at = NOW() WHERE id = $1`,
      [quotation.enquiry_id]
    );
  }

  return rows[0];
}

module.exports = {
  createQuotation,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  calculateTotals,
};
