'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Signs a JWT containing the user's id, email, and role.
 * The role is embedded so the authorization middleware can check it
 * without a database lookup on every request.
 */
const signToken = (user) =>
  jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

/**
 * Verifies and decodes a JWT.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 */
const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

module.exports = { signToken, verifyToken };
