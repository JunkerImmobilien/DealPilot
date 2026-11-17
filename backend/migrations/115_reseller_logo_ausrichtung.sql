-- 115_reseller_logo_ausrichtung.sql  ·  v3630e
--
-- AUSRICHTUNG DES PARTNERLOGOS IN DER MENUELEISTE (Marcel 17.11.2026:
-- "Vielleicht sollten wir auch die Moeglichkeit geben, das Logo zu zentrieren.")
--
--   brand_logo_ausrichtung  'links' | 'mitte'. NULL = 'links' (Auslieferungszustand).
--
-- Nur die Menueleiste (Schiene am Schreibtisch, Schublade am Handy). Im PDF-Seitenkopf
-- steht der Seitentitel mittig bei 105 mm - ein mittiges Logo laege darauf. Das
-- Deckblatt-Logo und der Mail-Kopf sind ohnehin mittig.
--
-- Idempotent.

ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_ausrichtung text;

DO $$ BEGIN
  ALTER TABLE public.resellers ADD CONSTRAINT resellers_logo_ausrichtung_chk
    CHECK (brand_logo_ausrichtung IS NULL OR brand_logo_ausrichtung IN ('links','mitte'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
