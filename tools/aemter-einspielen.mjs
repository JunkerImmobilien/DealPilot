#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * aemter-einspielen.mjs — v2442
 *
 * RECHERCHIERTE AEMTER IN `unterlagen_aemter` — MIT UNSEREM EIGENEN BELEG
 *
 * Marcel am 19.10.2026: „für die Unterlagen-App weiter machen, wir
 * brauchen mehr Werte." Gemessen vorher auf Staging: 27 Ämter in 6
 * Gemeinden, KEINES mit Ansprechpartnern.
 *
 * Die Eingabe ist eine Recherche (Vorgehen wie der Agent
 * `aemter-recherche`): je Gemeinde und Art Behörde, Adresse, Quelle,
 * bis zu zwei Personen mit ihrer Seite. Die Recherche ist eine
 * BEHAUPTUNG. Dieser Einspielweg prüft sie mit denselben Funktionen,
 * die auch die KI-Recherche im Modal prüfen (echter
 * `unterlagenService.js`):
 *
 *   belegPruefen   steht die Amtsadresse auf der Quellseite?
 *   belegSeiten    welche Adressen stehen auf WELCHER Seite (pro_seite)?
 *   personenAus    höchstens zwei, Name oder Adresse auf einer selbst
 *                  gelesenen Seite, sonst fällt die Person (v2440);
 *                  weniger als zwei ohne Namen -> Amtsweg (v2153)
 *
 * Geschrieben wird der GEMEINDEWEITE Satz (`gemeinde-<kern>`, `plz` =
 * PLZ-Leitbereiche, v2440). Zuständigkeiten, die sich innerhalb der
 * Gemeinde teilen (`geteilt: true`, z. B. Grundbuch Berlin), werden
 * NICHT geschrieben — ein gemeindeweiter Satz wäre dort für die
 * meisten Adressen falsch.
 *
 * Bestehende PLZ-genaue Sätze derselben Gemeinde und Art bekommen die
 * geprüften Personen NUR, wenn sie selbst keine haben UND es dasselbe
 * Amt ist (gleiche Adresse oder gleicher Server der Quelle).
 *
 * Aufruf (nur im Backend-Container, dort sind pg und die Umgebung echt):
 *   node aemter-einspielen.mjs datei1.json [datei2.json …] --trocken
 *   node aemter-einspielen.mjs datei1.json …            (schreibt)
 *
 * --trocken ruft die Seiten ab und zählt, schreibt aber nichts.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const KANDIDATEN = ['/app/src', path.join(process.cwd(), 'backend', 'src'), path.join(process.cwd(), 'src')];
const BASIS = KANDIDATEN.find((k) => fs.existsSync(path.join(k, 'services', 'unterlagenService.js')));
if (!BASIS) { console.error('unterlagenService.js nicht gefunden'); process.exit(2); }
const require_ = createRequire(path.join(BASIS, 'x.js'));
const U = require_('./services/unterlagenService.js');
const { query } = require_('./db/pool');

const argv = process.argv.slice(2);
const TROCKEN = argv.includes('--trocken');
const dateien = argv.filter((a) => !a.startsWith('--'));
if (!dateien.length) { console.error('Keine Eingabedatei.'); process.exit(2); }

const link = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim() : '');
const s = (v) => (typeof v === 'string' ? v.trim() : '');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

const z = {
  gemeinden: 0, saetze: 0, geschrieben: 0, geteilt: 0, ungueltig: 0,
  belegt: 0, personen_eingang: 0, personen_geprueft: 0, personen_verworfen: 0,
  mit_personen: 0, plz_saetze_ergaenzt: 0
};
const bericht = [];

