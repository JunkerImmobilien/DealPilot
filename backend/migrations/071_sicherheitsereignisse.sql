-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 071
-- v1367: Sicherheitsereignisse bekommen eine Ablage
--
-- Punkt B3 und B10 aus Marcels Schutz-Lastenheft. B3 verlangt
-- Anomalie-Erkennung je Account, B10 ein "Audit Trail, append-only, nicht
-- ueber das Admin-Interface editierbar".
--
-- WARUM UEBERHAUPT EINE TABELLE: seit v1366 wird jede
-- Limit-Ueberschreitung protokolliert - aber nur mit console.warn ins
-- Container-Log. Das ist fluechtig (weg beim naechsten Rebuild), nicht
-- durchsuchbar und nicht auswertbar. Ein Muster ueber Tage erkennt man
-- darin nicht.
--
-- APPEND-ONLY IST HIER ERNST GEMEINT. Es gibt bewusst KEINE
-- updated_at-Spalte und keinen Weg im Code, eine Zeile zu aendern. Wer
-- einen Fall bearbeitet, schreibt ein NEUES Ereignis dagegen - die
-- Bearbeitungsspuren stehen damit in derselben Chronologie wie das, was
-- sie bewerten. Marcels Auflage: "Audit Trail, append-only, nicht ueber
-- das Admin-Interface editierbar."
--
-- WAS HIER NICHT STEHT, UND WARUM:
--   - kein Risikoscore. Marcel ausdruecklich: "Eine technische
--     Auffaelligkeit oder ein automatisch erzeugter Risikoscore darf NICHT
--     automatisch als rechtlich bewiesener Vertragsverstoss behandelt
--     werden." Diese Tabelle sammelt BEOBACHTUNGEN. Die Bewertung ist ein
--     zweiter, spaeterer Schritt - und sie gehoert einem Menschen.
--   - keine Inhalte. Gespeichert wird, WELCHER Endpunkt wie oft getroffen
--     wurde, nicht WAS uebertragen wurde. Marcels Auflage: "Keine
--     unnoetige Ueberwachung des Endgeraets und keine heimliche
--     Ausspaehung."
--   - kein User-Agent, kein Fingerabdruck des Geraets. Aus demselben
--     Grund.
--
-- Die IP steht drin, weil sie bei anonymen Zugriffen die einzige
-- Zuordnung ist - aber bei eingeloggten Nutzern bleibt sie leer, dort
-- genuegt das Konto. Sie faellt mit der Aufbewahrungsfrist weg (siehe
-- retention unten).
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_events (
    id              BIGSERIAL PRIMARY KEY,

    -- WER. Genau eines von beiden ist gesetzt.
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_key          TEXT,                       -- nur wenn kein Konto bekannt

    -- WAS. Freier, aber kurzer Schluessel: 'rate_limit', 'auth_fail', ...
    art             TEXT NOT NULL,

    -- WIE SCHWER. Bewusst nur eine grobe Stufe, KEIN Score.
    -- 'hinweis'   - faellt auf, mehr nicht
    -- 'auffaellig'- wiederholt oder ungewoehnlich
    -- 'ernst'     - Limit deutlich ueberschritten, mehrfach
    stufe           TEXT NOT NULL DEFAULT 'hinweis'
                    CHECK (stufe IN ('hinweis','auffaellig','ernst')),

    -- WO. Pfad ohne Parameter, damit keine Inhalte mitlaufen.
    pfad            TEXT,
    methode         TEXT,

    -- ZUSATZ. Zahlen und Zaehler, keine Nutzdaten.
    detail          JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Die drei Fragen, die ein Sicherheitsbereich stellt:
--   "was war bei diesem Konto?"   "was war heute?"   "was war ernst?"
CREATE INDEX IF NOT EXISTS idx_sec_events_user  ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_zeit  ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_stufe ON security_events(stufe, created_at DESC)
    WHERE stufe <> 'hinweis';

-- Der IP-Schluessel wird nur fuer anonyme Zugriffe gebraucht und nur kurz.
CREATE INDEX IF NOT EXISTS idx_sec_events_ip ON security_events(ip_key, created_at DESC)
    WHERE ip_key IS NOT NULL;

COMMENT ON TABLE  security_events IS
    'v1367 - Beobachtungen, keine Urteile. Append-only: Zeilen werden nie geaendert, '
    'Korrekturen sind neue Zeilen. Enthaelt bewusst keine Inhalte und keinen Risikoscore.';
COMMENT ON COLUMN security_events.stufe IS
    'Grobe Einordnung, KEIN Score. Eine technische Auffaelligkeit ist kein bewiesener Verstoss.';
COMMENT ON COLUMN security_events.detail IS
    'Nur Zahlen und Zaehler - nie uebertragene Inhalte.';
