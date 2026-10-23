-- 091_support_einstufung.sql  ·  v2935
--
-- SUPPORT: KI-EINSTUFUNG, FEHLER-BACKLOG, RUECKFRAGE-ENTWURF
--
-- Marcel am 23.10.2026: "Wir nehmen ein Backlog auf fuer Fehler. Wenn die
-- Beschreibung genau genug ist, schreiben wir das in ein Fehler-Backlog und
-- ein Agent arbeitet diese Punkte ab, wenn ich danach frage. Wenn die Antwort
-- nicht reicht, schreiben wir dem Kunden eine Mail im DealPilot-Design und
-- fragen nach. Bilder werden natuerlich auch abgelegt."
--
-- Das Fehler-Backlog liegt bewusst HIER und nicht als Datei im Repo: Kundentexte
-- und Bilder enthalten Namen und Anschriften, das Repo liegt bei GitHub. Ins
-- Repo kommt hoechstens die anonymisierte Beschreibung (fehler_beschreibung).
--
-- einstufung           JSONB  Antwort der KI (art, genau_genug, fehlt, prioritaet ...)
-- fehler_backlog       TEXT   NULL | offen | in_arbeit | erledigt | kein_fehler
-- fehler_titel         TEXT   kurz, ohne Namen
-- fehler_beschreibung  TEXT   Schritte / erwartet / tatsaechlich, anonymisiert
-- rueckfrage_entwurf   TEXT   Text der Rueckfrage, wartet auf Freigabe im Admin
-- rueckfrage_status    TEXT   NULL | entwurf | gesendet | verworfen
-- diagnose             JSONB  App-Version, Seite, Browser aus dem Formular

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS einstufung JSONB;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS einstufung_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS fehler_backlog TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS fehler_titel TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS fehler_beschreibung TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS fehler_erledigt_commit TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS rueckfrage_entwurf TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS rueckfrage_status TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS diagnose JSONB;
CREATE INDEX IF NOT EXISTS support_tickets_backlog_idx ON support_tickets (fehler_backlog, created_at) WHERE fehler_backlog IS NOT NULL;
