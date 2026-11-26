-- 027_mietspiegel_waechter.sql — v5080 · Wächter über die Mietspiegel-Quellen (26.11.2026)
-- Marcel 26.11.2026: „rufen wir das auch regelmäßig ab?" Gemessen: kein Takt für Mietspiegel. Neue Ausgaben
-- (meist alle 2 Jahre) und abgelaufene Mietspiegel fielen niemandem auf.
-- Je Quelle (Wertedatei und Verzeichnis-Satz) der letzte Abruf: Kennung der Antwort (ETag, Last-Modified, Länge,
-- Hash des Anfangs). Ändert sich die Kennung, steht status = 'geaendert', bis jemand die neue Ausgabe erntet und
-- quittiert. Übernommen wird NICHTS automatisch.
CREATE TABLE IF NOT EXISTS mb.mietspiegel_waechter (
  ags            TEXT NOT NULL,
  url            TEXT NOT NULL,
  art            TEXT NOT NULL DEFAULT 'werte',     -- werte | verzeichnis
  kennung        TEXT,                              -- etag|last-modified|laenge|hash
  kennung_basis  TEXT,                              -- Kennung beim ersten Abruf bzw. nach der letzten Ernte
  http_status    INT,
  status         TEXT NOT NULL DEFAULT 'neu',       -- neu | gleich | geaendert | fehler
  fehler         TEXT,
  geprueft_am    TIMESTAMPTZ,
  geaendert_am   TIMESTAMPTZ,
  PRIMARY KEY (ags, url)
);
