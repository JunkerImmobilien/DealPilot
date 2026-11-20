-- 123_einzelcheck.sql  ·  v3940 (Einzel-Check von der Landing, Marcel 20.11.2026)
--
-- Ein Besucher ohne Konto laedt bis zu vier Unterlagen hoch, liest zwei kostenlos aus und kauft fuer
-- 3,99 EUR (Stripe-Preis mit lookup_key dp_einzelcheck_399) den vollstaendigen Bericht.
--
-- WAS HIER LIEGT, UND WAS NIE:
--   · KEINE Datei, kein Dokumenttext, keine Anschrift, kein Name. Die Unterlagen werden nur im
--     Arbeitsspeicher gelesen (services/einzelcheck.js, pdftotext ueber stdin/stdout).
--   · zahlen: NUR ausgelesene Zahlen und wenige Merkmale (PLZ, Ort, Objektart, Effizienzklasse),
--     gefiltert durch einzelcheck.zahlenSauber() - jede andere Angabe wird verworfen.
--   · token_hash: SHA-256 des Kauf-Tokens. Das Token selbst kennt nur der Browser des Kaeufers.
--   · gueltig_bis: hoechstens 14 Tage nach dem Anlegen. Danach loescht der Takt 'einzelcheckLoeschen'
--     (utils/taktSperre.js) die Zeile ganz - wegen Anrechnung und Uebernahme gibt es sie, laenger nicht.
--     Die Rechnung liegt bei Stripe (invoice_creation), nicht hier.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.einzelcheck_kaeufe (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash            text NOT NULL UNIQUE,
  status                text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','bezahlt')),
  zahlen                jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_session_id     text UNIQUE,
  stripe_payment_intent text,
  amount_cents          integer,
  currency              text,
  anrechnung_code       text,
  anrechnung_promo_id   text,
  berichte              integer NOT NULL DEFAULT 0,
  erstellt_am           timestamptz NOT NULL DEFAULT now(),
  bezahlt_am            timestamptz,
  gueltig_bis           timestamptz NOT NULL,
  CONSTRAINT einzelcheck_frist_14 CHECK (gueltig_bis <= erstellt_am + interval '14 days')
);

CREATE INDEX IF NOT EXISTS einzelcheck_kaeufe_gueltig_idx ON public.einzelcheck_kaeufe (gueltig_bis);
