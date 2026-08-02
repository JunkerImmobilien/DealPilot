-- 011_modellversion_nrw.sql  (Paket v1048)
-- ─────────────────────────────────────────────────────────────────────
-- Jeder Parameter soll sagen, nach WELCHEM Modell er abgeleitet wurde.
--
-- Bisher steht ueberall 'immowertv2021'. Das ist fuer die NRW-Werte falsch:
-- sie stammen aus dem "Modell zur Ableitung von Liegenschaftszinssaetzen"
-- der AGVGA.NRW (Stand 21.06.2016), und das hat andere Bewirtschaftungs-
-- kostenansaetze als Anlage 3 ImmoWertV:
--
--                       ImmoWertV Anlage 3     AGVGA.NRW
--   Verwaltung ETW      275 / 357              275 / 335
--   Instandhaltung      9,00 / 11,70 EUR/m2    9,00 / 11,00 EUR/m2
--   Garage              68 / 88 EUR            65 EUR
--   Stellplatz          nicht getrennt         25 EUR
--
-- Das Modell sagt selbst: "Die Verwendung der abgeleiteten Liegenschafts-
-- zinssaetze bedingt eine modellkonforme Ertragswertermittlung." Wer einen
-- NRW-Zinssatz mit den Ansaetzen der ImmoWertV kombiniert, verlaesst das
-- Modell (Paragraf 10 ImmoWertV) — und bekommt ein Ergebnis, das amtlich
-- aussieht und es nicht ist.
--
-- Mit dem Vermerk am Wert entscheidet der Parameter selbst, mit welchen
-- Ansaetzen er gerechnet werden will. Brandenburg und Niedersachsen
-- bekommen spaeter ihr eigenes Modell, ohne dass irgendwo im Rechenkern
-- eine Laenderabfrage steht.

BEGIN;

UPDATE mb.wert_parameter
   SET modellversion = 'agvga_nrw_2016'
 WHERE modellversion = 'immowertv2021'
   AND qualitaet IN ('A','B')
   AND left(ags, 2) = '05';        -- Nordrhein-Westfalen

COMMENT ON COLUMN mb.wert_parameter.modellversion IS
  'Nach welchem Modell der Wert abgeleitet wurde. Entscheidet, mit welchen '
  'Bewirtschaftungskosten und welcher Restnutzungsdauer-Tabelle er gerechnet '
  'werden darf (Paragraf 10 ImmoWertV, Grundsatz der Modellkonformitaet). '
  'agvga_nrw_2016 = Modell der AGVGA.NRW vom 21.06.2016. '
  'immowertv2021 = Modellansaetze der Anlagen 1 bis 3 ImmoWertV. '
  'Der gesetzliche Auffangwert nach Paragraf 256 BewG bleibt immowertv2021.';

COMMIT;
