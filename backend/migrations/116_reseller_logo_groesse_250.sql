-- 116_reseller_logo_groesse_250.sql  ·  v3630f
--
-- LOGOGROESSE IN DER MENUELEISTE BIS 250 % (Marcel 17.11.2026: "Das Logo waere auch
-- schoen, wenn man es oben in der Aktionsleiste passend breiter machen kann oder noch
-- groesser.") Bisher 60-160 (Migration 112). Gemessen an seinem Logo (Verhaeltnis 1,6):
-- bei 160 % 138 x 96 px, die Breite des Markenfelds (231 px) blieb ungenutzt.
--
-- Idempotent: alte Regel weg, neue Regel her.

ALTER TABLE public.resellers DROP CONSTRAINT IF EXISTS resellers_logo_groesse_chk;
ALTER TABLE public.resellers ADD CONSTRAINT resellers_logo_groesse_chk
  CHECK (brand_logo_groesse IS NULL OR brand_logo_groesse BETWEEN 60 AND 250);
