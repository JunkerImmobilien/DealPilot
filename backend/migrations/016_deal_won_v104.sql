-- ════════════════════════════════════════════════════
-- JUNKER IMMOBILIEN BACKEND - Migration 016
-- Deal-Status "Zuschlag bekommen" (V104)
-- ════════════════════════════════════════════════════
-- Marcels Wunsch: Im Tab Deal-Aktion soll man markieren können,
-- ob ein Deal gewonnen wurde (Zuschlag erhalten). Standardmäßig
-- sollen nur Won-Deals im Track-Record und Bankexport landen.
--
-- Architektur-Entscheidung: deal_won wird im JSONB-Blob "data"
-- gespeichert (Schlüssel: _deal_won, _deal_won_at). Spart
-- Backend-Refactoring weil PUT /:id den ganzen data-Blob durchreicht.
-- Migration legt nur einen partiellen Index an.
-- ════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_objects_deal_won
  ON objects(user_id)
  WHERE (data::jsonb->>'_deal_won')::boolean = TRUE;

COMMENT ON INDEX idx_objects_deal_won IS
  'V104: Schnelles Filtern auf Won-Deals (im JSONB data-Feld _deal_won=true) für Track-Record + Bankexport';
