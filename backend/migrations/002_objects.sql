-- ════════════════════════════════════════════════════
-- JUNKER IMMOBILIEN BACKEND - Migration 002
-- Calculation objects (real estate investments)
-- ════════════════════════════════════════════════════

-- Objects table - stores calculation objects per user
-- We use a JSONB field for the calculation data (forward-compatible:
-- new fields can be added without schema changes)
CREATE TABLE IF NOT EXISTS objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Indexable summary fields (denormalized for quick listing)
  name VARCHAR(255) NOT NULL,
  kuerzel VARCHAR(50),
  ort VARCHAR(100),
  kaufpreis NUMERIC(14, 2),
  bmy NUMERIC(6, 3),
  cf_ns NUMERIC(14, 2),
  dscr NUMERIC(6, 3),

  -- Full calculation data (JSONB - all input fields)
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- AI-generated analysis text (from ChatGPT)
  ai_analysis TEXT,

  -- Photos (array of base64 data URLs - or future: object storage URLs)
  photos JSONB DEFAULT '[]'::jsonb,

  -- Optimistic locking (for future multi-user collaborative editing)
  version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objects_user_id ON objects(user_id);
CREATE INDEX IF NOT EXISTS idx_objects_user_updated ON objects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_kuerzel ON objects(kuerzel) WHERE kuerzel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objects_data_gin ON objects USING GIN (data);

DROP TRIGGER IF EXISTS objects_updated_at ON objects;
CREATE TRIGGER objects_updated_at
  BEFORE UPDATE ON objects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log table - tracks who changed what (useful for compliance, debugging)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
