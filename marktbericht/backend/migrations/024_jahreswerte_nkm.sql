-- 024_jahreswerte_nkm.sql · v3026 — dritte amtliche Reihe im Jahreswerte-Takt:
-- Index der Nettokaltmieten (Destatis, GENESIS 61111-0006, Sonderposition CC13-73,
-- 2020 = 100). Fortgeschrieben wird damit die Zensusmiete 2022 (lib/zensus_miete.js).
-- Gemessen 28.10.2026 auf Staging: der Spaltencheck heisst jahreswerte_abruf_reihe_check.
ALTER TABLE mb.jahreswerte_abruf DROP CONSTRAINT IF EXISTS jahreswerte_abruf_reihe_check;
ALTER TABLE mb.jahreswerte_abruf ADD CONSTRAINT jahreswerte_abruf_reihe_check
  CHECK (reihe IN ('vpi', 'bpi', 'nkm'));
