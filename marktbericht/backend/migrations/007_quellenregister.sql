-- 007_quellenregister.sql  (Paket v1041)
-- ─────────────────────────────────────────────────────────────────────
-- Das Quellenverzeichnis aus 006 kennt Zugangsart und Portal, aber weder
-- Preis noch Bestellweg. Damit ist "kostenpflichtig" eine Notiz zum Lesen
-- statt einer Kaufliste zum Abarbeiten.
--
-- Und es fehlt die wichtigste Spalte ueberhaupt: ob eine Zeile belegt oder
-- vermutet ist. Ein Verzeichnis mit 390 Eintraegen, in dem man nicht sieht,
-- welche Adresse jemand hat antworten sehen, ist schlimmer als eines mit 17
-- geprueften — weil es Sicherheit vortaeuscht, wo keine ist.

BEGIN;

ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS preis_eur       NUMERIC(8,2);
ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS bestell_url     TEXT;
ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS pruefstand      TEXT NOT NULL DEFAULT 'offen';
ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS geprueft_am     DATE;
ALTER TABLE mb.gaa_sources ADD COLUMN IF NOT EXISTS geprueft_quelle TEXT;

COMMENT ON COLUMN mb.gaa_sources.pruefstand IS
  'geprueft = Adresse hat geantwortet, Zugangsart und Preis am Portal abgelesen. '
  'gemeldet = aus einem amtlichen Verzeichnis uebernommen, Portal noch nicht selbst aufgerufen. '
  'offen = Geruest, nichts belegt. Nur "geprueft" darf als Tatsache angezeigt werden.';

COMMENT ON COLUMN mb.gaa_sources.preis_eur IS
  'Schutzgebuehr des Berichts. NULL heisst nicht kostenlos, sondern unbekannt — '
  'der Unterschied entscheidet, ob die Zeile in die Kaufliste gehoert.';

CREATE INDEX IF NOT EXISTS ix_gaa_sources_kauf
  ON mb.gaa_sources (zugang, bundesland) WHERE zugang IN ('kostenpflichtig','auf_anfrage');

-- ═══════════════════════════════════════════════════════════════════════
-- Die 17 Bestandszeilen aus 006 bekommen ihren Pruefstand. Sie stammen aus
-- der Recherche von damals, ohne Portalabruf -> 'gemeldet', nicht 'geprueft'.
-- ═══════════════════════════════════════════════════════════════════════
UPDATE mb.gaa_sources SET pruefstand = 'gemeldet'
 WHERE pruefstand = 'offen' AND created_at < now();

-- ═══════════════════════════════════════════════════════════════════════
-- Korrekturen. Vier Adressen aus 006 zeigen ins Leere, zwei Einschaetzungen
-- sind zu pauschal. Belegt am 02.08.2026 durch Abruf der jeweiligen Seite.
-- ═══════════════════════════════════════════════════════════════════════

-- Brandenburg: Die Kostenfreiheit ist dort nicht Kulanz, sondern steht in der
-- Brandenburgischen Gutachterausschuss-Gebuehrenordnung. Die Kreisberichte
-- liegen unter einem stabilen Muster GMB_<Kfz-Kennzeichen>.pdf.
UPDATE mb.gaa_sources
   SET portal_url = 'https://gutachterausschuss.brandenburg.de/',
       lizenz     = 'kostenfrei nach BbgGAGebO',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-08-02',
       geprueft_quelle = 'gutachterausschuss.brandenburg.de + geobasis-bb.de, abgerufen 02.08.2026',
       notiz = 'Kreisberichte als PDF unter stabilem Muster GMB_<Kennzeichen>.pdf. '
               'Bodenrichtwerte zusaetzlich als CSV/XML im Geobroker (EPSG 25833).'
 WHERE bundesland = 'BB' AND ebene = 'land';

