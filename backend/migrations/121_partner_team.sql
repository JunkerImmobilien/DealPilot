-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 121
-- v3830: Team in der Kanzlei, Kunde entfernen, Loeschfristen, Objekt-Zuordnung
--
-- Marcel 19.11.2026:
--   A  mehrere Logins je Partnerkonto (reseller_members, Rolle owner | berater). Der Inhaber laedt per
--      E-Mail ein (partner_team_einladungen). Mitgliedsplaetze vorerst OHNE Abrechnung, begrenzt durch
--      resellers.team_plaetze (Vorgabe 5, Admin aenderbar). Der Preis ist noch nicht entschieden.
--      Jeder Kunde gehoert einem Berater (reseller_clients.berater_id, seit 105 vorhanden, bisher leer):
--      Altbestand -> der Inhaber.
--   C  erledigte Aufgaben werden nach einer Frist geloescht: dafuer der Zeitpunkt des Abschlusses.
--   E  Kunde entfernen: bei einem Kunden auf einem Partnerplatz laeuft die Entzugsfrist (AVV § 12), die
--      Verbindung bleibt so lange als Rumpf stehen, fuer den Partner unsichtbar (entfernt_am).
--   F  Objekte des Partners einem Kunden zuordnen, auch ohne Uebergabe (partner_objekt_kunden), und beim
--      Einladen gleich vormerken (objekt_ids an Einladung und Anfrage).
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.resellers
    ADD COLUMN IF NOT EXISTS team_plaetze integer NOT NULL DEFAULT 5;   -- Mitgliedsplaetze ohne Inhaber, vorerst ohne Abrechnung

CREATE TABLE IF NOT EXISTS public.partner_team_einladungen (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id    uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    email          text NOT NULL,
    name           text,
    user_id        uuid REFERENCES public.users(id) ON DELETE CASCADE,   -- bestehendes Konto (sonst beim Annehmen gesetzt)
    token_hash     text NOT NULL UNIQUE,                                  -- nur SHA-256, der Klartext steht nur in der Mail
    status         text NOT NULL DEFAULT 'offen',                         -- offen | angenommen | abgelehnt | zurueckgezogen
    erstellt_von   uuid REFERENCES public.users(id) ON DELETE SET NULL,
    erstellt_am    timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz NOT NULL DEFAULT now() + interval '30 days',
    beantwortet_am timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_team_einladung_offen ON public.partner_team_einladungen (reseller_id, lower(email)) WHERE status = 'offen';
CREATE INDEX IF NOT EXISTS idx_partner_team_einladung_user ON public.partner_team_einladungen (user_id) WHERE status = 'offen';

UPDATE public.reseller_clients c SET berater_id = r.owner_user_id
  FROM public.resellers r WHERE r.id = c.reseller_id AND c.berater_id IS NULL AND r.owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reseller_clients_berater ON public.reseller_clients (reseller_id, berater_id);

ALTER TABLE public.reseller_clients
    ADD COLUMN IF NOT EXISTS entfernt_am timestamptz;   -- v3830 E: vom Partner entfernt, Rumpf nur fuer die Entzugsfrist

ALTER TABLE public.partner_aufgaben
    ADD COLUMN IF NOT EXISTS abgeschlossen_am timestamptz;
UPDATE public.partner_aufgaben SET abgeschlossen_am = now() WHERE status = 'abgeschlossen' AND abgeschlossen_am IS NULL;   -- Frist beginnt fuer den Altbestand heute

CREATE INDEX IF NOT EXISTS idx_partner_meldungen_gelesen ON public.partner_meldungen (gelesen_am) WHERE gelesen_am IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.partner_objekt_kunden (
    object_id      uuid PRIMARY KEY REFERENCES public.objects(id) ON DELETE CASCADE,   -- ein Objekt, hoechstens ein Kunde
    reseller_id    uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
    client_id      uuid NOT NULL REFERENCES public.reseller_clients(id) ON DELETE CASCADE,
    zugeordnet_von uuid REFERENCES public.users(id) ON DELETE SET NULL,
    zugeordnet_am  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_objekt_kunden_client ON public.partner_objekt_kunden (client_id);

ALTER TABLE public.reseller_invites  ADD COLUMN IF NOT EXISTS objekt_ids jsonb;   -- beim Einladen vorgemerkte Objekte (F)
ALTER TABLE public.partner_anfragen  ADD COLUMN IF NOT EXISTS objekt_ids jsonb;
