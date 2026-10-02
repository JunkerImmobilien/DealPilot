-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 078
-- v1793: Der Portfolio-Spiegel — EIN Rechenkern, zwei Leser
--
-- ── DAS PROBLEM, UND WARUM MARCELS VORSCHLAG ES LOEST ─────────────────
--
-- Der Telegram-Bot soll Portfolio-Fragen beantworten ("wie ist meine
-- Vermoegensbilanz, wo stehe ich in zehn Jahren"). Gerechnet wird das
-- heute AUSSCHLIESSLICH im Browser:
--
--   dashboard.js:456   aggStats()      die Aggregat-Quelle
--   dashboard.js:704   projectAll(n)   Jahr fuer Jahr Restschuld/Wert/EK
--   dashboard.js:2459  portfolioPayload()  liest beide, rechnet NICHTS nach
--
-- Einen Backend-Weg dorthin gibt es nicht. Die naheliegende Loesung waere,
-- das im Backend nachzubauen — und das ist genau die verbotene:
--
--   > "Rechenkerne — nie duplizieren" (CLAUDE.md)
--
-- Was dabei herauskommt, ist gemessen: `projectAll` rechnete JAHRELANG in
-- Cent, Faktor 100, in Tabelle UND Charts. Aufgefallen ist es erst, als
-- der Portfolio-Pilot dieselbe Groesse aus einer zweiten Quelle daneben
-- stellte. Eine zweite Vermoegensbilanz waere derselbe Fehler noch einmal.
--
-- Marcel am 02.10.2026: "ich moechte eigentlich die komplette Auskunft
-- haben und du sollst das auch nicht doppelt bauen. Ich wuerde
-- vorschlagen, dass wir die Werte dann mit in die Datenbank schreiben,
-- beim Portfolio."
--
-- Das ist der Ausweg, und er ist der richtige: der Browser bleibt der
-- EINZIGE Rechenkern und legt sein Ergebnis hier ab. Der Bot liest einen
-- Spiegel, keine zweite Rechnung.
--
--   > Ein Spiegel darf nie selbst rechnen. Sobald er es tut, ist er eine
--   > zweite Quelle — und zwei Quellen derselben Zahl weichen irgendwann
--   > voneinander ab, ohne dass jemand es merkt.
--
-- ── WAS DAS KOSTET, UND WARUM ES TROTZDEM STIMMT ──────────────────────
--
-- Ein Spiegel ist nur so frisch wie der letzte Besuch im Browser. Wer vier
-- Wochen nicht eingeloggt war, bekaeme vier Wochen alte Zahlen.
--
-- Deshalb traegt JEDE Antwort des Bots den Stand mit. `erfasst_am` ist
-- nicht Buchhaltung, sondern Teil der Auskunft:
--
--   "Stand: heute 09:14" / "Stand: 12.09.2026 — seitdem warst du nicht
--    mehr in DealPilot, die Zahlen koennen veraltet sein."
--
-- Das ist dieselbe Doktrin wie im Marktbericht: jede Zahl traegt ihre
-- Herkunft. Eine Zahl ohne Stand behauptet, aktuell zu sein.
--
-- ── WARUM EIN JSONB UND KEINE SPALTEN ─────────────────────────────────
--
-- `portfolioPayload()` ist bereits die abgestimmte Schnittstelle zum
-- Co-Piloten (dashboard.js:2459 ff., 22 Kernfelder je Objekt, Deckel bei
-- 60 Objekten). Sie in Spalten zu zerlegen hiesse, ihre Struktur ein
-- zweites Mal zu pflegen — und beim naechsten neuen Feld eine Migration zu
-- brauchen. Der Bot bekommt genau das, was der Co-Pilot im Browser
-- bekommt. Dieselbe Form, dieselben Zahlen.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portfolio_spiegel (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Das Ergebnis von portfolioPayload(), unveraendert.
  payload      JSONB NOT NULL,

  -- Wann der Browser das gerechnet hat. GEHOERT IN JEDE AUSKUNFT.
  erfasst_am   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Womit. Weicht die Fassung spaeter ab, laesst sich erkennen, dass ein
  -- alter Spiegel von einem alten Rechenstand stammt.
  app_version  TEXT,

  -- Zwei Kennzahlen aus dem payload herausgezogen, damit eine Uebersicht
  -- ueber viele Nutzer nicht jedes JSONB auspacken muss. SIE SIND KOPIEN,
  -- keine zweite Wahrheit: wer rechnet, liest den payload.
  anzahl_objekte INTEGER,
  gesamtinvestition_eur NUMERIC
);

COMMENT ON TABLE portfolio_spiegel IS
  'Spiegel von dashboard.js portfolioPayload() (v1793). Gerechnet wird NUR im '
  'Browser; diese Tabelle rechnet nie selbst. erfasst_am gehoert in jede Auskunft.';

CREATE INDEX IF NOT EXISTS portfolio_spiegel_alter_idx
  ON portfolio_spiegel (erfasst_am);
