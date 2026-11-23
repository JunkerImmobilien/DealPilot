-- 127_vivi_import.sql  ·  v4050 (Marcel 23.11.2026: Objekte, die schon in ViVi verwaltet werden, in DealPilot übernehmen)
--
-- Eine Verknüpfung kann jetzt auch aus ViVi kommen: herkunft 'importiert' (DealPilot-Objekt aus einem ViVi-Objekt
-- angelegt, ViVi wird dabei nur gelesen). Das Protokoll kennt die Art 'import'.
ALTER TABLE public.vivi_verknuepfung DROP CONSTRAINT IF EXISTS vivi_verknuepfung_herkunft_check;
ALTER TABLE public.vivi_verknuepfung ADD CONSTRAINT vivi_verknuepfung_herkunft_check
  CHECK (herkunft IN ('angelegt','zugeordnet','importiert'));
ALTER TABLE public.vivi_protokoll DROP CONSTRAINT IF EXISTS vivi_protokoll_art_check;
ALTER TABLE public.vivi_protokoll ADD CONSTRAINT vivi_protokoll_art_check
  CHECK (art IN ('probe','anlegen','abruf','takt','mietaenderung_vorschau','mietaenderung','import'));
