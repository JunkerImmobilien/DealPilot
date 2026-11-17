-- 111_vorschau_freigaben.sql  ·  v3600
--
-- VORSCHAU-FUNKTIONEN (Marcel 17.11.2026: was noch nicht fertig ist, sieht auf Prod kein Kunde)
-- Die Liste der Funktionen steht im Code (backend/src/services/vorschau-funktionen.json).
-- Hier steht nur der Schalter „für alle freigegeben“ je Funktion (Admin › Vorschau).
-- Wer einzeln freigeschaltet ist, steht in user_zusaetze (zusatz = 'vorschau').
-- Ohne Zeile gilt: Vorschau (nur Admin, Freigabeliste bzw. der genannte Zusatz).

CREATE TABLE IF NOT EXISTS vorschau_freigaben (
  schluessel     TEXT PRIMARY KEY,
  fuer_alle      BOOLEAN NOT NULL DEFAULT FALSE,
  geaendert_von  TEXT,
  geaendert_am   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
