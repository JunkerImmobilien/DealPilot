-- 125_vivi.sql  ·  v3950 (ViVi-Anbindung, Pakete V1 bis V3, Marcel 22.11.2026)
--
-- Bauplan: Dateien/Architektur/ViVi-Anbindung-2026-11-22.md, Spezifikation Dateien/Architektur/vivi/vivi-openapi-v1.json
-- (ViVi API v1.5.0). Marcels Regeln: ein Objekt wird GENAU EINMAL in ViVi angelegt, danach wird nur gelesen.
-- Kein laufender Wert geht zurueck. Der Token liegt NICHT hier, sondern verschluesselt in
-- user_provider_credentials (Migration 034, Anbieter 'vivi', services/credentialVault.js).
--
-- vivi_verknuepfung  eine Zeile je DealPilot-Objekt. Sie ist zugleich die SPERRE gegen ein zweites Anlegen:
--                    services/vivi/viviAnlegen.js beansprucht die Zeile atomar (INSERT ... ON CONFLICT DO NOTHING
--                    bzw. UPDATE nur aus 'abgebrochen'). vivi_objekt_id ist NULL, solange das Objekt bei ViVi noch
--                    nicht angelegt ist (Abbruch vor dem ersten POST). vivi_ids haelt jede Antwort-ID sofort fest
--                    (projekt, einheiten, mietverhaeltnisse, darlehen), damit ein Fortsetzen nichts doppelt anlegt.
-- vivi_werte         zuletzt gelesene ViVi-Werte je DealPilot-Feld (und Steuerjahr, 0 = keins). Quelle fuer Sperre,
--                    Hinweis und spaeter den Abgleich mit Unterlagen (Paket V5).
-- vivi_protokoll     je Anlage, Abruf und Probeabruf: Anzahl Anfragen, 429, Dauer, Fehler. NIE der Token.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.vivi_verknuepfung (
  object_id        uuid PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vivi_objekt_id   text,
  vivi_account_id  text,
  vivi_ids         jsonb NOT NULL DEFAULT '{}'::jsonb,
  herkunft         text NOT NULL DEFAULT 'angelegt' CHECK (herkunft IN ('angelegt','zugeordnet')),
  anlage_status    text NOT NULL DEFAULT 'laeuft' CHECK (anlage_status IN ('laeuft','fertig','abgebrochen')),
  angelegt_am      timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am  timestamptz NOT NULL DEFAULT now(),
  letzter_abruf    timestamptz,
  letzter_fehler   text,
  UNIQUE (user_id, vivi_objekt_id)
);
CREATE INDEX IF NOT EXISTS vivi_verknuepfung_user_idx ON public.vivi_verknuepfung (user_id);

CREATE TABLE IF NOT EXISTS public.vivi_werte (
  object_id    uuid NOT NULL REFERENCES public.vivi_verknuepfung(object_id) ON DELETE CASCADE,
  feld         text NOT NULL,
  jahr         integer NOT NULL DEFAULT 0,
  wert         jsonb NOT NULL,
  vivi_quelle  text,
  vivi_stand   timestamptz,
  gelesen_am   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (object_id, feld, jahr)
);

CREATE TABLE IF NOT EXISTS public.vivi_protokoll (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  object_id    uuid,
  art          text NOT NULL CHECK (art IN ('probe','anlegen','abruf','takt')),
  anfragen     integer NOT NULL DEFAULT 0,
  bremse_429   boolean NOT NULL DEFAULT false,
  ok           boolean NOT NULL DEFAULT true,
  fehler       text,
  dauer_ms     integer,
  erstellt_am  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vivi_protokoll_user_idx ON public.vivi_protokoll (user_id, erstellt_am DESC);
