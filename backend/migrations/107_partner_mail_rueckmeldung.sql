-- 107_partner_mail_rueckmeldung.sql  ·  v3460
--
-- E-MAIL AN DEN KUNDEN BEI RUECKMELDUNG (Marcel 16.11.2026: „E-Mail an den Kunden kann man im Portal-Cockpit
-- auswählen, wo man die Einstellungen für den Kunden macht.“)
--
--   reseller_clients.mail_rueckmeldung   gibt der Partner Anmerkungen mit „Zurück an Kunden“ zurück, bekommt der
--                                        Kunde eine E-Mail im Rahmen des Partners (services/partnerAnmerkungen.js).
--                                        Vorgabe AN: das Zurückgeben ist ein bewusster Schritt an genau diesen
--                                        Kunden, eine Mail je Rückgabe (nicht je Anmerkung) - ohne sie sieht der
--                                        Kunde die Rückmeldung erst, wenn er die App zufällig öffnet.
--                                        Gilt für beide Zugangsarten (platz und eigen): es ist eine Einstellung des
--                                        Partners über SEINE Nachrichten, kein Recht am Konto des Kunden.
--
-- Idempotent.

ALTER TABLE public.reseller_clients
    ADD COLUMN IF NOT EXISTS mail_rueckmeldung boolean NOT NULL DEFAULT true;
