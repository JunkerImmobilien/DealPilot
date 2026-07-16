-- 062_reseller_display.sql
-- Der Darstellungs-Satz des Resellers (Modus, Chrome, Karten, Akzent, Schrift,
-- Zoom, Text-Feintuning) — genau die Schluessel, die das Panel in settings.js
-- sonst nach localStorage schreibt. jsonb, weil das Panel waechst: neue Regler
-- brauchen dann keine Migration.
-- NULL = nicht gepflegt -> der Mandant bekommt die normale Darstellung.
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_display jsonb;
