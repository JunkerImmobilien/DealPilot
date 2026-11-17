#!/usr/bin/env node
/**
 * tools/partner-kunden-pruefen.mjs · v3357 — Partner und Kunden (backend/src/services/partnerKunden.js)
 *
 *   A  ohne DB: Rechte-Vorgaben (Partnerplatz vs. eigener Plan), Verbindungscode (Zeichen ohne Verwechsler, Normalform)
 *   B  jede Abfrage im Backend, die Objekte eines Nutzers LISTET oder ZAEHLT, schliesst Kundenstaende aus
 *      (kunden_freigabe_id IS NULL) oder steht begruendet in der Ausnahmeliste. Neue Stelle ohne beides = rot.
 *   C  Plan-Schutz steht in assignSeat und unassignSeat, Kundenstand ist im Update schreibgeschuetzt,
 *      die Kostenstellen Marktbericht und KI fragen die Partner-Rechte.
 *
 *   D  v3640 (Marcel 17.11.2026): Kundennummer K-JJJJ-NNN (Regel, Migration 113 mit Trigger und Altbestand, Eingabe),
 *      Uebernehmen mit Kundenbezug am ECHTEN kundenstandUebernehmen (neu, aktualisieren als Vorgabe, Nummer/Halter/
 *      Deal-Status bleiben, bewusst neue Kopie), Sperre beim Senden am ECHTEN senden() (offen ohne Antwort -> 409 mit
 *      fehlen[], Antwort/Rueckfrage oder erledigt -> frei, Bestand ueberspringt nur das Objekt) mit GEGENPROBE (Sperre
 *      aus dem Quelltext entfernt -> der Punkt muss rot werden), Frontend-Regel = Backend-Regel, Objektliste und Karte.
 *
 *   node tools/partner-kunden-pruefen.mjs          RC 0 = sauber
 *   node tools/partner-kunden-pruefen.mjs --live   dazu E: NUR Staging im Backend-Container (tools/partner-kunden-live.js)
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

let n = 0, rot = 0;
const ok = (ab, was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + ab + ' · ' + was + (ist !== undefined ? ' → ' + ist : '')); };

// ── A ─────────────────────────────────────────────────────────────────────
/* Der Dienst laedt db/pool beim Import; ohne DATABASE_URL reicht ein Platzhalter-Modul im require-Cache */
const poolPfad = path.join(WURZEL, 'backend/src/db/pool.js');
function platzhalter(rel, exp) { const f = path.join(WURZEL, rel); require.cache[require.resolve(f)] = { id: f, filename: f, loaded: true, exports: exp }; }
let antworte = async () => ({ rows: [], rowCount: 0 });   /* v3640 · je Abschnitt umstellbar */
platzhalter('backend/src/db/pool.js', { query: (sql, p) => antworte(sql, p), pool: {} });
platzhalter('backend/src/services/resellerService.js', { hatBezahltesAbo: async () => false, getPool: async () => null });
const OS = { aufrufe: [], getById: async () => null, create: async () => null, update: async () => null };
platzhalter('backend/src/services/objectService.js', OS);
platzhalter('backend/src/services/planService.js', {});
const pk = require(path.join(WURZEL, 'backend/src/services/partnerKunden.js'));

const r0 = pk.rechteAus({ platz_art: 'platz', rechte: null });
ok('A', 'Partnerplatz ohne Angabe: alles an', pk.RECHTE.every((k) => r0[k] === true));
const r1 = pk.rechteAus({ platz_art: 'platz', rechte: { pdf: false, markt: false } });
ok('A', 'Partnerplatz: pdf und markt aus, Rest an', r1.pdf === false && r1.markt === false && r1.ki === true && r1.senden === true);
const r2 = pk.rechteAus({ platz_art: 'eigen', rechte: { pdf: false } });
ok('A', 'eigener Plan: Partner-Rechte wirken nie', r2.pdf === true);
ok('A', 'Code-Zeichen ohne 0 O 1 I L', !/[01OIL]/.test(pk.CODE_ZEICHEN) && pk.CODE_ZEICHEN.length === 31);
ok('A', 'Code-Normalform aus „k7qm-4xtd “', pk._codeNorm(' k7qm-4xtd ') === 'K7QM4XTD');
ok('A', 'Code nur als SHA-256 (64 Hex)', /^[0-9a-f]{64}$/.test(pk._sha('K7QM4XTD')));
ok('A', 'Entzugsfrist 30 Tage', pk.ENTZUG_FRIST_TAGE === 30);

