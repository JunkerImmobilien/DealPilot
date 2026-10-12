-- ════════════════════════════════════════════════════════════════════
-- 086 · v2136b — Den Bestätigungsstempel für Altkonten nachtragen
-- Backlog N60.3
--
-- ⚠ DIESE MIGRATION GEHÖRT ZWINGEND ZU v2136. Ohne sie sperrt die
--   Gnadenfrist JEDEN bestehenden Nutzer aus.
--
-- WAS PASSIERT IST — gemessen auf Staging am 12.10.2026, nach dem
-- Ausrollen von v2136 und VOR dieser Migration:
--
--   info@junker-immobilien.io   is_active=t  2026-05-13  Stempel NULL
--   majunker@gmx.net            is_active=t  2026-07-14  Stempel NULL
--   junker_immobilien@gmx.de    is_active=t  2026-07-23  Stempel NULL
--   pruef-ein-125f5634@...test  is_active=t  2026-10-04  Stempel NULL
--
-- Alle vier: Frist seit Monaten abgelaufen, also 403 VERIFY_EXPIRED an
-- jeder Anfrage. Vier von vier Konten ausgesperrt, darunter beide von
-- Marcel und das Admin-Konto.
--
-- DIE URSACHE war eine Annahme, die ich nicht geprüft habe: v2136 liest
-- `email_verified_at` als "hat bestätigt". Gemessen war die Spalte aber
-- LEER — bei allen. Der Bestätigungsweg hat sie nie geschrieben (genau
-- der Fehler, den v2136 behebt). Damit sah die neue Frist jeden
-- Altnutzer als "nie bestätigt".
--
--   > Wer eine Spalte zur Bedingung macht, muss ihren ALTBESTAND
--   > mitbringen. Ich habe die Bedingung gebaut und die Vergangenheit
--   > vergessen — und das Ergebnis war nicht ein Schönheitsfehler,
--   > sondern eine Aussperrung.
--
-- WARUM `is_active = true` HIER "BESTÄTIGT" HEISST, und zwar sicher:
-- Vor v2136 gab es genau zwei Wege zu `is_active = true`:
--   1. Der Klick auf den Bestätigungslink (registerWithVerify.js:194)
--   2. Ein Admin, der das Konto anlegt (admin.js:971) — und der setzt
--      `email_verified_at` von sich aus mit
-- Ein unbestätigtes Konto war `is_active = false`. Deshalb ist für den
-- Altbestand "aktiv" gleichbedeutend mit "bestätigt".
--
-- DIE GRENZE IST DER ZEITPUNKT DIESER MIGRATION. `created_at < NOW()`
-- wird beim Lauf ausgewertet — wer sich DANACH anmeldet, fällt nicht
-- darunter und muss seine Mail bestätigen wie vorgesehen. Ohne diese
-- Grenze würde die Migration jeden künftigen Nutzer stempeln und die
-- Frist damit dauerhaft abschalten.
--
-- `created_at` als Wert, nicht `NOW()`: der Stempel soll sagen, wann
-- bestätigt wurde, und das war damals. Ein Stempel von heute würde eine
-- Bestätigung behaupten, die heute nicht stattgefunden hat.
-- ════════════════════════════════════════════════════════════════════

UPDATE users
   SET email_verified_at = created_at
 WHERE is_active = TRUE
   AND email_verified_at IS NULL
   AND created_at < NOW();

-- Gegenprobe im Log: wie viele tragen jetzt einen Stempel, und bleibt
-- einer ohne? Ein aktiver Nutzer ohne Stempel nach dieser Migration
-- wäre ein Neuzugang innerhalb seiner Frist — das ist richtig so.
DO $$
DECLARE
  n_aktiv   integer;
  n_stempel integer;
  n_offen   integer;
BEGIN
  SELECT count(*) FILTER (WHERE is_active),
         count(*) FILTER (WHERE email_verified_at IS NOT NULL),
         count(*) FILTER (WHERE is_active AND email_verified_at IS NULL)
    INTO n_aktiv, n_stempel, n_offen
    FROM users
   WHERE deleted_at IS NULL;
  RAISE NOTICE '[086] aktiv=% mit_stempel=% aktiv_ohne_stempel=%',
    n_aktiv, n_stempel, n_offen;
END $$;
