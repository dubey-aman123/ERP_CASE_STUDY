'use strict';

const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * authenticate — verifies the JWT from the Authorization header.
 * Attaches the decoded payload (id, email, role) to req.user.
 *
 * WHY: Every protected route must verify the JWT on the backend.
 *      Relying only on frontend route guards is INSUFFICIENT — a user
 *      can bypass the frontend entirely and hit the API directly.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Please log in.', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    // Attach decoded payload: { sub, email, role, name }
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token. Please log in.', 401));
  }
};

/**
 * authorize — returns middleware that checks req.user.role against allowed roles.
 *
 * WHY: Role-Based Access Control is enforced here on the server, not in React.
 *      A SALES_USER attempting an ADMIN-only endpoint (e.g., confirm order)
 *      receives HTTP 403 regardless of what the frontend shows.
 *
 * Usage: router.post('/confirm', authenticate, authorize('ADMIN'), controller)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(
      new AppError(
        `Access denied. Requires role: ${roles.join(' or ')}.`,
        403
      )
    );
  }
  return next();
};

module.exports = { authenticate, authorize };
