-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 066
-- v1183: der Kontingent-Zaehler — Schluss mit Litern
--
-- 064 hat die sechs Spalten mpi/mpi_plus/wev je _used und _bank angelegt und
-- die Restliter der Bestandsnutzer nach mpi_bank umgerechnet. Gezaehlt wurde
-- weiter in Litern. Diese Migration macht die Umstellung vollstaendig.
--
-- WAS HIER DAZUKOMMT
--   A) zwei Bestaende fuer die Marktwert-Abrufe
--   B) ein Merker fuer den Monatsuebertrag
--   C) die Liter werden stillgelegt — aber NICHT geloescht
-- ════════════════════════════════════════════════════════════════════════

-- ── A · Die Marktwert-Abrufe bekommen einen eigenen Bestand ─────────────
-- Sie hingen bisher am selben Topf wie alles andere und kosteten 40 L
-- (PriceHubble) bzw. 20 L (Sprengnetter). Bei einem Monatskontingent von
-- 5 Bewertungen haette ein einziger Abruf das Kontingent achtfach
-- gesprengt — die Zahlen stammen aus der Zeit, als 100 L im Pro-Plan lagen.
--
-- Im Preismodell v1176 sind sie Einzelposten (5,90 € / 9,90 €), also
-- bekommen sie einen eigenen Bestand und keine Monatszuteilung. Wer keinen
-- hat, kauft einen — er verfaellt nicht.
ALTER TABLE ai_credits_user
  ADD COLUMN IF NOT EXISTS avm_a_bank INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avm_b_bank INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN ai_credits_user.avm_a_bank IS 'v1183: gekaufte Marktwert-Abrufe Bewertungspartner A, verfallen nicht';
COMMENT ON COLUMN ai_credits_user.avm_b_bank IS 'v1183: gekaufte Marktwert-Abrufe Bewertungspartner B, verfallen nicht';

-- ── B · Der Monatsuebertrag braucht ein Gedaechtnis ─────────────────────
-- Marcels Regel: nicht genutzte Abrufe verfallen NICHT, sie wandern beim
-- Monatswechsel in die Bank, gedeckelt auf das Dreifache des
-- Monatskontingents.
--
-- Warum eine eigene Spalte und nicht current_period_start:
-- current_period_start wird beim Reset gesetzt, EGAL ob der Uebertrag lief.
-- Faellt der Server zwischen Reset und Uebertrag aus, waere das Guthaben
-- still weg und niemand koennte es nachweisen. Der eigene Merker macht den
-- Uebertrag idempotent und nachvollziehbar.
ALTER TABLE ai_credits_user
  ADD COLUMN IF NOT EXISTS kontingent_carry_at DATE;

COMMENT ON COLUMN ai_credits_user.kontingent_carry_at IS 'v1183: Monat, fuer den der Uebertrag ins Sparguthaben zuletzt lief';

-- Bestandsnutzer: auf den laufenden Monat setzen, damit der erste
-- Monatswechsel nach dem Rollout nicht rueckwirkend etwas uebertraegt, das
-- unter der alten Liter-Rechnung schon verbraucht war.
UPDATE ai_credits_user
   SET kontingent_carry_at = date_trunc('month', NOW())::date
 WHERE kontingent_carry_at IS NULL;

-- ── C · Die Liter werden stillgelegt, nicht geloescht ───────────────────
-- 064 hat bonus_credits bereits nach mpi_bank umgerechnet (aufgerundet, 2 L
-- je Marktpreisindikation). Ab jetzt liest kein Code mehr bonus_credits.
--
-- Die Spalte BLEIBT stehen. Sie ist der einzige Beleg dafuer, was ein
-- Bestandsnutzer vor der Umstellung hatte — wer sie loescht, kann eine
-- Beschwerde ueber verlorenes Guthaben nicht mehr pruefen.
-- ai_credits_log bleibt aus demselben Grund unangetastet: v1125 rechnet die
-- bezahlte Marktbericht-Stufe aus den ALTEN Kostenzeilen zurueck, damit
-- niemand fuer ein Objekt doppelt zahlt.
COMMENT ON COLUMN ai_credits_user.bonus_credits IS
  'STILLGELEGT v1183. Alter Litertank. Wurde in 064 nach mpi_bank umgerechnet. Bleibt als Nachweis stehen, wird nicht mehr gelesen.';
