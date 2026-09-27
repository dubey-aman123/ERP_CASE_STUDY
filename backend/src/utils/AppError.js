'use strict';

/**
 * AppError — a domain-specific error class that carries an HTTP status code.
 * Controllers catch this and forward to the centralized error handler.
 * Using a class (not plain Error) lets the error handler distinguish between
 * intentional "known" errors and unexpected crashes.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // signals this is a known, expected error
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
