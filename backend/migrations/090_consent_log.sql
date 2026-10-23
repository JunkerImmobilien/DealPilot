-- 090_consent_log.sql  ·  v2933
--
-- ZUSTIMMUNGEN MIT NACHWEIS
--
-- Datenschutz-Bestandsaufnahme vom 23.10.2026: Die Datenschutzerklaerung
-- verspricht "Zustimmungen mit Zeitstempel und Versionsnummer, 3 Jahre".
-- Tatsaechlich lagen sie nur im localStorage des Browsers, und der Aufruf an
-- /api/v1/consent ging ins Leere - den Endpunkt gab es nicht. Ohne dieses
-- Protokoll fehlt auch der Nachweis, dass ein Verbraucher der sofortigen
-- Ausfuehrung zugestimmt hat (§ 356 Abs. 5 BGB, Erloeschen des Widerrufsrechts).
--
-- art:      hinweise | widerruf_verzicht | agb | datenschutz | newsletter
-- version:  Version des Textes, dem zugestimmt wurde
-- kontext:  z. B. {"plan":"pro","intervall":"monthly"} beim Kauf
-- Keine IP-Adresse: der Nachweis haengt am angemeldeten Konto.
-- Aufbewahrung: 3 Jahre (Datenschutzerklaerung), danach loescht der
-- naechtliche Lauf in index.js die Zeilen.

CREATE TABLE IF NOT EXISTS consent_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  art          TEXT NOT NULL,
  version      TEXT NOT NULL,
  accepted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent   TEXT,
  kontext      JSONB
);
CREATE INDEX IF NOT EXISTS consent_log_user_idx ON consent_log (user_id, art, accepted_at DESC);
