'use strict';

const { query } = require('../db/pool');
const AppError = require('../utils/AppError');

async function createProduct(data) {
  const { product_code, product_name, category, unit, base_price } = data;
  const { rows } = await query(
    `INSERT INTO products (product_code, product_name, category, unit, base_price)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [product_code, product_name, category, unit, base_price]
  );
  // Create an inventory record for the new product with 0 stock
  await query(
    `INSERT INTO inventory (product_id, physical_qty, reserved_qty)
     VALUES ($1, 0, 0)`,
    [rows[0].id]
  );
  return rows[0];
}

async function getAllProducts() {
  const { rows } = await query(
    `SELECT p.*, 
            COALESCE(i.physical_qty, 0) AS physical_qty,
            COALESCE(i.reserved_qty, 0) AS reserved_qty,
            COALESCE(i.physical_qty, 0) - COALESCE(i.reserved_qty, 0) AS available_qty
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.is_active = TRUE
     ORDER BY p.category, p.product_name`
  );
  return rows;
}

async function getProductById(id) {
  const { rows } = await query(
    `SELECT p.*, 
            COALESCE(i.physical_qty, 0) AS physical_qty,
            COALESCE(i.reserved_qty, 0) AS reserved_qty,
            COALESCE(i.physical_qty, 0) - COALESCE(i.reserved_qty, 0) AS available_qty
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.id = $1`,
    [id]
  );
  if (!rows[0]) throw new AppError('Product not found.', 404);
  return rows[0];
}

async function getInventory() {
  const { rows } = await query(
    `SELECT p.id AS product_id, p.product_code, p.product_name, p.category, p.unit,
            i.physical_qty, i.reserved_qty,
            (i.physical_qty - i.reserved_qty) AS available_qty,
            i.updated_at
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     WHERE p.is_active = TRUE
     ORDER BY p.category, p.product_name`
  );
  return rows;
}

async function updateInventory(productId, physicalQty) {
  // First check the new physical_qty wouldn't violate the reserved constraint
  const { rows: inv } = await query(
    'SELECT reserved_qty FROM inventory WHERE product_id = $1',
    [productId]
  );
  if (!inv[0]) throw new AppError('Inventory record not found.', 404);
  if (physicalQty < inv[0].reserved_qty) {
    throw new AppError(
      `Cannot set physical_qty to ${physicalQty} — ${inv[0].reserved_qty} units are currently reserved.`,
      400
    );
  }
  const { rows } = await query(
    `UPDATE inventory SET physical_qty = $1, updated_at = NOW()
     WHERE product_id = $2
     RETURNING *`,
    [physicalQty, productId]
  );
  return rows[0];
}

module.exports = { createProduct, getAllProducts, getProductById, getInventory, updateInventory };
