-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 120
-- v3800: die weiteren Angaben der Anlage V je Objekt und Jahr
--
-- Marcel 19.11.2026 nach dem Termin bei der Steuerkanzlei: alles, was die
-- Anlage V abfragt, muss in DealPilot eingebbar sein und in der Steuer-Mappe
-- an der richtigen Zeile ankommen. Die Steuer-Mappe liest die GESPEICHERTEN
-- Saetze (tax_records), nicht das geoeffnete Objekt - die Angaben brauchen
-- deshalb einen Platz in der Tabelle.
--
-- EINE jsonb-Spalte statt zwanzig numerischer: die Angaben (av_* aus
-- frontend/js/anlage-v-kern.js) und die Auskuenfte zur Zuordnung (_erhV
-- verteilte Erhaltung je Ursprungsjahr, _erhG Gesamtaufwand, _zeUngeteilt)
-- aendern sich mit dem Formular. Die Summenspalten (einnahmen_vv,
-- immo_result) bleiben die Wahrheit fuer alle Auswertungen.
--
-- ALTBESTAND: NULL. Die Mappe rechnet dann wie bisher (jede Wirkung 0).
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_records
  ADD COLUMN IF NOT EXISTS anlage_v jsonb;

COMMENT ON COLUMN tax_records.anlage_v IS
  'v3800: weitere Angaben der Anlage V (av_*) und Auskuenfte zur Zeilenzuordnung (_erhV, _erhG, _zeUngeteilt). '
  'NULL = keine Angaben (Altbestand). Bedeutung der Felder: frontend/js/anlage-v-kern.js.';
