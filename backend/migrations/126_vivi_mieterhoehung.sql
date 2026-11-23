-- 126_vivi_mieterhoehung.sql  ·  v4037 (Marcel 23.11.2026: „Mieterhöhung in ViVi anlegen“ aus DealPilot)
--
-- Das Protokoll der ViVi-Anbindung kennt zwei neue Arten: 'mietaenderung_vorschau' (ViVi rechnet die Änderung vor,
-- nichts wird gespeichert) und 'mietaenderung' (der Nutzer hat bestätigt, ViVi legt die Mietänderung an).
ALTER TABLE public.vivi_protokoll DROP CONSTRAINT IF EXISTS vivi_protokoll_art_check;
ALTER TABLE public.vivi_protokoll ADD CONSTRAINT vivi_protokoll_art_check
  CHECK (art IN ('probe','anlegen','abruf','takt','mietaenderung_vorschau','mietaenderung'));
