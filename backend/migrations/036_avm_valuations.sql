-- 036_avm_valuations.sql  ·  AVM-Bewertungshistorie  (marker: v742-avm-history)
-- Additiv: nur eine neue Tabelle. Code-Rollback braucht KEIN DB-Restore.
CREATE TABLE IF NOT EXISTS avm_valuations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id     uuid NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      varchar(32) NOT NULL,          -- pricehubble | sprengnetter | dealpilot | manuell
  source_label  varchar(255),                  -- frei, z.B. "Makler Mueller", "eigenes Gutachten"
  marktwert     integer,
  low           integer,
  high          integer,
  marktmiete    integer,
  eur_per_sqm   integer,
  confidence    varchar(32),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avm_val_object  ON avm_valuations(object_id);
CREATE INDEX IF NOT EXISTS idx_avm_val_created ON avm_valuations(created_at);
