-- 019_makro_ebene.sql — v2517 · Makrolage auf Gemeindeebene
--
-- Marcel am 20.10.2026: Makrolage auf Gemeindeebene, wo die
-- Regionaldatenbank die Kennzahl je Gemeinde fuehrt; Bericht und Messdienst
-- nehmen Gemeinde vor Kreis und schreiben die Ebene dazu.
--
-- Gemessen am 20.10.2026 (regionalstatistik.de, Kreis Minden-Luebbecke):
--   12411-01-01-5  Bevoelkerung je Gemeinde               -> Werte
--   12711-91-01-5  Zu- und Fortzuege je Gemeinde           -> Werte
--   AI002-1-5      Wanderungssaldo je 10.000 EW, Gemeinde  -> gesperrt (".")
--   AI008-1-5      Arbeitslosenquote, Gemeinde             -> gesperrt (".")
--   Einkommen je Einwohner gibt es nur je Kreis (82000-07-01-4).
-- Die Gemeindewerte stehen unter eigenen Kennzahlen (bevoelkerung_gemeinde,
-- zuzuege_gemeinde, fortzuege_gemeinde) - die Deckungspruefung der
-- Kreiswerte zaehlt sonst Gemeinden als Kreise.

ALTER TABLE mb.makro_werte ADD COLUMN IF NOT EXISTS ebene TEXT;   -- bund | land | kreis | gemeinde

UPDATE mb.makro_werte SET ebene = CASE
    WHEN ags = 'DG' THEN 'bund'
    WHEN length(ags) = 2 THEN 'land'
    WHEN length(ags) = 5 THEN 'kreis'
    WHEN length(ags) = 8 THEN 'gemeinde'
    ELSE NULL END
  WHERE ebene IS NULL;