// ── B ─────────────────────────────────────────────────────────────────────
/* Datei:Muster -> Grund. Abfragen nach EINER Objekt-ID (id = $1) sind keine Liste und stehen nicht hier. */
const AUSNAHMEN = {
  'routes/admin.js': 'Admin-Zaehler je Nutzer (Speicherbedarf, alles zaehlt)',
  'db/seed-demo.js': 'Demo-Konto anlegen',
  'services/demoObjectService.js': 'Demo-Objekte des Demo-Kontos',
  'services/statsService.js': 'Gesamtstatistik',
  'routes/publicStats.js': 'oeffentliche Gesamtzahl',
  'services/objektFotos.js': 'Fotoablage aller Objekte (Kopien haben eigene Fotos)',
  'services/partnerKunden.js': 'der Dienst selbst',
  'services/immometricaFlow.js': 'Suche nach ImmoMetrica-ID, Kopien tragen keine',
  'routes/network.js': 'Suche nach einem Objekt per Kennung',
  'services/agentWerkzeuge.js#1539': 'Suche nach Name',
  'services/objectService.js#118': 'Nummernvergabe (Kundenstaende tragen K-Nummern und stoeren sie nicht)',
};
const dateien = [];
(function lauf(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'generated' && f !== 'node_modules') lauf(p); } else if (f.endsWith('.js')) dateien.push(p); } })(path.join(WURZEL, 'backend/src'));
let stellen = 0;
for (const p of dateien) {
  const rel = path.relative(path.join(WURZEL, 'backend/src'), p).replace(/\\/g, '/');
  const txt = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  txt.forEach((zeile, i) => {
    if (!/FROM objects\b/.test(zeile)) return;
    const block = txt.slice(i, i + 4).join(' ');
    if (!/user_id\s*=\s*\$1/.test(block)) return;            /* nicht je Nutzer */
    if (/\bid\s*=\s*\$1\b|WHERE id\s*=|AND id\s*=|id\s*=\s*ANY|id::text\s*=/.test(block)) return;   /* eine bestimmte ID */
    stellen++;
    if (/kunden_freigabe_id IS NULL/.test(block)) return;
    if (AUSNAHMEN[rel] || AUSNAHMEN[rel + '#' + (i + 1)]) return;
    ok('B', rel + ':' + (i + 1) + ' listet Objekte ohne Ausschluss der Kundenstaende', false);
  });
}
ok('B', 'Listen- und Zaehlstellen geprueft', stellen >= 10, stellen);

// ── C ─────────────────────────────────────────────────────────────────────
const lies = (r) => fs.readFileSync(path.join(WURZEL, r), 'utf8');
const rs = lies('backend/src/services/resellerService.js');
ok('C', 'assignSeat prueft bezahltes Abo (Plan-Schutz)', /async function assignSeat[\s\S]{0,900}hatBezahltesAbo/.test(rs));
ok('C', 'unassignSeat setzt den Plan von vorher zurueck', /async function unassignSeat[\s\S]{0,1200}plan_vorher/.test(rs));
ok('C', 'Kundenstand im Update schreibgeschuetzt', /kundenstand_schreibgeschuetzt/.test(lies('backend/src/services/objectService.js')));
ok('C', 'Marktbericht fragt Partner-Rechte (beide Wege)', (lies('backend/src/routes/marktbericht.js').match(/marktberichtErlaubt/g) || []).length >= 2);
ok('C', 'KI fragt Partner-Rechte', /kiErlaubt/.test(lies('backend/src/routes/ai.js')));
ok('C', 'Partnernetzwerk fragt Partner-Rechte', /rechteFuer/.test(lies('backend/src/routes/network.js')));
ok('C', 'Ende des Partner-Abos laeuft in die Frist', /aboEnde/.test(lies('backend/src/services/partnerSeatsWebhook.js')));
ok('C', 'Einladung eines bestehenden Kontos wird erst bestaetigt', /einladungFragen/.test(lies('frontend/js/reseller-portal.js')));
ok('C', 'Marke nur bei aktiver Verbindung und Wahl Partner', /getrennt_am IS NULL AND rc\.marke = 'partner'/.test(lies('backend/src/routes/resellerInvite.js')));