async function einAmt(g, a) {
  const art = s(a.art);
  if (!U.ARTEN_MAP[art]) { z.ungueltig++; return { art, status: 'unbekannte Art' }; }
  if (a.geteilt) { z.geteilt++; return { art, status: 'geteilt — nicht gemeindeweit geschrieben' }; }
  const quelle = link(a.quelle_url);
  if (!s(a.behoerde) || !quelle) { z.ungueltig++; return { art, status: 'ohne Behörde oder Quelle' }; }
  z.saetze++;

  const email = U.mailSauber(a.email);
  const roh = (Array.isArray(a.ansprechpartner) ? a.ansprechpartner : []).slice(0, 4);
  z.personen_eingang += roh.length;
  const seiten = (Array.isArray(a.seiten) ? a.seiten : []).map(link).filter(Boolean);
  const personenSeiten = roh.map((p) => link(p && p.seite)).filter(Boolean);
  /* Quelle zuerst, dann die Personenseiten, dann der Rest — höchstens
     sechs liest belegSeiten. Die Personenseiten MÜSSEN dabei sein,
     sonst lässt sich ein Name nicht nachlesen. */
  const lesen = [...new Set([quelle, ...personenSeiten, ...seiten])].slice(0, 6);

  let beleg = email ? await U.belegPruefen(email, quelle) : { ok: false, grund: 'keine Adresse genannt' };
  const detail = await U.belegSeiten(email, lesen);
  if (email && !beleg.ok && detail.bestaetigt) {
    const fund = (detail.pro_seite.find((x) => x.mails.includes(email)) || {}).url;
    beleg = { ok: true, grund: 'auf einer weiteren amtlichen Seite gefunden (' + fund + ')' };
  }
  if (beleg.ok) z.belegt++;

  const personen = U.personenAus(
    roh.map((p) => ({ name: s(p && p.name), funktion: s(p && p.funktion), email: s(p && p.email), telefon: s(p && p.telefon) })),
    email, detail, quelle);
  z.personen_geprueft += personen.length;
  z.personen_verworfen += Math.max(0, roh.length - personen.length);
  if (personen.length) z.mit_personen++;

  const schluessel = U.gemeindeweitSchluessel(g.gemeinde);
  const plz = (Array.isArray(g.plz_praefixe) ? g.plz_praefixe : [])
    .map((x) => String(x).replace(/\D/g, '')).filter((x) => x.length >= 2 && x.length <= 5).join(',');
  if (!schluessel || !plz) { z.ungueltig++; return { art, status: 'ohne Schlüssel oder PLZ-Leitbereich' }; }

  const zeile = {
    art, behoerde: s(a.behoerde), email: email || null, beleg_ok: !!beleg.ok, beleg_grund: beleg.grund,
    personen: personen.map((p) => (p.name || p.email) + (p.bestaetigt ? ' [Adresse belegt]' : p.name_belegt ? ' [Name belegt]' : '')),
    verworfen: roh.length - personen.length
  };
  if (TROCKEN) return Object.assign(zeile, { status: 'trocken' });

  const kanal = U.kanalAus(s(a.kanal), email, link(a.antrag_url));
  /* Dieselbe Abfrage wie amtHolen (v2152), inklusive der Regel, dass eine
     leere Personenliste eine gefüllte nicht überschreibt. */
  await query(
    `INSERT INTO unterlagen_aemter
       (gemeinde_schluessel, plz, ort, art, behoerde, abteilung, email, telefon,
        kanal, antrag_url, quelle_url, seiten, gebuehr, hinweis, kreis, bundesland,
        beleg_ok, beleg_grund, ansprechpartner, geprueft_am, erstellt_von)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),NULL)
     ON CONFLICT (gemeinde_schluessel, art) DO UPDATE SET
       plz = EXCLUDED.plz, ort = EXCLUDED.ort,
       behoerde = EXCLUDED.behoerde, abteilung = EXCLUDED.abteilung,
       email = EXCLUDED.email, telefon = EXCLUDED.telefon, kanal = EXCLUDED.kanal,
       antrag_url = EXCLUDED.antrag_url, quelle_url = EXCLUDED.quelle_url,
       seiten = EXCLUDED.seiten, gebuehr = EXCLUDED.gebuehr,
       hinweis = EXCLUDED.hinweis, kreis = EXCLUDED.kreis,
       bundesland = EXCLUDED.bundesland, beleg_ok = EXCLUDED.beleg_ok,
       beleg_grund = EXCLUDED.beleg_grund,
       ansprechpartner = CASE
         WHEN jsonb_array_length(EXCLUDED.ansprechpartner) > 0
           THEN EXCLUDED.ansprechpartner
         ELSE unterlagen_aemter.ansprechpartner
       END,
       geprueft_am = now()`,
    [schluessel, plz, s(g.gemeinde), art, s(a.behoerde), s(a.abteilung) || null,
     email || null, s(a.telefon) || null, kanal, link(a.antrag_url) || null, quelle,
     JSON.stringify({ liste: lesen, pro_seite: detail.pro_seite, alternativen: detail.alternativen,
                      beleg_quelle: null, herkunft: 'Ämterliste v2442 (Recherche 19.10.2026)' }),
     s(a.gebuehr) || null, s(a.hinweis) || null, s(g.kreis) || null, s(g.bundesland) || null,
     !!beleg.ok, 'Ämterliste (Recherche 19.10.2026, von DealPilot nachgelesen): ' + beleg.grund,
     JSON.stringify(personen)]);
  z.geschrieben++;

  /* PLZ-genaue Altsätze derselben Gemeinde und Art: Personen nur
     nachtragen, wenn es dasselbe Amt ist und sie noch keine haben. */
  if (personen.length) {
    const alt = await query(
      `SELECT id, gemeinde_schluessel, plz, ort, email, quelle_url FROM unterlagen_aemter
        WHERE art = $1 AND gemeinde_schluessel !~ '^gemeinde-'
          AND jsonb_array_length(ansprechpartner) = 0`, [art]);
    for (const r of alt.rows) {
      if (U.ortKern(r.ort) !== U.ortKern(g.gemeinde)) continue;
      if (!plz.split(',').some((x) => String(r.plz || '').startsWith(x))) continue;
      const gleich = (email && r.email && r.email.toLowerCase() === email)
        || (host(r.quelle_url) && host(r.quelle_url) === host(quelle));
      if (!gleich) continue;
      const eigen = personen.filter((p) => !p.email || !r.email || p.email !== r.email.toLowerCase());
      if (eigen.length !== personen.length) continue; /* Empfänger wäre zugleich Person */
      await query('UPDATE unterlagen_aemter SET ansprechpartner = $2 WHERE id = $1',
        [r.id, JSON.stringify(personen)]);
      z.plz_saetze_ergaenzt++;
    }
  }
  return Object.assign(zeile, { status: 'geschrieben' });
}

