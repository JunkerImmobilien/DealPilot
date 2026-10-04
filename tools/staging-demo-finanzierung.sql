-- v1845 · Demo-Werte NUR in leere Felder, nie ueber einen gesetzten Wert.
-- Marcel am 04.10.2026: "Demo-Werte in alle leeren Felder". Platzhalter
-- sind als solche erkennbar (DEMO-Praefix, "Demo-Bank"), damit nichts
-- wie ein echter Vertrag aussieht. Nur Staging.
BEGIN;

-- 1 · Finanzierung fuer Objekte ohne Darlehen: 80 % Darlehen / 20 % EK
--     vom Kaufpreis, App-Standardsaetze (3,5 % Zins, 2 % Tilgung, 10 J.).
UPDATE objects SET data = data::jsonb
  || jsonb_build_object(
       'd1',       to_char(round((data->>'kp')::numeric * 0.8), 'FM999999999'),
       'ek',       to_char(round((data->>'kp')::numeric * 0.2), 'FM999999999'),
       'd1z',      '3,5',
       'd1t',      '2',
       'd1_bindj', '10',
       'd1_type',  'annuitaet')
WHERE COALESCE(data->>'d1','') = ''
  AND COALESCE(data->>'kp','') <> ''
  AND (data->>'kp') ~ '^[0-9]+$';

-- 2 · Bank, nur wo leer.
UPDATE objects SET data = data::jsonb || jsonb_build_object('bank_inst', 'Demo-Bank (Platzhalter)')
 WHERE COALESCE(data->>'bank_inst','') = '';

-- 3 · Vertragsnummer DEMO-JJJJ-NNN, nur wo leer; Nummer nach Anlagereihenfolge.
WITH nr AS (
  SELECT id, 'DEMO-' || to_char(created_at,'YYYY') || '-'
         || lpad((row_number() OVER (ORDER BY created_at))::text, 3, '0') AS v
  FROM objects
)
UPDATE objects o SET data = o.data::jsonb || jsonb_build_object('d1_vertrag', nr.v)
 FROM nr WHERE o.id = nr.id AND COALESCE(o.data->>'d1_vertrag','') = '';

-- 4 · Vertragsdatum: drei Wochen vor dem Kaufdatum, sonst ein fester Demotag.
UPDATE objects SET data = data::jsonb || jsonb_build_object('d1_vertragsdatum',
   CASE WHEN COALESCE(data->>'kaufdat','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN to_char(to_date(data->>'kaufdat','YYYY-MM-DD') - 21, 'DD.MM.YYYY')
        ELSE '01.07.2026' END)
 WHERE COALESCE(data->>'d1_vertragsdatum','') = '';

-- 5 · Auszahlung MM.JJJJ: der Kaufmonat, sonst ein fester Demomonat.
UPDATE objects SET data = data::jsonb || jsonb_build_object('d1_auszahl',
   CASE WHEN COALESCE(data->>'kaufdat','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN to_char(to_date(data->>'kaufdat','YYYY-MM-DD'), 'MM.YYYY')
        ELSE '08.2026' END)
 WHERE COALESCE(data->>'d1_auszahl','') = '';

COMMIT;

-- Gegenprobe: was ist jetzt noch leer? (Soll: ueberall 0)
SELECT
 sum(CASE WHEN COALESCE(data->>'d1','')='' THEN 1 ELSE 0 END)               AS ohne_darlehen,
 sum(CASE WHEN COALESCE(data->>'ek','')='' THEN 1 ELSE 0 END)               AS ohne_ek,
 sum(CASE WHEN COALESCE(data->>'bank_inst','')='' THEN 1 ELSE 0 END)        AS ohne_bank,
 sum(CASE WHEN COALESCE(data->>'d1_vertrag','')='' THEN 1 ELSE 0 END)       AS ohne_vertragnr,
 sum(CASE WHEN COALESCE(data->>'d1_vertragsdatum','')='' THEN 1 ELSE 0 END) AS ohne_vertragsdatum,
 sum(CASE WHEN COALESCE(data->>'d1_auszahl','')='' THEN 1 ELSE 0 END)       AS ohne_auszahlung,
 count(*) AS objekte
FROM objects;

-- Welche Objekte tragen jetzt Demo-Platzhalter?
SELECT left(name,34) AS objekt, data->>'d1' AS darlehen, data->>'ek' AS ek,
       data->>'d1_vertrag' AS vertrag, data->>'d1_vertragsdatum' AS vdatum
FROM objects WHERE data->>'bank_inst' = 'Demo-Bank (Platzhalter)' ORDER BY name;
