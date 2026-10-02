-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 079
-- v1794: Der Gespraechszustand des Bots
--
-- Marcel will ueber den Bot Objekte anlegen koennen, "dass wir diese
-- Schritt-fuer-Schritt-Anleitung, dass das ueber den Bot funktionieren
-- kann".
--
-- Eine gefuehrte Anlage ist ein Gespraech ueber viele Nachrichten hinweg.
-- Telegram schickt jede davon einzeln und ohne Erinnerung an die vorige —
-- der Zustand muss also bei uns liegen.
--
-- ── WARUM NICHT IN telegram_links ─────────────────────────────────────
--
-- `telegram_links` fuehrt eine BERECHTIGUNG. Ein Entwurf ist fluechtig,
-- wird oft geschrieben und darf jederzeit weggeworfen werden.
--
--   > Wer Fluechtiges in die Tabelle schreibt, die eine Berechtigung
--   > fuehrt, schreibt irgendwann aus Versehen an der Berechtigung.
--
-- ── WAS HIER NICHT STEHT ──────────────────────────────────────────────
--
-- Keine Frage, keine Reihenfolge, kein Pflichtfeld. Die stehen in
-- `generated/frontend-konstanten.json`, abgeleitet aus den
-- Frontend-Dateien — nicht abgeschrieben.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS telegram_dialog (
  chat_id       BIGINT  NOT NULL,
  bot_user_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 'anlegen' | 'adresse_bestaetigen' | null (= freie Auskunft)
  modus         TEXT,

  -- Der Entwurf, solange das Objekt noch nicht gespeichert ist.
  entwurf       JSONB   NOT NULL DEFAULT '{}'::jsonb,

  -- Welche Felder die letzte Frage betraf. Damit laesst sich eine Antwort
  -- zuordnen, die nur aus einer Zahl besteht ("1968").
  offene_ids    TEXT[],
  letzte_frage  TEXT,

  -- Wenn ein bestehendes Objekt bearbeitet wird.
  objekt_id     UUID,

  aktualisiert  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, bot_user_id)
);

COMMENT ON TABLE telegram_dialog IS
  'Fluechtiger Gespraechszustand des Telegram-Bots (v1794). Enthaelt KEINE '
  'Berechtigung - die steht in telegram_links - und KEINE Fragenlogik.';

CREATE INDEX IF NOT EXISTS telegram_dialog_alt_idx ON telegram_dialog (aktualisiert);
