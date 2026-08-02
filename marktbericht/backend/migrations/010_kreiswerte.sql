-- 010_kreiswerte.sql  (Paket v1045)
-- ─────────────────────────────────────────────────────────────────────
-- 52 von 71 geernteten NRW-Werten sind unerreichbar.
--
-- Die Gutachterausschuesse leiten ihre Zinssaetze teils fuer eine Gemeinde
-- ab, teils fuer den ganzen Kreis. Kreiswerte tragen in der amtlichen Datei
-- einen achtstelligen Schluessel, der auf drei Nullen endet: 05770000 =
-- Kreis Minden-Luebbecke. Wir haben sie als ags_ebene='gemeinde' abgelegt.
--
-- Folge: keine echte Adresse traegt je 05770000 — Huellhorst ist 05770016.
-- Die Kaskade sucht auf Gemeindeebene, findet nichts; sucht auf Kreisebene,
-- findet auch nichts, weil der Wert dort nicht liegt; und faellt auf
-- Paragraf 256. Drei Viertel der Ernte lag in der Datenbank und wurde nie
-- gelesen.
--
-- Belegt am 02.08.2026: 52 Kreiswerte, 19 Gemeindewerte. Fuer Huellhorst
-- liegt unter 05770000 ein Wert fuer Eigentumswohnungen von 2,2 Prozent aus
-- 65 Kauffaellen — gerechnet wurden 3,0 Prozent nach Paragraf 256.

BEGIN;

-- Der Eindeutigkeitsindex laeuft ueber
--   (ags, objektart, typ, qualitaet, gueltig_von, modellversion).
-- Nach dem Kuerzen koennte eine Zeile mit einer bestehenden kollidieren.
-- Deshalb nur umschreiben, wo keine Kollision entsteht — der Rest bleibt
-- sichtbar liegen, statt still zu verschwinden.
UPDATE mb.wert_parameter p
   SET ags = left(p.ags, 5),
       ags_ebene = 'kreis'
 WHERE length(p.ags) = 8
   AND right(p.ags, 3) = '000'
   AND NOT EXISTS (
     SELECT 1 FROM mb.wert_parameter q
      WHERE q.ags = left(p.ags, 5)
        AND q.objektart = p.objektart
        AND q.typ = p.typ
        AND q.qualitaet = p.qualitaet
        AND q.gueltig_von = p.gueltig_von
        AND q.modellversion = p.modellversion
   );

-- Was nach dem Lauf noch achtstellig auf 000 endet, ist eine Kollision und
-- gehoert angesehen. Die Abfrage steht hier als Notiz, nicht als Automatik:
--   select ags, objektart, typ, count(*) from mb.wert_parameter
--    where length(ags)=8 and right(ags,3)='000' group by 1,2,3;

COMMENT ON COLUMN mb.wert_parameter.ags_ebene IS
  'gemeinde (8-stellig) | kreis (5-stellig) | bezirk (3) | land (2) | bund (00000). '
  'Ein amtlicher Schluessel, der auf drei Nullen endet, ist ein KREIS in '
  'achtstelliger Schreibweise — nicht eine Gemeinde. Wer das verwechselt, legt '
  'den Wert unter einem Schluessel ab, den keine Adresse traegt.';

COMMIT;
