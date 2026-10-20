-- 020_potenzial_abrufe.sql — v2542 · Abruf „Marktpreise" aus der Pilot-Analyse
--
-- Marcel am 20.10.2026: „Der Abruf soll später auch aus dem Tab Pilot-Analyse
-- möglich sein, kostet aber Guthaben, geht dann auch mit in den Marktbericht und
-- kann, wenn man über die Zeit mehrere abgerufen hat, auch bewertet werden, also
-- der Verlauf." Entscheidung: 1 × erweiterte Marktpreisindikation je Abruf, jeder
-- Abruf ein eigener Eintrag mit Datum.
--
-- Je Abruf eine Zeile: Marktdaten (Kauf €/m² Haus und Wohnung mit Spanne,
-- Angebotsmiete mit Spanne), Marktpreisindikation je Stufe mit Spanne,
-- Rohertragsfaktor × Miete, Wert je Wohnung als ETW. Gerechnet wird nichts
-- nachträglich: der Verlauf liest die gespeicherten Zahlen.

CREATE TABLE IF NOT EXISTS mb.potenzial_abrufe (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  external_ref  TEXT,
  adresse       TEXT,
  ags           TEXT,
  objektart     TEXT,
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  daten         JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS potenzial_abrufe_user_ref ON mb.potenzial_abrufe (user_id, external_ref, abgerufen_am DESC);
