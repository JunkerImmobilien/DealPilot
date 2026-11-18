-- 118_partner_freigaben.sql  ·  v3690 (Paket P1 · Freigabe bei der Kopplung)
--
-- Konzept: Dateien/Mandantenkonzept/Anfordern-und-Freigeben-2026-11-18.md, Abschnitt 5.1 (Teil Freigaben).
-- Marcel 18.11.2026: Steuerdaten des Kunden gehen nur mit seiner Freigabe mit, abgefragt bei der Kopplung,
-- dauerhaft ODER einmalig, spaeter unter Mein Partner aenderbar und widerrufbar.
--
--   partner_freigaben   je Verbindung (client_id) beliebig viele FASSUNGEN. Aendern = neue Zeile, die alte bekommt
--                       ersetzt_am. Genau eine Fassung ist aktiv (ersetzt_am, widerrufen_am, verbraucht_am leer).
--                       art 'einmal' wird beim ersten Senden verbraucht (verbraucht_am).
--   partner_anfragen.vorschlag, reseller_invites.vorschlag
--                       was der Partner vorschlaegt (Art und Bereiche), beim Kunden vorausgewaehlt und abwaehlbar.
--   object_shares.bereiche, object_shares.freigabe_id
--                       mit welchen Bereichen und unter welcher Fassung ein Stand gesendet wurde.
--
-- Spalten fuer Anforderungen und Steuerjahr (Pakete P3, P4) kommen mit eigener Migration.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.partner_freigaben (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.reseller_clients(id) ON DELETE CASCADE,
  art           text NOT NULL CHECK (art IN ('dauer','einmal','keine')),
  bereiche      jsonb NOT NULL DEFAULT '{}'::jsonb,
  umfang        text NOT NULL DEFAULT 'alle' CHECK (umfang IN ('objekt','auswahl','bestand','ankauf','alle')),
  objekt_ids    uuid[],
  steuerjahr    integer,
  text_version  text NOT NULL,
  quelle        text NOT NULL CHECK (quelle IN ('einladung','anfrage','code','mein_partner','anforderung')),
  erteilt_am    timestamptz NOT NULL DEFAULT now(),
  erteilt_von   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ersetzt_am    timestamptz,
  widerrufen_am timestamptz,
  verbraucht_am timestamptz,
  staende_zurueckgezogen integer
);
CREATE INDEX IF NOT EXISTS partner_freigaben_client ON public.partner_freigaben (client_id, erteilt_am DESC);
-- hoechstens EINE aktive Fassung je Verbindung (zwei gleichzeitige Speichervorgaenge: der zweite scheitert mit 23505)
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_freigaben_aktiv ON public.partner_freigaben (client_id)
  WHERE ersetzt_am IS NULL AND widerrufen_am IS NULL AND verbraucht_am IS NULL;

ALTER TABLE public.partner_anfragen ADD COLUMN IF NOT EXISTS vorschlag jsonb;
ALTER TABLE public.reseller_invites ADD COLUMN IF NOT EXISTS vorschlag jsonb;

ALTER TABLE public.object_shares
  ADD COLUMN IF NOT EXISTS bereiche    jsonb,
  ADD COLUMN IF NOT EXISTS freigabe_id uuid REFERENCES public.partner_freigaben(id) ON DELETE SET NULL;
