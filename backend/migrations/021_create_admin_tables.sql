-- ═══════════════════════════════════════════════════════════════
--  V194 — Admin-Dashboard Migration
--  Erstellt admin_users und admin_audit_log Tabellen
--  
--  Idempotent: nutzt CREATE TABLE IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════

-- Admin-User-Tabelle (separat von normalen users)
CREATE TABLE IF NOT EXISTS admin_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    totp_secret     TEXT,                                  -- AES-verschlüsselt
    totp_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    role            TEXT NOT NULL DEFAULT 'support',        -- 'owner' | 'support' | 'readonly'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    last_login_ip   TEXT,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- Audit-Log für ALLE Admin-Aktionen
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    admin_user_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    admin_email     TEXT,                                   -- Snapshot für nachvollziehbares Audit
    action          TEXT NOT NULL,                          -- 'login', 'user.password_reset', 'user.plan_change', ...
    target_type     TEXT,                                   -- 'user', 'subscription', 'system', ...
    target_id       TEXT,                                   -- Frei (uuid, email, etc.)
    payload         JSONB,                                  -- Zusatzdaten
    ip              TEXT,
    user_agent      TEXT,
    success         BOOLEAN NOT NULL DEFAULT TRUE,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

-- Rate-Limit für Login-Versuche pro IP
CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id              BIGSERIAL PRIMARY KEY,
    ip              TEXT NOT NULL,
    email_attempted TEXT,
    success         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON admin_login_attempts(ip, created_at DESC);
