-- 026_harvest_quellen.sql — Harvest-Quellen nachgezogen (07.11.2026)
-- ─────────────────────────────────────────────────────────────────────
-- Gemessen auf Staging am 07.11.2026 (mb.gaa_sources, 122 Zeilen):
--   33 Quellen auf status='portal_defekt' — BB 17, MV 9, HB, HE, HH, SH, SL, SN, TH je 1.
--   BW und ST ohne einen einzigen letzter_check.
--
-- Was die 33 Zeilen wirklich hatten (Abruf je URL aus dem mb-Backend-Container
-- auf Staging, dieselbe Kennung wie der Harvest-Takt; Gegenprobe vom Arbeitsplatz):
--   26 antworten heute mit 200 (BB 17, MV 9 inkl. Landesebene, SN) — sie waren
--      nur EINMAL nicht erreichbar. portal_defekt war aber eine Einbahnstrasse:
--      discover() liest nur status='aktiv', eine einzige Zeitueberschreitung hat
--      die Quelle fuer immer aus dem Takt genommen. Und warum, stand nirgends —
--      der Fehler ging nur ins Log, und das Log ueberlebt keinen Neustart.
--    3 Adressen gibt es nicht mehr:
--      HH  hamburg.de/gutachterausschuss/          -> 404 (Auftritt umgezogen)
--      HE  www.gutachterausschuesse.hessen.de      -> Host existiert nicht (ENOTFOUND)
--      TH  www.gutachterausschuss.thueringen.de    -> Host existiert nicht (ENOTFOUND)
--    2 zeigten nur auf die Startseite des Landesportals:
--      SH  www.schleswig-holstein.de/   SL  www.saarland.de/
--    Von Staging aus abgewiesen, vom Arbeitsplatz aus 200 (Abwehr gegen
--    Rechenzentrums-Adressen, nicht die Adresse ist falsch):
--      HB  403   SH  ECONNRESET   SL  403   TH  403 (Link11-Captcha)
--    Diese vier stehen mit richtiger Adresse auf status='gesperrt' — Captcha und
--    Abwehr sind eine Ansage, keine Huerde (laender-registry.js). Gepflegt wird
--    dort von Hand; die Adresse ist der Weg fuer den Kunden und fuer die Nachernte.
--
-- Warum BW und ST nie geprueft wurden:
--   discover() nimmt nur zugang NOT IN ('kostenpflichtig','auf_anfrage') und
--   portal_url IS NOT NULL.
--   ST (Land): zugang='kostenpflichtig' aus 006 („ca. 30 EUR") — gemessen falsch:
--       lvermgeo.sachsen-anhalt.de stellt die Berichte „kostenfrei im PDF-Format"
--       bereit, Adresse war zudem landesrecht.sachsen-anhalt.de (Gesetzessammlung).
--   BW (Land): zugang='auf_anfrage' aus 006 („Massenabzug untersagt"). Das
--       betrifft die Wertdaten, nicht das Verzeichnis der Marktberichte; die
--       Discovery registriert nur Links. Wie BY in 007: je Ausschuss pruefen.
--   BW (Stuttgart) und die uebrigen automatisch erfassten Ausschuesse
--       (HarvestService.registriere… beim BRW-Abruf) haben gar keine portal_url.
--
-- Die Updates gehen ueber (name, bundesland), nicht ueber id — die ids sind
-- auf Staging und Produktion verschieden. Fehlt eine Zeile, trifft das UPDATE
-- nichts, und das ist richtig so.

BEGIN;

-- ── 1 · Fehler sichtbar machen statt nur loggen ─────────────────────────
ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS letzter_fehler  TEXT;
ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS fehler_seit     TIMESTAMPTZ;
ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS fehler_anzahl   INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN mb.gaa_sources.letzter_fehler IS
  'Fehlermeldung des letzten fehlgeschlagenen Abrufs (HTTP-Status, ENOTFOUND, Zeitueberschreitung). '
  'NULL nach einem erfolgreichen Abruf.';
COMMENT ON COLUMN mb.gaa_sources.fehler_anzahl IS
  'Fehlschlaege in Folge. portal_defekt erst ab 3; eine defekte Quelle wird nach 14 Tagen erneut versucht.';

-- ── 2 · Der letzte Lauf des Takts ueberlebt den Neustart ────────────────
CREATE TABLE IF NOT EXISTS mb.harvest_laeufe (
  id         BIGSERIAL   PRIMARY KEY,
  beginn     TIMESTAMPTZ NOT NULL,
  ende       TIMESTAMPTZ,
  geprueft   INTEGER,
  neu        INTEGER,
  fehler     INTEGER,
  abbruch    TEXT,
  fehlerliste TEXT[]
);
CREATE INDEX IF NOT EXISTS ix_harvest_laeufe_beginn ON mb.harvest_laeufe (beginn DESC);

-- ── 3 · Adressen ────────────────────────────────────────────────────────
-- HH: Auftritt liegt seit dem hamburg.de-Umbau unter dem LGV. Seite des
-- Immobilienmarktberichts (Staging: 200, 2 passende PDF-Links).
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.hamburg.de/politik-und-verwaltung/behoerden/behoerde-fuer-stadtentwicklung-und-wohnen/aemter-und-landesbetrieb/landesbetrieb-geoinformation-und-vermessung/produkte-und-dienstleistungen/infos-ueber-grundstuecke/gutachterausschuss-fuer-grundstueckswerte/immobilienmarktbericht-238656',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200; alte Adresse 404'
 WHERE bundesland = 'HH' AND ebene = 'land';

-- HE: gutachterausschuesse.hessen.de gibt es nicht mehr. Landesamt (HVBG),
-- Seite Immobilienwerte (Staging: 200); Berichte selbst im Downloadcenter gds.hessen.de.
UPDATE mb.gaa_sources
   SET portal_url = 'https://hvbg.hessen.de/immobilienwerte',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200; alter Host ENOTFOUND',
       notiz = 'Regionale Immobilienmarktberichte der 17 hessischen Ausschuesse im Downloadcenter: '
               'https://gds.hessen.de/INTERSHOP/web/WFS/HLBG-Geodaten-Site/de_DE/-/EUR/ViewDownloadcenter-Start?path=Immobilienwerte/Regionale%20Immobilienmarktberichte'
 WHERE bundesland = 'HE' AND ebene = 'land';

-- TH: gutachterausschuss.thueringen.de gibt es nicht mehr; Berichte beim TLBG.
-- Dort steht ein Link11-Captcha vor jedem automatischen Abruf -> gesperrt.
UPDATE mb.gaa_sources
   SET portal_url = 'https://tlbg.thueringen.de/wertermittlung/berichte-zum-grundstuecksmarkt',
       status = 'gesperrt',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'alter Host ENOTFOUND; neue Seite vom Arbeitsplatz 200, von Staging 403 (Link11-Captcha)',
       notiz = 'Captcha = Ansage, nicht Huerde: kein automatischer Abruf. Register wird von Hand geerntet '
               '(TH 136 Werte am 07.11.2026).'
 WHERE bundesland = 'TH' AND ebene = 'land';

-- SH: zeigte auf die Startseite des Landesportals. Seite Immobilienmarktberichte
-- der Zentralen Geschaeftsstelle. Von Staging aus ECONNRESET (Abwehr) -> gesperrt.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.schleswig-holstein.de/gaa/DE/_documents/gaStartImmomarktber',
       status = 'gesperrt',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'vom Arbeitsplatz 200, vom Staging-Server ECONNRESET (07.11.2026)',
       notiz = 'Kreisberichte unter https://www.schleswig-holstein.de/gaa/DE/gaPdf/pdf_<Kreis>/ . '
               'Das Landesportal weist den Server ab — von Hand ernten, Status nicht auf aktiv stellen, '
               'solange der Abruf von Staging nicht 200 ergibt.'
 WHERE bundesland = 'SH' AND ebene = 'land';

-- SL: zeigte auf die Startseite saarland.de. Zentrale Geschaeftsstelle beim LVGL.
-- Von Staging aus 403 -> gesperrt.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.saarland.de/lvgl/DE/themen-aufgaben/themen/zgga/zgga_node.html',
       status = 'gesperrt',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'vom Arbeitsplatz 200, vom Staging-Server 403 (07.11.2026)',
       notiz = 'Grundstuecksmarktbericht Saarland als PDF unter saarland.de/lvgl/DE/service/publikationen/. '
               'saarland.de weist den Server ab — von Hand ernten.'
 WHERE bundesland = 'SL' AND ebene = 'land';

-- HB: Startseite gutachterausschuss.bremen.de ist richtig, die Marktbericht-Seite
-- traegt das PDF. Von Staging aus 403 -> gesperrt.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.gutachterausschuss.bremen.de/marktbericht-1469',
       status = 'gesperrt',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'vom Arbeitsplatz 200 (1 Marktbericht-PDF), vom Staging-Server 403 (07.11.2026)',
       notiz = 'bremen.de weist den Server ab — von Hand ernten.'
 WHERE bundesland = 'HB' AND ebene = 'land';

-- BB (Land): alte Startseite leitet auf /gaa/de/ um. Verteiler der Kreisberichte.
-- Der Server antwortet dem Staging-Server wechselnd (200 / Verbindungs-Zeitueberschreitung)
-- -> aktiv lassen; die neue Fehlerzaehlung haelt das aus.
UPDATE mb.gaa_sources
   SET portal_url = 'https://gutachterausschuss.brandenburg.de/gaa/de/marktinformationen/grundstuecksmarktberichte/',
       geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'vom Arbeitsplatz 200 (34 PDF-Links); von Staging wechselnd 200 / Zeitueberschreitung'
 WHERE bundesland = 'BB' AND ebene = 'land';

-- MV (Land): zeigte direkt auf LGMB_2025_Web.pdf — eine feste Datei findet den
-- naechsten Jahrgang nie. Verteilerseite (Staging: 200, 13 PDF-Links).
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.laiv-mv.de/Geoinformation/Wertermittlung/Grundstuecksmarktberichte/',
       geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200'
 WHERE bundesland = 'MV' AND ebene = 'land';

-- ST (Land): Adresse war die Gesetzessammlung, zugang 'kostenpflichtig' ist
-- gemessen falsch („kostenfrei im PDF-Format bereitgestellt").
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.lvermgeo.sachsen-anhalt.de/de/gdp-grundstuecksmarktbericht.html',
       zugang = 'frei', preis_eur = NULL,
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200, 11 PDF-Links (GMB 2009-2023)',
       notiz = 'Berichte bis 2023 als PDF kostenfrei. Ab 2025 „Grundstuecksmarktinformationen" als Story-Map '
               '(geodatenportal.sachsen-anhalt.de) mit eigenen Seiten fuer LZS, Sachwert- und Gebaeudefaktoren — '
               'die findet die Discovery nicht, Nachernte von Hand.'
 WHERE bundesland = 'ST' AND ebene = 'land';

-- BW (Land): Verzeichnis der Marktberichte der ZGG statt Startseite; Zugang je
-- Ausschuss pruefen statt pauschal sperren (wie BY in 007).
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.zgg-bw.de/Marktberichte/index.html',
       zugang = 'unbekannt',
       geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200',
       notiz = 'Verzeichnis der Gutachterausschuesse mit Links auf die oertlichen Berichte (fremde Hosts — '
               'die Discovery folgt ihnen nicht). Oertliche Fachinformationen liegen unter '
               'https://www.gutachterausschuesse-bw.de/borisfachdaten/lgd/<Jahr>/ (Register: BW 437 Werte am 07.11.2026). '
               'Massenabzug der Wertdaten bleibt untersagt; die Discovery registriert nur Links.'
 WHERE bundesland = 'BW' AND ebene = 'land';

-- Automatisch erfasste Ausschuesse ohne portal_url, Adresse belegt (Staging: 200).
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.stuttgart.de/leben/bauen/grundstueckswerte/Marktberichte-und-Dashboard',
       zugang = 'frei', pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200, 5 passende PDF-Links'
 WHERE bundesland = 'BW' AND portal_url IS NULL AND name ILIKE '%Stuttgart%';

UPDATE mb.gaa_sources
   SET portal_url = 'https://www.wiesbaden.de/vv/produkte/66/wissenswertes',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200, Immobilienmarktbericht-PDFs'
 WHERE bundesland = 'HE' AND portal_url IS NULL AND name ILIKE '%Wiesbaden%';

UPDATE mb.gaa_sources
   SET portal_url = 'https://www.dresden.de/de/leben/stadtportrait/statistik/geoinformationen/Gutachterausschuss.php',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-11-07',
       geprueft_quelle = 'Abruf vom mb-Backend auf Staging 07.11.2026: 200'
 WHERE bundesland = 'SN' AND portal_url IS NULL AND name ILIKE '%Dresden%';

-- ── 4 · Die uebrigen defekten Quellen zurueck in den Takt ───────────────
-- BB-Kreise (16), MV-Kreise (8), SN-Land: heute 200. Die Ursache des einen
-- Fehlschlags ist nicht mehr feststellbar (nicht gespeichert) — das sagt die Zeile.
UPDATE mb.gaa_sources
   SET status = 'aktiv',
       letzter_fehler = 'vor 026 als portal_defekt markiert, Ursache nicht gespeichert (Adresse am 07.11.2026 nachgemessen)',
       fehler_anzahl = 0
 WHERE status = 'portal_defekt';

COMMIT;
