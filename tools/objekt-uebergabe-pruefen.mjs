/* objekt-uebergabe-pruefen.mjs · v3317
   Prueft "Objekt an Kunden uebergeben" (backend/src/services/objektUebergabe.js).

   A · ohne Datenbank, mit den ECHTEN Modulen (nur db/pool, Mailversand, Objekt- und
       Fotodienst ersetzt):
       RAHMEN    die Einladungs-Mail ist nach dem Herausloesen des Rahmens (marke/rahmen/knopf)
                 Zeichen fuer Zeichen dieselbe wie vor v3317 (Stand ab83a694 aus git)
       INHALT    Zusammenfassung nur aus GESPEICHERTEN Werten; Stufe aus dem gespiegelten
                 score-tiers.js; Cashflow Monat = Jahr / 12; Wertangabe mit Herkunft
       MAIL      Partnermarke (Name, Akzent, Reply-To, Absendername), DealPilot NUR als
                 "Plattform" im Fuss, kein data:-Bild, keine Quellennamen, Satz escaped
       KOPIE     Felder, die beim Kunden nichts zu suchen haben, fallen weg (Nummer,
                 Gewonnen/Verloren, Halter), alles andere bleibt; Herkunft _uebergabe
       TOKEN     Hash statt Token, Testadressen (RFC 2606/6761) gehen nie ueber SMTP

   B · --live  echte Staging-Datenbank im Container dealpilot-backend
       (tools/objekt-uebergabe-pruefen.live.cjs): Token-Lebenszyklus gesendet ->
       geoeffnet -> uebernommen, Ablauf, Widerruf, Berechtigung (nur eigener Partner,
       nur eigenes Objekt, Mitglied ja / fremder Partner nein), Kopie statt
       Verschiebung (Original unveraendert, Fotos in der Ablage des Kunden),
       Platzvergabe nur fuer neue Mandanten, kein Platz -> 409 vor dem Senden,
       Doppel-Uebernahme (auch gleichzeitig) abgewiesen. Legt Testkonten
       (@uebergabe-pruefer.dealpilot.test, is_test_user) an und raeumt sie wieder ab.
       NUR Staging - ein anderer Server wird abgelehnt.

   RC=0 ist sauber. */
import { createRequire } from 'node:module';
import Module from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(WURZEL, 'backend', 'src');
const ALT_STAND = 'ab83a694';   /* letzter Stand vor v3317 */

let fehler = 0, n = 0;
const ok = (bed, text) => { n++; if (!bed) { fehler++; console.log('  ROT  ' + text); } else console.log('  ok   ' + text); };