// ── D · v3640 ─────────────────────────────────────────────────────────────
{
  ok('D', 'erste Nummer im Jahr', pk.kundennummerNaechste([], 2026) === 'K-2026-001', pk.kundennummerNaechste([], 2026));
  ok('D', 'naechste nach der hoechsten desselben Jahres, Freitext und anderes Jahr zaehlen nicht',
    pk.kundennummerNaechste(['K-2026-001', 'K-2026-007', 'K-2025-012', 'Mustermann-01', null], 2026) === 'K-2026-008');
  ok('D', 'neues Jahr beginnt bei 001 (je Partner und Jahr)', pk.kundennummerNaechste(['K-2026-031'], 2027) === 'K-2027-001');
  ok('D', 'dreistellig, darueber weiter', pk.kundennummerNaechste(['K-2026-999'], 2026) === 'K-2026-1000');
  ok('D', 'Eingabe: getrimmt, Leerraum zusammengezogen', pk.kundennummerSauber('  K-2026-  003 ') === 'K-2026- 003');
  ok('D', 'Eingabe: leer, zu lang, Sonderzeichen abgewiesen', [null, '', '   ', 'x'.repeat(31), '<b>', 'K;1', '-K1'].every((v) => pk.kundennummerSauber(v) === null));
  ok('D', 'Eingabe: freie Nummer mit Umlaut, Punkt, Schraegstrich erlaubt', pk.kundennummerSauber('Müller/2026.1_a') === 'Müller/2026.1_a');

  const mig = fs.readFileSync(path.join(WURZEL, 'backend/migrations/113_partner_kundennummer_bilder.sql'), 'utf8');
  ok('D', 'Migration 113: Spalte, Trigger BEFORE INSERT, Sperre je Partner', /ADD COLUMN IF NOT EXISTS kundennummer text/.test(mig) && /BEFORE INSERT ON public\.reseller_clients/.test(mig) && /pg_advisory_xact_lock\(hashtext\('kundennummer:' \|\| NEW\.reseller_id/.test(mig));
  ok('D', 'Migration 113: Trigger zaehlt nur das Muster desselben Jahres (wie kundennummerNaechste)', /substring\(kundennummer from '\^K-\[0-9\]\{4\}-\(\[0-9\]\+\)\$'\)/.test(mig) && /LIKE 'K-' \|\| j::text \|\| '-%'/.test(mig) && /lpad\(n::text, 3, '0'\)/.test(mig));
  ok('D', 'Migration 113: Jahr der Verbindung, Altbestand nachgezogen, eindeutig je Partner ohne Gross/Klein',
    /COALESCE\(NEW\.verbunden_am, NEW\.created_at, now\(\)\)/.test(mig) && /row_number\(\) OVER \(PARTITION BY reseller_id/.test(mig) && /UNIQUE INDEX IF NOT EXISTS uq_reseller_clients_kundennummer\s+ON public\.reseller_clients \(reseller_id, lower\(kundennummer\)\)/.test(mig));
  ok('D', 'Migration 113: Bild an der Anmerkung und zur Antwort, mit Deckel', /ADD COLUMN IF NOT EXISTS bild text/.test(mig) && /ADD COLUMN IF NOT EXISTS bild_antwort text/.test(mig) && /length\(bild\) <= 600000/.test(mig));

  /* Regel „bearbeitet“ */
  const L = [{ id: 1, status: 'offen' }, { id: 2, status: 'offen', antwort: '  ' }, { id: 3, status: 'offen', antwort: 'Rückfrage: welcher Notar?' },
    { id: 4, status: 'erledigt' }, { id: 5, status: 'entwurf' }, { id: 6, status: 'offen', hat_bild_antwort: true }, { id: 7, status: 'offen', bild_antwort: 'data:image/png;base64,AA==' }];
  const ob = pk.ohneBearbeitung(L).map((x) => x.id).join(',');
  ok('D', 'ohne Bearbeitung = offen ohne Antwort (Leerzeichen zaehlen nicht), Rueckfrage/Bild/erledigt/Entwurf frei', ob === '1,2', ob);
  const vmq = fs.readFileSync(path.join(WURZEL, 'frontend/js/partner-anmerkungen.js'), 'utf8');
  const vm = await import('node:vm');
  const fw = {}; vm.runInNewContext(vmq, { window: fw, document: {}, setTimeout, clearTimeout, setInterval, clearInterval, console });
  const fo = fw.DpAnmerkungen && fw.DpAnmerkungen.ohneBearbeitung ? fw.DpAnmerkungen.ohneBearbeitung(L).map((x) => x.id).join(',') : null;
  ok('D', 'Frontend-Regel (partner-anmerkungen.js) = Backend-Regel', fo === ob, fo);

  /* Sperre beim Senden am echten senden() */
  const KLIENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', O1 = '11111111-1111-4111-8111-111111111111', O2 = '22222222-2222-4222-8222-222222222222';
  let anm = [];
  const sendenDb = async (sql, p) => {
    if (/FROM reseller_clients c JOIN resellers rs/.test(sql)) return { rows: [{ id: KLIENT, reseller_id: 'r1', platz_art: 'eigen', display_name: 'Kundin Muster', partner_name: 'Muster Immobilien' }] };
    if (/FROM partner_anmerkungen n WHERE n\.client_id = \$1 AND n\.objekt_id = ANY/.test(sql)) return { rows: anm.filter((a) => a.status === 'offen' && p[1].includes(a.objekt_id)) };
    if (/SELECT id FROM objects WHERE user_id = \$1 AND kunden_freigabe_id IS NULL ORDER BY updated_at/.test(sql)) return { rows: [{ id: O1 }, { id: O2 }] };
    if (/FROM resellers WHERE id/.test(sql)) return { rows: [{ n: 'Muster Immobilien', owner_user_id: 'pu1' }] };
    return { rows: [], rowCount: 0 };
  };
  async function sperreWirkt(modul) {
    antworte = sendenDb;
    anm = [{ id: 'a1', nr: 1, objekt_id: O1, aufgabe_id: 'g1', status: 'offen', antwort: null, text: 'Kaufpreis bitte prüfen' },
           { id: 'a2', nr: 2, objekt_id: O1, aufgabe_id: 'g1', status: 'offen', antwort: null, text: 'Bitte nachreichen' }];
    let e1 = null; try { await modul.senden({ id: 'u1' }, { object_ids: [O1] }); } catch (e) { e1 = e; }
    return !!(e1 && e1.status === 409 && e1.message === 'anmerkungen_offen' && e1.extra && e1.extra.fehlen && e1.extra.fehlen.length === 2 && /Noch 2 Anmerkungen/.test(e1.detail || ''));
  }
  ok('D', 'Senden mit 2 offenen Anmerkungen ohne Bearbeitung -> 409 anmerkungen_offen, fehlen[2], Text „Noch 2 Anmerkungen“', await sperreWirkt(pk));
  anm[0].antwort = 'Rückfrage: welcher Notar?'; anm[1].status = 'erledigt';
  let e2 = null, r2 = null; try { r2 = await pk.senden({ id: 'u1' }, { object_ids: [O1] }); } catch (e) { e2 = e; }
  ok('D', 'eine Rueckfrage + eine erledigt -> Senden frei', !e2 && r2 && r2.ok === true, e2 ? e2.message : r2);
  anm[0].antwort = null; anm[1].status = 'offen';
  let r3 = null, e3 = null; try { r3 = await pk.senden({ id: 'u1' }, { bestand: true }); } catch (e) { e3 = e; }
  const g3 = r3 && r3.ergebnis.filter((x) => x.grund === 'anmerkungen_offen').map((x) => x.object_id);
  ok('D', 'ganzer Bestand: nur das Objekt mit offenen Anmerkungen bleibt zurueck', !e3 && g3 && g3.length === 1 && g3[0] === O1 && r3.uebersprungen === 1, e3 ? e3.message : r3);
  ok('D', 'Route gibt fehlen[] mit der 409 aus', /Object\.assign\(\{\}, e\.extra \|\| \{\}, \{ error: e\.message, detail: e\.detail \|\| null \}\)/.test(lies('backend/src/routes/partnerKunden.js')));

  /* GEGENPROBE: dieselbe Datei ohne die Sperrzeile muss den Punkt rot machen */
  const Module = (await import('node:module')).default;
  const pkPfad = path.join(WURZEL, 'backend/src/services/partnerKunden.js');
  const quelle = fs.readFileSync(pkPfad, 'utf8');
  const zeile = "  if (fehlen.length && !bestand) throw fehler('anmerkungen_offen', 409, sperrText(fehlen.length), { fehlen });";
  ok('D', 'Gegenprobe: Sperrzeile genau einmal im Quelltext', quelle.split(zeile).length === 2);
  const ohne = new Module(pkPfad, null); ohne.filename = pkPfad; ohne.paths = Module._nodeModulePaths(path.dirname(pkPfad));
  ohne._compile(quelle.replace(zeile, '  /* Gegenprobe: Sperre entfernt */'), pkPfad);
  ok('D', 'Gegenprobe: ohne Sperrzeile wird der Senden-Punkt rot (Pruefer erkennt die fehlende Sperre)', (await sperreWirkt(ohne.exports)) === false);

  /* Uebernehmen mit Kundenbezug am echten kundenstandUebernehmen */
  const SH = '33333333-3333-4333-8333-333333333333';
  let vorh = null; const auf = { create: [], update: [] };
  OS.getById = async (uid, id) => id === 'kopie1' ? { id, data: { str: 'Musterweg', hnr: '5', _obj_seq: 'K-33333333-2', _kundenstand: { share_id: SH }, _deal_won: true }, photos: [], ai_analysis: null }
    : id === 'eigen1' ? { id, data: { _obj_seq: '2026-041', halter: 'h1', _deal_lost: true, _deal_won: false, _von_kunde: { share_id: SH, am: '2026-11-01T00:00:00Z' } } } : null;
  OS.create = async (uid, o) => { auf.create.push(o); return { id: 'neu' + auf.create.length, seq_no: '2026-05' + auf.create.length }; };
  OS.update = async (uid, id, o) => { auf.update.push({ id, o }); return { id, seq_no: '2026-041' }; };
  antworte = async (sql) => {
    if (/FROM object_shares WHERE id = \$1 AND reseller_id = \$2/.test(sql)) return { rows: [{ id: SH, client_id: KLIENT, kopie_object_id: 'kopie1', stand_nr: 3 }] };
    if (/SELECT id, display_name, kundennummer FROM reseller_clients/.test(sql)) return { rows: [{ id: KLIENT, display_name: 'Kundin Muster', kundennummer: 'K-2026-003' }] };
    if (/FROM resellers WHERE id/.test(sql)) return { rows: [{ n: 'Muster Immobilien', owner_user_id: 'pu1' }] };
    if (/_von_kunde'->>'share_id' = \$2/.test(sql)) return { rows: vorh ? [{ id: vorh }] : [] };
    return { rows: [], rowCount: 0 };
  };
  const rs = { id: 'r1' };
  let u = await pk.kundenstandUebernehmen(rs, 'pu1', SH, {});
  const vk = auf.create[0] && auf.create[0].data._von_kunde;
  ok('D', 'erstes Uebernehmen legt an, mit Kunde (client_id, Name, Kundennummer, Stand)', u.modus === 'neu' && vk && vk.client_id === KLIENT && vk.kunde === 'Kundin Muster' && vk.kundennummer === 'K-2026-003' && vk.stand_nr === 3, [u, vk]);
  ok('D', 'Kopie ohne Kundenstand-Kennung und ohne fremde Objektnummer', auf.create[0] && !auf.create[0].data._kundenstand && !auf.create[0].data._obj_seq);
  vorh = 'eigen1';
  u = await pk.kundenstandUebernehmen(rs, 'pu1', SH, {});
  const ud = auf.update[0] && auf.update[0].o.data;
  ok('D', 'erneut ohne Wahl -> aktualisiert das bestehende Objekt (Vorgabe)', u.modus === 'aktualisiert' && u.object_id === 'eigen1' && auf.create.length === 1 && ud, u);
  ok('D', 'beim Aktualisieren bleiben Nummer, Halter und Deal-Status des Partners', ud && ud._obj_seq === '2026-041' && ud.halter === 'h1' && ud._deal_lost === true && ud._deal_won === false, ud && [ud._obj_seq, ud.halter, ud._deal_lost, ud._deal_won]);
  ok('D', 'beim Aktualisieren: neue Daten des Kunden, erstes Uebernahmedatum bleibt', ud && ud.str === 'Musterweg' && ud._von_kunde.stand_nr === 3 && ud._von_kunde.erst_am === '2026-11-01T00:00:00Z');
  u = await pk.kundenstandUebernehmen(rs, 'pu1', SH, { modus: 'neu' });
  ok('D', 'modus neu -> bewusst weitere Kopie', u.modus === 'neu' && auf.create.length === 2 && auf.update.length === 1, u);
  let e4 = null; try { await pk.kundenstandUebernehmen(rs, 'pu1', 'kein-uuid', {}); } catch (e) { e4 = e; }
  ok('D', 'ungueltige Kennung -> 404 ohne DB-Fehler', e4 && e4.status === 404);
  antworte = async () => ({ rows: [], rowCount: 0 });

  /* Anzeige */
  const ob2 = lies('backend/src/services/objectService.js');
  ok('D', 'Objektliste liefert den Kunden (kunde_client_id, kunde_name, kunde_nr)', /'_von_kunde'->>'client_id' AS kunde_client_id/.test(ob2) && /'_von_kunde'->>'kundennummer' AS kunde_nr/.test(ob2));
  const st = lies('frontend/js/storage.js');
  ok('D', 'Objektliste: Sortiermodus kunde, Gruppenkopf, Filter im selben Menue, Hinweis auf der Karte',
    /var _SB_MODI = \['recent', 'id', 'kaufdat', 'lage', 'kunde'\]/.test(st) && /h\.textContent = k \? \('Kunde ' \+ k\) : 'Eigene Objekte'/.test(st) && /data-kunde="/.test(st) && /o\.kunde_client_id \? 'Kunde ' \+ _sbKundeVon\(o\)/.test(st));
  const pkf = lies('frontend/js/partner-kunden.js');
  ok('D', 'Cockpit: Kundennummer in Kundenliste, Kundenstaenden, Meldungen, Aufgaben; aenderbar in beiden Kundendialogen',
    /nrEtikett\(k\.kundennummer\)/.test(pkf) && /nrEtikett\(k\.kunde_nr\)/.test(pkf) && /m\.kunde_nr/.test(pkf) && /k\.kundennummer \? k\.kundennummer/.test(pkf) && (pkf.match(/kundennummer: wert\(d, '#pk-k-nr'\)/g) || []).length === 2);
  ok('D', 'Cockpit: Rueckfrage eigener Chip, Uebernehmen mit Rueckfrage aktualisieren/neu', /pk-chip frage/.test(pkf) && /los\('neu'\)/.test(pkf) && /'Bestehendes aktualisieren'/.test(pkf));
  ok('D', 'Kunde: Senden-Dialog prueft frisch und sperrt sichtbar (fehlenJeObjekt), Sendungen-Knopf aus', /function sendenDialog[\s\S]{0,200}api\('\/mein-partner'\)/.test(pkf) && /disabled data-gesperrt="1"/.test(pkf) && /data-neu="' \+ s\.object_id \+ '"' \+ \(f \? ' disabled/.test(pkf));
  ok('D', 'Kunde-Liste: Erneut senden ausgegraut mit Zahl und Sprung', /data-f="naechste"/.test(vmq) && /data-f="senden" disabled/.test(vmq));
}

/* ── E · live (NUR Staging) ─────────────────────────────────────────────── */
if (process.argv.includes('--live')) {
  const { execSync } = await import('node:child_process');
  const SERVER = 'root@116.203.214.11';
  const live = path.join(WURZEL, 'tools/partner-kunden-live.js');
  try {
    const aus = execSync(`scp -q "${live}" ${SERVER}:/tmp/pkl.js && ssh ${SERVER} "docker cp /tmp/pkl.js dealpilot-backend:/app/partner-kunden-live.js && docker exec dealpilot-backend node /app/partner-kunden-live.js; docker exec dealpilot-backend rm -f /app/partner-kunden-live.js; rm -f /tmp/pkl.js"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(aus);
    const m = aus.match(/LIVE (\d+) Punkte, (\d+) rot/);
    ok('E', 'Live-Lauf vollstaendig', !!m && m[2] === '0', m && m[0]);
  } catch (e) { process.stdout.write(String(e.stdout || '')); ok('E', 'Live-Lauf', false, String(e.stderr || e.message).slice(0, 300)); }
}

console.log('\npartner-kunden-pruefen v3640 · ' + n + ' Punkte, ' + (n - rot) + ' gruen, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
