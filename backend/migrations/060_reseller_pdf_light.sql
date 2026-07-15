-- 060_reseller_pdf_light.sql
-- Entscheidung 15.07.: Der RESELLER entscheidet, ob das PDF-Deckblatt hell oder
-- dunkel ist — gilt dann fuer alle seine Mandanten. Deine eigenen Kunden behalten
-- Obsidian. NULL/false = dunkel (Bestandsverhalten, keine Ueberraschung).
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS brand_pdf_light boolean DEFAULT false;
