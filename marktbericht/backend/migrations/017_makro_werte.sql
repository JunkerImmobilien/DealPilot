-- 017_makro_werte.sql — v2172 · N62.16 / N62.18 Punkt 1
--
-- Marcel am 13.10.2026: „Warum warten wir 20 Sekunden auf die
-- Regionaldatenbank, wenn wir direkt aus unserer Datenbank die Werte holen
-- koennen? ... das Ziel sollte sein, dass der Marktbericht so schnell wie
-- moeglich erstellt wird."
--
-- Gemessen am 13.10.2026: die Regionaldatenbank braucht 44 bis 182 s je
-- Tabelle. Die vier Makro-Kennzahlen aendern sich einmal im Jahr. Sie liegen
-- jetzt je Kreis und Jahr hier, der Bericht liest nur noch diese Tabelle.
--
-- Jeder Wert traegt Quelle, Tabelle, Merkmal (Spaltenkopf), Jahr/Stichtag,
-- Abrufdatum und Lizenz — Marcels Vorgabe fuer jeden abgelegten Wert.

CREATE TABLE IF NOT EXISTS mb.makro_werte (
  id            BIGSERIAL PRIMARY KEY,
  kennzahl      TEXT        NOT NULL,   -- bevoelkerung | einkommen_je_ew | arbeitslosenquote | wanderungssaldo_je_10000
  ags           TEXT        NOT NULL,   -- 5 Stellen (Kreis), 2 Stellen (Land) oder DG (Deutschland)
  gebiet_name   TEXT,
  jahr          INTEGER     NOT NULL,
  wert          NUMERIC,                -- NULL = gesperrt oder nicht belegt
  wert_roh      TEXT,                   -- genau wie geliefert
  einheit       TEXT,
  tabelle       TEXT        NOT NULL,   -- z. B. AI008-1
  merkmal       TEXT,                   -- Spaltenkopf der Quelle, zum Nachpruefen
  stichtag      DATE,                   -- nur bei Stichtagswerten (Bevoelkerung 31.12.)
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  lizenz        TEXT        NOT NULL,
  quelle_url    TEXT,
  UNIQUE (kennzahl, ags, jahr)
);

CREATE INDEX IF NOT EXISTS makro_werte_ags_idx ON mb.makro_werte (ags, kennzahl);

CREATE TABLE IF NOT EXISTS mb.makro_abrufe (
  id            BIGSERIAL PRIMARY KEY,
  tabelle       TEXT        NOT NULL,   -- Tabellencode oder GESAMT fuer den ganzen Lauf
  filter        TEXT,                   -- z. B. 05* (ein Bundesland)
  werte         INTEGER     NOT NULL DEFAULT 0,
  gebiete       INTEGER     NOT NULL DEFAULT 0,
  dauer_ms      INTEGER,
  status        TEXT        NOT NULL,   -- ok | fehler
  fehler        TEXT,
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);
