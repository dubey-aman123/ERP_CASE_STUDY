'use strict';

const { query, getClient } = require('../db/pool');
const AppError = require('../utils/AppError');
const { generateNumber } = require('../utils/numberGenerator');

async function createEnquiry(data, userId) {
  const { customer_id, enquiry_date, required_date, notes, items } = data;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const enquiry_number = await generateNumber('seq_enquiry_number', 'ENQ');

    const { rows } = await client.query(
      `INSERT INTO enquiries (enquiry_number, customer_id, enquiry_date, required_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [enquiry_number, customer_id, enquiry_date, required_date || null, notes || null, userId]
    );
    const enquiry = rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO enquiry_items (enquiry_id, product_id, quantity, notes)
         VALUES ($1, $2, $3, $4)`,
        [enquiry.id, item.product_id, item.quantity, item.notes || null]
      );
    }

    await client.query('COMMIT');
    return getEnquiryById(enquiry.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAllEnquiries() {
  const { rows } = await query(
    `SELECT e.*, c.company_name, c.contact_person,
            COUNT(ei.id) AS item_count
     FROM enquiries e
     JOIN customers c ON c.id = e.customer_id
     LEFT JOIN enquiry_items ei ON ei.enquiry_id = e.id
     GROUP BY e.id, c.company_name, c.contact_person
     ORDER BY e.created_at DESC`
  );
  return rows;
}

async function getEnquiryById(id) {
  const { rows } = await query(
    `SELECT e.*, c.company_name, c.contact_person, c.email AS customer_email, c.mobile, c.city
     FROM enquiries e
     JOIN customers c ON c.id = e.customer_id
     WHERE e.id = $1`,
    [id]
  );
  if (!rows[0]) throw new AppError('Enquiry not found.', 404);
  const enquiry = rows[0];

  const { rows: items } = await query(
    `SELECT ei.*, p.product_code, p.product_name, p.unit, p.base_price
     FROM enquiry_items ei
     JOIN products p ON p.id = ei.product_id
     WHERE ei.enquiry_id = $1`,
    [id]
  );
  enquiry.items = items;
  return enquiry;
}

module.exports = { createEnquiry, getAllEnquiries, getEnquiryById };
