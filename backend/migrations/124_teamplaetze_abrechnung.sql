-- 124_teamplaetze_abrechnung.sql  ·  v3947 (Teamplaetze mit Preis, Marcel 22.11.2026)
--
-- Bis v3946 waren Teamplaetze kostenlos, hoechstens resellers.team_plaetze (Vorgabe 5) je Partnerkonto.
-- Ab v3947 kostet jeder weitere Login nach Staffel (2. bis 4. Login 59 EUR, 5. bis 9. 49 EUR, ab dem 10. 39 EUR
-- im Monat, im Jahr 649 / 539 / 429 EUR). Quelle der Betraege: frontend/js/teamplatz-staffel.js, abgerechnet als
-- Stripe-Position mit lookup_key dp_teamplatz_monat / dp_teamplatz_jahr (tiers_mode graduated) im Partner-Plan-Abo.
--
-- Der Rahmen eines Partnerkontos ist jetzt ZWEITEILIG:
--   team_plaetze          kostenlose Plaetze: Bestand vor v3947 oder von Hand im Admin gesetzt (nicht berechnet)
--   team_plaetze_bezahlt  Menge der Stripe-Position, gesetzt NUR vom Abgleich (Webhook, Cockpit, Checkout-Rueckweg)
--   Rahmen = beide zusammen. Die feste Grenze 5 entfaellt.
--
-- Altbestand: NICHT automatisch berechnen (Marcel 22.11.2026). Bestehende Partnerkonten behalten ihren Wert in
-- team_plaetze als kostenlosen Bestand, jeder Berater, der heute schon im Team ist, wird als Bestand markiert
-- (reseller_members.team_bestand). Die Uebergangsregel (wie lange, ob unbelegte Bestandsplaetze bleiben) ist offen.
-- Neue Partnerkonten beginnen mit 0 kostenlosen Plaetzen.

ALTER TABLE public.resellers
    ADD COLUMN IF NOT EXISTS team_plaetze_bezahlt integer NOT NULL DEFAULT 0;   -- Menge der Stripe-Position dp_teamplatz_*
ALTER TABLE public.resellers
    ALTER COLUMN team_plaetze SET DEFAULT 0;                                      -- neue Konten: kein kostenloser Teamplatz

ALTER TABLE public.reseller_members
    ADD COLUMN IF NOT EXISTS team_bestand boolean NOT NULL DEFAULT false;        -- Berater aus der Zeit vor v3947 (kostenlos)
UPDATE public.reseller_members SET team_bestand = true WHERE role = 'berater' AND team_bestand = false;

COMMENT ON COLUMN public.resellers.team_plaetze IS 'v3947: kostenlose Teamplaetze (Bestand vor v3947 oder Admin), nicht berechnet';
COMMENT ON COLUMN public.resellers.team_plaetze_bezahlt IS 'v3947: bezahlte Teamplaetze = Menge der Stripe-Position dp_teamplatz_*';
COMMENT ON COLUMN public.reseller_members.team_bestand IS 'v3947: Berater war vor der Abrechnung der Teamplaetze im Team (Bestand)';
