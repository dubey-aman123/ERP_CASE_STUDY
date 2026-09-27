'use strict';

const config = require('../config');

/**
 * Centralized error handler — the LAST middleware registered in app.js.
 *
 * Two categories of errors:
 *  1. Operational (AppError.isOperational = true): known, expected errors.
 *     Return the message to the client because it is safe and useful.
 *  2. Programming / unexpected errors: log fully but return a generic message.
 *     This prevents leaking stack traces, DB internals, or file paths to clients.
 *
 * PostgreSQL unique violation (code 23505) is mapped to 409 Conflict here so
 * we catch DB-level duplicate prevention (e.g., duplicate Sales Order from
 * the UNIQUE constraint on quotation_id) in a user-friendly way.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Handle PostgreSQL constraint violations gracefully
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry: ' + (err.detail || 'A record with this value already exists.'),
    });
  }
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced record not found.',
    });
  }
  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      error: 'Database constraint violated: ' + (err.detail || 'invalid value.'),
    });
  }

  // Known operational error
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message,
    });
  }

  // Unknown / programming error — log but don't expose details
  console.error('UNHANDLED ERROR:', err);
  return res.status(500).json({
    success: false,
    error: config.nodeEnv === 'development'
      ? err.message
      : 'Internal server error.',
  });
};

module.exports = errorHandler;
