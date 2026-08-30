-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 064
-- v1176: Die neuen Preise und die drei Bewertungs-Kontingente
--
-- WAS SIE TUT, IN ZWEI TEILEN
--   A) die Preise in `plans` auf den Stand von v1176 ziehen
--   B) `ai_credits_user` um drei benannte Zaehler erweitern
--
-- WAS SIE NICHT TUT
--   Sie schaltet den Verbrauch NICHT um. Der Litertank laeuft weiter, bis
--   aiCreditsService.js umgestellt ist. Die Spalten stehen vorher da, damit
--   die Umstellung selbst ohne Schema-Aenderung auskommt und im Zweifel in
--   einem Schritt zurueckgedreht werden kann.
--
-- WARUM DIE PREISE HIER UND NICHT NUR IM FRONTEND
--   hasFeature fragt ZUERST die DB (Sub.hasCachedFeature), config.js ist nur
--   der Rueckfall. Wer nur das Frontend aendert, hat zwei Wahrheiten.
--
-- STRIPE
--   stripe_price_*_id bleiben hier ABSICHTLICH unangetastet. Preise werden in
--   Stripe nie geaendert, sondern neu angelegt; die neuen IDs kommen in einer
--   eigenen Migration nach, wenn sie im Dashboard existieren. Bis dahin zeigt
--   die App die neuen Preise und der Checkout die alten — deshalb gehoert
--   diese Migration und das Anlegen in Stripe in DENSELBEN Arbeitsgang.
-- ════════════════════════════════════════════════════════════════════════

-- ── A · Preise ──────────────────────────────────────────────────────────
-- Cent-Betraege, wie die Spalte es verlangt. 19,99 € = 1999.

UPDATE plans SET price_monthly_cents = 1999, price_yearly_cents = 19900,
                 updated_at = NOW()
 WHERE id = 'starter';

UPDATE plans SET price_monthly_cents = 3999, price_yearly_cents = 39900,
                 updated_at = NOW()
 WHERE id = 'investor';

UPDATE plans SET price_monthly_cents = 7999, price_yearly_cents = 79900,
                 updated_at = NOW()
 WHERE id = 'pro';

-- Der Partner-Plan existiert in `plans` nicht zwingend — er wird im
-- Frontend aus 'pro' geklont (reseller-portal.js). Falls er doch als Zeile
-- gefuehrt wird, zieht er mit; sonst passiert hier nichts.
UPDATE plans SET price_monthly_cents = 9900, price_yearly_cents = 99000,
                 updated_at = NOW()
 WHERE id = 'partner';

-- ── B · Die drei Kontingente ────────────────────────────────────────────
-- Ein Zaehler je Leistungsart statt eines Litertanks.
--   mpi       Stufe 1 · Marktpreisindikation
--   mpi_plus  Stufe 2 · Erweiterte Marktpreisindikation
--   wev       Stufe 3 · Wertermittlung nach ImmoWertV
--
-- Je Art zwei Werte: `used` ist der Verbrauch im laufenden Monat, `bank` das
-- Angesparte. Marcels Regel: nicht genutzte Abrufe verfallen NICHT — sie
-- wandern beim Monatswechsel in `bank`, gedeckelt auf das Dreifache des
-- Monatskontingents (`sparfaktor` in config.js).
--
-- Warum zwei Spalten und nicht eine: ein einzelner Zaehler koennte nicht
-- unterscheiden, ob ein Guthaben aus dem laufenden Monat stammt oder
-- angespart ist — und genau das entscheidet, ob der Deckel greift.

ALTER TABLE ai_credits_user
  ADD COLUMN IF NOT EXISTS mpi_used       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mpi_bank       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mpi_plus_used  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mpi_plus_bank  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wev_used       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wev_bank       INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN ai_credits_user.mpi_used      IS 'v1176: Verbrauch Marktpreisindikation im laufenden Monat';
COMMENT ON COLUMN ai_credits_user.mpi_bank      IS 'v1176: angesparte Marktpreisindikationen, verfallen nicht';
COMMENT ON COLUMN ai_credits_user.mpi_plus_used IS 'v1176: Verbrauch erweiterte Marktpreisindikation im laufenden Monat';
COMMENT ON COLUMN ai_credits_user.mpi_plus_bank IS 'v1176: angesparte erweiterte Marktpreisindikationen';
COMMENT ON COLUMN ai_credits_user.wev_used      IS 'v1176: Verbrauch Wertermittlung im laufenden Monat';
COMMENT ON COLUMN ai_credits_user.wev_bank      IS 'v1176: angesparte Wertermittlungen';

-- ── C · Die Restbestaende der Bestandsnutzer ────────────────────────────
-- Wer heute Bonus-Liter im Tank hat, verliert sie nicht. Umgerechnet wird
-- zum Preis der einfachsten Leistung (2 L je Marktpreisindikation) — das ist
-- die fuer den Nutzer guenstigste Auslegung und braucht keine Entscheidung
-- darueber, was er damit vorhatte.
--
-- Aufgerundet, nicht abgerundet: ein Rest von 1 L waere sonst verfallen, und
-- ein stiller Verlust ist schlimmer als ein halber Liter Grosszuegigkeit.

UPDATE ai_credits_user
   SET mpi_bank = mpi_bank + CEIL(bonus_credits / 2.0)::INTEGER,
       updated_at = NOW()
 WHERE bonus_credits > 0;

-- Die Liter bleiben stehen, bis der Zaehler umgestellt ist. Sie hier zu
-- nullen wuerde den laufenden Betrieb anhalten, bevor der Ersatz steht.
-- Das Nullen gehoert in die Migration, die den Zaehler umschaltet.
