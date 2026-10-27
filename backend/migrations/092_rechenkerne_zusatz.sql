-- 092_rechenkerne_zusatz.sql  ·  v2977
--
-- SCHNITTSTELLE RECHENKERNE ALS ZUSATZ (RND + VERKEHRSWERT)
--
-- Marcel am 27.10.2026: „kannst du eine schnittstelle bauen wo ich daten eingeben
-- kann und an dealpilot schicken kann also rnd berechnungen und auch die
-- Verkehrswertermittlung? … das möchte ich später extra verkaufen“ — „später für
-- sachverständige oder makler ein extra paket … das anzubinden“, „nur Pro und Partner“.
--
-- Die Schnittstelle selbst gibt es seit v2071 (routes/rechenkerne.js). Neu ist:
--   user_zusaetze        je Kunde ein freigeschalteter Zusatz, optional mit
--                        Monatskontingent je Kern (NULL = ohne Grenze). Freigeschaltet
--                        wird im Admin-Portal; der Preis kommt später als Paket.
--   rechenkerne_aufrufe  jeder Aufruf mit Kunde, Schlüssel, Kern, Ergebnis und Dauer —
--                        die Grundlage für Kontingent und spätere Abrechnung.

CREATE TABLE IF NOT EXISTS user_zusaetze (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zusatz          TEXT NOT NULL,                 -- 'rechenkerne_api'
  aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
  kontingent_rnd  INTEGER,                       -- Aufrufe je Kalendermonat, NULL = ohne Grenze
  kontingent_vw   INTEGER,
  notiz           TEXT,
  geaendert_von   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, zusatz)
);

CREATE TABLE IF NOT EXISTS rechenkerne_aufrufe (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id    UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  kern          TEXT NOT NULL,                   -- 'rnd' | 'verkehrswert'
  ok            BOOLEAN NOT NULL,
  http_status   INTEGER,
  ms            INTEGER,
  external_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rechenkerne_aufrufe_user_zeit ON rechenkerne_aufrufe (user_id, created_at);
