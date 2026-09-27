'use strict';

/**
 * Migration runner script.
 * Reads migrate.sql and executes it against the configured database.
 * Run with: node src/db/migrate.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const sqlPath = path.join(__dirname, 'migrate.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running database migration...');
  try {
    await pool.query(sql);
    console.log('✅ Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
