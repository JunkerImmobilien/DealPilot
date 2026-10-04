-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 080
-- v1798: Der Bot merkt sich, worueber gerade geredet wird
--
-- Marcel am 02.10.2026:
--
--   "ich moechte einfach sachen sagen wie gib mir ne liste der objekte
--    aus. sag mir was Objekt 17 davon an Kerndaten hat. Also das muss
--    schlau sein. (...) Das muss halt ein lockerer flow sein."
--
-- ── WARUM DAS EINE DATENBANKZEILE BRAUCHT ─────────────────────────────
--
-- "Objekt 17 davon" ist ohne Vorgeschichte sinnlos. Die 17 verweist auf
-- eine Liste, die der Bot eine Nachricht vorher geschickt hat — und
-- Telegram liefert jede Nachricht einzeln, ohne jede Erinnerung an die
-- vorige.
--
--   > Ein Bot ohne Gedaechtnis zwingt den Nutzer, in jedem Satz alles zu
--   > wiederholen. Das ist kein Gespraech, das ist ein Formular mit
--   > Sprechblasen.
--
-- `telegram_dialog` (Migration 079) fuehrt bereits den Zustand einer
-- laufenden ANLAGE. Hier kommt dazu, was fuer die AUSKUNFT noetig ist:
-- die zuletzt gezeigte Liste, das zuletzt besprochene Objekt und die
-- letzten Wortwechsel.
--
-- ── WAS NICHT HINEINGEHOERT ───────────────────────────────────────────
--
-- Keine Objektdaten. Die Liste merkt sich nur die REIHENFOLGE der
-- Kennungen — welche Zahlen zu welchem Objekt gehoeren. Die Daten selbst
-- werden bei jeder Frage frisch gelesen, sonst antwortet der Bot
-- irgendwann aus einem Abzug von gestern.
-- ══════════════════════════════════════════════════════════════════════

-- Die zuletzt gezeigte Liste: Position -> Objekt-Kennung.
-- Ein Array von UUIDs; Position 1 ist Eintrag 1 im Chat.
ALTER TABLE telegram_dialog
  ADD COLUMN IF NOT EXISTS letzte_liste UUID[];

-- Welche Art Liste das war ("objekte", "treffer", "kandidaten") — damit
-- "die zweite" sich auf das Richtige bezieht.
ALTER TABLE telegram_dialog
  ADD COLUMN IF NOT EXISTS letzte_liste_art TEXT;

-- Das zuletzt besprochene Objekt. Traegt "davon", "dazu", "und die Miete?"
ALTER TABLE telegram_dialog
  ADD COLUMN IF NOT EXISTS letztes_objekt UUID;

-- Die letzten Wortwechsel, damit das Modell den Faden hat.
-- [{ rolle: 'user'|'assistant', text: '...' }], gedeckelt auf 12.
ALTER TABLE telegram_dialog
  ADD COLUMN IF NOT EXISTS verlauf JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Eine Zeile je Chat gibt es auch ohne laufende Anlage: `modus` darf
-- NULL sein und bedeutet dann "freie Auskunft".
COMMENT ON COLUMN telegram_dialog.letzte_liste IS
  'Reihenfolge der zuletzt gezeigten Objekte (v1798). Nur Kennungen, nie Daten — '
  'die werden bei jeder Frage frisch gelesen.';
