-- ════════════════════════════════════════════════════
-- DEALPILOT BACKEND - Migration 039
-- Support-Ticketsystem + Kundenzufriedenheit.
-- Support-Anfragen -> Tickets (mit Thread). Feedback -> Zufriedenheits-Auswertung.
-- E-Mail-Versand (an support@ / feedback@) bleibt als Benachrichtigung erhalten;
-- diese Tabellen sind die persistente Ablage + Admin-Bearbeitung.
-- ════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_email VARCHAR(255),
  category VARCHAR(50),
  subject VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'new',   -- new | open | waiting | closed
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_activity ON support_tickets(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender VARCHAR(20) NOT NULL,                 -- 'user' | 'admin'
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS feedback_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_email VARCHAR(255),
  overall_rating INTEGER,
  criteria JSONB,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_entries(created_at DESC);
