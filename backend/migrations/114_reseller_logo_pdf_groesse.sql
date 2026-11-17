-- 114_reseller_logo_pdf_groesse.sql  ·  v3630b
--
-- LOGOGROESSE IN DEN DOKUMENTEN (Marcel 17.11.2026, Partner-Cockpit › Verwaltung › Dokumente)
--
--   brand_logo_pdf_groesse  Prozent, 60-150. NULL = 100. Wirkt ueber
--                           branding.get().logo_pdf_skala (mandant-branding.js) auf
--                           Kopf, Kopfbalken und Deckblatt (pdf-logo.js box/kopf, pdf.js);
--                           jede Stelle hat eine harte Obergrenze, damit nichts in
--                           Text oder Goldlinie waechst.
--
-- Idempotent.

ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_pdf_groesse smallint;

DO $$ BEGIN
  ALTER TABLE public.resellers ADD CONSTRAINT resellers_logo_pdf_groesse_chk
    CHECK (brand_logo_pdf_groesse IS NULL OR brand_logo_pdf_groesse BETWEEN 60 AND 150);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
