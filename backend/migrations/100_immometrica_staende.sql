-- 100_immometrica_staende.sql  ·  v3298
--
-- DEALPILOT FLOW, PUNKT 4: IMMOMETRICA-STAENDE SPEICHERN UND PREISSENKUNGEN MELDEN
-- Auftrag: Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md, Punkt 4.
--
-- ImmoMetrica liefert keinen Preisverlauf und keine Webhooks (Support 04.11.2026, immometricaService.js
-- v3168). Deshalb merkt sich DealPilot je Suche und Treffer den letzten Stand und vergleicht.
-- Gespeichert wird NUR: Inserats-Id, Preis, Flaeche, Titel, Link (platforms[].url), Online-Status -
-- keine Kontaktdaten.
--
-- Der regelmaessige Abruf (services/immometricaFlowJob.js) ist per Schalter AUS
-- (FLOW_IMMOMETRICA_JOB=an), bis Marcel ihn nach der Messung der Kontingentbelastung freigibt.

CREATE TABLE IF NOT EXISTS immometrica_staende (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suche_id       TEXT NOT NULL,
  offer_id       TEXT NOT NULL,
  preis          NUMERIC(14,2) NULL,
  flaeche        NUMERIC(10,2) NULL,
  titel          TEXT NULL,
  link           TEXT NULL,
  online         BOOLEAN NOT NULL DEFAULT TRUE,
  objekt_id      UUID NULL,
  erstmals_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zuletzt_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preis_geaendert_at TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, suche_id, offer_id)
);

CREATE TABLE IF NOT EXISTS immometrica_ereignisse (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  art            TEXT NOT NULL,                 -- neu | preis_gesenkt | unter_zielpreis | offline | wieder_online
  suche_id       TEXT NULL,
  offer_id       TEXT NULL,
  objekt_id      UUID NULL,
  titel          TEXT NULL,
  link           TEXT NULL,
  preis_alt      NUMERIC(14,2) NULL,
  preis_neu      NUMERIC(14,2) NULL,
  senkung_pct    NUMERIC(6,2) NULL,
  zielpreis      NUMERIC(14,2) NULL,
  at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gesendet_at    TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS immometrica_ereignisse_nutzer ON immometrica_ereignisse (user_id, id);

CREATE TABLE IF NOT EXISTS immometrica_abruf (
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suche_id         TEXT NOT NULL,
  letzter_lauf_at  TIMESTAMPTZ NULL,
  hoechste_offer_id TEXT NULL,
  kontingent       JSONB NULL,
  PRIMARY KEY (user_id, suche_id)
);
