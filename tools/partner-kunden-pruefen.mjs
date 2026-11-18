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
 *   F  v3690 P1 Freigabe bei der Kopplung (Konzept Anfordern-und-Freigeben-2026-11-18.md): Regeln am ECHTEN
 *      partnerFreigaben.js, alle drei Kopplungswege (anfrageBeantworten bei Anfrage und Code, acceptInvite bei Einladung)
 *      speichern die Freigabe und pruefen sie VOR jeder Aenderung, Fassungen statt Ueberschreiben, senden() ohne
 *      Steuerdaten ohne zve/grenz, ohne Steuer ohne Anlage V/Jahresbuch, einmal wird verbraucht, Widerruf sperrt
 *      Anfordern und die beendete Aufgabe. GEGENPROBEN: Filterzeile bzw. Widerrufsperre entfernt -> rot.
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
  'services/resellerService.js#374': 'Kundenseite: listet die eigenen Freigaben des Kunden (Originale), keine Kopien',
  'services/objectService.js#119': 'Nummernvergabe (Kundenstaende tragen K-Nummern und stoeren sie nicht)',   /* v3700: eine Zeile tiefer (kunde_ziel) */
};
const dateien = [];
(function lauf(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'generated' && f !== 'node_modules') lauf(p); } else if (f.endsWith('.js')) dateien.push(p); } })(path.join(WURZEL, 'backend/src'));
let stellen = 0;
for (const p of dateien) {
  const rel = path.relative(path.join(WURZEL, 'backend/src'), p).replace(/\\/g, '/');
  const txt = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  txt.forEach((zeile, i) => {
    if (!/(FROM|JOIN) objects\b/.test(zeile)) return;   /* v3683 · JOIN fehlte: tax-snapshots rechnete Kundenstaende mit */
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
  /* v3640d · seq_no ist varchar(12): der zehnte Stand scheiterte mit 500 */
  const SID = 'abcdef12-3456-4789-8abc-def012345678';
  const kk = [1, 9, 10, 99, 999, 9999].map((s) => pk.kopieKennung(SID, s));
  ok('D', 'Kennung der Kundenkopie hoechstens 12 Zeichen (seq_no varchar 12) bis Stand 9999, bis Stand 9 wie bisher', kk.every((x) => x.length <= 12) && kk[0] === 'K-abcdef12-1' && new Set(kk).size === kk.length, kk);
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
    : id === 'eigen1' ? { id, data: { _obj_seq: '2026-041', halter: 'h1', _deal_lost: true, _deal_won: false, _von_kunde: { share_id: SH, am: '2026-11-01T00:00:00Z', modus: 'eigen' } } } : null;   /* v3700: im eigenen Bestand */
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
  u = await pk.kundenstandUebernehmen(rs, 'pu1', SH, { ziel: 'eigen' });   /* v3700: Halter und Deal-Status bleiben nur im eigenen Bestand (Marcel 18.11.) */
  const ud = auf.update[0] && auf.update[0].o.data;
  ok('D', 'erneut ohne Wahl -> aktualisiert das bestehende Objekt (Vorgabe)', u.modus === 'aktualisiert' && u.object_id === 'eigen1' && auf.create.length === 1 && ud, u);
  ok('D', 'beim Aktualisieren (eigener Bestand) bleiben Nummer, Halter und Deal-Status des Partners', ud && ud._obj_seq === '2026-041' && ud.halter === 'h1' && ud._deal_lost === true && ud._deal_won === false, ud && [ud._obj_seq, ud.halter, ud._deal_lost, ud._deal_won]);
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
    /nrEtikett\(k\.kundennummer\)/.test(pkf) && /nrEtikett\(k\.kunde_nr\)/.test(pkf) && /m\.kunde_nr/.test(pkf) && /k\.kundennummer \? k\.kundennummer/.test(pkf) && /kundennummer: wert\(b, '#pk-k-nr'\)/.test(pkf) && /var reiter = \[kundeReiter\(k\), steuerReiter\(\)\];/.test(pkf));
  /* v3640b/c · Mein Partner im Arbeitsbereich, Freigaben, Kundendialog im RND-Stil (dieselben Bausteine, rnd-wizard.js unberuehrt) */
  ok('D', 'Kundendialog: Bausteine des RND-Rechners (rnd-wiz-overlay rnd-hub, Schrittleiste, Karten, Fuss), Reiter Kunde/Stufe/Rechte/Kontingente/Marke/Platz',
    /className = 'rnd-wiz-overlay rnd-hub dppk-hub'/.test(pkf) && /rnd-wiz-steps rnd-hub-schritte/.test(pkf) && /rnd-wiz-footer rnd-hub-nav/.test(pkf) && /kurz: 'Stufe'/.test(pkf) && /kurz: 'Rechte'/.test(pkf) && /kurz: 'Kontingente'/.test(pkf) && /kurz: 'Marke'/.test(pkf) && /kurz: 'Platz'/.test(pkf));
  ok('D', 'Mein Partner im Arbeitsbereich (arbeitsbereichZeigen kunde), Reiter Freigaben nutzt dieselben Karten nur lesend beim Platz',
    /arbeitsbereichZeigen\('kunde'/.test(pkf) && /k_freigaben: 'shieldCheck'/.test(pkf) && /freigabeReiter\(v, v\.partner_name, true\)/.test(pkf) && !/return ansichtOeffnen\('Mein Partner'/.test(pkf));
  ok('D', 'Einstellungen: nur noch ein Verweis auf Aktionen › Mein Partner, kein Verbindungscode dort', /Mein Partner findest du jetzt unter/.test(pkf) && !/'Verbindungscode erzeugen'\) \+ '<\/button>'/.test(pkf));
  ok('D', 'rnd-wizard.js nicht angefasst von v3640 (keine dppk-Bezuege)', !/dppk/.test(lies('frontend/js/rnd-wizard.js')));
  ok('D', 'Cockpit: Rueckfrage eigener Chip, Uebernehmen mit Rueckfrage aktualisieren/neu', /pk-chip frage/.test(pkf) && /los\('neu'\)/.test(pkf) && /'Bestehendes aktualisieren'/.test(pkf));
  ok('D', 'Kunde: Senden-Dialog prueft frisch und sperrt sichtbar (fehlenJeObjekt), Sendungen-Knopf aus', /function sendenDialog[\s\S]{0,200}api\('\/mein-partner'\)/.test(pkf) && /disabled data-gesperrt="1"/.test(pkf) && /data-neu="' \+ s\.object_id \+ '"' \+ \(f \? ' disabled/.test(pkf));
  ok('D', 'Kunde-Liste: Erneut senden ausgegraut mit Zahl und Sprung', /data-f="naechste"/.test(vmq) && /data-f="senden" disabled/.test(vmq));
}

// ── F · v3690 P1 Freigabe bei der Kopplung ────────────────────────────────
{
  const Fpfad = path.join(WURZEL, 'backend/src/services/partnerFreigaben.js');
  const F = require(Fpfad);
  const Module = (await import('node:module')).default;
  function frisch(pfad, quelle) {   /* Datei neu laden, auf Wunsch mit veraendertem Quelltext (Gegenprobe) */
    const m = new Module(pfad, null); m.filename = pfad; m.paths = Module._nodeModulePaths(path.dirname(pfad));
    m._compile(quelle == null ? fs.readFileSync(pfad, 'utf8') : quelle, pfad); return m.exports;
  }

  /* F1 · Regeln, rein */
  const b0 = F.bereicheSauber({ steuerdaten: true, finanzierung: true, fremd: true });
  ok('F', 'Bereiche: Objekt immer, Steuerdaten nur mit Steuer, unbekannte Schluessel fallen weg', b0.objekt === true && b0.steuerdaten === false && b0.finanzierung === true && !('fremd' in b0) && Object.keys(b0).length === 6, b0);
  const k0 = F.freigabeSauber({ art: 'keine', bereiche: { steuer: true, steuerdaten: true } });
  ok('F', 'Art „keine“: nur Objekt, auch wenn Bereiche mitkommen', k0.art === 'keine' && F.BEREICHE.every((k) => k0.bereiche[k] === (k === 'objekt')));
  let e0 = null; try { F.freigabeSauber({ art: 'immer' }); } catch (e) { e0 = e; }
  let e00 = null; try { F.freigabeSauber(null); } catch (e) { e00 = e; }
  ok('F', 'unbekannte oder fehlende Art -> 400', e0 && e0.status === 400 && e00 && e00.status === 400);
  ok('F', 'Vorschlag: nur dauer/einmal, sonst null (kein Fehler)', F.vorschlagSauber({ art: 'keine' }) === null && F.vorschlagSauber(null) === null && F.vorschlagSauber({ art: 'einmal', bereiche: { steuer: true } }).bereiche.steuer === true);
  ok('F', 'ohne aktive Fassung, bei „keine“: wirksam nur Objekt', [null, { art: 'keine', bereiche: { steuer: true } }].every((x) => { const w = F.bereicheWirksam(x); return w.objekt && !w.steuer && !w.steuerdaten; }));
  const ganz = () => ({ str: 'Musterweg', zve: 68000, grenz: 42, _kpis_cf_ns: -120, _kpis_steuerjahr: 2026, _steuer_vorlaeufig: true, _steuerbasis: { jahr: 2026 }, _tax_overrides: { 2025: { e: 1 } }, _jahre: { 2025: {} }, steuer_snapshot: { wk_per_year: {} }, kp: 200000 });
  let d1 = ganz(); const w1 = F.kopieFiltern(d1, { steuer: true });
  ok('F', 'kopieFiltern ohne Steuerdaten: zve, grenz, cf_ns, Steuerbasis weg, Anlage V und Jahresbuch bleiben', !('zve' in d1) && !('grenz' in d1) && !('_kpis_cf_ns' in d1) && !('_steuerbasis' in d1) && !('_steuer_vorlaeufig' in d1) && d1._tax_overrides && d1._jahre && d1.kp === 200000, w1);
  let d2 = ganz(); F.kopieFiltern(d2, {});
  ok('F', 'kopieFiltern ohne Steuer: zusaetzlich Anlage V, Jahresbuch, Snapshot weg', !d2._tax_overrides && !d2._jahre && !d2.steuer_snapshot && !('zve' in d2) && d2.str === 'Musterweg');
  let d3 = ganz(); const w3 = F.kopieFiltern(d3, { steuer: true, steuerdaten: true });
  ok('F', 'kopieFiltern mit Steuer und Steuerdaten: nichts entfernt', w3.length === 0 && d3.zve === 68000 && d3.grenz === 42);
  ok('F', 'Zustand: aktiv = Art, sonst widerrufen / verbraucht / ohne', F.zustand({ art: 'dauer' }, null) === 'dauer' && F.zustand(null, { widerrufen_am: 'x' }) === 'widerrufen' && F.zustand(null, { verbraucht_am: 'x' }) === 'verbraucht' && F.zustand(null, null) === 'ohne');
  ok('F', 'Meldungstext ganze Saetze ohne Semikolon und Gedankenstrich', /^Freigabe dauerhaft für Objekte, Steuer, Steuerdaten\.$/.test(F.kurztext({ art: 'dauer', bereiche: { steuer: true, steuerdaten: true } })) && F.kurztext(null) === 'Noch keine Freigabe.');

  /* In-Speicher-Tabelle partner_freigaben + alles, was senden/anfrageBeantworten/acceptInvite fragen */
  const KL = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', OB = '44444444-4444-4444-8444-444444444444', SH = '55555555-5555-4555-8555-555555555555', AUF = '66666666-6666-4666-8666-666666666666';
  const T = { fg: [], log: [], ak: {}, kopie: [], invite: null, anfrage: null, akStatus: null };
  let uhr = 0; const jetzt = () => new Date(Date.UTC(2026, 10, 18, 10, 0, uhr++)).toISOString();
  const aktivFg = () => T.fg.filter((x) => !x.ersetzt_am && !x.widerrufen_am && !x.verbraucht_am);
  const fake = async (sql, p) => {
    T.log.push(sql.replace(/\s+/g, ' ').trim().slice(0, 90));
    if (/FROM partner_freigaben WHERE client_id = \$1 AND ersetzt_am IS NULL/.test(sql) && /^\s*SELECT/.test(sql)) return { rows: aktivFg().slice(0, 1) };
    if (/UPDATE partner_freigaben SET ersetzt_am = now\(\)/.test(sql)) { const a = aktivFg(); a.forEach((x) => { x.ersetzt_am = jetzt(); }); return { rows: a, rowCount: a.length }; }
    if (/INSERT INTO partner_freigaben/.test(sql)) { const r = { id: 'fg' + (T.fg.length + 1), client_id: p[0], art: p[1], bereiche: JSON.parse(p[2]), umfang: p[3], text_version: p[4], quelle: p[5], erteilt_von: p[6], erteilt_am: jetzt() }; T.fg.push(r); return { rows: [r], rowCount: 1 }; }
    if (/UPDATE partner_freigaben SET widerrufen_am = now\(\)/.test(sql)) { const a = aktivFg(); a.forEach((x) => { x.widerrufen_am = jetzt(); }); return { rows: a, rowCount: a.length }; }
    if (/UPDATE partner_freigaben SET verbraucht_am = now\(\) WHERE id = \$1 AND art = 'einmal'/.test(sql)) { const a = aktivFg().filter((x) => x.id === p[0] && x.art === 'einmal'); a.forEach((x) => { x.verbraucht_am = jetzt(); }); return { rows: a, rowCount: a.length }; }
    if (/UPDATE partner_freigaben SET staende_zurueckgezogen/.test(sql)) return { rows: [], rowCount: 1 };
    if (/SELECT widerrufen_am FROM partner_freigaben WHERE client_id = \$1 ORDER BY erteilt_am DESC LIMIT 1/.test(sql)) { const l = T.fg.filter((x) => x.client_id === p[0]).slice(-1); return { rows: l }; }
    if (/FROM partner_freigaben WHERE client_id = \$1 ORDER BY erteilt_am DESC, id/.test(sql)) return { rows: T.fg.slice().reverse() };
    if (/FROM reseller_clients c JOIN resellers rs/.test(sql)) return { rows: T.verbunden === false ? [] : [{ id: KL, reseller_id: 'r1', platz_art: 'eigen', display_name: 'Kundin Muster', partner_name: 'Muster Immobilien' }] };
    if (/FROM resellers WHERE id/.test(sql)) return { rows: [{ n: 'Muster Immobilien', owner_user_id: 'pu1', brand_name: 'Muster Immobilien' }] };
    if (/SELECT \* FROM partner_anfragen WHERE id = \$1 AND user_id = \$2/.test(sql)) return { rows: T.anfrage ? [T.anfrage] : [] };
    if (/SELECT \* FROM reseller_clients WHERE reseller_id = \$1 AND user_id = \$2/.test(sql)) return { rows: [{ id: KL }] };
    if (/SELECT \* FROM reseller_invites WHERE token/.test(sql)) return { rows: T.invite ? [T.invite] : [] };
    if (/INSERT INTO reseller_clients/.test(sql)) return { rows: [{ id: KL }] };
    if (/SELECT status FROM partner_aufgaben_kunden WHERE aufgabe_id = \$1 AND client_id = \$2/.test(sql)) return { rows: T.akStatus ? [{ status: T.akStatus }] : [] };
    if (/UPDATE partner_aufgaben_kunden SET status = 'widerrufen'/.test(sql)) return { rows: [{ aufgabe_id: AUF }], rowCount: 1 };
    if (/SELECT \* FROM object_shares WHERE object_id = \$1 AND reseller_id = \$2/.test(sql)) return { rows: [{ id: SH, status: 'eingereicht', stand_nr: 1, kopie_object_id: null }] };
    if (/SELECT 1 FROM reseller_clients WHERE id = \$1 AND reseller_id = \$2 AND getrennt_am IS NULL/.test(sql)) return { rows: [{}], rowCount: 1 };
    if (/INSERT INTO partner_aufgaben \(/.test(sql)) return { rows: [{ id: AUF }] };
    return { rows: [], rowCount: 0 };
  };
  antworte = fake;
  OS.getById = async (uid, id) => id === OB ? { id, data: Object.assign(ganz(), { _obj_seq: '2026-007' }), photos: [], ai_analysis: null } : null;
  OS.create = async (uid, o) => { T.kopie.push(o.data); return { id: 'kopie' + T.kopie.length }; };
  const pkF = frisch(path.join(WURZEL, 'backend/src/services/partnerKunden.js'));
  const quelleR = fs.readFileSync(path.join(WURZEL, 'backend/src/services/resellerService.js'), 'utf8');
  const rsEcht = frisch(path.join(WURZEL, 'backend/src/services/resellerService.js'), quelleR);
  const U = { id: 'u1', name: 'Kundin Muster' };
  const aktiv = () => aktivFg()[0] || null;

  /* F2 · alle drei Kopplungswege speichern die Freigabe */
  T.anfrage = { id: 'an1', reseller_id: 'r1', quelle: 'einladung', platz_mitgeben: false, anzeige_name: 'Kundin Muster' };
  T.verbunden = false;
  const a1 = await pkF.anfrageBeantworten(U, 'an1', true, { art: 'dauer', bereiche: { steuer: true, steuerdaten: true } });
  ok('F', 'Weg Anfrage (bestehendes Konto): Freigabe dauerhaft gespeichert, Quelle anfrage, Antwort traegt sie', a1.freigabe && a1.freigabe.art === 'dauer' && aktiv() && aktiv().quelle === 'anfrage' && aktiv().bereiche.steuerdaten === true && aktiv().text_version === F.TEXT_VERSION, [a1.freigabe, aktiv()]);
  T.anfrage = { id: 'an2', reseller_id: 'r1', quelle: 'code', platz_mitgeben: false, anzeige_name: 'Kundin Muster' };
  const a2 = await pkF.anfrageBeantworten(U, 'an2', true, { art: 'einmal', bereiche: { steuer: true } });
  ok('F', 'Weg Verbindungscode: Freigabe einmalig, Quelle code', a2.freigabe.art === 'einmal' && aktiv().quelle === 'code' && aktiv().bereiche.steuerdaten === false);
  T.invite = { id: 'inv1', reseller_id: 'r1', status: 'pending', expires_at: '2099-01-01T00:00:00Z', display_name: 'Kundin Muster', platz_mitgeben: false };
  const a3 = await rsEcht.acceptInvite('tok', 'u1', { art: 'dauer', bereiche: { steuer: true, steuerdaten: false, marktbericht: true } });
  ok('F', 'Weg Einladung an neue Adresse (acceptInvite): Freigabe gespeichert, Quelle einladung', a3.freigabe && a3.freigabe.art === 'dauer' && aktiv().quelle === 'einladung' && aktiv().bereiche.marktbericht === true, [a3.freigabe, aktiv()]);
  T.log = [];
  T.anfrage = { id: 'an3', reseller_id: 'r1', quelle: 'einladung', platz_mitgeben: false };
  let e5 = null; try { await pkF.anfrageBeantworten(U, 'an3', true, { art: 'alles' }); } catch (e) { e5 = e; }
  ok('F', 'ungueltige Freigabe bei der Annahme: 400, VOR jeder Aenderung (kein UPDATE)', e5 && e5.status === 400 && !T.log.some((x) => /^UPDATE|^INSERT/.test(x)), [e5 && e5.message, T.log]);
  T.log = [];
  let e6 = null; try { await rsEcht.acceptInvite('tok', 'u1', { art: 'alles' }); } catch (e) { e6 = e; }
  ok('F', 'ungueltige Freigabe bei der Einladung: 400, nichts verbunden', e6 && e6.status === 400 && !T.log.some((x) => /^UPDATE|^INSERT/.test(x)), [e6 && e6.message, T.log]);
  const davor = T.fg.length;
  T.anfrage = { id: 'an4', reseller_id: 'r1', quelle: 'einladung', platz_mitgeben: false };
  await pkF.anfrageBeantworten(U, 'an4', true, undefined);
  ok('F', 'ohne Freigabe im Body (alter Browserstand): keine neue Fassung', T.fg.length === davor);

  /* F3 · Fassungen statt Ueberschreiben */
  T.verbunden = true;
  const n0 = T.fg.length;
  await pkF.freigabeSetzen(U, { art: 'dauer', bereiche: { steuer: true } });
  await pkF.freigabeSetzen(U, { art: 'dauer', bereiche: { steuer: true, steuerdaten: true } });
  ok('F', 'Aendern = neue Zeile, die alte bekommt ersetzt_am, genau eine aktiv', T.fg.length === n0 + 2 && aktivFg().length === 1 && T.fg[n0].ersetzt_am && !T.fg[n0 + 1].ersetzt_am && T.fg[n0].bereiche.steuerdaten === false && aktiv().quelle === 'mein_partner', T.fg.map((x) => [x.art, !!x.ersetzt_am]));
  const ueb = await F.uebersicht(KL);
  ok('F', 'Verlauf liefert alle Fassungen, neueste zuerst', ueb.verlauf.length === T.fg.length && ueb.verlauf[0].id === aktiv().id && ueb.zustand === 'dauer');

  /* F4 · senden() mit und ohne Steuerdaten */
  T.kopie = [];
  let s1 = await pkF.senden(U, { object_ids: [OB] });
  const k1 = T.kopie[0] || {};
  ok('F', 'Dauerfreigabe mit Steuerdaten: zve und grenz in der Kopie, Band-Angabe steuerdaten an', k1.zve === 68000 && k1.grenz === 42 && k1._tax_overrides && k1._kundenstand.freigabe.steuerdaten === true && s1.freigabe_art === 'dauer', s1);
  await pkF.freigabeSetzen(U, { art: 'dauer', bereiche: { steuer: true, steuerdaten: false } });
  async function sendenOhneSteuerdaten(modul) {
    T.kopie = [];
    await modul.senden(U, { object_ids: [OB] });
    const k = T.kopie[0] || {};
    return !('zve' in k) && !('grenz' in k) && !('_kpis_cf_ns' in k) && !!k._tax_overrides && !!k._jahre && k._kundenstand && k._kundenstand.freigabe.steuerdaten === false;
  }
  ok('F', 'senden() ohne Bereich Steuerdaten: kein zve, kein grenz, kein Cashflow nach Steuern, Anlage V bleibt', await sendenOhneSteuerdaten(pkF));
  const shUpd = T.log.filter((x) => /^UPDATE object_shares SET kopie_object_id/.test(x)).length;
  ok('F', 'Stand traegt Bereiche und Fassung (object_shares.bereiche, freigabe_id)', shUpd >= 1 && /bereiche = \$7::jsonb, freigabe_id = \$8/.test(fs.readFileSync(path.join(WURZEL, 'backend/src/services/partnerKunden.js'), 'utf8')));
  await pkF.freigabeSetzen(U, { art: 'keine' });
  T.kopie = []; await pkF.senden(U, { object_ids: [OB] });
  const k3 = T.kopie[0] || {};
  ok('F', 'Freigabe „noch nicht“: Kopie nur Objekt (ohne Anlage V, Jahresbuch, zve, grenz)', !k3._tax_overrides && !k3._jahre && !('zve' in k3) && k3.str === 'Musterweg');

  /* F5 · einmalig wird verbraucht */
  await pkF.freigabeSetzen(U, { art: 'einmal', bereiche: { steuer: true, steuerdaten: true } });
  const einmalId = aktiv().id;
  T.kopie = []; const s5 = await pkF.senden(U, { object_ids: [OB] });
  ok('F', 'einmalig: erste Sendung mit Steuerdaten, danach verbraucht', T.kopie[0].zve === 68000 && s5.freigabe_verbraucht === true && T.fg.filter((x) => x.id === einmalId)[0].verbraucht_am && !aktiv(), s5);
  T.kopie = []; const s6 = await pkF.senden(U, { object_ids: [OB] });
  ok('F', 'zweite Sendung nach dem Verbrauch: nur Objekt, Zustand verbraucht', !('zve' in T.kopie[0]) && !T.kopie[0]._tax_overrides && s6.freigabe_art === 'keine' && (await F.uebersicht(KL)).zustand === 'verbraucht', s6);

  /* F6 · Widerruf sperrt */
  await pkF.freigabeSetzen(U, { art: 'dauer', bereiche: { steuer: true, steuerdaten: true } });
  T.log = [];
  const wr = await pkF.freigabeWiderrufen(U, { staende_zurueckziehen: false });
  ok('F', 'Widerruf: keine aktive Fassung, offene Aufgaben auf widerrufen, Staende bleiben (ohne Wahl)', !aktiv() && wr.aufgaben_beendet === 1 && wr.staende_zurueckgezogen === 0 && T.log.some((x) => /^UPDATE partner_aufgaben_kunden SET status = 'widerrufen'/.test(x)) && !T.log.some((x) => /^DELETE FROM objects/.test(x)), wr);
  let e7 = null; try { await pkF.freigabeWiderrufen(U, {}); } catch (e) { e7 = e; }
  ok('F', 'zweiter Widerruf ohne aktive Fassung -> 409 keine_freigabe', e7 && e7.status === 409 && e7.message === 'keine_freigabe');
  async function anfordernGesperrt(modul) {
    let e = null; try { await modul.aufgabeAnlegen({ id: 'r1' }, 'pu1', { titel: 'Steuerjahr 2025', art: 'steuerjahr', kunden: [KL] }); } catch (x) { e = x; }
    return !!(e && e.status === 403 && e.message === 'freigabe_widerrufen');
  }
  ok('F', 'nach Widerruf: Partner kann nichts anfordern (Aufgabe an diesen Kunden -> 403)', await anfordernGesperrt(pkF));
  T.akStatus = 'widerrufen';
  let e8 = null; try { await pkF.senden(U, { object_ids: [OB], aufgabe_id: AUF }); } catch (e) { e8 = e; }
  ok('F', 'nach Widerruf: die beendete Aufgabe laesst sich nicht mehr erfuellen (409)', e8 && e8.status === 409 && e8.message === 'freigabe_widerrufen');
  T.akStatus = null;
  T.kopie = []; await pkF.senden(U, { object_ids: [OB] });
  ok('F', 'nach Widerruf: selbst senden geht, aber nur das Objekt', T.kopie.length === 1 && !('zve' in T.kopie[0]) && !T.kopie[0]._tax_overrides);
  await pkF.freigabeSetzen(U, { art: 'dauer', bereiche: { steuer: true } });
  let e9 = null; try { await pkF.aufgabeAnlegen({ id: 'r1' }, 'pu1', { titel: 'Steuerjahr 2025', art: 'steuerjahr', kunden: [KL] }); } catch (e) { e9 = e; }
  ok('F', 'neue Freigabe nach dem Widerruf oeffnet das Anfordern wieder', !e9, e9 && e9.message);
  const wr2 = await pkF.freigabeWiderrufen(U, { staende_zurueckziehen: true });
  ok('F', 'Widerruf mit „auch zurueckziehen“: Antwort zaehlt, Quelltext loescht die Kopien', wr2.ok && /staende_zurueckziehen === true[\s\S]{0,400}DELETE FROM objects WHERE id = \$1 AND kunden_freigabe_id = \$2/.test(fs.readFileSync(path.join(WURZEL, 'backend/src/services/partnerKunden.js'), 'utf8')));
  ok('F', 'Trennen beendet die Freigabe', /async function trennen[\s\S]{0,700}F\.widerrufen\(clientId\)/.test(fs.readFileSync(path.join(WURZEL, 'backend/src/services/partnerKunden.js'), 'utf8')));

  /* F7 · GEGENPROBEN: Sperrzeile entfernt -> der Punkt muss rot werden */
  const pkPfad = path.join(WURZEL, 'backend/src/services/partnerKunden.js');
  const q = fs.readFileSync(pkPfad, 'utf8');
  const zFilter = '    const entfernt = F.kopieFiltern(d, bereiche);   /* v3690 */';
  const zSperre = '    if (z && z.widerrufen_am) { ohneFreigabe++; continue; }';
  ok('F', 'Gegenprobe: Filterzeile und Widerrufsperre je genau einmal im Quelltext', q.split(zFilter).length === 2 && q.split(zSperre).length === 2);
  await pkF.freigabeSetzen(U, { art: 'dauer', bereiche: { steuer: true, steuerdaten: false } });
  const ohneFilter = frisch(pkPfad, q.replace(zFilter, '    const entfernt = [];   /* Gegenprobe */'));
  ok('F', 'Gegenprobe: ohne kopieFiltern gehen zve/grenz ungefragt mit (Pruefer erkennt es)', (await sendenOhneSteuerdaten(ohneFilter)) === false);
  await pkF.freigabeWiderrufen(U, {});
  const ohneSperre = frisch(pkPfad, q.replace(zSperre, '    /* Gegenprobe: Sperre entfernt */'));
  ok('F', 'Gegenprobe: ohne Widerrufsperre kann der Partner wieder anfordern (Pruefer erkennt es)', (await anfordernGesperrt(ohneSperre)) === false);

  /* F8 · Migration, Routen, Frontend */
  const m118 = fs.readFileSync(path.join(WURZEL, 'backend/migrations/118_partner_freigaben.sql'), 'utf8');
  ok('F', 'Migration 118: Tabelle mit art-Pruefung, Fassungsspalten, eine aktive je Verbindung, Vorschlag, Stand-Spalten',
    /CREATE TABLE IF NOT EXISTS public\.partner_freigaben/.test(m118) && /CHECK \(art IN \('dauer','einmal','keine'\)\)/.test(m118) && /ersetzt_am\s+timestamptz/.test(m118) && /verbraucht_am timestamptz/.test(m118) &&
    /CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_freigaben_aktiv/.test(m118) && /partner_anfragen ADD COLUMN IF NOT EXISTS vorschlag jsonb/.test(m118) && /reseller_invites ADD COLUMN IF NOT EXISTS vorschlag jsonb/.test(m118) && /ADD COLUMN IF NOT EXISTS freigabe_id uuid/.test(m118));
  const rt = lies('backend/src/routes/partnerKunden.js'), ri = lies('backend/src/routes/resellerInvite.js');
  ok('F', 'Routen: Anfrage mit freigabe, GET/PUT /freigabe, POST /freigabe/widerrufen, Partner liest, Einladung mit freigabe',
    /annehmen\), req\.body && req\.body\.freigabe\)/.test(rt) && /kunde\.get\('\/freigabe'/.test(rt) && /kunde\.put\('\/freigabe'/.test(rt) && /kunde\.post\('\/freigabe\/widerrufen'/.test(rt) && /partner\.get\('\/kunden\/:id\/freigabe'/.test(rt) && /acceptInvite\(token, req\.user\.id, req\.body\.freigabe\)/.test(ri));
  const pkf = lies('frontend/js/partner-kunden.js'), rp = lies('frontend/js/reseller-portal.js');
  ok('F', 'Frontend: Zustimmungsdialog bei Anfrage, Code und Einladung (bestehendes und neues Konto)',
    /function anfrageDialog[\s\S]{0,400}fgDialog\(/.test(pkf) && /function einladungFragen[\s\S]{0,500}fgDialog\(/.test(pkf) && /body: \{ annehmen: true, freigabe: f \}/.test(pkf) && /body: \{ token: token, freigabe: f \}/.test(pkf) &&
    /function startAcceptWatcher[\s\S]{0,1400}DpMeinPartner\.einladungFragen\(token, inf\)/.test(rp));
  ok('F', 'Frontend: Reiter Freigabe in Mein Partner (Verlauf, Aendern, Widerrufen mit „auch zurueckziehen“)',
    /kurz: 'Freigabe', titel: 'Was dein Partner anfordern darf'/.test(pkf) && /\/mein-partner\/freigabe', \{ method: 'PUT'/.test(pkf) && /\/mein-partner\/freigabe\/widerrufen'/.test(pkf) && /staende_zurueckziehen: !!wert\(dd, '#pk-fg-mitz'\)/.test(pkf));
  ok('F', 'Kirchensteuer steht ausdruecklich im Zustimmungstext (Art. 9 DSGVO)', /Die Kirchensteuer zeigt, ob du einer Kirche angehörst\./.test(pkf));
  const texte = (pkf.match(/var FG_BEREICHE = \[[\s\S]*?\];/) || [''])[0] + (pkf.match(/var FG_ARTEN = \{[\s\S]*?\};/) || [''])[0] + (pkf.match(/var FG_FUSS = '[^']*'/) || [''])[0];
  ok('F', 'Kundentext der Freigabe: kein Semikolon im Text, kein Gedankenstrich', texte.length > 800 && !/[–—]/.test(texte) && !/[a-zäöüß] ?; ?[a-zäöüß]/i.test(texte.replace(/'\],?\s*\[/g, '')), texte.length);
  /* dieselbe Regel im Browser wie im Server: fgSauber aus partner-kunden.js gegen bereicheSauber ueber alle 64 Kombinationen */
  const fgQ = (pkf.match(/function fgSauber\(b\) \{[^\n]*\}/) || [''])[0];
  const vm = await import('node:vm');
  const ctx = { FG_BEREICHE: F.BEREICHE.map((k) => [k, k, '', k === 'objekt']) }; vm.runInNewContext(fgQ + '; this.fgSauber = fgSauber;', ctx);
  let gleich = !!ctx.fgSauber;
  for (let m = 0; m < 64 && gleich; m++) { const b = {}; F.BEREICHE.forEach((k, i) => { b[k] = !!(m & (1 << i)); }); gleich = JSON.stringify(ctx.fgSauber(b)) === JSON.stringify(F.bereicheSauber(b)); }
  ok('F', 'Frontend-Regel fgSauber = Backend-Regel bereicheSauber (64 Kombinationen)', gleich);
  ok('F', 'Partner: Vorschlag in Einladung und Code, Chip je Kunde, „Steuerdaten nicht freigegeben“ in Freigegeben und im Band',
    /vorschlag: vorschlagLesen\(d, 'e'\)/.test(pkf) && /vorschlag: vorschlagLesen\(d, 'c'\)/.test(pkf) && /fgChipPartner\(k\.freigabe\)/.test(pkf) && /'Steuerdaten nicht freigegeben'/.test(pkf) && /fgBandText\(ks\.freigabe\)/.test(pkf));
  antworte = async () => ({ rows: [], rowCount: 0 });
}

// ── G · v3700 P2 Steuerprofil des Kunden, Rechenkontext, Uebernehmen ──────
{
  const Module = (await import('node:module')).default;
  const vm = await import('node:vm');
  function frischG(pfad, quelle) { const m = new Module(pfad, null); m.filename = pfad; m.paths = Module._nodeModulePaths(path.dirname(pfad)); m._compile(quelle == null ? fs.readFileSync(pfad, 'utf8') : quelle, pfad); return m.exports; }
  const SPpfad = path.join(WURZEL, 'backend/src/services/partnerSteuerprofil.js');
  const SP = frischG(SPpfad);
  const O1 = '11111111-1111-4111-8111-111111111111', O2 = '22222222-2222-4222-8222-222222222222';
  const roh = { erzeugt_am: '2026-11-18T10:00:00Z',
    zeitraeume: [{ valid_from: '2026-01-01', valid_to: null, zve: 140000, splitting: true, kirchensteuer: 0 }, { valid_from: '2020-01-01', valid_to: '2025-12-31', zve: '120000', splitting: true, kirchensteuer: 9 }, { valid_from: 'kaputt', zve: 1 }],
    angaben: { splitting: 'ja', kirchensteuer: 9 },
    mandanten: [{ id: 'm-gmbh', name: 'Muster GmbH', rechtsform: 'gmbh', regime: { kst: 15.825, gewst: 450, erw_kuerzung: true }, bh: { verlustvortrag: 5000 }, kosten: { 2026: { steuerber: 2400 } }, geheim: 'x' }],
    bestand: [{ id: O1, address: 'Musterweg 1', purchase_date: '2020-04-01', wk_per_year: { 2025: -3000, 2026: '-2500', x: 5 }, halter: 'privat', rang: 0 }, { id: 'keine-uuid' }],
    pro: true, fremd: 'weg' };
  const p = SP.profilSauber(roh);
  ok('G', 'profilSauber: Zeitraeume sortiert, kaputte verworfen, zvE als Zahl, Veranlagung je Zeitraum', p.zeitraeume.length === 2 && p.zeitraeume[0].valid_from === '2020-01-01' && p.zeitraeume[0].zve === 120000 && p.zeitraeume[0].kirchensteuer === 9 && p.zeitraeume[1].valid_to === null, JSON.stringify(p.zeitraeume));
  ok('G', 'profilSauber: Angaben nur echte Werte (splitting nur true, KiSt 0/8/9), Privat ergaenzt, fremde Schluessel weg', p.angaben.splitting === false && p.angaben.kirchensteuer === 9 && p.mandanten[0].id === 'privat' && !('geheim' in p.mandanten[1]) && p.mandanten[1].regime.gewst === 450 && !('fremd' in p) && p.pro === true);
  ok('G', 'profilSauber: Bestand nur mit UUID, Jahre nur vierstellig mit Zahl', p.bestand.length === 1 && p.bestand[0].wk_per_year['2026'] === -2500 && !('x' in p.bestand[0].wk_per_year));
  let eG1 = null; try { SP.profilSauber('kaputt'); } catch (e) { eG1 = e; }
  let eG2 = null; try { SP.profilSauber({ bestand: [{ id: O1, address: 'x'.repeat(1600000) }] }); } catch (e) { eG2 = e; }
  ok('G', 'unbrauchbares Profil 400, zu grosses 413', eG1 && eG1.status === 400 && eG2 && eG2.status === 413);
  ok('G', 'gleicher Inhalt = gleiche Pruefsumme (Erzeugungszeit zaehlt nicht), anderer Inhalt = andere', SP.inhaltHash(p) === SP.inhaltHash(Object.assign({}, p, { erzeugt_am: '2030-01-01T00:00:00Z' })) && SP.inhaltHash(p) !== SP.inhaltHash(Object.assign({}, p, { pro: false })));
  const ue = SP.ueberfuehrungenAus([{ id: O2, data: { str: 'Bismarckstr.', hnr: '27', plz: '32756', ort: 'Detmold', obj_herkunft: 'ueberfuehrung', halter: 'm-gmbh', halter_seit: '2027-01-01', gesellschafterdarlehen: '50000', _ueberf_link: O1, ueberf_daten: JSON.stringify({ art: 'verdeckt', vw: 410000, gd: { betrag: 50000 } }) } }, { id: O1, data: { obj_herkunft: 'neukauf' } }]);
  ok('G', 'Ueberfuehrungen aus den Objekten: Stichtag, Art, Verkehrswert, Gesellschafterdarlehen, Verweis aufs Privatobjekt', ue.length === 1 && ue[0].stichtag === '2027-01-01' && ue[0].art === 'verdeckt' && ue[0].verkehrswert === 410000 && ue[0].gesellschafterdarlehen === 50000 && ue[0].privat_id === O1, JSON.stringify(ue));
  const bs = SP.basisFuer({ id: 'sp1', fassung: 3, zuletzt_am: new Date('2026-11-18T11:00:00Z'), profil: p }, O1, 'm-gmbh');
  ok('G', '_steuerbasis fuer die Kopie: Profil, Fassung, Stand, Original-Kennung, Halter', bs.profil_id === 'sp1' && bs.fassung === 3 && bs.orig_id === O1 && bs.halter === 'm-gmbh' && bs.stand_am === '2026-11-18T11:00:00.000Z' && bs.profil === p);

  /* senden() mit In-Speicher-DB: Profil nur mit Bereich Steuerdaten */
  const KL = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', OB = '44444444-4444-4444-8444-444444444444', SH = '55555555-5555-4555-8555-555555555555';
  const T = { fg: null, sp: [], kopie: [], log: [] };
  antworte = async (sql, prm) => {
    T.log.push(sql.replace(/\s+/g, ' ').trim().slice(0, 80));
    if (/FROM reseller_clients c JOIN resellers rs/.test(sql)) return { rows: [{ id: KL, reseller_id: 'r1', platz_art: 'eigen', display_name: 'Kundin Muster', partner_name: 'Muster' }] };
    if (/FROM resellers WHERE id/.test(sql)) return { rows: [{ n: 'Muster', owner_user_id: 'pu1' }] };
    if (/FROM partner_freigaben WHERE client_id = \$1 AND ersetzt_am IS NULL/.test(sql)) return { rows: T.fg ? [T.fg] : [] };
    if (/data::jsonb->>'obj_herkunft' = 'ueberfuehrung'/.test(sql)) return { rows: [] };
    if (/FROM partner_steuerprofile WHERE client_id = \$1 AND ersetzt_am IS NULL/.test(sql)) return { rows: T.sp.filter((x) => !x.ersetzt_am).slice(-1) };
    if (/MAX\(fassung\)/.test(sql)) return { rows: [{ m: T.sp.length }] };
    if (/UPDATE partner_steuerprofile SET ersetzt_am/.test(sql)) { T.sp.forEach((x) => { if (x.id === prm[0]) x.ersetzt_am = 'jetzt'; }); return { rows: [], rowCount: 1 }; }
    if (/UPDATE partner_steuerprofile SET zuletzt_am/.test(sql)) return { rows: T.sp.filter((x) => x.id === prm[0]), rowCount: 1 };
    if (/INSERT INTO partner_steuerprofile/.test(sql)) { const r = { id: 'sp' + (T.sp.length + 1), client_id: prm[0], fassung: prm[2], profil: JSON.parse(prm[3]), inhalt_hash: prm[4], freigabe_id: prm[5], empfangen_am: new Date('2026-11-18T12:00:00Z') }; T.sp.push(r); return { rows: [r], rowCount: 1 }; }
    if (/SELECT \* FROM object_shares WHERE object_id = \$1 AND reseller_id = \$2/.test(sql)) return { rows: [{ id: SH, status: 'eingereicht', stand_nr: 1, kopie_object_id: null }] };
    return { rows: [], rowCount: 0 };
  };
  OS.getById = async (uid, oid) => oid === OB ? { id: oid, data: { str: 'Musterweg', halter: 'm-gmbh', zve: 90000, grenz: 42, _tax_overrides: { 2025: {} } }, photos: [], ai_analysis: null } : null;
  OS.create = async (uid, o) => { T.kopie.push(o.data); return { id: 'kopie' + T.kopie.length }; };
  const pkPfadG = path.join(WURZEL, 'backend/src/services/partnerKunden.js');
  const qG = fs.readFileSync(pkPfadG, 'utf8');
  const pkG = frischG(pkPfadG, qG);
  const U = { id: 'u1', name: 'Kundin Muster' };
  async function sendeMit(modul, bereiche) {
    T.fg = { id: 'fg1', art: 'dauer', bereiche }; T.kopie = []; T.sp = [];
    await modul.senden(U, { object_ids: [OB], steuerprofil: roh });
    return { k: T.kopie[0] || {}, sp: T.sp.slice() };
  }
  const g1 = await sendeMit(pkG, { steuer: true, steuerdaten: true });
  ok('G', 'mit Steuerdaten: Profil als Fassung 1 abgelegt, Kopie traegt _steuerbasis (Original, Halter des Kunden), Halter am Objekt', g1.sp.length === 1 && g1.sp[0].fassung === 1 && g1.k._steuerbasis && g1.k._steuerbasis.orig_id === OB && g1.k._steuerbasis.halter === 'm-gmbh' && g1.k.halter === 'm-gmbh' && g1.k._steuerbasis.profil.zeitraeume.length === 2, JSON.stringify({ sp: g1.sp.length, h: g1.k.halter }));
  async function sendeOhne(modul) { const r = await sendeMit(modul, { steuer: true, steuerdaten: false }); return r.sp.length === 0 && !r.k._steuerbasis && r.k.halter === 'privat' && !('zve' in r.k); }
  ok('G', 'ohne Steuerdaten: kein Profil gespeichert (auch wenn der Browser eins schickt), keine _steuerbasis, Halter privat', await sendeOhne(pkG));
  T.fg = { id: 'fg1', art: 'dauer', bereiche: { steuer: true, steuerdaten: true } }; T.kopie = [];
  await pkG.senden(U, { object_ids: [OB], steuerprofil: roh });   /* zweite Sendung, gleicher Inhalt (T.sp bleibt) */
  const vorG = T.sp.length;
  await pkG.senden(U, { object_ids: [OB], steuerprofil: Object.assign({}, roh, { erzeugt_am: '2026-11-19T08:00:00Z' }) });
  const glG = T.sp.length === vorG;
  await pkG.senden(U, { object_ids: [OB], steuerprofil: Object.assign({}, roh, { angaben: { splitting: true, kirchensteuer: 0 } }) });
  ok('G', 'Fassungen: gleicher Inhalt keine neue, geaenderter Inhalt neue Fassung, die alte ersetzt', glG && T.sp.length === vorG + 1 && T.sp[T.sp.length - 1].fassung === vorG + 1 && T.sp[T.sp.length - 2].ersetzt_am, JSON.stringify(T.sp.map((x) => [x.fassung, !!x.ersetzt_am])));
  /* Gegenprobe: ohne die Freigabe-Bedingung wuerde das Profil auch ohne Steuerdaten abgelegt */
  const zG = '  if (bereiche.steuerdaten && b && b.steuerprofil) {';
  ok('G', 'Gegenprobe: Bedingung genau einmal im Quelltext', qG.split(zG).length === 2);
  const ohneBed = frischG(pkPfadG, qG.replace(zG, '  if (b && b.steuerprofil) {   /* Gegenprobe */'));
  ok('G', 'Gegenprobe: ohne Freigabe-Bedingung landet das Profil ohne Steuerdaten beim Partner (Pruefer erkennt es)', (await sendeOhne(ohneBed)) === false);

  /* Uebernehmen: Daten je Ziel */
  const dK = { str: 'Musterweg', halter: 'm-gmbh', zve: 90000, grenz: 42, _steuerbasis: bs, _kpis_cf_ns: -100, _deal_won: true, _kundenstand: { share_id: SH }, _obj_seq: 'K-1' };
  const uk = pkG.uebernahmeDaten(dK, 'kunde', { share_id: SH }, null);
  ok('G', 'Uebernehmen fuer den Kunden: Profil, Halter, zvE und Deal-Status des Kunden bleiben, Ziel kunde', uk._steuerbasis === undefined ? false : (uk._steuerbasis.orig_id === O1 && uk.halter === 'm-gmbh' && uk.zve === 90000 && uk._deal_won === true && uk._von_kunde.modus === 'kunde' && !uk._kundenstand && !uk._obj_seq));
  const ug = pkG.uebernahmeDaten(dK, 'eigen', { share_id: SH }, 'm-eigen');
  ok('G', 'Uebernehmen in den eigenen Bestand: keine Steuerdaten des Kunden (zvE, grenz, Profil, cf_ns), Deal offen, Halter nach Wahl', !ug._steuerbasis && !('zve' in ug) && !('grenz' in ug) && !('_kpis_cf_ns' in ug) && !('_deal_won' in ug) && ug.halter === 'm-eigen' && ug._von_kunde.modus === 'eigen' && ug.str === 'Musterweg');
  ok('G', 'Halter im eigenen Bestand: ungueltige Angabe wird privat', pkG.uebernahmeDaten(dK, 'eigen', {}, '<b>').halter === 'privat' && pkG.uebernahmeDaten(dK, 'eigen', {}, null).halter === 'privat');
  ok('G', 'ohne Ziel (alter Browserstand) gilt kunde: zaehlt nie ungefragt zur Steuer des Partners', /const ziel = ZIELE\.indexOf\(b && b\.ziel\) >= 0 \? b\.ziel : 'kunde';/.test(qG));
  ok('G', 'neuer Stand zieht weitergefuehrte Objekte nach (Objekt und Profil), eigener Bestand bleibt', /async function weitergefuehrtNachziehen[\s\S]{0,400}COALESCE\(data::jsonb->'_von_kunde'->>'modus', 'kunde'\) = 'kunde'/.test(qG) && /await weitergefuehrtNachziehen\(pn\.owner_user_id, s\.id, d, standNr/.test(qG));

  /* Verlustverrechnung: Praedikat nachgebaut und gegen beide Abfragen gehalten */
  const tsq = lies('backend/src/routes/taxSnapshots.js'), tsv = lies('backend/src/services/taxService.js');
  const PRAED = "((o.data::jsonb -> '_von_kunde') IS NULL OR o.data::jsonb -> '_von_kunde' ->> 'modus' = 'eigen')";
  const zaehlt = (d) => !d._von_kunde || d._von_kunde.modus === 'eigen';   /* dieselbe Regel in JS */
  ok('G', 'Verlustverrechnung (GET /tax-snapshots) und eigene Steuersaetze: eigener Bestand zaehlt, fuer den Kunden weitergefuehrt nie', tsq.includes(PRAED) && tsv.includes(PRAED) && zaehlt({}) && zaehlt({ _von_kunde: { modus: 'eigen' } }) && !zaehlt({ _von_kunde: { modus: 'kunde' } }) && !zaehlt({ _von_kunde: {} }));
  ok('G', 'Gegenprobe: der alte v3688-Filter (jedes _von_kunde ausgeschlossen) steht nicht mehr da', !/AND \(o\.data::jsonb -> '_von_kunde'\) IS NULL\s*(--|`)/.test(tsq + tsv));
  ok('G', 'Steuersaetze je Kunde (Steuer-Mappe beim Partner): nur Ziel kunde, nur dieser Kunde, nur eigene Objekte', /async function listForKunde[\s\S]{0,500}tr\.user_id = \$1[\s\S]{0,200}'client_id' = \$2[\s\S]{0,120}'modus', 'kunde'\) = 'kunde'/.test(tsv) && /req\.query\.kunde/.test(lies('backend/src/routes/taxRecords.js')));

  /* Frontend: der Rechenkontext an EINER Stelle, echte Datei im vm */
  const skQ = lies('frontend/js/steuer-kontext.js');
  function skLaden(d) {
    const win = { _currentObjData: d, _currentObjKey: 'kopie-1', addEventListener() {}, setTimeout() {} };
    const ctx = { window: win, document: { readyState: 'complete', addEventListener() {}, getElementById: () => null, body: null }, setTimeout() {}, clearTimeout() {}, console, Promise, JSON, Date };
    win.window = win; vm.runInNewContext(skQ, ctx); return win.DpSteuerKontext;
  }
  const kd = { _kundenstand: { share_id: SH, kunde: 'Kundin Muster', stand_am: '2026-11-18T12:00:00Z' }, _steuerbasis: Object.assign({}, bs, { orig_id: O1 }) };
  const K1 = skLaden(kd);
  ok('G', 'Kontext im Kundenstand: Zeitraeume, Angaben, Mandanten und Plan des KUNDEN', K1.aktiv() && !K1.gesperrt() && K1.zeitraeume().length === 2 && K1.zeitraeume()[1].zve === 140000 && K1.angaben().kirchensteuer === 9 && K1.mandanten().some((m) => m.id === 'm-gmbh') && K1.pro() === true);
  const bst = K1.bestand('kopie-1');
  ok('G', 'Saldo-Grundlage: das Original traegt die Kennung des offenen Objekts (ueberspringt sich selbst wie beim Kunden)', bst.length === 1 && bst[0].id === 'kopie-1' && bst[0].wk_per_year['2025'] === -3000);
  const K2 = skLaden({ _kundenstand: { share_id: SH } });
  ok('G', 'Kundenstand ohne Profil: gesperrt, keine Zeitraeume, keine Gesellschaften, kein Bestand, neutral', K2.aktiv() && K2.gesperrt() && K2.zeitraeume().length === 0 && K2.mandanten().length === 1 && K2.bestand().length === 0 && K2.angaben().splitting === false && /Steuerdaten nicht freigegeben/.test(K2.bandText()));
  ok('G', 'fuer den Kunden weitergefuehrt = Kontext, eigener Bestand und eigenes Objekt = kein Kontext', !!skLaden({ _von_kunde: { modus: 'kunde' }, _steuerbasis: bs }).aktiv() && !skLaden({ _von_kunde: { modus: 'eigen' }, _steuerbasis: bs }).aktiv() && !skLaden({ str: 'eigen' }).aktiv());
  const bt = K1.bandText();
  ok('G', 'Band: „Steuer mit den Angaben von …, Stand …“, ganze Saetze ohne Semikolon und Gedankenstrich', /^Steuer mit den Angaben von Kundin Muster, Stand 18\.11\.2026 \(Steuerprofil Fassung 3\)\./.test(bt) && !/[–—;]/.test(bt + K2.bandText()), bt);
  const tp = lies('frontend/js/tax-periods.js'), wk = lies('frontend/js/wk-aggregator.js'), md = lies('frontend/js/mandanten.js'), tx = lies('frontend/js/tax.js'), zm = lies('frontend/js/zve-manager.js');
  ok('G', 'Leser fragen den Kontext zuerst: Steuerzeitraeume (getForDateSync, getAllSync, status, loadAll)', /getForDateSync: kGetForDateSync/.test(tp) && /getAllSync: kGetAllSync/.test(tp) && /status: kStatus/.test(tp) && /loadAll: kLoadAll/.test(tp));
  ok('G', 'Leser fragen den Kontext zuerst: uebrige Objekte (Aggregator) und Mandanten (Liste, Plan)', /getAllObjectsWithWK: kGetAll/.test(wk) && /getWKForOtherObjects: kOther/.test(wk) && /function _liste\(\) \{ var K = _kontext\(\); return K \? K\.mandanten\(\) : _state\.list; \}/.test(md) && /_K\.aktiv\(\)\) return _K\.pro\(\);/.test(md));
  ok('G', 'Leser fragen den Kontext zuerst: Veranlagung (Tax.optionen, DpSteuerAngaben), zvE gesperrt', /DpSteuerKontext\.aktiv\(\)\) p = DpSteuerKontext\.angaben\(\);/.test(tx) && /DpSteuerKontext\.gesperrt\(\)\) return \{ zve: 0/.test(tx));
  ok('G', 'im Kontext wird nichts des Partners geschrieben: Snapshot, Zeitraeume, Mandanten, Investmentprofil, zvE-Profil',
    /DpSteuerKontext && DpSteuerKontext\.aktiv\(\)\) return; \} catch \(e\) \{\}\n?\s*var key = window\._currentObjKey;/.test(tx.replace(/\r/g, '')) && /create: _nurEigen\(create\)/.test(tp) && /function _save\(\) \{ if \(_kontext\(\)\) return;/.test(md) &&
    /function speichern\(splitting, kist\) \{\s*try \{ if \(window\.DpSteuerKontext && DpSteuerKontext\.aktiv\(\)\) return false;/.test(tx) && /DpSteuerKontext\.aktiv\(\)\) return; \} catch \(e\) \{\}   \/\* v3700 · zvE eines Kunden/.test(zm) && /function kSave\(objectId, snapshot\) \{\s*if \(_kontext\(\)\)/.test(wk));
  /* Gegenprobe Frontend: ohne den Kundenstand-Zweig waere der Kundenstand ohne Kontext */
  const skOhne = skQ.replace("if (!ks && !(vk && vk.modus !== 'eigen')) return null;", "if (!(vk && vk.modus !== 'eigen')) return null;   /* Gegenprobe */");
  ok('G', 'Gegenprobe: ohne den Kundenstand-Zweig rechnete der Kundenstand mit den Daten des Partners (Pruefer erkennt es)', skOhne !== skQ && (() => { const win = { _currentObjData: kd, addEventListener() {} }; vm.runInNewContext(skOhne, { window: win, document: { readyState: 'complete', addEventListener() {}, getElementById: () => null }, setTimeout() {}, console, Promise, JSON, Date }); return !win.DpSteuerKontext.aktiv(); })());
  const pkf = lies('frontend/js/partner-kunden.js');
  ok('G', 'Kunde sammelt das Profil beim Senden nur mit Bereich Steuerdaten ein', /var mitProfil = fgSauber\(a0 \? a0\.bereiche : \{\}\)\.steuerdaten && window\.DpSteuerKontext && DpSteuerKontext\.einsammeln;/.test(pkf) && /if \(sp\) body\.steuerprofil = sp;/.test(pkf));
  ok('G', 'Partner: Wahl beim Uebernehmen (kunde / eigen mit Halter), Reiter Steuer, Band fuer weitergefuehrte Objekte', /var body = \{ modus: modus, ziel: ziel \};/.test(pkf) && /ZIEL_TEXT = \{/.test(pkf) && /kurz: 'Steuer', titel: 'Steuerprofil des Kunden'/.test(pkf) && /function weitergefuehrtBand\(d\)/.test(pkf) && /\/partner\/kunden\/' \+ k\.id \+ '\/steuerprofil'/.test(pkf));
  const zt = (pkf.match(/var ZIEL_TEXT = \{[\s\S]*?\};/) || [''])[0] + (skQ.match(/function bandText[\s\S]*?\n  \}/) || [''])[0];
  ok('G', 'Kundentext Uebernehmen und Band: kein Semikolon, kein Gedankenstrich', zt.length > 400 && !/[–—]/.test(zt) && !/[a-zäöüß] ?; ?[a-zäöüß]/i.test(zt.replace(/;\s*(\n|$)/g, '')), zt.length);
  const m119 = lies('backend/migrations/119_partner_steuerprofile.sql');
  ok('G', 'Migration 119: eigene Tabelle mit Fassung, Pruefsumme, Freigabe-Fassung, eine geltende je Verbindung, Stand-Spalte', /CREATE TABLE IF NOT EXISTS public\.partner_steuerprofile/.test(m119) && /UNIQUE \(client_id, fassung\)/.test(m119) && /inhalt_hash\s+text NOT NULL/.test(m119) && /freigabe_id\s+uuid REFERENCES public\.partner_freigaben/.test(m119) && /uq_partner_steuerprofile_aktiv/.test(m119) && /ADD COLUMN IF NOT EXISTS steuerprofil_id/.test(m119));
  ok('G', 'Route: Partner liest das Steuerprofil nur lesend (GET), kein Schreibweg fuer den Partner', /partner\.get\('\/kunden\/:id\/steuerprofil'/.test(lies('backend/src/routes/partnerKunden.js')) && !/partner\.(put|post|delete)\('\/kunden\/:id\/steuerprofil/.test(lies('backend/src/routes/partnerKunden.js')));
  antworte = async () => ({ rows: [], rowCount: 0 });
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

console.log('\npartner-kunden-pruefen v3700 · ' + n + ' Punkte, ' + (n - rot) + ' gruen, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
