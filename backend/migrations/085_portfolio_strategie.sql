-- 085 · Portfolio-Strategie (v1880, 05.10.2026)
--
-- Marcel: "leg das modul portfolio strategie an nach dem zweiten weg" - das Modul liegt im
-- selben Repo und geht mit jedem Rollout nach Prod, ist dort aber unsichtbar, weil es nur mit
-- dem Feature-Schluessel `portfolio_strategie` erscheint. Ein unbekannter Schluessel ist fuer
-- jeden false (CLAUDE.md); hier wird er fuer JEDEN Plan ausdruecklich auf false gesetzt, damit
-- er bekannt ist. Auf Staging wird er fuer den Partner-Plan von Hand auf true gesetzt - NICHT
-- per Migration, sonst waere er beim naechsten Rollout auch auf Prod an.
--
-- Fachlich: Forschungsvorhaben 827-757-583/2026-1/1 (BSFZ-Bescheid 05.10.2026), Arbeitspakete
-- 1-10 (Zielfunktion, Steuer-Rechenkern, Normableitung, Datenfusion, Szenario-Engine,
-- Heuristische Suche, Restriktions-/Fristenmodell, Ereignisextraktion, Profilgewichtung,
-- Validierung). Die Tabelle nimmt Laeufe des Verfahrens auf: Eingabe (Bestand, Profil,
-- Budgets) und Ergebnis (Zuordnung, Handlung, Zeitpunkt je Objekt), damit Versuchsreihen
-- (Hypothese -> Messung -> Fortfuehrung/Verwerfen) belegbar bleiben.

UPDATE plans
SET features = features || '{"portfolio_strategie": false}'::jsonb,
    updated_at = now()
WHERE NOT (features ? 'portfolio_strategie');

CREATE TABLE IF NOT EXISTS portfolio_strategie_laeufe (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID        NOT NULL,
  name          TEXT        NOT NULL DEFAULT '',
  arbeitspaket  TEXT        NOT NULL DEFAULT '',      -- z. B. 'AP6', 'AP7'
  hypothese     TEXT        NOT NULL DEFAULT '',      -- vorab gesetzte Schwelle, in Worten
  eingabe       JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- Bestand, Profil, Budgets, Fristen
  ergebnis      JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- Zuordnung/Handlung/Zeitpunkt je Objekt, Kennzahlen
  befund        TEXT        NOT NULL DEFAULT '',      -- fortgefuehrt / verworfen, warum
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portfolio_strategie_laeufe_user_idx ON portfolio_strategie_laeufe (user_id, created_at DESC);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM plans WHERE features->>'portfolio_strategie' = 'false';
  IF n = 0 THEN
    RAISE EXCEPTION '085: portfolio_strategie in keinem Plan gesetzt';
  END IF;
  RAISE NOTICE '085: portfolio_strategie in % Plaenen auf false, Tabelle portfolio_strategie_laeufe da.', n;
END $$;
