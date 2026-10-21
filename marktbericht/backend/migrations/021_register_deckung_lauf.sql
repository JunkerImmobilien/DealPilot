-- 021_register_deckung_lauf.sql — v2591 · Verlauf der Registerdeckung
--
-- Die Admin-Ansicht „Register & Ernte" zeigt, wie viele Werte und Sperren
-- das Register je Land und Kennzahl fuehrt. Ohne Verlauf ist das eine
-- Momentaufnahme: ob die Ernte vorankommt, sieht man erst, wenn man die
-- Zahl von letztem Monat daneben hat.
--
-- Je Tag eine Zeile, geschrieben beim ersten Aufruf von /register/deckung
-- (ON CONFLICT DO NOTHING). `daten` traegt nur die Kopfzahlen und die
-- Zellen Werte/Sperren — keine Saetze, keine Objektdaten, kein Nutzerbezug.
-- Eine NEUE Tabelle; keine bestehende wird angefasst.

CREATE TABLE IF NOT EXISTS mb.register_deckung_lauf (
  gemessen_am  DATE        PRIMARY KEY,
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  daten        JSONB       NOT NULL
);

COMMENT ON TABLE mb.register_deckung_lauf IS
  'v2591 · Tagesschnappschuss der Registerdeckung (Admin „Register & Ernte"). Je Tag eine Zeile.';
