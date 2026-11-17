-- 112_reseller_logo_darstellung.sql  ·  v3630
--
-- PARTNERLOGO: DARSTELLUNG AUF DUNKLEM GRUND UND GROESSE (Marcel 17.11.2026)
--
--   brand_logo_darstellung  'auto' | 'weiss' | 'gold' | 'gold-dunkel' - vom Partner gewaehlt.
--                           Das fertige PNG dazu steht wie bisher in brand_logo_auf_dunkel
--                           (Mail-Kopf, dunkles PDF-Deckblatt und Menueleiste lesen nur das
--                           PNG). Die Spalte merkt nur die Wahl fuer das Portal und fuers
--                           Nachrechnen. NULL = 'auto' (Branding vor v3630).
--   brand_logo_groesse      Logogroesse in der Menueleiste in Prozent, 60-160. NULL = 100.
--
-- Eigene Spalten statt brand_display: brand_display ist die Darstellungs-Vorgabe fuer
-- Mandanten und wird von darstellung-reseller.js als GANZES Objekt ueberschrieben
-- (PUT /branding-contact) - ein Feld darin ginge beim naechsten Speichern dort verloren.
--
-- Idempotent.

ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_darstellung text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_logo_groesse     smallint;

DO $$ BEGIN
  ALTER TABLE public.resellers ADD CONSTRAINT resellers_logo_darstellung_chk
    CHECK (brand_logo_darstellung IS NULL OR brand_logo_darstellung IN ('auto','weiss','gold','gold-dunkel'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.resellers ADD CONSTRAINT resellers_logo_groesse_chk
    CHECK (brand_logo_groesse IS NULL OR brand_logo_groesse BETWEEN 60 AND 160);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
