'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Authenticate a user by email + password.
 * Returns a signed JWT on success.
 *
 * We compare timing-safe with bcrypt.compare to prevent timing attacks.
 * We return the same error message for wrong email and wrong password
 * to avoid leaking whether an email exists in the system.
 */
async function login(email, password) {
  const { rows } = await query(
    'SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = $1',
    [email]
  );

  // Use a dummy compare to prevent timing attacks even when user not found
  const user = rows[0];
  const dummyHash = '$2a$12$dummyhashforsecuritypurposesonly123456';
  const passwordMatches = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, dummyHash);

  if (!user || !passwordMatches) {
    throw new AppError('Invalid email or password.', 401);
  }
  if (!user.is_active) {
    throw new AppError('Account is deactivated.', 403);
  }

  const token = signToken(user);
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

module.exports = { login };
