-- 059_reseller_mail_accent.sql
-- Entkopplung (Entscheidung 15.07.): die Mail-Farbe ist NICHT mehr an den
-- App-Akzent gebunden. brand_accent = App/PDF, brand_mail_accent = Mail.
-- NULL bedeutet bewusst "nicht gepflegt" -> Code faellt dann auf brand_accent
-- zurueck (ein leerer Farbwert waere ein Fehler, kein Default).
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_mail_accent text;
