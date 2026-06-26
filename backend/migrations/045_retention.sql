-- 045_retention.sql — Kundenbindung: Einstellungen + Versand-Log (v799)

-- Eine Settings-Zeile (singleton, id=1). Schwellen, Auto-An/Aus, Templates.
CREATE TABLE IF NOT EXISTS retention_settings (
  id                   INT PRIMARY KEY DEFAULT 1,
  -- Auslauf-Mahnung
  expiry_enabled       BOOLEAN NOT NULL DEFAULT false,   -- Auto-Versand an?
  expiry_days_before   INT     NOT NULL DEFAULT 14,       -- X Tage vor Ablauf mailen
  expiry_subject       TEXT,
  expiry_body          TEXT,
  -- Inaktivitaet
  inactive_enabled     BOOLEAN NOT NULL DEFAULT false,
  inactive_days        INT     NOT NULL DEFAULT 30,       -- ab X Tagen ohne Login
  inactive_subject     TEXT,
  inactive_body        TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retention_settings_singleton CHECK (id = 1)
);

-- Versand-Log: verhindert Doppel-Mails (1 Mail je User je Typ je "Fenster").
CREATE TABLE IF NOT EXISTS retention_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        VARCHAR(20) NOT NULL,        -- 'expiry' | 'inactive'
  ref_key     VARCHAR(80) NOT NULL,        -- Idempotenz-Schluessel (z.B. 'expiry:<period_end-date>')
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel     VARCHAR(20) NOT NULL DEFAULT 'email',
  meta        JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_retention_log_dedup ON retention_log(user_id, kind, ref_key);
CREATE INDEX IF NOT EXISTS idx_retention_log_sent ON retention_log(sent_at DESC);

-- Default-Settings-Zeile anlegen (idempotent).
INSERT INTO retention_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
