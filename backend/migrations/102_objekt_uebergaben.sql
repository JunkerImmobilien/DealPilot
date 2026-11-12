-- 102_objekt_uebergaben.sql  ·  v3317
--
-- OBJEKT AN KUNDEN UEBERGEBEN (Partner -> Kunde per E-Mail), Marcel 12.11.2026.
-- Bisher gab es nur die Gegenrichtung (object_shares: Kunde reicht beim Partner ein).
--
--   token_hash        SHA-256 des Zufallstokens aus dem Link. Das Token selbst steht NIRGENDS.
--   bild_schluessel   eigener Zufallswert fuer das Titelfoto der Mail (Mailprogramme laden
--                     Bilder ueber Proxys - dort soll nicht das Token des Links stehen)
--   zusammenfassung   was die Mail zeigte (Adresse, Score, Stufe, Cashflow, Rendite, DSCR,
--                     Wertangabe) - gespeicherte Werte des Objekts beim Versand
--   status            gesendet -> geoeffnet (Link aufgerufen) -> uebernommen; widerrufen.
--                     "abgelaufen" ist kein Zustand, sondern expires_at <= now().
--   object_id         das ORIGINAL beim Partner (bleibt dort); kopie_object_id die Kopie beim Kunden
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.objekt_uebergaben (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    absender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    object_id uuid REFERENCES public.objects(id) ON DELETE SET NULL,
    email text NOT NULL,
    anzeige_name text,
    nachricht text,
    token_hash text NOT NULL UNIQUE,
    bild_schluessel text UNIQUE,
    zusammenfassung jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'gesendet'
        CHECK (status IN ('gesendet', 'geoeffnet', 'uebernommen', 'widerrufen')),
    mail_status text,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
    geoeffnet_at timestamptz,
    uebernommen_at timestamptz,
    widerrufen_at timestamptz,
    empfaenger_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    client_id uuid REFERENCES public.reseller_clients(id) ON DELETE SET NULL,
    kopie_object_id uuid REFERENCES public.objects(id) ON DELETE SET NULL,
    seat_assigned boolean
);
CREATE INDEX IF NOT EXISTS idx_objekt_uebergaben_reseller ON public.objekt_uebergaben (reseller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objekt_uebergaben_object   ON public.objekt_uebergaben (object_id);
