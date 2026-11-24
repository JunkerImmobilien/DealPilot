-- 129_grafiken_neu_fuer_alle.sql  ·  v4360
--
-- Marcel 24.11.2026: die Vorschau grafiken_neu für ALLE Kunden freigeben (neue Grafiken der
-- Pilot-Analyse und des Cockpits, Übersicht, Ansicht anpassen in der Bewertung, Belege nach
-- Anlage V, Einstellung maßgebender Objektwert, Hinweis Marktbericht abrufen).
-- Weg: der vorgesehene Schalter „für alle“ (Tabelle vorschau_freigaben, Migration 111), damit
-- die Freigabe im Admin › Vorschau sichtbar und ohne Rollout zurücknehmbar bleibt. Die Sperren
-- im Code fallen erst in einer späteren Version weg (claude/vorschau-funktionen.md).
INSERT INTO vorschau_freigaben (schluessel, fuer_alle, geaendert_von, geaendert_am)
VALUES ('grafiken_neu', TRUE, 'migration 129 (Marcel 24.11.2026)', NOW())
ON CONFLICT (schluessel) DO UPDATE SET fuer_alle = TRUE, geaendert_von = EXCLUDED.geaendert_von, geaendert_am = NOW();
