-- 134_hauscheck_produkt.sql · v5130 KK6 · Haus-Check (Eigennutzer, 9,99 €) laeuft ueber den Kaufweg des Einzel-Checks
-- (Marcel 26.11.2026). Ein Kauf traegt jetzt sein Produkt: 'einzelcheck' (3,99 €, Bestand) oder 'hauscheck'.
-- Der Haus-Check bekommt KEINE Anrechnung aufs Abo (nicht entschieden), die Frist bleibt 14 Tage.
ALTER TABLE public.einzelcheck_kaeufe ADD COLUMN IF NOT EXISTS produkt text NOT NULL DEFAULT 'einzelcheck';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'einzelcheck_kaeufe_produkt_chk') THEN
    ALTER TABLE public.einzelcheck_kaeufe ADD CONSTRAINT einzelcheck_kaeufe_produkt_chk CHECK (produkt IN ('einzelcheck','hauscheck'));
  END IF;
END $$;
