-- 022_amt_anfragen.sql — v3020 · Status der Anfragen an die Gutachterausschüsse
--
-- Marcel 28.10.2026: „die Ämter, die wir anfragen sollten, mit Mail und
-- worum es geht, könnten wir in unser Admin-Portal setzen" — und „ja, mit
-- Status gerne in die Datenbank".
--
-- Die Liste selbst (welche Sperren, welche E-Mail) wird NICHT gespeichert,
-- sie kommt bei jedem Aufruf frisch aus Register und ausschuss_kontakte.json
-- (lib/sperren_anfragen.js). Hier steht nur, was Marcel von Hand pflegt:
-- Status, Datum der Anfrage, Datum der Antwort, Notiz.
--
-- Schlüssel = `LAND:normName(Ausschuss)` aus lib/sperren_anfragen.js —
-- dieselbe Normalisierung wie die Alias-Zusammenführung der Kontaktdatei.
-- Eine NEUE Tabelle; keine bestehende wird angefasst. Kein Nutzerbezug außer
-- der Admin-Adresse, die zuletzt geändert hat.

CREATE TABLE IF NOT EXISTS mb.amt_anfragen (
  schluessel    TEXT        PRIMARY KEY,
  land          TEXT        NOT NULL,
  ausschuss     TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'offen'
                CHECK (status IN ('offen', 'angefragt', 'antwort', 'erledigt', 'abgelehnt')),
  angefragt_am  DATE,
  antwort_am    DATE,
  notiz         TEXT,
  geaendert_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_von TEXT
);

COMMENT ON TABLE mb.amt_anfragen IS
  'v3020 · Status je Gutachterausschuss für Anfragen zu gesperrten Registerwerten (Admin „Register & Ernte" › „Anfragen an Ämter").';
