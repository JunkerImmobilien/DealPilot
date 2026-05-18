-- V200: Reseller-Anfragen
-- 2026-05-17

BEGIN;

CREATE TABLE IF NOT EXISTS reseller_inquiries (
  id              bigserial PRIMARY KEY,
  contact_name    text NOT NULL,
  company         text,
  email           text NOT NULL,
  phone           text,
  website         text,
  team_size       text,             -- Auswahl: solo/2-5/6-20/21+
  target_market   text,             -- Privat/Gewerbe/beides
  current_volume  text,             -- Geschätzte Objekte/Jahr
  goals           text,             -- Freitext "Was wollt ihr erreichen?"
  message         text,             -- Zusätzliche Nachricht
  status          text NOT NULL DEFAULT 'new',  -- new / contacted / qualified / converted / declined
  admin_notes     text,
  source          text,             -- z.B. "landing", "footer", "direct"
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  contacted_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_inquiries_status ON reseller_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_inquiries_email ON reseller_inquiries(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_reseller_inquiries_created ON reseller_inquiries(created_at DESC);

COMMENT ON TABLE reseller_inquiries IS
  'V200: Anfragen von potentiellen Wiederverkäufern / White-Label-Partnern';
COMMENT ON COLUMN reseller_inquiries.status IS
  'new = neu eingegangen, contacted = wir haben uns gemeldet, qualified = passt, converted = abgeschlossen, declined = abgelehnt';

COMMIT;
