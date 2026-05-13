-- V204 SECURITY-FIX (H2): Password-Reset-Tokens werden ab jetzt gehasht in
-- der DB gespeichert (SHA-256 hex). Vorher: Klartext-Tokens in
-- password_reset_tokens.token — bei DB-Kompromittierung übernahmefähig.
--
-- Migration ist idempotent:
--   A) Tabelle hat noch kein token_hash → spalte hinzufügen
--   B) Alte Tokens (mit Klartext-token) werden verworfen → User muss
--      Reset neu anfordern (Tokens waren ohnehin nur 1h gültig)
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Hash-Spalte hinzufügen falls fehlt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_reset_tokens' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE password_reset_tokens ADD COLUMN token_hash VARCHAR(128);
    RAISE NOTICE 'Spalte token_hash zu password_reset_tokens hinzugefügt';
  END IF;

  -- Alte Tokens (mit token aber ohne token_hash) löschen — bei nächstem
  -- Reset-Request bekommt User einen neuen, korrekt gehashten Token.
  DELETE FROM password_reset_tokens WHERE token_hash IS NULL;
  RAISE NOTICE 'Alte Klartext-Tokens (falls vorhanden) wurden verworfen';

  -- Alte UNIQUE-Constraint auf der token-Spalte entfernen (sonst kollidieren
  -- die leeren Strings beim INSERT in createPasswordResetToken).
  -- Constraint-Name kann je nach Postgres-Version variieren — wir suchen ihn.
  PERFORM 1 FROM pg_constraint
    WHERE conrelid = 'password_reset_tokens'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(token)%';
  IF FOUND THEN
    EXECUTE (
      SELECT 'ALTER TABLE password_reset_tokens DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'password_reset_tokens'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%(token)%'
      LIMIT 1
    );
    RAISE NOTICE 'UNIQUE-Constraint auf token-Spalte entfernt';
  END IF;

  -- token-Spalte nullable machen (war NOT NULL)
  BEGIN
    ALTER TABLE password_reset_tokens ALTER COLUMN token DROP NOT NULL;
    RAISE NOTICE 'token-Spalte ist nun nullable (legacy, ungenutzt)';
  EXCEPTION WHEN OTHERS THEN
    -- Bereits nullable oder anderer Fehler — egal
    NULL;
  END;

  -- Unique-Index auf token_hash (statt auf token wie früher)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_pw_reset_token_hash'
  ) THEN
    CREATE UNIQUE INDEX idx_pw_reset_token_hash ON password_reset_tokens(token_hash);
    RAISE NOTICE 'Unique-Index idx_pw_reset_token_hash erstellt';
  END IF;
END $$;

-- Cleanup-Helper bleibt unverändert
CREATE OR REPLACE FUNCTION cleanup_expired_password_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
