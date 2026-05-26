-- =================================================================
-- Migration 027: bmf_advanced Feature für Pro-Plan
-- =================================================================
-- V288: Aktiviert das bmf_advanced Feature im Pro-Plan.
-- Wird im Backend via requireFeature('bmf_advanced') geprüft.
-- Idempotent: || JSONB-Merge überschreibt falls schon vorhanden.
-- =================================================================

UPDATE plans
SET features = features || '{"bmf_advanced": true}'::jsonb,
    updated_at = now()
WHERE id = 'pro';

-- Verify
DO $$
DECLARE
  v_features jsonb;
BEGIN
  SELECT features INTO v_features FROM plans WHERE id = 'pro';
  IF v_features->>'bmf_advanced' = 'true' THEN
    RAISE NOTICE 'V288: bmf_advanced erfolgreich auf Pro-Plan aktiviert.';
  ELSE
    RAISE EXCEPTION 'V288 MIGRATION FAILED: bmf_advanced nicht aktiviert in Pro-Plan';
  END IF;
END $$;
