-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 077
-- v1792: JEDER KUNDE LEGT SEINEN EIGENEN BOT AN
--
-- ── RUECKNAHME EINER ENTSCHEIDUNG VON GESTERN ─────────────────────────
--
-- Migration 076 und BACKLOG T-B1 gingen von EINEM DealPilot-Bot fuer alle
-- aus. Begruendet war das mit Marcels Satz "der muss ueber einstellungen
-- vernuenftig einzurichten sein" — gelesen als "moeglichst wenig Arbeit
-- fuer den Kunden".
--
-- Marcel am 02.10.2026, direkt danach:
--
--   "aber ich moechte dass der kunde fuer sein objekt einen anlegen kann
--    also selber. jeder kunde kann fuer sich und sein portfolio einen
--    eigenen bot anlegen."
--
-- Das ist etwas anderes, und es ist seine Entscheidung. "In den
-- Einstellungen einrichten" hiess nicht "mit einem Klick", sondern "dort
-- traegt der Kunde SEINEN Bot ein".
--
-- ── WAS DAGEGEN SPRACH, UND WARUM ES NICHT MEHR GILT ──────────────────
--
-- T-B1 fuehrte als Gegenargument: "Polling: eine Instanz JE Kunde — 50
-- Kunden = 50 Polling-Schleifen", dazu die harte Grenze aus der Anleitung
-- ("nur eine Instanz darf pollen").
--
--   > Das gilt fuer POLLING. Mit einem Webhook faellt es ersatzlos weg:
--   > jeder Bot ruft von sich aus unsere URL auf, und wir halten keine
--   > einzige Schleife. Fuenfzig Bots kosten dann genau so viel wie einer.
--
-- Das Gegenargument war also kein Argument gegen Marcels Weg, sondern
-- eines gegen die Bauart des Bau-Cockpits. Ich hatte beides vermengt.
--
-- Sein Weg hat dazu einen Vorteil, der in derselben Tabelle stand und den
-- ich nicht gewichtet habe: der Kunde darf den Bot nennen wie er will.
-- Fuer eine Whitelabel-SaaS ist das kein Nebenpunkt.
--
-- ── WO DER TOKEN LIEGT: NICHT HIER ────────────────────────────────────
--
-- Ein Bot-Token ist ein PASSWORT — ein fremdes. Er gehoert deshalb in
-- `user_provider_credentials` (AES-256-GCM ueber credentialVault), wie
-- der ImmoMetrica-Zugang, und NICHT in eine Klartextspalte hier.
--
-- Diese Tabelle fuehrt nur, was oeffentlich sein darf: wie der Bot heisst
-- und unter welchem Pfad sein Webhook hereinkommt.
-- ══════════════════════════════════════════════════════════════════════

-- Der Bot eines Kunden. Genau einer je Konto — wer einen zweiten will,
-- ersetzt den ersten.
CREATE TABLE IF NOT EXISTS telegram_bots (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Was BotFather vergeben hat. Nur zur Anzeige und fuer den t.me-Link.
  bot_username    TEXT NOT NULL,
  bot_name        TEXT,

  -- Die Bot-Kennung aus getMe (BIGINT wie jede Telegram-Kennung).
  bot_id          BIGINT,

  -- Der Pfad, unter dem GENAU DIESER Bot seinen Webhook abliefert:
  -- /api/v1/telegram/webhook/<webhook_pfad>. Zufaellig und je Kunde
  -- verschieden — damit steht die Zuordnung fest, BEVOR irgendein Inhalt
  -- gelesen wird.
  webhook_pfad    TEXT NOT NULL UNIQUE,

  -- Zusaetzlich das, was Telegram im Kopf X-Telegram-Bot-Api-Secret-Token
  -- mitschickt. Zwei unabhaengige Merkmale: wer den Pfad erraet, hat noch
  -- nichts.
  webhook_secret  TEXT NOT NULL,

  webhook_gesetzt TIMESTAMPTZ,
  letzter_fehler  TEXT,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktiv           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS telegram_bots_pfad_idx ON telegram_bots (webhook_pfad);

COMMENT ON TABLE telegram_bots IS
  'Der EIGENE Telegram-Bot eines Kunden (v1792). Der Token steht NICHT hier, '
  'sondern verschluesselt in user_provider_credentials (provider=telegram).';

-- `telegram_links` (Migration 076) bleibt unveraendert gueltig: auch bei
-- einem eigenen Bot muss der Chat erst verknuepft werden. Wer den Bot
-- kennt, kann ihm schreiben — der Einmal-Code entscheidet, WESSEN Daten
-- er dann sieht.
--
-- Neu ist nur, dass eine Verknuepfung zu einem bestimmten Bot gehoert.
-- Ohne diese Spalte wuerde ein Chat, der bei Kunde A verknuepft ist, auch
-- ueber den Bot von Kunde B gelten.
ALTER TABLE telegram_links
  ADD COLUMN IF NOT EXISTS bot_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Derselbe Chat darf an verschiedenen Bots haengen (jemand bedient zwei
-- Portfolios), aber je Bot nur einmal. Der alte Index ueber chat_id allein
-- waere dafuer zu streng.
DROP INDEX IF EXISTS telegram_links_chat_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_links_chat_bot_uniq
  ON telegram_links (chat_id, bot_user_id)
  WHERE chat_id IS NOT NULL;
