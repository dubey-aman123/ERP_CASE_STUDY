'use strict';

const { query } = require('../db/pool');

/**
 * Generates the next sequential human-readable number using a PostgreSQL SEQUENCE.
 * Using sequences is race-condition-safe: two concurrent calls cannot get the same number.
 *
 * @param {string} sequenceName - e.g. 'seq_enquiry_number'
 * @param {string} prefix       - e.g. 'ENQ'
 * @param {number} padding      - zero-pad to this many digits
 */
async function generateNumber(sequenceName, prefix, padding = 4) {
  const { rows } = await query(`SELECT nextval($1) AS val`, [sequenceName]);
  const num = String(rows[0].val).padStart(padding, '0');
  return `${prefix}-${num}`;
}

module.exports = { generateNumber };
