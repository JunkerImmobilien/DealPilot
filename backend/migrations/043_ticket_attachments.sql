-- 043: Anhaenge (Bilder) zu Support-Tickets. Dateien liegen auf Platte
-- unter /app/uploads/tickets/<ticket-id>/ (persistentes Volume backend_uploads).
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id  UUID,
  sender      VARCHAR(20) NOT NULL DEFAULT 'user',
  filename    VARCHAR(255) NOT NULL,
  mime        VARCHAR(120),
  size_bytes  INTEGER,
  path        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id, created_at);
