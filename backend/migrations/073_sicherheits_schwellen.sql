-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 073
-- v1371 (B17): Die Schwellen gehoeren dem Betreiber, nicht dem Code
--
-- Marcels Punkt B17: "Konfigurationsbereich im Admin fuer alle Schwellen."
--
-- Bis hierher standen sie als Konstante in securityEventService.js. Das
-- war fuer den Anfang richtig - man kann nichts einstellen, was man noch
-- nicht gemessen hat. Jetzt gibt es Messwerte, und damit gehoert die
-- Entscheidung dorthin, wo sie hingehoert.
--
-- EINE ZEILE, KEINE TABELLE MIT ZEILEN JE SCHWELLE. Die Schwellen sind
-- ein zusammenhaengendes Modell: wer die Warnstufe verschiebt, muss die
-- Stufe darueber mitdenken. Einzeln editierbar zu machen lueede dazu ein,
-- sie einzeln zu aendern - und dann steht 'warnung' ueber 'hohes_risiko'.
--
-- DIE VORGABEWERTE SIND DIE GEMESSENEN. Sie stammen aus dem Lauf vom
-- 13.09.2026: echte Nutzung trifft 12 Endpunktgruppen bei einem
-- Variationskoeffizienten von 5,13. Wer sie aendert, sollte eine eigene
-- Messung haben - deshalb steht der Ursprung in der Tabelle.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_config (
    id              INTEGER PRIMARY KEY DEFAULT 1,

    -- Die drei berechenbaren Stufen. Jede verlangt Menge UND Muster.
    warnung_ab          INTEGER NOT NULL DEFAULT 20,
    warnung_vielfalt    INTEGER NOT NULL DEFAULT 3,
    warnung_streuung    NUMERIC(5,2) NOT NULL DEFAULT 1.5,

    hoch_ab             INTEGER NOT NULL DEFAULT 50,
    hoch_vielfalt       INTEGER NOT NULL DEFAULT 2,
    hoch_streuung       NUMERIC(5,2) NOT NULL DEFAULT 1.0,

    auffaellig_ab       INTEGER NOT NULL DEFAULT 5,

    -- Das Limit selbst
    limit_konto         INTEGER NOT NULL DEFAULT 600,
    limit_anonym        INTEGER NOT NULL DEFAULT 100,

    -- Benachrichtigung
    alert_ruhe_minuten  INTEGER NOT NULL DEFAULT 360,

    -- Wer hat zuletzt daran gedreht, und warum?
    geaendert_von       TEXT,
    geaendert_am        TIMESTAMPTZ,
    notiz               TEXT,

    CONSTRAINT security_config_einzeilig CHECK (id = 1),
    -- Die Stufen muessen aufeinander aufbauen. Ohne diese Pruefung koennte
    -- jemand 'warnung' ueber 'hohes Risiko' setzen, und dann waere die
    -- hoechste Stufe unerreichbar.
    CONSTRAINT security_config_reihenfolge CHECK (
        auffaellig_ab <= warnung_ab AND warnung_ab <= hoch_ab
        AND hoch_vielfalt <= warnung_vielfalt
        AND hoch_streuung <= warnung_streuung
    )
);

INSERT INTO security_config (id, notiz)
VALUES (1, 'Vorgabewerte aus der Messung vom 13.09.2026: echte Nutzung trifft '
           '12 Endpunktgruppen bei Variationskoeffizient 5,13.')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE security_config IS
    'v1371 (B17) - eine Zeile. Die Schwellen sind ein zusammenhaengendes Modell; '
    'wer eine verschiebt, muss die naechste mitdenken. Der CHECK erzwingt das.';
