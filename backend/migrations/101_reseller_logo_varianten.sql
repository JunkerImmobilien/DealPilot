-- 101_reseller_logo_varianten.sql  ·  v3299
--
-- LOGO-KONTRAST FUER PARTNER (Dateien/Partner-Demo/Befund.md, Punkt 3 und L1/L7/L10)
--
-- Ein Partner laedt EIN Logo hoch; es steht auf Obsidian (Menueleiste, Mail-Kopf,
-- dunkle PDF-Deckblaetter) und auf Weiss (PDF-Boegen). Gemessen am 11.11.2026:
-- dunkles Logo auf der Menueleiste 1,30 : 1, helles Logo auf weissen Deckblaettern
-- unsichtbar. Das Portal vermisst das Logo beim Speichern (frontend/js/logo-kontrast.js)
-- und legt je Grund ein fertiges PNG ab - jsPDF und Mail kennen weder CSS noch SVG.
--
--   brand_logo_dark_b64     optionales zweites Logo "fuer dunklen Grund" (Vorrang dort)
--   brand_logo_auf_dunkel   PNG-Variante fuer dunklen Grund (eingefaerbt, Platte oder unveraendert)
--   brand_logo_auf_hell     PNG-Variante fuer hellen Grund (ebenso; auch die PNG-Fassung eines SVG)
--   brand_logo_messung      Messung (mittlere Farbe, Streuung, eigene Flaeche, Kontrast vorher/nachher)
--
-- Idempotent. Kein Default: NULL heisst "noch nicht gerechnet" (Branding vor v3299).

ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_dark_b64   text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_auf_dunkel text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_auf_hell   text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_messung    jsonb;
