-- 032: marktbericht_cost_log.user_id INTEGER -> TEXT (User-IDs sind UUIDs, nicht INT).
-- Idempotent: nur aendern, wenn noch integer.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marktbericht_cost_log' AND column_name = 'user_id' AND data_type = 'integer'
  ) THEN
    ALTER TABLE marktbericht_cost_log ALTER COLUMN user_id TYPE TEXT USING user_id::text;
  END IF;
END $$;
