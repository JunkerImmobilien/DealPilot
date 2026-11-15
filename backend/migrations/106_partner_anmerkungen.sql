-- 106_partner_anmerkungen.sql · v3450 — Anmerkungen des Partners an einem Kundenstand, Rueckmeldung an den Kunden
--
-- Marcel 15.11.2026: „Wenn ich mir als Partner ein freigegebenes Objekt anschaue und noch nicht uebernommen habe,
-- moechte ich vielleicht Anmerkungen machen und dem Kunden wieder zurueckschicken … wie bei unserem Mechaniker
-- etwas auswaehlen und markieren und dazu etwas schreiben. Der Kunde bekommt das dann passend.“
--
-- Kein zweiter Kanal: die Rueckmeldung ist eine Aufgabe (partner_aufgaben, art = 'rueckmeldung') mit Bezug auf den
-- Kundenstand (share_id), das ORIGINAL-Objekt des Kunden (objekt_id) und die Stand-Nummer. Die Anmerkungen haengen
-- an dieser Aufgabe. Solange sie nicht zurueckgegeben sind, sind sie Entwurf (aufgabe_id NULL) und nur beim Partner.
-- Der Feldbezug (sec, feld_id, selektor, feld_label, wert_damals) ist ein Hinweis fuer die Anzeige, kein Schluessel:
-- fehlt das Feld spaeter (neuer Stand, anderes Layout), bleibt die Anmerkung als freie stehen.

ALTER TABLE public.partner_aufgaben
    ADD COLUMN IF NOT EXISTS share_id  uuid REFERENCES public.object_shares(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS objekt_id uuid REFERENCES public.objects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS stand_nr  integer;

CREATE TABLE IF NOT EXISTS public.partner_anmerkungen (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id  uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    client_id    uuid NOT NULL REFERENCES public.reseller_clients(id) ON DELETE CASCADE,
    share_id     uuid NOT NULL REFERENCES public.object_shares(id) ON DELETE CASCADE,
    objekt_id    uuid REFERENCES public.objects(id) ON DELETE SET NULL,      -- Original des Kunden
    stand_nr     integer,
    aufgabe_id   uuid REFERENCES public.partner_aufgaben(id) ON DELETE SET NULL,
    nr           integer NOT NULL DEFAULT 1,
    art          text NOT NULL DEFAULT 'hinweis',                           -- hinweis | pruefen | nachreichen
    text         text NOT NULL,
    sec          text,                                                      -- Abschnitt (.sec id), z. B. s3
    reiter       text,                                                      -- Beschriftung des Reiters
    feld_id      text,                                                      -- id des Eingabefelds
    selektor     text,                                                      -- Ersatzweg ohne id
    feld_label   text,
    wert_damals  text,
    vorschlag    text,
    status       text NOT NULL DEFAULT 'entwurf',                           -- entwurf | offen | erledigt
    antwort      text,
    antwort_am   timestamptz,
    erledigt_am  timestamptz,
    erstellt_von uuid REFERENCES public.users(id) ON DELETE SET NULL,
    erstellt_am  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_anmerkungen_share   ON public.partner_anmerkungen (share_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_anmerkungen_aufgabe ON public.partner_anmerkungen (aufgabe_id);