/* ── Ersatzmodule ──────────────────────────────────────────────────────── */
const gesendet = [];
const stub = (rel, exp) => { const f = require.resolve(join(SRC, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
stub('db/pool.js', { query: async () => { throw new Error('keine Datenbank im Offline-Teil'); }, pool: {} });
stub('services/planService.js', {});
stub('services/mailerService.js', { sendMail: async (o) => { gesendet.push(o); return { dryRun: false, to: o.to }; } });
stub('services/objectService.js', {});
stub('services/objektFotos.js', {});
/* routes/partnerLogo.js zieht express (lokal nicht installiert) - logoUrl ist dieselbe reine Funktion */
const logoUrl = (basis, id, art, v) => (!basis || !id) ? null
  : String(basis).replace(/\/+$/, '') + '/api/v1/public/partner-logo/' + id + '/' + art + '.png' + (v ? '?v=' + encodeURIComponent(v) : '');
stub('routes/partnerLogo.js', Object.assign(() => {}, { logoUrl }));

const mail = require(join(SRC, 'services', 'resellerInviteMail.js'));
const U = require(join(SRC, 'services', 'objektUebergabe.js'));

/* ── A1 · RAHMEN ───────────────────────────────────────────────────────── */
console.log('A1 · RAHMEN - Einladung unveraendert nach dem Herausloesen');
{
  const altQuelle = execFileSync('git', ['show', ALT_STAND + ':backend/src/services/resellerInviteMail.js'], { cwd: WURZEL, encoding: 'utf8' });
  const datei = join(SRC, 'services', '__alt_resellerInviteMail.js');
  const m = new Module(datei); m.filename = datei; m.paths = Module._nodeModulePaths(dirname(datei));
  m._compile(altQuelle, datei);
  const alt = m.exports;
  const faelle = [
    { name: 'mit Marke, PNG-Logo', r: { id: '11111111-2222-3333-4444-555555555555', name: 'Konto', brand_name: 'Muster & Partner', brand_logo_b64: 'data:image/png;base64,AAAA', brand_accent: '#8E2C48', brand_mail_accent: '', whitelabel_enabled: true, brand_email: 'kontakt@muster.example', brand_website: 'muster.example', brand_company: 'Muster & Partner GmbH', hat_variante: true, stand: 1731400000, basis: 'https://app.staging.dealpilot.immo' } },
    { name: 'mit Marke, SVG ohne Variante', r: { id: '11111111-2222-3333-4444-555555555555', brand_name: 'Nord <Test>', brand_logo_b64: 'data:image/svg+xml;base64,AAAA', brand_accent: '#ffffff', whitelabel_enabled: true, hat_variante: false, basis: 'https://x.test' } },
    { name: 'ohne Marke', r: { name: 'Einfach Konto', whitelabel_enabled: false } }
  ];
  for (const f of faelle) {
    gesendet.length = 0;
    const p = { email: 'kunde@beispiel.test', displayName: 'Erika "E" Muster', link: 'https://x.test/?rp_invite=abc&x=1', reseller: f.r };
    await alt.sendInvite(p); const a = gesendet[0];
    await mail.sendInvite(p); const b = gesendet[1];
    const gleich = ['from', 'fromName', 'replyTo', 'to', 'subject', 'text', 'html'].every((k) => a[k] === b[k]);
    ok(gleich, 'Einladung "' + f.name + '" identisch (Betreff, Text, HTML, Absender, Reply-To)');
  }
}

/* ── A2 · INHALT ───────────────────────────────────────────────────────── */
console.log('A2 · INHALT - nur gespeicherte Werte');
const daten = {
  str: 'Lindenallee', hnr: '14', plz: '32052', ort: 'Herford', objart: 'MFH', _obj_seq: '2026-042',
  _dealpilot_score: 72, _kpis_cf_ns: 2400, _kpis_bmy: 5.43, _kpis_dscr: 1.27,
  svwert: '310000', svw_herkunft: 'bank', _deal_won: true, _deal_won_at: '2026-10-01', _deal_lost_state: 'x', halter: 'm-17',
  kp: 289000, nkm: 1450
};
const z = U.zusammenfassung(daten, { hatFoto: true });
ok(z.adresse === 'Lindenallee 14, 32052 Herford', 'Adresse aus str/hnr/plz/ort');
ok(z.score === 72 && z.stufe && z.stufe.wort === 'Gut' && z.stufe.versal === 'GUT', 'Score 72 -> Gut (score-tiers.js)');
ok(U.zusammenfassung({ _dealpilot_score: 85 }).stufe.wort === 'Sehr gut', 'Score 85 -> Sehr gut');
ok(U.zusammenfassung({ _dealpilot_score: 50 }).stufe.wort === 'Solide', 'Score 50 -> Solide');
ok(U.zusammenfassung({ _dealpilot_score: 34 }).stufe.wort === 'Kritisch', 'Score 34 -> Kritisch');
ok(U.zusammenfassung({}).score === null && U.zusammenfassung({}).stufe === null, 'ohne gespeicherten Score keine Stufe (keine Rechnung)');
ok(z.cashflow_jahr === 2400 && z.cashflow_monat === 200, 'Cashflow: Jahr gespeichert, Monat = Jahr / 12');
ok(z.rendite_brutto === 5.43 && z.dscr === 1.27, 'Rendite und DSCR unveraendert aus _kpis_bmy/_kpis_dscr');
ok(z.marktwert && z.marktwert.wert === 310000 && z.marktwert.herkunft === 'Bankbewertung', 'Wertangabe aus svwert mit Herkunft');
ok(U.zusammenfassung({ svwert: '' }).marktwert === null && U.zusammenfassung({ svwert: 0 }).marktwert === null, 'ohne Wertangabe keine Zeile');
ok(U.zusammenfassung({ svwert: 5 }).marktwert.herkunft === null && !/\(\)|\(Wertangabe\)/.test(U.mailBauen({ zusammenfassung: U.zusammenfassung({ svwert: 5 }), link: 'x', reseller: {} }).html), 'Wertangabe ohne Herkunft ohne Klammer');
ok(U.zusammenfassung({ _kpis_cf_ns: null }).cashflow_monat === null, 'null bleibt null (Number(null) ist 0 - Falle)');

/* ── A3 · MAIL ─────────────────────────────────────────────────────────── */
console.log('A3 · MAIL - Partnermarke');
const marke = { id: '11111111-2222-3333-4444-555555555555', brand_name: 'Kessler & Roth Finanzierung', brand_logo_b64: 'data:image/png;base64,AAAA',
  brand_accent: '#8E2C48', whitelabel_enabled: true, brand_email: 'kontakt@kessler-roth.example', brand_website: 'kessler-roth.example',
  brand_company: 'Kessler & Roth GmbH', hat_variante: true, stand: 1, basis: 'https://app.staging.dealpilot.immo' };
const mb = U.mailBauen({ zusammenfassung: z, nachricht: 'Schau dir das mal an <script>x</script>\nzweite Zeile', anzeigeName: 'Erika',
  link: 'https://app.staging.dealpilot.immo/?rp_uebergabe=TOKEN123', bildUrl: 'https://app.staging.dealpilot.immo/api/v1/public/objekt-uebergabe/bild/abc.jpg',
  ablauf: '2026-12-12T10:00:00Z', reseller: marke });
ok(mb.marke.fromName === 'Kessler & Roth Finanzierung' && mb.marke.replyTo === 'kontakt@kessler-roth.example', 'Absendername = Partner, Reply-To = Partner');
ok(mb.html.includes('#8E2C48') && mb.html.includes('/api/v1/public/partner-logo/'), 'Partnerfarbe und gehostetes Partnerlogo');
const dpVorkommen = (mb.html.match(/DealPilot/g) || []).length;
ok(dpVorkommen === 1 && mb.html.includes('Plattform: DealPilot'), 'DealPilot nur einmal - als "Plattform: DealPilot" im Fuss (' + dpVorkommen + ')');
ok(!/data:/.test(mb.html), 'kein data:-Bild in der Mail');
ok(!/sprengnetter|pricehubble|immobilienscout|immoscout/i.test(mb.html + mb.text), 'keine Quellennamen');
ok(mb.html.includes('&lt;script&gt;') && !mb.html.includes('<script>'), 'persoenlicher Satz escaped');
ok(mb.html.includes('Score 72 · GUT') && mb.html.includes('200 €') && mb.html.includes('5,43 %') && mb.html.includes('1,27'), 'Score, Cashflow/Monat, Rendite, DSCR in der Mail');
ok(mb.html.includes('310.000 €') && mb.html.includes('Bankbewertung'), 'Wertangabe in der Mail');
ok(mb.html.includes('Objekt öffnen') && mb.html.includes('rp_uebergabe=TOKEN123') && mb.html.includes('/objekt-uebergabe/bild/abc.jpg'), 'Knopf, Link und Titelfoto');
ok(mb.subject === 'Kessler & Roth Finanzierung übergibt dir ein Objekt: Lindenallee 14, 32052 Herford', 'Betreff mit Partner und Adresse');
ok(mb.text.includes('Plattform: DealPilot') && mb.text.includes('rp_uebergabe=TOKEN123'), 'Textfassung mit Link und Plattform-Fuss');
ok(mb.html.includes('12.12.2026'), 'Ablaufdatum in der Mail');
const ohne = U.mailBauen({ zusammenfassung: U.zusammenfassung({ str: 'Weg', hnr: '1' }), link: 'https://x.test/?rp_uebergabe=T', reseller: marke });
ok(!ohne.html.includes('<img src="https://x.test') && ohne.html.includes('–'), 'ohne Foto kein Bild, fehlende Kennzahl als Strich');

/* ── A4 · KOPIE ────────────────────────────────────────────────────────── */
console.log('A4 · KOPIE - was mitgeht');
const k = U.datenFuerKopie(daten, { uebergabe_id: 'u1', von: 'Kessler & Roth Finanzierung' });
ok(!('_obj_seq' in k) && !('_deal_won' in k) && !('_deal_won_at' in k) && !('_deal_lost_state' in k) && !('halter' in k), 'Nummer, Gewonnen/Verloren, Halter fallen weg');
ok(k._dealpilot_score === 72 && k._kpis_cf_ns === 2400 && k.kp === 289000 && k.nkm === 1450 && k.str === 'Lindenallee', 'Berechnung und Eingaben bleiben');
ok(k._uebergabe && k._uebergabe.von === 'Kessler & Roth Finanzierung', 'Herkunft _uebergabe am Datensatz');
ok(daten._obj_seq === '2026-042' && daten.halter === 'm-17', 'Original-Daten nicht veraendert (tiefe Kopie)');

/* ── A5 · TOKEN ────────────────────────────────────────────────────────── */
console.log('A5 · TOKEN und Testadressen');
ok(U.hash('abc') === crypto.createHash('sha256').update('abc').digest('hex') && U.hash('abc') !== 'abc', 'gespeichert wird SHA-256, nicht das Token');
ok(['a@b.test', 'x@demo.invalid', 'y@example.com', 'z@sub.example.org', 'q@host.localhost'].every(U.istTestadresse), 'reservierte Domains = Testadresse');
ok(!['kunde@gmail.com', 'a@dealpilot.immo', 'b@example-firma.de'].some(U.istTestadresse), 'echte Domains keine Testadresse');
ok(U.GUELTIG_TAGE === 30, 'Gueltigkeit 30 Tage');
const quelle = readFileSync(join(SRC, 'services', 'objektUebergabe.js'), 'utf8');
ok(/WHERE id = \$1 AND status IN \('gesendet','geoeffnet'\) AND expires_at > now\(\)/.test(quelle), 'Uebernahme greift die Zeile atomar (nur einmal)');
ok(/FROM objects WHERE id = \$1 AND user_id = \$2/.test(quelle), 'Anlegen nur fuer eigene Objekte (user_id des Partners)');
const route = readFileSync(join(SRC, 'routes', 'resellerPortal.js'), 'utf8');
ok(/res\.json\(\{ ok: true, uebergabe: r\.uebergabe, mail: r\.mail \}\)/.test(route), 'Token geht nicht an den Browser zurueck');

/* ── B · --live ────────────────────────────────────────────────────────── */
if (process.argv.includes('--live')) {
  const server = (process.argv.find((a) => a.startsWith('--server=')) || '--server=root@116.203.214.11').slice(9);
  if (server !== 'root@116.203.214.11') { console.log('ROT: --live nur gegen Staging (116.203.214.11)'); process.exit(1); }
  console.log('B · echte Datenbank auf Staging (Testkonten, werden wieder abgeraeumt)');
  const code = readFileSync(join(WURZEL, 'tools', 'objekt-uebergabe-pruefen.live.cjs'), 'utf8');
  const r = spawnSync('ssh', [server, 'docker exec -i -w /app dealpilot-backend node -'], { input: code, encoding: 'utf8', timeout: 180000 });
  const zeilen = String(r.stdout || '').split('\n').filter((l) => /^(OK|ROT|INFO) /.test(l));
  if (!zeilen.length) ok(false, 'kein Ergebnis aus dem Container: ' + String(r.stderr || r.stdout).trim().slice(0, 300));
  for (const l of zeilen) {
    if (l.startsWith('INFO ')) { console.log('  ..   ' + l.slice(5)); continue; }
    ok(l.startsWith('OK '), l.slice(l.indexOf(' ') + 1));
  }
  if (!/^ENDE/m.test(String(r.stdout || ''))) ok(false, 'Live-Lauf nicht bis zum Ende gekommen: ' + String(r.stderr || '').trim().slice(0, 300));
}

console.log(fehler ? '\nROT: ' + fehler + ' von ' + n + ' Punkten' : '\nsauber (RC=0), ' + n + ' Punkte');
process.exit(fehler ? 1 : 0);
