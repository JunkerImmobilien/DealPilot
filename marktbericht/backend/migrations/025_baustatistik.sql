-- 025_baustatistik.sql — v3172 · N121 Marktstatistik je Kreis fuer das Portfolio-Modul (Marcel 04.11.2026)
--
-- Wie mb.makro_werte: die Werte liegen in UNSERER Datenbank, die Schnittstelle liest nur hier.
-- Gemessen am 04.11.2026: veranschlagte Baukosten gibt es amtlich nur je Land und Bund
-- (GENESIS 31111-0100 / 31111-0001); je Kreis fuehrt die Regionaldatenbank nur Gebaeude,
-- Wohnungen und Wohnflaeche (31111-01-02-4, 31121-01-02-4) und das Bauland (61511-01-03-4).
--
-- kennzahl: gen_kosten_teur | gen_wohnflaeche_qm | gen_wohnungen | gen_gebaeude
--           fert_wohnflaeche_qm | fert_wohnungen | fert_gebaeude
--           bauland_faelle | bauland_flaeche_qm | bauland_kaufsumme_teur | bauland_eur_qm
-- gruppe:   insgesamt | 1_wohnung | 2_wohnungen | 3_und_mehr | baureif
CREATE TABLE IF NOT EXISTS mb.baustatistik (
  kennzahl      TEXT        NOT NULL,
  ags           TEXT        NOT NULL,
  jahr          INTEGER     NOT NULL,
  gruppe        TEXT        NOT NULL DEFAULT 'insgesamt',
  ebene         TEXT,
  gebiet_name   TEXT,
  wert          NUMERIC,
  tabelle       TEXT        NOT NULL,
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kennzahl, ags, jahr, gruppe)
);
CREATE INDEX IF NOT EXISTS baustatistik_ags_idx ON mb.baustatistik (ags, jahr);

CREATE TABLE IF NOT EXISTS mb.baustatistik_abrufe (
  id         BIGSERIAL   PRIMARY KEY,
  tabelle    TEXT        NOT NULL,
  filter     TEXT,
  werte      INTEGER     NOT NULL DEFAULT 0,
  dauer_ms   INTEGER,
  status     TEXT        NOT NULL,
  fehler     TEXT,
  am         TIMESTAMPTZ NOT NULL DEFAULT now()
);
