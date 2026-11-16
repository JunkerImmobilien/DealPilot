-- 110_gutachten_auftraege.sql  ·  v3590
--
-- RND-GUTACHTEN UEBER JUNKER IMMOBILIEN (Marcel 16.11.2026)
-- Marcel verkauft die Gutachten selbst und reicht sie an gutachten.org durch. Jeder Auftrag
-- wird hier festgehalten: Objekt, Kunde (nur mit Zustimmung zur Weitergabe), Auswahl, Preis,
-- Rabatt, Endpreis, Partner-Anfragenummer, Zeit, Stand der Benachrichtigung an Marcel.
-- Admin › Gutachtenaufträge liest diese Tabelle.

CREATE TABLE IF NOT EXISTS gutachten_auftraege (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  objekt_id        UUID,
  objekt_text      TEXT,
  request_id       TEXT,                          -- Kennung bei gutachten.org (Entwurf/Auftrag)
  request_number   TEXT,
  status           TEXT NOT NULL DEFAULT 'entwurf',   -- entwurf | beauftragt
  kunde            JSONB NOT NULL,                -- Name, Anschrift, E-Mail, Telefon (fuer Marcels Rechnung)
  zustimmungen     JSONB NOT NULL,                -- daten, widerruf, kosten: Zeitpunkt der Zustimmung
  auswahl          JSONB NOT NULL,                -- besichtigung, express, rabattcode
  preis            JSONB NOT NULL,                -- posten, honorar, rabatt, endpreis, Quelle/Stand der Preisliste
  endpreis         NUMERIC(10,2),
  benachrichtigung JSONB,                         -- Mail an Marcel: gesendet | staging_unterdrueckt | fehler
  umgebung         TEXT,                          -- test | produktion (gutachten.org)
  beauftragt_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gutachten_auftraege_zeit ON gutachten_auftraege (created_at DESC);
CREATE INDEX IF NOT EXISTS gutachten_auftraege_request ON gutachten_auftraege (request_id);
