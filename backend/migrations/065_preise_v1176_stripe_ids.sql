-- ════════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 065
-- v1176: die neuen Stripe-Preis-IDs zu den Preisen aus Migration 064
--
-- WARUM SIE GETRENNT VON 064 IST
--   064 setzt die Betraege — die gelten in jeder Umgebung gleich.
--   IDs gelten das NICHT: Staging rechnet gegen das Sandbox-Konto
--   (…KEjyPDo0wo…), Produktion gegen das Live-Konto (…GefFev8arz…).
--
-- DIE FALLE, DIE 061 GESTELLT HAT
--   061 hat die Partner-LIVE-IDs bedingungslos in jede DB geschrieben.
--   Ergebnis, heute gemessen: Staging laeuft mit sk_test, traegt beim
--   Partner aber price_1TtM0CGefFev8arz… (livemode:true). Ein Partner-
--   Checkout auf Staging kann so nicht funktionieren — Stripe kennt eine
--   Live-Preis-ID unter einem Test-Schluessel nicht.
--
--   Deshalb ist diese Migration an die UMGEBUNG gebunden statt an den
--   Zustand der einzelnen Zeile: sie greift nur, wenn die starter-Zeile
--   eine Sandbox-ID traegt. Genau dann ist es Staging. Auf Produktion
--   passiert hier NICHTS — die Live-Preise sind bewusst noch nicht
--   angelegt, das ist eine Geldentscheidung und gehoert Marcel.
--
-- ANGELEGT AM 2026-08-30 in acct_1TWXFqKEjyPDo0wo (Test)
--   Produkte wiederverwendet, Preise neu — Stripe-Preise werden nie
--   geaendert, immer neu angelegt. Die alten bleiben aktiv, damit
--   laufende Test-Abos nicht ins Leere zeigen.
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE ist_sandbox BOOLEAN;
BEGIN
  SELECT COALESCE(stripe_price_monthly_id, '') LIKE '%KEjyPDo0wo%'
    INTO ist_sandbox
    FROM public.plans WHERE id = 'starter';

  IF NOT COALESCE(ist_sandbox, FALSE) THEN
    RAISE NOTICE '065: kein Sandbox-Konto erkannt — Preis-IDs bleiben unberuehrt.';
    RETURN;
  END IF;

  UPDATE public.plans SET
    stripe_product_id       = 'prod_UVZEGHdNAurZqc',
    stripe_price_monthly_id = 'price_1UADtaKEjyPDo0woWc7P2BpP',
    stripe_price_yearly_id  = 'price_1UADteKEjyPDo0woJ4PSCR07',
    stripe_price_id_monthly = 'price_1UADtaKEjyPDo0woWc7P2BpP',
    stripe_price_id_yearly  = 'price_1UADteKEjyPDo0woJ4PSCR07',
    updated_at = now()
  WHERE id = 'starter';

  UPDATE public.plans SET
    stripe_product_id       = 'prod_UVZG7q4Hcnb81e',
    stripe_price_monthly_id = 'price_1UADtSKEjyPDo0wofNZrGqv7',
    stripe_price_yearly_id  = 'price_1UADtTKEjyPDo0wopW2KaUWB',
    stripe_price_id_monthly = 'price_1UADtSKEjyPDo0wofNZrGqv7',
    stripe_price_id_yearly  = 'price_1UADtTKEjyPDo0wopW2KaUWB',
    updated_at = now()
  WHERE id = 'investor';

  UPDATE public.plans SET
    stripe_product_id       = 'prod_UVZG7e1bPNMBgm',
    stripe_price_monthly_id = 'price_1UADtUKEjyPDo0woUb9HGnH9',
    stripe_price_yearly_id  = 'price_1UADtUKEjyPDo0wo9lIM0Jss',
    stripe_price_id_monthly = 'price_1UADtUKEjyPDo0woUb9HGnH9',
    stripe_price_id_yearly  = 'price_1UADtUKEjyPDo0wo9lIM0Jss',
    updated_at = now()
  WHERE id = 'pro';

  -- Holt zugleich den Fehltritt aus 061 zurueck: Live-ID raus, Test-ID rein.
  UPDATE public.plans SET
    stripe_product_id       = 'prod_UsCIoKVXP3UVWR',
    stripe_price_monthly_id = 'price_1UADtjKEjyPDo0wojizmUVQe',
    stripe_price_yearly_id  = 'price_1UADtnKEjyPDo0wos33wfja3',
    stripe_price_id_monthly = 'price_1UADtjKEjyPDo0wojizmUVQe',
    stripe_price_id_yearly  = 'price_1UADtnKEjyPDo0wos33wfja3',
    updated_at = now()
  WHERE id = 'partner';

  RAISE NOTICE '065: Sandbox erkannt — vier Plaene auf die v1176-Preis-IDs gesetzt.';
END $$;

-- ── Was NICHT hier steht, und warum ─────────────────────────────────────
-- Mandanten-Seat steht in der .env, nicht in `plans`:
--   STRIPE_PRICE_MANDANT_SEAT_MONTHLY=price_1UADttKEjyPDo0woyrz1dd2t
--   STRIPE_PRICE_MANDANT_SEAT_YEARLY =price_1UADtyKEjyPDo0woHp82HVWE
--   (Staffel 24 / 19 / 15 € je Seat, Volume, Grenzen bei 9 und 24)
--
-- Die Bewertungspakete und Einzelposten tragen lookup_keys — sie gehoeren
-- NICHT hartverdrahtet in eine Migration, sondern werden zur Laufzeit ueber
-- den Schluessel aufgeloest. Dann stimmt jede Umgebung von selbst:
--   dp_paket_kurz    7,90 €   ·  5 MPI ·  2 MPI+ · 0 WEV
--   dp_paket_mittel 19,90 €   · 10 MPI ·  5 MPI+ · 1 WEV
--   dp_paket_gross  39,90 €   · 15 MPI · 10 MPI+ · 3 WEV
--   dp_paket_max    69,90 €   · 25 MPI · 20 MPI+ · 6 WEV
--   dp_einzeln_mpi       0,90 €
--   dp_einzeln_mpi_plus  1,90 €
--   dp_einzeln_wev       3,90 €
--   dp_einzeln_avm_a     5,90 €
--   dp_einzeln_avm_b     9,90 €
