-- 012_modellversion_kennzahlen.sql  (ERSETZT die fehlgeschlagene Fassung aus v1049)
-- ─────────────────────────────────────────────────────────────────────
-- Die erste Fassung lief in den Eindeutigkeitsindex und liess den Container
-- in einer Neustartschleife haengen.
--
-- DER MECHANISMUS
-- Migration 011 hatte keinen typ-Filter und hat deshalb bereits ALLE
-- NRW-Zeilen umgeschrieben — auch Bewirtschaftungskostenquote, Rest- und
-- Gesamtnutzungsdauer und Marktmiete. Danach lief die Ernte, und die zweite
-- Einfuegung im Konnektor schrieb ihre Zeilen erneut unter 'immowertv2021'
-- ein (den Vermerk hat erst v1049 dort korrigiert).
--
-- Damit gibt es zu vielen Kennungen ein Zwillingspaar: gleiche Gemeinde,
-- gleiche Objektart, gleicher Typ, gleicher Stichtag — einmal mit jedem
-- Modellvermerk. Der Index laeuft ueber
--   (ags, objektart, typ, qualitaet, gueltig_von, modellversion),
-- also darf der zweite nicht auf den ersten umgeschrieben werden.
--
-- DIE LEHRE
-- Migration 010 hatte fuer genau diesen Fall eine NOT-EXISTS-Absicherung.
-- In 011 und 012 habe ich sie weggelassen. Ein Muster, das einmal noetig
-- war, ist beim naechsten Mal wieder noetig.

BEGIN;

-- 1) Echte Zwillinge entfernen: gleiche Kennung UND gleicher Wert, nur
--    unterschiedlicher Modellvermerk. Das ist dieselbe Zahl aus derselben
--    Quelle, zweimal eingelesen. Die Fassung mit dem richtigen Vermerk
--    bleibt, die andere geht.
DELETE FROM mb.wert_parameter a
 WHERE a.modellversion = 'immowertv2021'
   AND a.qualitaet IN ('A','B')
   AND left(a.ags, 2) = '05'
   AND EXISTS (
     SELECT 1 FROM mb.wert_parameter b
      WHERE b.modellversion = 'agvga_nrw_2016'
        AND b.ags        = a.ags
        AND b.objektart  = a.objektart
        AND b.typ        = a.typ
        AND b.qualitaet  = a.qualitaet
        AND b.gueltig_von IS NOT DISTINCT FROM a.gueltig_von
        AND b.wert IS NOT DISTINCT FROM a.wert
   );

-- 2) Was danach noch auf dem alten Vermerk steht, wird umgeschrieben —
--    aber nur, wo keine Kollision entsteht. Bleibt etwas liegen, ist es ein
--    Zwilling mit ABWEICHENDEM Wert; der gehoert angesehen und nicht still
--    geloescht.
UPDATE mb.wert_parameter p
   SET modellversion = 'agvga_nrw_2016'
 WHERE p.modellversion = 'immowertv2021'
   AND p.qualitaet IN ('A','B')
   AND left(p.ags, 2) = '05'
   AND NOT EXISTS (
     SELECT 1 FROM mb.wert_parameter q
      WHERE q.modellversion = 'agvga_nrw_2016'
        AND q.ags        = p.ags
        AND q.objektart  = p.objektart
        AND q.typ        = p.typ
        AND q.qualitaet  = p.qualitaet
        AND q.gueltig_von IS NOT DISTINCT FROM p.gueltig_von
   );

-- Was jetzt noch uebrig ist, zeigt diese Abfrage. Sie steht als Notiz hier,
-- nicht als Automatik:
--   select ags, objektart, typ, wert, gueltig_von from mb.wert_parameter
--    where modellversion='immowertv2021' and left(ags,2)='05'
--      and qualitaet in ('A','B') order by ags, typ;

COMMIT;
