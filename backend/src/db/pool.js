'use strict';

const { Pool } = require('pg');
const config = require('../config');

/**
 * PostgreSQL connection pool.
 * Using a pool (not a single client) means the app can handle concurrent
 * requests efficiently without opening a new TCP connection per request.
 */
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  // Tune pool size based on expected concurrency
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});

/**
 * Execute a query using the pool (auto-release).
 * Use this for simple read/write queries that don't need an explicit transaction.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a dedicated client from the pool for manual transaction control.
 * Caller is responsible for calling client.release() in a finally block.
 *
 * WHY: PostgreSQL transactions must run on the same connection.
 *      Pool.query() may use different connections, so for multi-statement
 *      transactions we must grab a single client and hold it for the duration.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
