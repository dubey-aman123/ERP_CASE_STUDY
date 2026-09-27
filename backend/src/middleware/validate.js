'use strict';

const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * validate — middleware that runs after express-validator checks.
 * If there are validation errors, it returns a 422 response with all field errors.
 * If validation passes, calls next() to proceed to the controller.
 *
 * Usage: router.post('/customers', [...validationRules], validate, controller)
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => `${e.path}: ${e.msg}`).join('; ');
    return next(new AppError(`Validation failed: ${messages}`, 422));
  }
  return next();
};

module.exports = validate;
