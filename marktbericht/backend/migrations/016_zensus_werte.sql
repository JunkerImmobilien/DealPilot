-- 016_zensus_werte.sql  (v2162, N62.4 — Marcel am 13.10.2026: „nicht in eine
-- Datei schreiben, sondern direkt in eine Datenbank … ich brauche das ja fuer
-- ganz Deutschland")
--
-- Zensus 2022 je Kreis UND je Gemeinde, aufgeteilt nach Baujahr und Flaeche.
-- Gefuellt von src/services/ZensusImportService.js (Aufruf: npm run zensus).
-- Quelle: ergebnisse.zensus2022.de, Tabellen 4000W-*, Stichtag 15.05.2022.
--
-- Drei Entwurfsentscheidungen:
--
-- 1) Ein Wert je Zeile, mit seiner Tabelle. Eine breite Tabelle mit einer
--    Spalte je Baujahrsklasse muesste bei jeder neuen Aufteilung umgebaut
--    werden; so kommt eine neue Zensus-Tabelle ohne Migration dazu.
--
-- 2) Gesperrt ist nicht null. Der Zensus sperrt Zellen kleiner Gemeinden
--    (Geheimhaltung, "-", "/", "."). Diese Zeilen stehen DA, mit wert NULL und
--    wert_roh = Sperrzeichen — damit "nicht erhoben" und "gesperrt" und
--    "nicht abgerufen" unterscheidbar bleiben. Kein Treffer heisst kein Wert:
--    der Leser setzt nie den Kreis an die Stelle der Gemeinde, ohne es zu sagen.
--
-- 3) ags UND ars. Der Zensus fuehrt Gemeinden mit dem 12-stelligen
--    Regionalschluessel (ARS), der Marktbericht arbeitet mit dem 8-stelligen
--    Gemeindeschluessel (AGS). AGS = ARS[1..5] + ARS[10..12] — eine Umrechnung,
--    keine Zuordnung, deshalb wird sie beim Import gespeichert, nicht geraten.
--
-- Kein user_id: Referenzdaten. Geschrieben wird nur vom Import.

CREATE TABLE IF NOT EXISTS mb.zensus_werte (
  id               BIGSERIAL PRIMARY KEY,
  ebene            TEXT        NOT NULL CHECK (ebene IN ('kreis', 'gemeinde')),
  ags              TEXT        NOT NULL,          -- 5 (Kreis) oder 8 (Gemeinde) Stellen
  ars              TEXT,                          -- 12 Stellen, nur Gemeinde
  gebiet_name      TEXT,
  tabelle          TEXT        NOT NULL,          -- z. B. 4000W-0005
  kennzahl         TEXT        NOT NULL,          -- nettokaltmiete_qm | leerstandsquote | ...
  dimension        TEXT        NOT NULL DEFAULT 'gesamt',   -- gesamt | baujahr | flaeche | leerstandsdauer
  auspraegung      TEXT        NOT NULL DEFAULT 'INSGESAMT', -- Code, z. B. BAU1960B1969
  auspraegung_text TEXT,
  wert             NUMERIC,                       -- NULL = gesperrt oder nicht belegt
  wert_roh         TEXT,                          -- genau wie geliefert
  einheit          TEXT,
  stichtag         DATE        NOT NULL DEFAULT DATE '2022-05-15',
  abgerufen_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  lizenz           TEXT        NOT NULL,
  quelle_url       TEXT,
  UNIQUE (ebene, ags, tabelle, kennzahl, dimension, auspraegung)
);

CREATE INDEX IF NOT EXISTS zensus_werte_ags_idx ON mb.zensus_werte (ags, ebene);
CREATE INDEX IF NOT EXISTS zensus_werte_kennzahl_idx ON mb.zensus_werte (kennzahl, dimension);

-- Ein Protokoll je Abruf: wann, welche Tabelle, wie viele Werte, wie viele
-- gesperrt. Ohne es weiss beim naechsten Abgleich niemand, was schon da war.
CREATE TABLE IF NOT EXISTS mb.zensus_abrufe (
  id            BIGSERIAL PRIMARY KEY,
  tabelle       TEXT        NOT NULL,
  ebene         TEXT        NOT NULL,
  werte         INTEGER     NOT NULL,
  gesperrt      INTEGER     NOT NULL,
  gebiete       INTEGER     NOT NULL,
  dauer_ms      INTEGER,
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);
