-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 072
-- v1371 (B11): Rollen und Sicherheits-Ausnahmen
--
-- Marcels Punkt B11: "Rollen OWNER/ADMIN/DEVELOPER/SUPPORT/USER +
-- security_exempt". Dazu seine Auflage aus demselben Auftrag:
--
--   "Administratoren, Entwickler und ausdruecklich freigeschaltete
--    Testkonten muessen weiterarbeiten koennen ... Ausnahmen muessen
--    rollenbasiert umgesetzt und trotzdem protokolliert werden."
--
-- Der zweite Halbsatz ist der wichtige. Eine Ausnahme, die nicht
-- protokolliert wird, ist ein blinder Fleck: genau die Konten mit den
-- weitesten Rechten waeren dann die, ueber die niemand etwas weiss.
-- Deshalb wird `security_exempt` NUR vom Limit befreit - die Ereignisse
-- werden trotzdem geschrieben, mit einem Vermerk.
--
-- ZWEI ROLLENSYSTEME, ABSICHTLICH GETRENNT:
--   users.role        wer ist das in der ANWENDUNG
--   admin_users.role  wer darf was im ADMINBEREICH (owner/support/readonly)
--
-- Sie bleiben getrennt. Ein Entwickler braucht Ausnahmen im Betrieb, aber
-- nicht zwingend Zugriff auf Kundendaten im Admin - und umgekehrt. Sie zu
-- verschmelzen waere bequem und genau deshalb falsch.
--
-- WARUM DER CHECK ERWEITERT UND NICHT ERSETZT WIRD: bestehende Zeilen
-- tragen 'user' oder 'admin'. Beide bleiben gueltig, niemand muss
-- umgestellt werden, und nichts bricht. Die neuen Rollen kommen dazu.
-- ══════════════════════════════════════════════════════════════════════

-- Die Rollenliste erweitern. 'admin' und 'user' bleiben, damit der
-- Bestand unveraendert weiterlaeuft.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'admin', 'developer', 'support', 'user'));

-- Die Ausnahme. Bewusst eine eigene Spalte und nicht eine weitere Rolle:
-- ein Testkonto kann ein ganz normaler 'user' sein und trotzdem befreit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Warum befreit? Ohne Begruendung ist eine Ausnahme in einem halben Jahr
-- nicht mehr erklaerbar, und niemand traut sich, sie zu entfernen.
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_exempt_grund TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_exempt_seit TIMESTAMPTZ;

-- Wer befreit ist, soll auffindbar sein - eine Ausnahme, die man suchen
-- muss, wird vergessen.
CREATE INDEX IF NOT EXISTS idx_users_security_exempt
  ON users(security_exempt) WHERE security_exempt = TRUE;

COMMENT ON COLUMN users.security_exempt IS
  'v1371 (B11) - befreit vom Rate-Limit, NICHT vom Protokoll. Ereignisse '
  'werden weiterhin geschrieben und tragen den Vermerk ausnahme=true.';
COMMENT ON COLUMN users.security_exempt_grund IS
  'Warum diese Ausnahme besteht. Pflicht beim Setzen - ohne Begruendung ist '
  'sie spaeter nicht mehr erklaerbar.';
