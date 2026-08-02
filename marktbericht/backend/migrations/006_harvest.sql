-- 006_harvest.sql  (Paket v1019)
-- ─────────────────────────────────────────────────────────────────────
-- Ernte der Wertermittlungsparameter aus den Grundstuecksmarktberichten.
--
-- Etappe 1: Quellenverzeichnis + Discovery. Es wird NUR gefunden und
-- registriert, noch nichts extrahiert. Discovery ist billig und laeuft oft,
-- Extraktion ist teuer und laeuft nur bei neuen Dokumenten — deshalb getrennt.
--
-- KOSTENPFLICHTIGE QUELLEN WERDEN NIE ABGERUFEN. Sie stehen mit
-- zugang='kostenpflichtig' im Verzeichnis, damit sichtbar ist, warum ein
-- Kreis keinen amtlichen Wert hat, und damit man ihn gezielt kaufen kann.

BEGIN;

CREATE TABLE IF NOT EXISTS mb.gaa_sources (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT        NOT NULL,
  bundesland     TEXT        NOT NULL,
  ebene          TEXT        NOT NULL DEFAULT 'kreis',   -- kreis | land | bund
  ags_liste      TEXT[],                                  -- zustaendige Gemeindeschluessel
  portal_url     TEXT,
  zugang         TEXT        NOT NULL DEFAULT 'unbekannt',
                 -- frei | namensnennung | kostenpflichtig | auf_anfrage | unbekannt
  lizenz         TEXT,
  turnus         TEXT        DEFAULT 'jaehrlich',
  veroeff_monat  INTEGER,                                 -- gelerntes Fenster (1-12)
  letzter_fund   DATE,
  letzter_check  TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'aktiv',    -- aktiv | stumm | portal_defekt | gesperrt
  notiz          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gaa_sources_name ON mb.gaa_sources (name, bundesland);
CREATE INDEX IF NOT EXISTS ix_gaa_sources_check ON mb.gaa_sources (status, letzter_check);

COMMENT ON COLUMN mb.gaa_sources.zugang IS
  'kostenpflichtig => NIE automatisch abrufen. Steht im Verzeichnis, damit sichtbar ist, warum ein Kreis keinen amtlichen Wert traegt.';

CREATE TABLE IF NOT EXISTS mb.gaa_documents (
  id             BIGSERIAL PRIMARY KEY,
  source_id      BIGINT      NOT NULL REFERENCES mb.gaa_sources(id),
  url            TEXT        NOT NULL,
  titel          TEXT,
  jahrgang       INTEGER,
  sha256         TEXT,
  bytes          INTEGER,
  lauf_typ       TEXT        NOT NULL DEFAULT 'regel',    -- regel | archiv
  status         TEXT        NOT NULL DEFAULT 'neu',      -- neu | extrahiert | keine_daten | quarantaene | uebersprungen
  gefunden_am    TIMESTAMPTZ NOT NULL DEFAULT now(),
  extrahiert_am  TIMESTAMPTZ,
  notiz          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gaa_documents_url ON mb.gaa_documents (url);
CREATE INDEX IF NOT EXISTS ix_gaa_documents_offen ON mb.gaa_documents (status, lauf_typ);

-- ═══════════════════════════════════════════════════════════════════════
-- Startbestand: die 16 Landes-Einstiegspunkte (Etappe 2 des Konzepts).
-- 16 Dokumente statt 390 — damit springt die Abdeckung bundesweit von
-- Stufe D auf Stufe B, sobald extrahiert wird.
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO mb.gaa_sources (name, bundesland, ebene, portal_url, zugang, lizenz, veroeff_monat, notiz)
VALUES
  ('Oberer Gutachterausschuss NRW','NW','land','https://www.boris.nrw.de/','frei','dl-de/zero-2-0',4,
   'Vollstaendige Marktberichte als Open Data, kommerzielle Nutzung erlaubt.'),
  ('Oberer Gutachterausschuss Niedersachsen','NI','land','https://www.gag.niedersachsen.de/','frei',NULL,4,NULL),
  ('Gutachterausschuss Berlin','BE','land','https://www.berlin.de/gutachterausschuss/','frei',NULL,4,NULL),
  ('Oberer Gutachterausschuss Brandenburg','BB','land','https://www.gutachterausschuesse-bb.de/','frei',NULL,4,NULL),
  ('Gutachterausschuss Bremen','HB','land','https://www.gutachterausschuss.bremen.de/','frei',NULL,4,NULL),
  ('Gutachterausschuss Hamburg','HH','land','https://www.hamburg.de/gutachterausschuss/','frei',NULL,4,NULL),
  ('Oberer Gutachterausschuss Hessen','HE','land','https://www.gutachterausschuesse.hessen.de/','frei',NULL,4,NULL),
  ('Oberer Gutachterausschuss Mecklenburg-Vorpommern','MV','land','https://www.gutachterausschuesse-mv.de/','frei',NULL,4,NULL),
  ('Oberer Gutachterausschuss Rheinland-Pfalz','RP','land','https://gutachterausschuesse.rlp.de/','frei',NULL,4,NULL),
  ('Oberer Gutachterausschuss Sachsen','SN','land','https://www.boris.sachsen.de/','unbekannt',NULL,4,
   'Landesbericht pruefen; Kreisberichte teils kostenpflichtig (z. B. Meissen).'),
  ('Oberer Gutachterausschuss Sachsen-Anhalt','ST','land','https://www.landesrecht.sachsen-anhalt.de/','kostenpflichtig',NULL,4,
   'Landesbericht als Download kostenpflichtig (ca. 30 EUR) — NICHT automatisch abrufen.'),
  ('Oberer Gutachterausschuss Thueringen','TH','land','https://www.gutachterausschuss.thueringen.de/','unbekannt',NULL,4,NULL),
  ('Oberer Gutachterausschuss Schleswig-Holstein','SH','land','https://www.schleswig-holstein.de/','unbekannt',NULL,4,
   'Nicht im freien BORIS-D-Dienst.'),
  ('Gutachterausschuss Saarland','SL','land','https://www.saarland.de/','unbekannt',NULL,4,
   'Nicht im freien BORIS-D-Dienst.'),
  ('Gutachterausschuesse Bayern','BY','land','https://www.gutachterausschuesse.bayern.de/','kostenpflichtig',NULL,4,
   'Bodenrichtwertauskunft gebuehrenpflichtig — NICHT automatisch abrufen.'),
  ('Oberer Gutachterausschuss Baden-Wuerttemberg','BW','land','https://www.gutachterausschuesse-bw.de/','auf_anfrage',NULL,4,
   'Kein offener Dienst; Massenabzug untersagt.')
ON CONFLICT (name, bundesland) DO NOTHING;

-- Der Kreis aus dem Coswig-Testfall, als belegtes Beispiel fuer eine
-- kostenpflichtige Quelle.
INSERT INTO mb.gaa_sources (name, bundesland, ebene, ags_liste, portal_url, zugang, veroeff_monat, notiz)
VALUES ('Gutachterausschuss Landkreis Meissen','SN','kreis', ARRAY['14627'],
        'https://www.kreis-meissen.de/Landratsamt/Die-Verwaltung/Dezernat-Technik/Kreisvermessungsamt/Gutachterausschuss/',
        'kostenpflichtig', 4,
        'Grundstuecksmarktbericht mit Schutzgebuehr (Auszug ab 20 EUR). Wird NICHT abgerufen. Wert nach Kauf ueber harvest.js --wert eintragen.')
ON CONFLICT (name, bundesland) DO NOTHING;

COMMIT;
