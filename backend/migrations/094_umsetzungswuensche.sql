-- 094_umsetzungswuensche.sql  ·  v3097
--
-- UMSETZUNGSWÜNSCHE DER ENTWICKLUNGSPARTNER
--
-- Marcel am 03.11.2026: Ein Kollege arbeitet als Entwicklungspartner am Projekt mit.
-- Er soll „Umsetzungssachen, die wir umsetzen sollen“, ins Backlog geben können —
-- „kannst du ihm dort vlt was in der app bauen?“
--
-- Wer schreiben darf, steht in user_zusaetze (zusatz = 'entwicklungspartner',
-- freigeschaltet im Admin-Portal). Alle Partner sehen dieselbe Liste und können den
-- Stand setzen. Claude liest neue Wünsche zu Beginn einer Sitzung
-- (tools/wuensche-holen.mjs) und trägt sie mit „W-<id>“ in BACKLOG.md ein.

CREATE TABLE IF NOT EXISTS umsetzungswuensche (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  titel         TEXT NOT NULL,
  beschreibung  TEXT NOT NULL DEFAULT '',
  bereich       TEXT NOT NULL DEFAULT 'sonstiges',
  dringlichkeit TEXT NOT NULL DEFAULT 'normal',     -- 'spaeter' | 'normal' | 'dringend'
  status        TEXT NOT NULL DEFAULT 'neu',        -- 'neu' | 'backlog' | 'arbeit' | 'erledigt' | 'abgelehnt'
  backlog_nr    TEXT,                               -- z. B. 'N109'
  antwort       TEXT,
  geaendert_von TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_umsetzungswuensche_status ON umsetzungswuensche (status, created_at DESC);
