-- 117_reseller_logo_darstellung_hell.sql  ·  v3630g
--
-- Neue Darstellung 'hell' (hell eingefaerbt, ohne Flaeche) fuer das Partnerlogo auf
-- dunklem Grund (v3630f). Die Regel aus Migration 112 kannte sie nicht - gemessen:
-- Speichern mit "Hell eingefaerbt" endete mit 400 darstellung_invalid.
--
-- Idempotent.

ALTER TABLE public.resellers DROP CONSTRAINT IF EXISTS resellers_logo_darstellung_chk;
ALTER TABLE public.resellers ADD CONSTRAINT resellers_logo_darstellung_chk
  CHECK (brand_logo_darstellung IS NULL OR brand_logo_darstellung IN ('auto','hell','weiss','gold','gold-dunkel'));
