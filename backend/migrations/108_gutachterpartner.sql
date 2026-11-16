-- 108_gutachterpartner.sql  ·  v3540
--
-- RESTNUTZUNGSDAUER BEIM UNABHAENGIGEN GUTACHTERPARTNER ANFRAGEN
--
-- Marcel am 16.11.2026: die „Partner Form API“ des Gutachterpartners anbinden —
-- Ersteinschaetzung (Formular remaining-useful-life-lite, Ergebnis sofort) und
-- vollstaendige Gutachtenanfrage (remaining-useful-life, regulaere Bearbeitung).
-- Nach aussen heisst der Anbieter „unabhaengiger Gutachterpartner“ (CLAUDE.md,
-- Anbieter-Neutralitaet); der Name steht nur im Code (services/evalionClient.js).
--
--   gutachter_anfragen  je Anfrage beim Partner eine Zeile: Konto, Objekt, Formular,
--                       Umgebung (test/produktion), Partner-Kennung, Status, ETag,
--                       Ergebnis — die Anfrage-ID haengt so am Objekt.
--   gutachter_aufrufe   jeder Aufruf an den Partner mit Aktion, Ergebnis und Dauer
--                       (wie rechenkerne_aufrufe) — Grundlage fuer Abrechnung und Fehlersuche.
-- Freigeschaltet wird ueber user_zusaetze (zusatz = 'gutachterpartner') oder users.role = 'admin'.

CREATE TABLE IF NOT EXISTS gutachter_anfragen (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  objekt_id        UUID,                          -- objects.id, ohne FK: ein geloeschtes Objekt loescht die Anfrage nicht
  formular         TEXT NOT NULL,                 -- 'remaining-useful-life-lite' | 'remaining-useful-life'
  umgebung         TEXT NOT NULL,                 -- 'test' | 'produktion'
  request_id       TEXT NOT NULL UNIQUE,          -- Kennung beim Partner (UUID)
  request_number   TEXT,
  status           TEXT,                          -- draft | received | initialAssessment | ordered
  etag             TEXT,
  idem_submit      TEXT NOT NULL,                 -- Idempotency-Key fuers Absenden, einmal je Anfrage
  ergebnis         JSONB,
  kostenpflichtig_bestaetigt_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gutachter_anfragen_user_objekt ON gutachter_anfragen (user_id, objekt_id, created_at);

CREATE TABLE IF NOT EXISTS gutachter_aufrufe (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  aktion        TEXT NOT NULL,                   -- formular | anlegen | aendern | datei | datei_loeschen | absenden | lesen
  ok            BOOLEAN NOT NULL,
  http_status   INTEGER,
  ms            INTEGER,
  request_id    TEXT,
  code          TEXT,                            -- Fehlercode des Partners (validation_failed, …)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gutachter_aufrufe_user_zeit ON gutachter_aufrufe (user_id, created_at);
