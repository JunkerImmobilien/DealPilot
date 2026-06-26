-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 038
-- Rechnungs-Archiv: speichert Stripe-Rechnungen (Metadaten + PDF) lokal,
-- damit Marcel sie für die Buchhaltung griffbereit hat (Liste, Download, CSV-Export).
-- PDF als BYTEA (persistiert im Postgres-Volume + pg_dump-Backup; kein Dateisystem-Volume nötig).
-- §19 UStG: Stripe erzeugt die Rechnungen ohne USt-Ausweis. Beim UG-Wechsel übernimmt Stripe
-- den USt-Ausweis automatisch — diese Tabelle bleibt unverändert (provider-agnostisch).
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_invoice_id VARCHAR(100) UNIQUE,
  stripe_customer_id VARCHAR(100),
  invoice_number VARCHAR(100),
  amount_total INTEGER,                 -- in Cent
  currency VARCHAR(10) DEFAULT 'eur',
  status VARCHAR(40),
  hosted_invoice_url TEXT,
  pdf_data BYTEA,                       -- die Rechnungs-PDF (kann NULL sein, falls Download scheiterte)
  invoice_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);
