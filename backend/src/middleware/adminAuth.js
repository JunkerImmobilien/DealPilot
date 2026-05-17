/**
 * Admin-Auth Middleware
 *
 * Prüft das Admin-JWT-Token (eigener Cookie/Header, separat vom User-Auth).
 * Setzt req.adminUser auf das Admin-User-Objekt.
 *
 * Rollen:
 *   - 'owner'     → alles erlaubt
 *   - 'support'   → CRUD auf User, aber keine Admin-User-Verwaltung
 *   - 'readonly'  → nur GET, keine Mutations
 *
 * Token-Lebensdauer: 4 Stunden (deutlich kürzer als User-JWT mit 7d).
 */
'use strict';

const jwt = require('jsonwebtoken');

const ADMIN_TOKEN_TTL = '4h';
const ADMIN_TOKEN_TTL_SECONDS = 4 * 60 * 60;

function _getSecret() {
    const s = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!s) throw new Error('ADMIN_JWT_SECRET (oder JWT_SECRET fallback) muss gesetzt sein');
    return s;
}

function signAdminToken(adminUser) {
    return jwt.sign(
        {
            sub: adminUser.id,
            email: adminUser.email,
            role: adminUser.role,
            kind: 'admin'
        },
        _getSecret(),
        { expiresIn: ADMIN_TOKEN_TTL }
    );
}

/** Express-Middleware: prüft Admin-JWT aus Header 'X-Admin-Token' oder Cookie 'admin_token'. */
function requireAdmin(req, res, next) {
    let token = req.headers['x-admin-token'];
    if (!token && req.cookies && req.cookies.admin_token) {
        token = req.cookies.admin_token;
    }
    if (!token) {
        return res.status(401).json({ error: 'admin_auth_required' });
    }

    try {
        const decoded = jwt.verify(token, _getSecret());
        if (decoded.kind !== 'admin') {
            return res.status(401).json({ error: 'invalid_token_kind' });
        }
        req.adminUser = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role
        };
        next();
    } catch (e) {
        return res.status(401).json({ error: 'invalid_or_expired_token' });
    }
}

/** Higher-Order: erlaubt nur bestimmte Rollen. */
function requireRole(...allowedRoles) {
    return function (req, res, next) {
        if (!req.adminUser) return res.status(401).json({ error: 'admin_auth_required' });
        if (!allowedRoles.includes(req.adminUser.role)) {
            return res.status(403).json({ error: 'insufficient_role', required: allowedRoles });
        }
        next();
    };
}

/** Audit-Helper — wird von Route-Handlern aufgerufen. */
async function audit(db, adminUser, action, targetType, targetId, payload, success, errorMessage, req) {
    try {
        await db.query(
            `INSERT INTO admin_audit_log
                (admin_user_id, admin_email, action, target_type, target_id, payload, ip, user_agent, success, error_message)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
                adminUser ? adminUser.id : null,
                adminUser ? adminUser.email : null,
                action,
                targetType,
                targetId ? String(targetId) : null,
                payload ? JSON.stringify(payload) : null,
                req ? (req.headers['x-forwarded-for'] || req.ip) : null,
                req ? req.headers['user-agent'] : null,
                success !== false,
                errorMessage || null
            ]
        );
    } catch (e) {
        console.error('[admin-audit] failed:', e.message);
    }
}

module.exports = {
    signAdminToken,
    requireAdmin,
    requireRole,
    audit,
    ADMIN_TOKEN_TTL_SECONDS
};
