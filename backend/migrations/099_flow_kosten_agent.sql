-- 099_flow_kosten_agent.sql  ·  v3296 / v3297
--
-- DEALPILOT FLOW: FREIGABE FUER KOSTENPFLICHTIGE STUFEN (Punkt 6) UND BESTAETIGUNG
-- SCHREIBENDER CO-PILOT-WERKZEUGE (Punkt 5). Auftrag: Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md.
--
-- kosten_freigaben   je Anfrage ein Token (nur als SHA-256). Status: wartet (Nutzer muss freigeben),
--                    frei (darf eingeloest werden), verbraucht, abgelehnt. Die Monatsgrenze der
--                    automatischen Freigabe (profil.freigaben.monatsgrenze_eur) summiert preis_eur
--                    der Zeilen mit freigabe = 'auto' im laufenden Monat.
-- agent_vorschlaege  ein schreibendes Werkzeug, das der Co-Pilot ueber die API ausfuehren WILL, wird hier
--                    vorgemerkt und erst mit POST /agent/bestaetigen { token } ausgefuehrt.

CREATE TABLE IF NOT EXISTS kosten_freigaben (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL UNIQUE,
  art            TEXT NOT NULL,                 -- mpi | mpi_plus | wev
  stufe          INTEGER NOT NULL,              -- 1 | 2 | 3
  objekt_ref     TEXT NULL,                     -- objects.id (oder NULL ohne Objekt)
  preis_eur      NUMERIC(10,2) NOT NULL DEFAULT 0,
  kostet         BOOLEAN NOT NULL DEFAULT TRUE, -- false: diese Tiefe ist schon bezahlt
  freigabe       TEXT NULL,                     -- auto | nutzer | telegram
  status         TEXT NOT NULL,                 -- wartet | frei | verbraucht | abgelehnt
  kanal          TEXT NULL,                     -- api | telegram
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frei_at        TIMESTAMPTZ NULL,
  verbraucht_at  TIMESTAMPTZ NULL,
  expires_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS kosten_freigaben_nutzer ON kosten_freigaben (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_vorschlaege (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL UNIQUE,
  werkzeug       TEXT NOT NULL,
  args           JSONB NOT NULL DEFAULT '{}'::jsonb,
  kurz           TEXT NULL,
  status         TEXT NOT NULL DEFAULT 'offen',  -- offen | ausgefuehrt | verworfen
  ergebnis       JSONB NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erledigt_at    TIMESTAMPTZ NULL,
  expires_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_vorschlaege_nutzer ON agent_vorschlaege (user_id, created_at DESC);
