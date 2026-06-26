-- 044_mail_layouts.sql — Massenmail-Layouts + Text-Bausteine speichern/laden (v794)
CREATE TABLE IF NOT EXISTS mail_layouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(160) NOT NULL,
  kind         VARCHAR(20)  NOT NULL DEFAULT 'layout',  -- 'layout' (HTML) | 'snippet' (Text-Baustein)
  subject      VARCHAR(255),
  body_html    TEXT,                                    -- ganzes Layout-HTML
  body_text    TEXT,                                    -- Text-Baustein / Plain-Body
  created_by   VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mail_layouts_kind ON mail_layouts(kind, created_at DESC);
