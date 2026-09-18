-- ══════════════════════════════════════════════════════════════════════
-- DEALPILOT BACKEND — Migration 074
-- v1375 (A5): Der Datenraum überlebt den Gerätewechsel
--
-- Befund aus dem Audit (A5, 13.09.2026): die Datenraum-Verknüpfungen
-- liegen ausschließlich im localStorage unter `dp_datenraum_v141`. Wer
-- den Browser wechselt, das Profil löscht oder am Laptop statt am
-- Rechner arbeitet, hat ALLE Ordner-Links verloren.
--
-- Das ist bei einem Bereich, aus dem Bank-Anfragen verschickt werden,
-- kein Schönheitsfehler: der Link im Anschreiben ist genau das, was die
-- Bank anklickt.
--
-- WARUM EINE ALLGEMEINE TABELLE UND NICHT `users.datenraum`:
-- Der Datenraum ist nicht die einzige Einstellung, die im Browser liegt
-- und dort nicht hingehört. Eine Spalte je Fall würde `users` mit der
-- Zeit zur Sammelstelle machen. Hier steht ein Schlüssel und ein
-- JSON-Wert; wer die nächste Einstellung verlagert, braucht keine
-- Migration mehr.
--
-- WAS HIER NICHT HINEINGEHÖRT: nichts, was der Server auswerten muss.
-- Diese Tabelle ist eine Ablage für den Client, nicht eine Datenquelle
-- für Berechnungen. Sobald etwas serverseitig gerechnet werden soll,
-- gehört es in eine eigene, typisierte Tabelle.
--
-- ZUR DATENSPARSAMKEIT: gespeichert werden nur die URLs, die der Nutzer
-- selbst einträgt. DealPilot ruft sie nicht ab und liest keine Inhalte -
-- so steht es auch in der Beschreibung im Datenraum-Reiter.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_settings (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schluessel  TEXT NOT NULL,
    wert        JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, schluessel)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

COMMENT ON TABLE user_settings IS
    'v1375 - Ablage fuer Einstellungen, die einen Geraetewechsel ueberleben muessen. '
    'Client-Daten, keine Berechnungsgrundlage. Wer etwas serverseitig rechnen will, '
    'braucht eine eigene typisierte Tabelle.';
COMMENT ON COLUMN user_settings.schluessel IS
    'z. B. "datenraum". Ein Schluessel je Sachgebiet, nicht je Feld.';
