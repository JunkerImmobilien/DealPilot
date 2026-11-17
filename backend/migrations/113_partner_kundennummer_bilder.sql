-- 113_partner_kundennummer_bilder.sql · v3640 — Kundennummer je Partner, Bilder an Anmerkungen
--
-- Marcel 17.11.2026: „Werden den Kunden bzw. Mandanten auch Nummern oder IDs zugewiesen? Dann wäre es eindeutig.
-- Besteht die Möglichkeit bei den Anmerkungen auch Bildausschnitte mitzuschicken und Sachen zu markieren?“
--
-- 1 · reseller_clients.kundennummer  K-JJJJ-NNN, JJJJ = Jahr der Verbindung, NNN je Partner und Jahr fortlaufend.
--     Vergeben vom Trigger beim Anlegen der Verbindung (jeder Weg: Anfrage, Einladung, Code, createClient), der
--     Altbestand wird hier nachgezogen (Reihenfolge: Verbindungsdatum, dann Anlegedatum). Der Partner darf sie in
--     Kunden & Plaetze aendern; eindeutig je Partner (ohne Gross/Klein). Eine geaenderte Nummer im Muster K-JJJJ-NNN
--     zaehlt fuer die naechste Vergabe mit, eine freie Nummer (z. B. „Mustermann-01“) nicht.
-- 2 · partner_anmerkungen.bild / bild_antwort  Bildausschnitt mit Markierungen als data:-URL (WebP/PNG/JPEG), vom
--     Partner bzw. vom Kunden zur Antwort. Deckel im Dienst (services/partnerAnmerkungen.js BILD_MAX), hier als Netz.
--
-- Idempotent.

ALTER TABLE public.reseller_clients ADD COLUMN IF NOT EXISTS kundennummer text;

CREATE OR REPLACE FUNCTION public.reseller_clients_kundennummer() RETURNS trigger AS $$
DECLARE j int; n int;
BEGIN
  IF NEW.kundennummer IS NOT NULL AND btrim(NEW.kundennummer) <> '' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('kundennummer:' || NEW.reseller_id::text));
  j := extract(year from COALESCE(NEW.verbunden_am, NEW.created_at, now()))::int;
  SELECT COALESCE(MAX(substring(kundennummer from '^K-[0-9]{4}-([0-9]+)$')::int), 0) + 1 INTO n
    FROM public.reseller_clients
   WHERE reseller_id = NEW.reseller_id AND kundennummer LIKE 'K-' || j::text || '-%';
  NEW.kundennummer := 'K-' || j::text || '-' || lpad(n::text, 3, '0');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reseller_clients_kundennummer ON public.reseller_clients;
CREATE TRIGGER trg_reseller_clients_kundennummer BEFORE INSERT ON public.reseller_clients
  FOR EACH ROW EXECUTE FUNCTION public.reseller_clients_kundennummer();

WITH n AS (
  SELECT id, extract(year from COALESCE(verbunden_am, created_at))::int AS j,
         row_number() OVER (PARTITION BY reseller_id, extract(year from COALESCE(verbunden_am, created_at))
                            ORDER BY COALESCE(verbunden_am, created_at), created_at, id) AS nr
    FROM public.reseller_clients WHERE kundennummer IS NULL
)
UPDATE public.reseller_clients c SET kundennummer = 'K-' || n.j::text || '-' || lpad(n.nr::text, 3, '0')
  FROM n WHERE n.id = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reseller_clients_kundennummer
  ON public.reseller_clients (reseller_id, lower(kundennummer)) WHERE kundennummer IS NOT NULL;

ALTER TABLE public.partner_anmerkungen ADD COLUMN IF NOT EXISTS bild text;
ALTER TABLE public.partner_anmerkungen ADD COLUMN IF NOT EXISTS bild_antwort text;
ALTER TABLE public.partner_anmerkungen DROP CONSTRAINT IF EXISTS partner_anmerkungen_bild_deckel;
ALTER TABLE public.partner_anmerkungen ADD CONSTRAINT partner_anmerkungen_bild_deckel
  CHECK ((bild IS NULL OR length(bild) <= 600000) AND (bild_antwort IS NULL OR length(bild_antwort) <= 600000));