-- Mecklenburg-Vorpommern: digitale Berichte kostenfrei, aber je Landkreis
-- ueber einen eigenen Geoshop. Nur der Druck kostet.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.laiv-mv.de/Geoinformation/Wertermittlung/Grundstuecksmarktberichte/',
       zugang     = 'frei',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-08-02',
       geprueft_quelle = 'laiv-mv.de, abgerufen 02.08.2026',
       notiz = 'Digitale Fassung kostenfrei, Download je Landkreis ueber dessen Geoshop. '
               'Druckausgabe 30 EUR — das ist KEIN Grund fuer zugang=kostenpflichtig.'
 WHERE bundesland = 'MV' AND ebene = 'land';

-- Niedersachsen: zwei Dinge, die den Ertragswert betreffen.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.gag.niedersachsen.de/startseite/grundstucksmarktberichte/',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-08-02',
       geprueft_quelle = 'gag.niedersachsen.de, abgerufen 02.08.2026',
       notiz = 'Liegenschaftszinssaetze liegen als Tableau-Public-Einbettung vor, '
               'Muster <Jahr>_lizi_<Objektart>_nds — maschinenlesbarer Weg noch zu pruefen. '
               'ACHTUNG: Umstellung der Modelle auf 80 Jahre Gesamtnutzungsdauer bei '
               'Wohnimmobilien seit 02.03.2026. Beim Import als Modellparameter mitfuehren, '
               'sonst mischen sich zwei Restnutzungsdauer-Welten.'
 WHERE bundesland = 'NI' AND ebene = 'land';

-- Berlin: die Falle mit den zwei Zinssatz-Saetzen.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.berlin.de/gutachterausschuss/marktinformationen/daten-zur-wertermittlung/',
       pruefstand = 'geprueft', geprueft_am = DATE '2026-08-02',
       geprueft_quelle = 'berlin.de/gutachterausschuss, abgerufen 02.08.2026',
       notiz = 'Berlin veroeffentlicht ALLGEMEINE und STEUERLICHE Liegenschaftszinssaetze '
               'nebeneinander. Nur die allgemeinen verwenden — die steuerlichen hat das '
               'FG Berlin-Brandenburg als nicht gesetzeskonform verworfen. Beide sehen '
               'plausibel aus, die Verwechslung faellt nicht auf.'
 WHERE bundesland = 'BE' AND ebene = 'land';

-- Baden-Wuerttemberg: nicht "kein offener Dienst" — es gibt ein amtliches
-- Verzeichnis der Gutachterausschuesse nach § 15 Abs. 3 GuAVO.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.zgg-bw.de/',
       notiz = 'Zentrale Geschaeftsstelle fuehrt ein amtliches Verzeichnis der '
               'Gutachterausschuesse nach § 15 Abs. 3 GuAVO (Stand 01.01.2026). '
               'Fuer den Kreisbestand auswerten. Massenabzug der Wertdaten bleibt untersagt.'
 WHERE bundesland = 'BW' AND ebene = 'land';

-- Bayern: kostenpflichtig ist die Bodenrichtwertauskunft, nicht das Verzeichnis.
UPDATE mb.gaa_sources
   SET portal_url = 'https://www.gutachterausschuesse-bayern.de/',
       zugang = 'unbekannt',
       notiz = 'Oberer Gutachterausschuss fuehrt die 96 bayerischen Ausschuesse zentral. '
               'Gebuehrenpflichtig ist die Bodenrichtwertauskunft — je Ausschuss einzeln '
               'pruefen statt pauschal zu sperren.'
 WHERE bundesland = 'BY' AND ebene = 'land';

-- Meissen: der belegte Kaufposten bekommt Preis und Bestellweg.
UPDATE mb.gaa_sources
   SET preis_eur = 20.00,
       bestell_url = portal_url,
       pruefstand = 'gemeldet'
 WHERE bundesland = 'SN' AND ebene = 'kreis' AND zugang = 'kostenpflichtig'
   AND preis_eur IS NULL;

COMMIT;
