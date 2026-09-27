'use strict';

/**
 * Seed script.
 * Inserts realistic test data: users, products, inventory, customers.
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 * Run with: node src/db/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');
const config = require('../config');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------------
    // USERS
    // -------------------------------------------------------------------------
    const adminHash = await bcrypt.hash(config.seed.adminPassword, 12);
    const salesHash = await bcrypt.hash(config.seed.salesPassword, 12);

    await client.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
        ('admin@example.com', $1, 'Admin User', 'ADMIN'),
        ('sales@example.com', $2, 'Sales User', 'SALES_USER')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, salesHash]);

    console.log('✅ Users seeded.');

    // -------------------------------------------------------------------------
    // PRODUCTS (6 realistic industrial products)
    // -------------------------------------------------------------------------
    const products = [
      { code: 'BRG-6205',  name: 'Deep Groove Ball Bearing 6205',    category: 'Bearings',          unit: 'PCS', price: 320.00 },
      { code: 'MTR-IE3-75', name: 'IE3 Induction Motor 7.5kW 415V', category: 'Industrial Motors',  unit: 'PCS', price: 28500.00 },
      { code: 'PMP-CR10',  name: 'Centrifugal Pump CR10-2',          category: 'Pumps',             unit: 'PCS', price: 15200.00 },
      { code: 'VLV-GV50',  name: 'Gate Valve PN16 DN50',             category: 'Valves',            unit: 'PCS', price: 1800.00 },
      { code: 'GBX-HC200', name: 'Helical Gearbox HC200 Ratio 1:20', category: 'Gearboxes',         unit: 'PCS', price: 42000.00 },
      { code: 'CPL-JAW40', name: 'Jaw Coupling Set 40mm Bore',       category: 'Couplings',         unit: 'SET', price: 2400.00 },
    ];

    for (const p of products) {
      await client.query(`
        INSERT INTO products (product_code, product_name, category, unit, base_price)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (product_code) DO NOTHING
      `, [p.code, p.name, p.category, p.unit, p.price]);
    }

    console.log('✅ Products seeded.');

    // -------------------------------------------------------------------------
    // INVENTORY (initial stock for each product)
    // -------------------------------------------------------------------------
    const inventoryData = [
      { code: 'BRG-6205',   physical: 500, reserved: 0 },
      { code: 'MTR-IE3-75', physical: 50,  reserved: 0 },
      { code: 'PMP-CR10',   physical: 30,  reserved: 0 },
      { code: 'VLV-GV50',   physical: 200, reserved: 0 },
      { code: 'GBX-HC200',  physical: 20,  reserved: 0 },
      { code: 'CPL-JAW40',  physical: 150, reserved: 0 },
    ];

    for (const inv of inventoryData) {
      await client.query(`
        INSERT INTO inventory (product_id, physical_qty, reserved_qty)
        SELECT id, $1, $2 FROM products WHERE product_code = $3
        ON CONFLICT (product_id) DO NOTHING
      `, [inv.physical, inv.reserved, inv.code]);
    }

    console.log('✅ Inventory seeded.');

    // -------------------------------------------------------------------------
    // CUSTOMERS (sample accounts)
    // -------------------------------------------------------------------------
    // Get admin user id for created_by
    const { rows: adminRows } = await client.query(
      `SELECT id FROM users WHERE email = 'admin@example.com'`
    );
    const adminId = adminRows[0].id;

    const customers = [
      { company: 'Tata Steel Limited',       contact: 'Rajan Mehta',    mobile: '9876543210', email: 'rajan@tatasteel.com',    city: 'Mumbai' },
      { company: 'Bharat Heavy Electricals', contact: 'Sunita Sharma',  mobile: '9988776655', email: 'sunita@bhel.in',          city: 'Delhi' },
      { company: 'Larsen & Toubro Infotech', contact: 'Arjun Patel',    mobile: '9876001234', email: 'arjun@lnt.co.in',         city: 'Chennai' },
    ];

    for (const c of customers) {
      await client.query(`
        INSERT INTO customers (company_name, contact_person, mobile, email, city, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [c.company, c.contact, c.mobile, c.email, c.city, adminId]);
    }

    console.log('✅ Customers seeded.');

    await client.query('COMMIT');
    console.log('\n🌱 Seed complete. Test credentials:');
    console.log('   ADMIN:      admin@example.com / Admin@123');
    console.log('   SALES_USER: sales@example.com / Sales@123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
