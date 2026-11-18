-- 119_partner_steuerprofile.sql  ·  v3700 (Paket P2 · Steuerprofil des Kunden beim Partner)
--
-- Konzept: Dateien/Mandantenkonzept/Anfordern-und-Freigeben-2026-11-18.md, P2.
-- Marcel 18.11.2026: Die Steuerdaten des Kunden gehen nur mit Freigabe (Bereich steuerdaten) mit. Der Partner
-- bekommt je Kunde ein EIGENES Steuerprofil, nie in seine tax_periods, Einstellungen oder Mandanten.
--
--   partner_steuerprofile   je Verbindung (client_id) beliebig viele FASSUNGEN. Jede Uebermittlung mit geaendertem
--                           Inhalt ist eine neue Fassung (fassung + 1), die vorige bekommt ersetzt_am. Gleicher Inhalt
--                           (inhalt_hash) legt keine neue Fassung an, zuletzt_am wird nachgezogen.
--                           profil: Steuerzeitraeume (alle Jahre), Veranlagung, Kirchensteuer, Gesellschaften
--                           (Mandanten mit Regime, Kosten, Verlustvortrag), Saldo-Grundlage der uebrigen Objekte,
--                           Ueberfuehrungen. freigabe_id: unter welcher Freigabe-Fassung es kam.
--   object_shares.steuerprofil_id   mit welcher Fassung ein Stand gesendet wurde.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.partner_steuerprofile (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.reseller_clients(id) ON DELETE CASCADE,
  reseller_id   uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  fassung       integer NOT NULL,
  profil        jsonb NOT NULL,
  inhalt_hash   text NOT NULL,
  freigabe_id   uuid REFERENCES public.partner_freigaben(id) ON DELETE SET NULL,
  freigabe_art  text,
  erzeugt_am    timestamptz,
  empfangen_am  timestamptz NOT NULL DEFAULT now(),
  zuletzt_am    timestamptz NOT NULL DEFAULT now(),
  ersetzt_am    timestamptz,
  UNIQUE (client_id, fassung)
);
CREATE INDEX IF NOT EXISTS partner_steuerprofile_client ON public.partner_steuerprofile (client_id, fassung DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_steuerprofile_aktiv ON public.partner_steuerprofile (client_id) WHERE ersetzt_am IS NULL;

ALTER TABLE public.object_shares
  ADD COLUMN IF NOT EXISTS steuerprofil_id uuid REFERENCES public.partner_steuerprofile(id) ON DELETE SET NULL;
