-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 122
-- v3830a: share_audit.actor_user_id darf leer sein
--
-- Gemessen 19.11.2026 auf Staging (tools/partner-team-live.js): ein Teamberater, der einen Kundenstand
-- uebernommen hatte, liess sich nicht loeschen - userService.deleteUser brach ab mit
--   null value in column "actor_user_id" of relation "share_audit" violates not-null constraint
-- Die Spalte ist NOT NULL, ihr Fremdschluessel aber ON DELETE SET NULL: beides zusammen kann nie gelingen.
-- Dasselbe trifft jeden Partner und jeden Kunden mit Eintraegen im Protokoll. Ausserdem schreibt
-- partnerKunden.weitergefuehrtNachziehen (v3700) seine Zeile bewusst ohne Handelnden (der neue Stand kommt
-- vom Kunden, nachgezogen hat das System) - dieser INSERT scheiterte bisher still im try/catch.
-- Das Protokoll bleibt erhalten, nur der Verweis auf ein geloeschtes Konto wird leer.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.share_audit ALTER COLUMN actor_user_id DROP NOT NULL;
