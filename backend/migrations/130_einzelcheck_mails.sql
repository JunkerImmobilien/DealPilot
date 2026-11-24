-- 130_einzelcheck_mails.sql · einzelcheck-2 (Marcel 24.11.2026: „dass der Bericht auch per E-Mail-Adresse einmal zugesendet wird")
-- Zaehlt, wie oft der Bericht eines Kaufs per Mail ging (Deckel MAX_MAILS in services/einzelcheck.js).
-- Die Adresse selbst wird NICHT gespeichert, sie dient nur dem Versand.
ALTER TABLE public.einzelcheck_kaeufe ADD COLUMN IF NOT EXISTS mails integer NOT NULL DEFAULT 0;
