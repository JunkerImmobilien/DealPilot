-- 096_dateien.sql  ·  v3162
--
-- UNTERLAGEN-ABLAGE AUF DEM EIGENEN SERVER (Marcel 03.11.2026: „können wir auch auf unserem Server speichern
-- um erstmal weiter zu machen … Struktur Ordner mit Unterordnern möglich?“ — Grenzen je Plan: Vorschlag
-- übernommen: Free 100 MB · Starter 500 MB · Investor 2 GB · Pro 10 GB · Partner 25 GB, Datei ≤ 25 MB).
--
--   ordner            Pfad im Objekt, „/“-getrennt, z. B. „Mietverträge/Whg. 1“ oder „Rechnungen/2026“
--   ablage_schluessel Datei auf dem Laufwerk (backend_uploads), AES-256-GCM verschlüsselt
--   sha256            Prüfsumme des Klartexts (Doppelte erkennen, Unversehrtheit prüfen)
--   quelle            'upload' | 'eingang' | 'beleg' | 'api'
--   deleted_at        gelöscht (Datei wird beim Löschen sofort vom Laufwerk entfernt)

CREATE TABLE IF NOT EXISTS dateien (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_id          UUID NULL REFERENCES objects(id) ON DELETE SET NULL,
  ordner             TEXT NOT NULL DEFAULT '',
  name               TEXT NOT NULL,
  mime               TEXT,
  groesse            BIGINT NOT NULL,
  sha256             TEXT NOT NULL,
  ablage_schluessel  TEXT NOT NULL,
  quelle             TEXT,
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS dateien_user_objekt ON dateien (user_id, object_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS dateien_user_sha ON dateien (user_id, sha256) WHERE deleted_at IS NULL;
