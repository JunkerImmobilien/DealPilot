-- 029_newsletter_consent.sql
-- v428: Newsletter-Einwilligung (vorbereitet, noch kein Versand).
-- Speichert die freiwillige Opt-in-Einwilligung + Zeitstempel (Art. 7 DSGVO Nachweis).
-- Idempotent (ADD COLUMN IF NOT EXISTS).

ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_consent_at TIMESTAMPTZ;
