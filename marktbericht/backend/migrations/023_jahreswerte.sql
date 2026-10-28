-- 023_jahreswerte.sql — v3021 · Jahreswerte: automatisch geholte amtliche Reihen
-- und der selbst ermittelte Angebotsabschlag.
--
-- Marcel 28.10.2026: „den Wert [Angebotsabschlag 5,8 %] bitte dann jedes Jahr
-- automatisch neu ermitteln, und das müssen wir auch bei den Steuerdaten machen."
--
-- Drei NEUE Tabellen; keine bestehende wird angefasst. Kein Personenbezug:
-- keine Adresse, keine Nutzerkennung, nur Gemeindeschlüssel und Segment.

-- (1) Gelesene Werte amtlicher Reihen (VPI, Baupreisindex). Je Abruf und
--     Periode eine Zeile; wirksam ist höchstens EINE Zeile je Reihe+Periode
--     mit status 'aktiv'. 'warnung' = Plausibilitätsprüfung nicht bestanden,
--     wirkt NICHT, wartet auf einen Blick von Hand.
CREATE TABLE IF NOT EXISTS mb.jahreswerte_abruf (
  id            BIGSERIAL   PRIMARY KEY,
  reihe         TEXT        NOT NULL CHECK (reihe IN ('vpi', 'bpi')),
  periode       TEXT        NOT NULL CHECK (periode ~ '^\d{4}-\d{2}$'),
  wert          NUMERIC     NOT NULL,
  basis         TEXT        NOT NULL,
  status        TEXT        NOT NULL CHECK (status IN ('aktiv', 'warnung')),
  pruefung      TEXT,
  weg           TEXT        NOT NULL,          -- 'seite' | 'genesis'
  quelle_url    TEXT,
  quelle_stand  DATE,                          -- „Stand …" der Veröffentlichung
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS jahreswerte_abruf_aktiv
  ON mb.jahreswerte_abruf (reihe, periode) WHERE status = 'aktiv';
CREATE INDEX IF NOT EXISTS jahreswerte_abruf_reihe ON mb.jahreswerte_abruf (reihe, periode);

-- Protokoll der Läufe (auch der fehlgeschlagenen) - für den Admin-Abschnitt.
CREATE TABLE IF NOT EXISTS mb.jahreswerte_lauf (
  id         BIGSERIAL   PRIMARY KEY,
  art        TEXT        NOT NULL,             -- 'reihen' | 'angebotsabschlag'
  gelaufen_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok         BOOLEAN     NOT NULL,
  ergebnis   JSONB
);

-- (2) Jede örtliche Messung des Angebotsabschlags (Stufe 2/3 im
--     ValuationService): Ø Kaufpreis eines amtlichen Satzes gegen den Median
--     der Angebote. Wiederholte Berichte am selben Ort messen dasselbe -
--     die Jahresrechnung nimmt je (ags, segment, satz) nur die jüngste Messung.
CREATE TABLE IF NOT EXISTS mb.angebot_abschlag_messung (
  id                  BIGSERIAL   PRIMARY KEY,
  gemessen_am         TIMESTAMPTZ NOT NULL DEFAULT now(),
  jahr                INTEGER     NOT NULL,
  ags                 TEXT        NOT NULL,
  land                TEXT,
  segment             TEXT        NOT NULL CHECK (segment IN ('etw', 'haus', 'mfh')),
  objektart           TEXT,
  angebotsmedian_eur_qm NUMERIC   NOT NULL,
  angebote_n          INTEGER,
  kaufpreis_eur_qm    NUMERIC     NOT NULL,
  abschlag_pct        NUMERIC     NOT NULL,
  quelle              TEXT        NOT NULL CHECK (quelle IN ('rohertragsfaktor', 'liegenschaftszinssatz')),
  satz_id             TEXT,
  satz_berichtsjahr   INTEGER
);
CREATE INDEX IF NOT EXISTS angebot_abschlag_messung_jahr ON mb.angebot_abschlag_messung (jahr, segment);

-- (3) Der jährliche DealPilot-Marktdurchschnitt je Segment. aktiv = genug
--     Messungen (n >= min_n); sonst gilt weiter der recherchierte Wert.
CREATE TABLE IF NOT EXISTS mb.angebot_abschlag_jahr (
  jahr          INTEGER     NOT NULL,
  segment       TEXT        NOT NULL CHECK (segment IN ('etw', 'haus', 'mfh')),
  pct           NUMERIC,
  n             INTEGER     NOT NULL,      -- nach Ausreißer-Schnitt
  n_roh         INTEGER     NOT NULL,      -- verschiedene Orte/Sätze vor dem Schnitt
  n_ausreisser  INTEGER     NOT NULL,
  q1            NUMERIC,
  q3            NUMERIC,
  min_n         INTEGER     NOT NULL,
  aktiv         BOOLEAN     NOT NULL,
  berechnet_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (jahr, segment)
);

COMMENT ON TABLE mb.jahreswerte_abruf IS 'v3021 · automatisch gelesene amtliche Reihen (VPI, Baupreisindex), nur status=aktiv wirkt';
COMMENT ON TABLE mb.angebot_abschlag_messung IS 'v3021 · örtliche Messungen des Abschlags auf Angebotspreise, ohne Personenbezug';
COMMENT ON TABLE mb.angebot_abschlag_jahr IS 'v3021 · DealPilot-Marktdurchschnitt des Angebotsabschlags je Jahr und Segment';
