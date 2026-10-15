-- 088_markt_bauzins.sql  ·  v2245
--
-- DER INDIKATIVE BAUZINS FOLGT DEM MARKT
--
-- Marcel am 15.10.2026: "baue den mal genauso wie vorgeschlagen".
--
-- Bauzins(Bindung b, LTV) = Bund_b(heute) + A_mfi(b) + K + Z(LTV)
--
--   Bund_b   taegliche Rendite der Bundeswertpapiere (Bundesbank BBSIS,
--            D.I.ZST.ZI.EUR.S1311.B.A604.R{05|10|15|20}XX.R.A.A._Z._Z.A)
--   A_mfi(b) monatlicher Marktaufschlag = MFI-Effektivzins Wohnungsbau
--            Neugeschaeft (BBIM1 M.DE.B.A2C.{I|O|P}.R.A.2250.EUR.N) minus
--            Monatsdurchschnitt der Bund-Rendite gleicher Laufzeit
--   K, Z     Konstanten im Dienst (bauzinsService.js), nicht in der DB
--
-- Gespeichert wird nur, was die Bundesbank liefert, und der daraus
-- abgeleitete Monatsaufschlag. Faellt der Abruf aus, rechnet der Dienst
-- mit dem letzten Stand dieser Tabellen weiter - statt mit einer Zahl,
-- die jemand von Hand nachgetragen hat.

CREATE TABLE IF NOT EXISTS markt_zins_tag (
  datum       DATE      NOT NULL,
  laufzeit    SMALLINT  NOT NULL,          -- Restlaufzeit in Jahren: 5, 10, 15, 20
  bund        NUMERIC(6,3),                -- Rendite Bundeswertpapiere, % p.a.
  pfandbrief  NUMERIC(6,3),                -- Rendite Pfandbriefe, % p.a.
  abgerufen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (datum, laufzeit)
);

CREATE TABLE IF NOT EXISTS markt_bauzins_monat (
  monat       DATE      NOT NULL,          -- erster Tag des Monats
  laufzeit    SMALLINT  NOT NULL,          -- Zinsbindung, der der Aufschlag gilt: 5, 10, 15, 20
  mfi         NUMERIC(6,3) NOT NULL,       -- MFI-Effektivzins Wohnungsbau Neugeschaeft, % p.a.
  bund_avg    NUMERIC(6,3) NOT NULL,       -- Monatsdurchschnitt Bund gleicher Laufzeit
  aufschlag   NUMERIC(6,3) NOT NULL,       -- mfi - bund_avg
  reihe       TEXT,                        -- MFI-Reihe (I / O / P)
  abgerufen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (monat, laufzeit)
);

CREATE INDEX IF NOT EXISTS idx_markt_zins_tag_datum ON markt_zins_tag (datum DESC);