for (const datei of dateien) {
  let liste;
  try { liste = JSON.parse(fs.readFileSync(datei, 'utf8')); }
  catch (e) { console.error('Nicht lesbar: ' + datei + ' — ' + e.message); process.exit(2); }
  for (const g of (Array.isArray(liste) ? liste : [liste])) {
    z.gemeinden++;
    const zeilen = [];
    for (const a of (Array.isArray(g.aemter) ? g.aemter : [])) {
      try { zeilen.push(await einAmt(g, a)); }
      catch (e) { z.ungueltig++; zeilen.push({ art: a && a.art, status: 'Fehler: ' + e.message }); }
    }
    bericht.push({ gemeinde: g.gemeinde, zeilen });
    console.log(String(g.gemeinde).padEnd(26) + zeilen.map((r) => r.art + ':' + (r.status === 'geschrieben' || r.status === 'trocken'
      ? (r.beleg_ok ? 'B' : '-') + (r.personen ? r.personen.length : 0) : 'x')).join(' '));
  }
}
fs.writeFileSync('/tmp/aemter-einspielen-bericht.json', JSON.stringify(bericht, null, 1));
console.log('');
console.log((TROCKEN ? 'TROCKEN — nichts geschrieben. ' : '') + JSON.stringify(z));
console.log('Legende je Art: B = Amtsadresse belegt, - = nicht belegt, Zahl = geprüfte Ansprechpartner, x = nicht geschrieben');
console.log('Bericht: /tmp/aemter-einspielen-bericht.json');
process.exit(0);
