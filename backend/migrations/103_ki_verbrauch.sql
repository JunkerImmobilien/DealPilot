-- 103_ki_verbrauch.sql  ·  v3318
--
-- KI-VERBRAUCH JE AUFRUF UND MONATSDECKEL IN EURO (Marcel 12.11.2026: „die abrufe begrenzen,
-- dass wir nicht auf die hohen maximalen KI-Kosten kommen koennen ... max 3-4 euro pro monat").
--
-- ki_verbrauch      eine Zeile je OpenAI-Aufruf (Haupt-Backend und, ueber die Antwort des
--                   mb-Dienstes, der KI-Marktbericht). Geschrieben von services/kiVerbrauch.js,
--                   nie von Hand. eur = usd * kurs zum Zeitpunkt des Aufrufs.
--   endpunkt        Route bzw. Weg (ai/analyze, ai/copilot, telegram, marktbericht/...)
--   funktion        Aufrufstelle im Code (callOpenAI, vision, agent, transkription ...)
--   gruppe          analyse | recherche | dokument | null - fuer die Monatsgrenzen je Funktion
--   vorgang         eine Anfrage = ein Vorgang (mehrere Aufrufe moeglich, z. B. Agent-Runden)
--   im_deckel       false fuer Marktbericht (Kontingent) und Support-Einstufung
--   eigener_schluessel  der Nutzer zahlt selbst (eigener OpenAI-Key) -> nie im Deckel
--   bepreist        false = Modell ohne hinterlegten Preis, zum teuersten Satz gerechnet
--   abgeschnitten   Antwort an der Ausgabegrenze abgebrochen (status incomplete)
--
-- ki_tageszaehler   Co-Pilot-Tageslimit (Fragen + gesprochene Sekunden) je Berliner Kalendertag.
--                   Ersetzt den Arbeitsspeicher-Zaehler _cpDaily (fiel bei jedem Deploy auf 0).
--                   copilot_usage (033, v596) bleibt liegen - sie war nie in Gebrauch.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.ki_verbrauch (
    id                 bigserial PRIMARY KEY,
    ts                 timestamptz NOT NULL DEFAULT now(),
    user_id            uuid REFERENCES public.users(id) ON DELETE SET NULL,
    endpunkt           text,
    funktion           text,
    gruppe             text,
    vorgang            uuid,
    modell             text,
    ein                integer NOT NULL DEFAULT 0,
    ein_cached         integer NOT NULL DEFAULT 0,
    ein_audio          integer NOT NULL DEFAULT 0,
    aus                integer NOT NULL DEFAULT 0,
    denk               integer NOT NULL DEFAULT 0,
    websuchen          integer NOT NULL DEFAULT 0,
    audio_sek          numeric(10,2) NOT NULL DEFAULT 0,
    usd                numeric(14,6) NOT NULL DEFAULT 0,
    eur                numeric(14,6) NOT NULL DEFAULT 0,
    kurs               numeric(8,4),
    bepreist           boolean NOT NULL DEFAULT true,
    im_deckel          boolean NOT NULL DEFAULT true,
    eigener_schluessel boolean NOT NULL DEFAULT false,
    abgeschnitten      boolean NOT NULL DEFAULT false,
    quelle             text NOT NULL DEFAULT 'haupt',
    meta               jsonb
);

CREATE INDEX IF NOT EXISTS ki_verbrauch_user_ts ON public.ki_verbrauch (user_id, ts);
CREATE INDEX IF NOT EXISTS ki_verbrauch_ts ON public.ki_verbrauch (ts);

CREATE TABLE IF NOT EXISTS public.ki_tageszaehler (
    user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tag        date NOT NULL,
    copilot    integer NOT NULL DEFAULT 0,
    sprache_s  integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tag)
);
