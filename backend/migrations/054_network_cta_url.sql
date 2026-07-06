-- v871: Karten-CTA kann auf eine Partner-Seite verlinken (Lead wird per Klick gezaehlt)
ALTER TABLE network_cards ADD COLUMN IF NOT EXISTS cta_url TEXT;
