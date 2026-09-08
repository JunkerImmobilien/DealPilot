-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 070
-- v1258: die § 7b-Sonder-AfA bekommt eine eigene Spalte
--
-- Marcels Freigabe vom 08.09.2026. Der Punkt stand seit v1225 offen und
-- war der letzte, der eine Datenbankänderung brauchte.
--
-- DAS PROBLEM: `tax_records.afa` führt lineare Gebäude-AfA und § 7b
-- zusammen in EINER Zahl. Für das GEÖFFNETE Objekt ist die Aufteilung
-- seit v1225 bekannt (`_afaLinear` / `_afaSonder7b` in tax.js:1064) und
-- wird getrennt gedruckt. Für einen GESPEICHERTEN Satz in der Steuer-Mappe
-- nicht — dort steht nur der Hinweis, dass ein § 7b-Anteil aus Zeile 35
-- abzuziehen und in Zeile 38 einzutragen wäre.
--
-- Das ist ehrlich, aber unvollständig: die Anlage V verlangt die Trennung.
-- Zeile 35 nimmt die lineare AfA, Zeile 38 die erhöhten Absetzungen nach
-- § 7b EStG. Wer den gespeicherten Satz ausdruckt, muss heute selbst
-- rechnen.
--
-- WARUM ZWEI SPALTEN UND NICHT EINE:
-- `afa` BLEIBT und behält seine Bedeutung — die Summe. Alles, was heute
-- damit rechnet (immo_result, tax_before/after, jede Auswertung, jeder
-- Export), liest weiter dieselbe Zahl und bekommt dasselbe Ergebnis.
-- Die beiden neuen Spalten sind eine AUSKUNFT über die Zusammensetzung,
-- keine zweite Wahrheit. Wäre `afa` zur linearen AfA umgedeutet worden,
-- hätte sich jede gespeicherte Steuerlast rückwirkend verschoben.
--
-- ALTBESTAND: die 265 vorhandenen Sätze bekommen NULL, nicht 0. Null
-- heisst „nicht erhoben" und ist die Wahrheit — 0 hiesse „kein § 7b",
-- und das wissen wir für alte Sätze nicht. Die Anzeige muss den
-- Unterschied kennen: bei NULL bleibt der bisherige Hinweis stehen.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_records
  ADD COLUMN IF NOT EXISTS afa_linear     numeric(14,2),
  ADD COLUMN IF NOT EXISTS afa_sonder_7b  numeric(14,2);

COMMENT ON COLUMN tax_records.afa IS
  'Gebaeude-AfA GESAMT (linear + Sonder-AfA nach Paragraf 7b EStG). Bleibt die '
  'Summe — alle Auswertungen rechnen damit. Die Aufteilung steht in '
  'afa_linear und afa_sonder_7b.';

COMMENT ON COLUMN tax_records.afa_linear IS
  'Anteil lineare Gebaeude-AfA an `afa`. Anlage V Zeile 35. '
  'NULL = bei diesem Satz nicht erhoben (Saetze vor v1258).';

COMMENT ON COLUMN tax_records.afa_sonder_7b IS
  'Anteil Sonder-AfA nach Paragraf 7b EStG an `afa`. Anlage V Zeile 38. '
  'NULL = bei diesem Satz nicht erhoben (Saetze vor v1258).';
