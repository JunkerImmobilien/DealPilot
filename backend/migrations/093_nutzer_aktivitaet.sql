-- 093_nutzer_aktivitaet.sql  ·  v3095
--
-- ONLINE-DAUER JE NUTZER UND TAG
--
-- Marcel am 03.11.2026: „die Online-Dauer der Nutzer auf jeden Fall. Das kannst du
-- umsetzen.“ Bis hierher gab es nur users.last_login_at (ein Zeitpunkt) und
-- audit_log-Zeitpunkte — keine Dauer.
--
-- Die App schickt bei sichtbarem Fenster und Aktivität in den letzten 5 Minuten
-- einmal pro Minute einen Puls (POST /api/v1/aktivitaet/puls). Gezählt wird der
-- Abstand zum vorigen Puls desselben Nutzers, höchstens 90 s; liegt er über 150 s,
-- beginnt eine neue Sitzung und der Abstand zählt nicht (Leerlauf, Fenster zu).
-- Zwei offene Tabs zählen deshalb nicht doppelt: jeder Puls misst nur den Abstand
-- zum letzten Puls irgendeines Tabs.
--
-- Gespeichert wird nur die Summe je Tag, keine Seiten, keine Klicks, keine IP.
-- Aufbewahrung 400 Tage (Löschung im Puls-Endpunkt, routes/aktivitaet.js).

CREATE TABLE IF NOT EXISTS nutzer_aktivitaet (
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag           DATE        NOT NULL,              -- Kalendertag Europe/Berlin
  sekunden      INTEGER     NOT NULL DEFAULT 0,    -- aktive Zeit an diesem Tag
  sitzungen     INTEGER     NOT NULL DEFAULT 0,    -- Beginn nach > 150 s Pause
  erster_puls   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  letzter_puls  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_nutzer_aktivitaet_tag ON nutzer_aktivitaet (tag);
