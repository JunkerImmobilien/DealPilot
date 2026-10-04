-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 076
-- v1791 (T-B5 Schritt 2): Die Verknuepfung Telegram-Chat <-> DealPilot-Konto
--
-- Marcel am 01./02.10.2026: der Bot soll Objekte anlegen, Felder aendern,
-- Portfolio-Zahlen liefern und eine Marktpreisindikation holen — und er
-- "muss ueber einstellungen vernuenftig einzurichten sein".
--
-- Das ist der erste Baustein: ohne eine belastbare Zuordnung
-- "dieser Chat gehoert diesem Konto" darf der Bot gar nichts tun.
--
-- ── WARUM EINE EIGENE TABELLE UND KEINE SPALTE AN `users` ─────────────
--
-- Ein Telegram-Chat traegt eine ZAHL (`chat.id`, bis 2^52, offiziell
-- BIGINT). `users.id` ist dagegen eine UUID.
--
--   > Eine Kennung, die irgendwo zur Zahl wird, ist an dieser Stelle
--   > verloren.
--
-- Das ist hier keine Theorie. Seit v942 scheitern die nutzerbezogenen
-- Marktbericht-Wege genau daran still: `mb.market_reports.user_id` und
-- `object_snapshots.user_id` waren INTEGER, und `parseInt()` auf eine
-- UUID ergibt die erste Ziffernfolge — aus "2a1ac331-…" wurde die 2.
-- Keine Fehlermeldung, nur falsche Daten. Behoben erst mit Migration 015
-- im Marktbericht-Strang.
--
-- Deshalb stehen die beiden Kennungen hier in ZWEI Spalten mit zwei
-- Typen, und keine Zeile des Programms muss sie je ineinander wandeln.
--
-- ── WARUM EIN EINMAL-CODE UND KEIN TOKEN DES KUNDEN ───────────────────
--
-- Entschieden am 02.10.2026 (BACKLOG T-B1): EIN DealPilot-Bot fuer alle,
-- der Kunde verknuepft sich mit einem Code aus den Einstellungen. Die
-- Gegenvariante — jeder Kunde legt bei BotFather einen eigenen Bot an und
-- kopiert dessen Token zu uns — scheiterte an Marcels Vorgabe
-- "vernuenftig einzurichten", und sie haette ein fremdes Passwort in
-- unsere Datenbank gelegt.
--
-- Der Code ist absichtlich kurzlebig und einmalig:
--   * `code_ablauf`  — 15 Minuten, danach ist er wertlos
--   * `bestaetigt_am`— ist er gesetzt, ist der Code verbraucht
--   * `code` wird beim Bestaetigen auf NULL gesetzt, nicht aufgehoben
--
-- ── WAS HIER BEWUSST NICHT STEHT ──────────────────────────────────────
--
-- Kein Bot-Token. Der gehoert in die Umgebung (.env), nicht in die
-- Datenbank — er ist fuer alle Kunden derselbe und ein Geheimnis des
-- Betreibers, keine Kundeneinstellung.
--
-- Keine Chat-Historie. Der Gespraechszustand ist fluechtig und gehoert
-- nicht in eine Tabelle, die eine Berechtigung fuehrt.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS telegram_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- DealPilot-Konto: UUID. Niemals eine Zahl.
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Telegram-Chat: BIGINT. Niemals als user_id verwenden.
  -- NULL, solange der Code noch nicht eingeloest wurde.
  chat_id         BIGINT,

  -- Was Telegram ueber den Chat sagt (nur zur Anzeige in den
  -- Einstellungen: "verbunden mit @marcel_j"). Nie zur Berechtigung.
  tg_username     TEXT,
  tg_vorname      TEXT,

  -- Der Einmal-Code aus den Einstellungen.
  code            TEXT,
  code_ablauf     TIMESTAMPTZ,

  bestaetigt_am   TIMESTAMPTZ,
  letzte_nutzung  TIMESTAMPTZ,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Abschalten ohne loeschen: der Nutzer kann die Verbindung in den
  -- Einstellungen stilllegen und spaeter wieder anschalten.
  aktiv           BOOLEAN NOT NULL DEFAULT TRUE
);

-- Ein Telegram-Chat gehoert zu HOECHSTENS EINEM Konto. Ohne diese
-- Bedingung koennte derselbe Chat zwei Konten bedienen, und der Bot
-- muesste raten, wessen Objekte er zeigt.
CREATE UNIQUE INDEX IF NOT EXISTS telegram_links_chat_uniq
  ON telegram_links (chat_id)
  WHERE chat_id IS NOT NULL;

-- Ein Konto darf mehrere Chats haben (Handy und Zweitgeraet), aber nur
-- EINEN offenen Code. Sonst haette ein Angreifer mehrere Versuche
-- gleichzeitig offen.
CREATE UNIQUE INDEX IF NOT EXISTS telegram_links_offener_code_uniq
  ON telegram_links (user_id)
  WHERE bestaetigt_am IS NULL;

-- Der Weg, den der Webhook bei JEDER Nachricht geht: chat_id -> Konto.
CREATE INDEX IF NOT EXISTS telegram_links_user_idx
  ON telegram_links (user_id);

COMMENT ON TABLE telegram_links IS
  'Verknuepfung Telegram-Chat (BIGINT) <-> DealPilot-Konto (UUID). v1791. '
  'chat_id darf NIE als user_id verwendet werden.';
