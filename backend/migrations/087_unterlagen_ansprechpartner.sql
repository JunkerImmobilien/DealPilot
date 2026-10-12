-- 087 · Ansprechpartner je Amt (v2152, 12.10.2026)
--
-- Marcel am 12.10.2026: "ja mach die ansprechpartner gleich mit". Vorlage ist
-- `unterlagen-app-v6-ansprechpartner`, Backlog N51 Schritt 2 bis 5.
--
-- WARUM EINE EIGENE SPALTE UND NICHT `seiten`
--
-- Das Backlog hielt in N51 fest: "Offen bleibt die Form: eine eigene Spalte
-- `ansprechpartner` waere sauberer als eine Liste in einer Spalte namens
-- `seiten`." Das gilt. `seiten` traegt seit v2151 den BELEG je Seite
-- (`{liste, pro_seite, alternativen, beleg_quelle}`) -- Personen dort
-- hineinzulegen waere genau die Vermischung, die spaeter niemand mehr
-- auseinandersortiert.
--
-- Die Vorlage v6 macht es in SQLite mit
--   db.exec("ALTER TABLE behoerden ADD COLUMN ansprechpartner TEXT DEFAULT '[]'")
-- in einem try/catch. Wir haben Postgres und `schema_migrations`, also
-- gehoert es hierher und nicht in den Anwendungsstart.
--
-- UNBEDENKLICH FUER DEN ALTBESTAND
--
-- Am 11.10.2026 hat v2136 gezeigt, was eine Migration anrichten kann, die
-- eine BEDINGUNG einfuehrt: `email_verified_at` wurde zur Zugangsbedingung
-- und sperrte alle vier Staging-Konten aus, weil der Altbestand den Stempel
-- nicht trug (nachgetragen in 086).
--
-- Diese hier fuehrt keine Bedingung ein. Eine neue Spalte mit DEFAULT '[]'
-- ist fuer jeden bestehenden Satz sofort gueltig: eine leere Liste heisst
-- "noch keine Person ermittelt", und genau das ist fuer alle Altsaetze wahr.
-- Kein Satz wird dadurch unbrauchbar, keine Abfrage bricht.
--
-- FORM JE EINTRAG (hoechstens zwei, in der Reihenfolge der Quellseite):
--   {
--     "name":     "",        -- nur wenn die Seite ihn nennt
--     "funktion": "",        -- Amtsbezeichnung oder Sachgebiet
--     "email":    "",        -- nur wenn sie dort WOERTLICH steht
--     "telefon":  "",
--     "bestaetigt": true,    -- die Adresse wurde auf einer gelesenen Seite gefunden
--     "kopie":    false      -- vom Nutzer angehakt: geht ins CC
--   }
--
-- `bestaetigt` ist der Kern. Ohne diese Angabe waere "Ansprechpartner 1" eine
-- Behauptung -- v5 wusste nur, ob eine Adresse irgendwo stand, v6 weiss auf
-- WELCHER Seite. Die Zuordnung liegt seit v2151 in `seiten.pro_seite`.

ALTER TABLE unterlagen_aemter
  ADD COLUMN IF NOT EXISTS ansprechpartner jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN unterlagen_aemter.ansprechpartner IS
  'v2152 · Hoechstens zwei Ansprechpersonen je Amt, in der Reihenfolge der '
  'Quellseite. Je Eintrag: name, funktion, email, telefon, bestaetigt, kopie. '
  'bestaetigt=true heisst: die Adresse wurde auf einer von uns SELBST '
  'gelesenen amtlichen Seite gefunden (siehe seiten.pro_seite). Eine leere '
  'Liste heisst "keine Person ermittelt" - nie "keine vorhanden".';
