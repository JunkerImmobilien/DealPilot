'use strict';
const jwtUtil = require('../utils/jwt');
const { query } = require('../db/pool');

/**
 * Authenticate request via Bearer token in Authorization header.
 * Sets req.user = { id, email, name, role }
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    let payload;
    try {
      payload = jwtUtil.verify(match[1]);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Verify user still exists and is active
    const r = await query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [payload.userId]
    );
    if (r.rowCount === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    const user = r.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is disabled' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require user to have a specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
