-- 058_reseller_brand_contact.sql
-- Whitelabel-Luecke: resellers kennt bisher nur brand_name / brand_logo_b64 /
-- brand_accent* / brand_obsidian / brand_domain — aber KEINE Kontaktdaten.
-- Deshalb faellt der PDF-Footer beim Mandanten auf JUNKER_DEFAULTS zurueck
-- (fremder Firmenname ueber Junker-Adresse). Diese Migration legt die Felder an.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_company  text;  -- Rechtsname, falls != brand_name
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_address  text;  -- Strasse + Hausnummer
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_plz      text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_city     text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_phone    text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_email    text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_website  text;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_tagline  text;  -- ersetzt "Investmentanalyse für Profis"

-- Hinweis: KEIN Default und KEIN NOT NULL — leere Felder muessen erkennbar bleiben,
-- damit die App weiss, dass der Reseller sie noch nicht gepflegt hat (sonst
-- wuerde ein leerer String als "gepflegt" durchgehen und der Footer waere leer).
