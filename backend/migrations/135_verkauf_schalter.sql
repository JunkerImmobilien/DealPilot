-- 135_verkauf_schalter.sql · v5130 KK6 · Admin › Betrieb: „Deal-Check verkaufen“ und „Haus-Check verkaufen“
-- (Marcel 26.11.2026). Der Schalter steht in der Datenbank, die Umgebungsvariable (EINZELCHECK_AKTIV, HAUSCHECK_AKTIV)
-- bleibt die harte Obergrenze: steht sie auf aus, nützt der Admin-Schalter nichts (services/verkaufSchalter.js).
-- Ohne Zeile gilt „an“, damit sich am heutigen Verhalten nichts ändert, bis jemand schaltet.
CREATE TABLE IF NOT EXISTS public.verkauf_schalter (
  produkt        text PRIMARY KEY CHECK (produkt IN ('einzelcheck','hauscheck')),
  aktiv          boolean NOT NULL DEFAULT true,
  geaendert_am   timestamptz NOT NULL DEFAULT now(),
  geaendert_von  text
);
INSERT INTO public.verkauf_schalter (produkt, aktiv) VALUES ('einzelcheck', true), ('hauscheck', true) ON CONFLICT (produkt) DO NOTHING;

-- Bezahlte Käufe je Tag: die Kauf-Zeilen selbst löscht der Takt nach 14 Tagen, die Zählung für „heute“ und „im Monat“
-- bleibt hier. Nur Anzahl und Betrag, keine Angaben zum Käufer.
CREATE TABLE IF NOT EXISTS public.verkauf_tage (
  produkt   text NOT NULL CHECK (produkt IN ('einzelcheck','hauscheck')),
  tag       date NOT NULL,
  anzahl    integer NOT NULL DEFAULT 0,
  cent      bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (produkt, tag)
);
