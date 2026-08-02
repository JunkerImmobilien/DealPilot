-- 008_ags_namen.sql  (Paket v1042)
-- ─────────────────────────────────────────────────────────────────────
-- Bisher steht im Admin "05111000" statt "Düsseldorf". Die Nummer ist der
-- richtige Schlüssel für die Rechnung, aber sie taugt nicht zum Lesen — und
-- ein Verzeichnis, das man nicht lesen kann, prüft niemand nach.
--
-- Die Namen werden NICHT geraten. Sie kommen aus derselben amtlichen Datei,
-- aus der auch die Werte stammen (schluessel.csv im NRW-Open-Data-Paket),
-- und für die übrigen Länder über den CSV-Weg. Was nicht bekannt ist, bleibt
-- eine Nummer — das ist ehrlicher als ein hübscher Platzhalter.

BEGIN;

CREATE TABLE IF NOT EXISTS mb.ags_namen (
  ags        TEXT PRIMARY KEY,            -- 5-stellig Kreis, 8-stellig Gemeinde
  name       TEXT        NOT NULL,
  ebene      TEXT        NOT NULL DEFAULT 'kreis',   -- gemeinde | kreis | land
  bundesland TEXT,
  quelle     TEXT,                        -- woher der Name stammt
  stand      DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ags_namen_ebene ON mb.ags_namen (ebene);

COMMENT ON TABLE mb.ags_namen IS
  'Klartextnamen zu Gemeinde- und Kreisschluesseln. Reine Anzeigehilfe — '
  'kein Rechenweg haengt daran. Fehlt ein Name, wird die Nummer angezeigt.';

-- Die 16 Laender als Grundstock: zweistellig, immer bekannt, nie strittig.
INSERT INTO mb.ags_namen (ags, name, ebene, bundesland, quelle) VALUES
  ('01','Schleswig-Holstein','land','SH','Amtlicher Gemeindeschluessel'),
  ('02','Hamburg','land','HH','Amtlicher Gemeindeschluessel'),
  ('03','Niedersachsen','land','NI','Amtlicher Gemeindeschluessel'),
  ('04','Bremen','land','HB','Amtlicher Gemeindeschluessel'),
  ('05','Nordrhein-Westfalen','land','NW','Amtlicher Gemeindeschluessel'),
  ('06','Hessen','land','HE','Amtlicher Gemeindeschluessel'),
  ('07','Rheinland-Pfalz','land','RP','Amtlicher Gemeindeschluessel'),
  ('08','Baden-Wuerttemberg','land','BW','Amtlicher Gemeindeschluessel'),
  ('09','Bayern','land','BY','Amtlicher Gemeindeschluessel'),
  ('10','Saarland','land','SL','Amtlicher Gemeindeschluessel'),
  ('11','Berlin','land','BE','Amtlicher Gemeindeschluessel'),
  ('12','Brandenburg','land','BB','Amtlicher Gemeindeschluessel'),
  ('13','Mecklenburg-Vorpommern','land','MV','Amtlicher Gemeindeschluessel'),
  ('14','Sachsen','land','SN','Amtlicher Gemeindeschluessel'),
  ('15','Sachsen-Anhalt','land','ST','Amtlicher Gemeindeschluessel'),
  ('16','Thueringen','land','TH','Amtlicher Gemeindeschluessel')
ON CONFLICT (ags) DO NOTHING;

-- Die Kreise, die wir ueber die Wellen belegt haben. Quelle ist jeweils die
-- amtliche Uebersichtsseite, die auch den Ausschuss belegt hat.
INSERT INTO mb.ags_namen (ags, name, ebene, bundesland, quelle, stand) VALUES
  ('11000','Berlin','kreis','BE','berlin.de/gutachterausschuss, 02.08.2026',DATE '2026-08-02'),
  ('12051','Brandenburg an der Havel','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12052','Cottbus','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12053','Frankfurt (Oder)','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12054','Potsdam','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12060','Barnim','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12061','Dahme-Spreewald','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12062','Elbe-Elster','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12063','Havelland','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12064','Maerkisch-Oderland','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12065','Oberhavel','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12066','Oberspreewald-Lausitz','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12067','Oder-Spree','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12068','Ostprignitz-Ruppin','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12069','Potsdam-Mittelmark','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12070','Prignitz','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12071','Spree-Neisse','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12072','Teltow-Flaeming','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('12073','Uckermark','kreis','BB','gutachterausschuss.brandenburg.de, 02.08.2026',DATE '2026-08-02'),
  ('13003','Rostock, Hansestadt','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02'),
  ('13004','Schwerin, Landeshauptstadt','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02'),
  ('13071','Mecklenburgische Seenplatte','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02'),
  ('13072','Rostock, Landkreis','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02'),
  ('13073','Vorpommern-Ruegen','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02'),
  ('13074','Nordwestmecklenburg','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02'),
  ('13075','Vorpommern-Greifswald','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02'),
  ('13076','Ludwigslust-Parchim','kreis','MV','laiv-mv.de, 02.08.2026',DATE '2026-08-02')
ON CONFLICT (ags) DO NOTHING;

COMMIT;
