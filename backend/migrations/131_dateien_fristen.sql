-- 131_dateien_fristen.sql  ·  v4860
--
-- DOKUMENTENABLAGE: Löschfrist nach Vertragsende (Marcel 25.11.2026). Hat ein Konto Dateien in der Ablage, aber
-- keinen Plan mehr mit Ablage (Kündigung, Downgrade auf Free), merkt der Takt „ablageFristen“ hier die Frist
-- (90 Tage) und den Versand der Hinweis-Mail. Lesen bleibt bis zur Frist möglich, danach werden die Dateien
-- gelöscht. Kommt wieder ein Plan mit Ablage, fällt die Zeile weg.

CREATE TABLE IF NOT EXISTS dateien_fristen (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  erkannt_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frist_am    TIMESTAMPTZ NOT NULL,
  mail_am     TIMESTAMPTZ NULL
);
