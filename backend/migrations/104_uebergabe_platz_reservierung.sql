-- 104_uebergabe_platz_reservierung.sql  ·  v3317b
--
-- KUNDENPLATZ MIT DER OBJEKT-UEBERGABE MITSCHICKEN (Marcel 12.11.2026: „Kann er vielleicht
-- direkt ein Häkchen setzen ‚Platz freigeben' und der wird gleich mitgeschickt?")
--
-- Ein Platz bleibt status = 'pool' (kein neuer ENUM-Wert - license_status wird an vielen
-- Stellen gelesen), traegt aber die Uebergabe, fuer die er reserviert ist. "Frei" ist ein
-- Platz nur, wenn er KEINE aktive Reservierung traegt; aktiv = Uebergabe gesendet/geoeffnet
-- und nicht abgelaufen. Widerruf raeumt das Feld, Ablauf wirkt ohne Takt (die Bedingung
-- sieht eine abgelaufene Reservierung als frei). Die Bedingung steht EINMAL in
-- resellerService.FREI_SQL.
--
-- Idempotent.

ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS reserviert_fuer uuid
    REFERENCES public.objekt_uebergaben(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_reserviert_fuer ON public.licenses (reserviert_fuer) WHERE reserviert_fuer IS NOT NULL;

ALTER TABLE public.objekt_uebergaben ADD COLUMN IF NOT EXISTS lizenz_id uuid
    REFERENCES public.licenses(id) ON DELETE SET NULL;
