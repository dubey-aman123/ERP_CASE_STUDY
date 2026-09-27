'use strict';

const { query } = require('../db/pool');
const AppError = require('../utils/AppError');

async function createCustomer(data, userId) {
  const { company_name, contact_person, mobile, email, city } = data;
  const { rows } = await query(
    `INSERT INTO customers (company_name, contact_person, mobile, email, city, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [company_name, contact_person, mobile, email, city, userId]
  );
  return rows[0];
}

async function getAllCustomers() {
  const { rows } = await query(
    `SELECT id, company_name, contact_person, mobile, email, city, created_at
     FROM customers ORDER BY company_name`
  );
  return rows;
}

async function getCustomerById(id) {
  const { rows } = await query('SELECT * FROM customers WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError('Customer not found.', 404);
  return rows[0];
}

module.exports = { createCustomer, getAllCustomers, getCustomerById };
