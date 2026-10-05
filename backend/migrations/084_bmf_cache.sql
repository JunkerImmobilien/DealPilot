-- 084_bmf_cache.sql  ·  v1872
--
-- DER BMF-LAUF WIRD GEMERKT
--
-- Marcel am 05.10.2026 (Parkstr. 9): "erstmal hat es dort sehr lange
-- gedauert, bis die Anschaffungskosten geladen waren. Vielleicht haben wir
-- die Moeglichkeit, wenn man Pro hat und alle Werte da sind, dass wir das
-- schon mal ausrechnen vorher und nicht jedes Mal nur beim Aufruf."
--
-- Gemessen: ein Lauf dauert rund 40 Sekunden, weil die BMF-Arbeitshilfe in
-- LibreOffice neu gerechnet wird (bmfService.calculateKpa). Dieselben
-- Eingaben ergeben dasselbe Ergebnis - also wird es je Eingabe-Hash abgelegt
-- und beim naechsten Aufruf in Millisekunden geliefert. Die Excel- und
-- PDF-Ausgaben rechnen weiter frisch (sie brauchen die Datei).
--
-- Der Hash umfasst ALLE Eingaben der Pipeline (Kaufpreis, Nebenkosten,
-- Bodenrichtwert, Flaechen, Baujahr, Modernisierungen ...). Aendert sich
-- eine, ist es ein neuer Schluessel. Alte Zeilen raeumt der Lauf selbst ab
-- (aelter als 60 Tage).

CREATE TABLE IF NOT EXISTS bmf_cache (
  hash        TEXT PRIMARY KEY,
  user_id     TEXT,
  inputs      JSONB NOT NULL,
  result      JSONB NOT NULL,
  dauer_ms    INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  letzter_zugriff TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bmf_cache_created_idx ON bmf_cache (created_at);
