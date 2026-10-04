-- 082_telegram_einwilligung.sql  ·  v1827
--
-- DIE EINWILLIGUNG, DIE MAN NACHWEISEN KANN
--
-- Seit v1826 nennt die Datenschutzerklaerung den Telegram-Bot in einem
-- eigenen Abschnitt 9. Sie stuetzt die Uebermittlung an Telegram auf
-- Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) und den Drittland-Transfer in
-- die VAE auf Art. 49 Abs. 1 lit. a (ausdrueckliche Einwilligung).
--
-- GEMESSEN am 04.10.2026: eine solche Einwilligung wurde nirgends erhoben.
-- Wer `PUT /bot` aufruft, bekam seinen Webhook, fertig. Der Text behauptete
-- also eine Rechtsgrundlage, die es nicht gab.
--
--   > Art. 7 Abs. 1 DSGVO: der Verantwortliche muss NACHWEISEN koennen,
--   > dass eingewilligt wurde. Eine Einwilligung, die nirgends steht,
--   > ist im Streitfall keine.
--
-- Deshalb zwei Spalten an dem Datensatz, der ohnehin genau so lange lebt
-- wie die Funktion:
--
--   einwilligung_am       WANN  — Zeitpunkt
--   einwilligung_fassung  WOZU  — die Fassung der Erklaerung, die dabei
--                                 am Bildschirm stand ("1.1")
--
-- Die Fassung ist der eigentliche Punkt. Ein blosses Datum beantwortet
-- nicht, WORIN eingewilligt wurde: aendert sich der Text, ist die alte
-- Zustimmung fuer die neuen Punkte keine. Mit der Fassung laesst sich das
-- auseinanderhalten, ohne jeden Nutzer erneut zu fragen.
--
-- WAS DIESE MIGRATION BEWUSST NICHT TUT: sie traegt fuer bestehende
-- Verbindungen nichts nach. NULL heisst "nicht erhoben", und das ist die
-- Wahrheit — ein Default `now()` wuerde eine Zustimmung erfinden, die
-- niemand gegeben hat. Das Panel fragt beim naechsten Verbinden.
--
-- UND: beim `DELETE /bot` faellt die Zeile und damit der Nachweis. Das ist
-- hier richtig, weil mit dem Widerruf auch alles geloescht wird, wofuer er
-- zu fuehren waere — es bleibt keine Verarbeitung uebrig, deren
-- Rechtmaessigkeit zu belegen waere.

ALTER TABLE telegram_bots
  ADD COLUMN IF NOT EXISTS einwilligung_am      timestamptz,
  ADD COLUMN IF NOT EXISTS einwilligung_fassung text;

COMMENT ON COLUMN telegram_bots.einwilligung_am IS
  'v1827 · Zeitpunkt der Einwilligung nach Art. 6 Abs. 1 lit. a und '
  'Art. 49 Abs. 1 lit. a DSGVO. NULL = nicht erhoben (Altbestand vor '
  'v1827); wird beim naechsten Verbinden nachgeholt, nie vorausgesetzt.';

COMMENT ON COLUMN telegram_bots.einwilligung_fassung IS
  'v1827 · Fassung der Datenschutzerklaerung, die dabei galt ("1.1"). '
  'Ohne sie sagt das Datum nicht, WORIN eingewilligt wurde.';
