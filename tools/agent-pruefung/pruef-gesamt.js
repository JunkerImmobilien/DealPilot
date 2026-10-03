'use strict';
/* GESAMTTEST durch den Agenten, mit Marcels eigenen Saetzen.
 *
 * Geprueft wird nicht, ob die Antwort "gut klingt", sondern WELCHE
 * WERKZEUGE gewaehlt wurden und ob die Sperren halten. Eine schoene
 * Antwort auf eine falsche Quelle ist der gefaehrlichere Fehler. */
const { query } = require('/app/src/db/pool');
const agent = require('/app/src/services/agentLauf');

(async function () {
  const u = await query(
    `SELECT user_id FROM telegram_links WHERE bestaetigt_am IS NOT NULL LIMIT 1`);
  const uid = u.rows[0].user_id;
  const liste = await query(
    `SELECT id FROM objects WHERE user_id = $1 ORDER BY updated_at DESC`, [uid]);
  const ids = liste.rows.map((r) => r.id);

  let fehler = 0;
  async function probe(titel, frage, erwartet, opts) {
    const o = opts || {};
    const protokoll = [];
    const ctx = { userId: uid, letzteListe: o.liste === false ? null : ids,
      letztesObjekt: o.letztes || null, entwurf: o.entwurf || null, protokoll,
      merkeObjekt(id) { this.letztesObjekt = id; }, merkeListe(i) { this.letzteListe = i; } };
    let r;
    try {
      r = await agent.laufen(frage, ctx, {
        verlauf: o.verlauf || [], darfKosten: Boolean(o.darfKosten) });
    } catch (e) {
      console.log(titel + '\n  AUSNAHME: ' + e.message + '\n'); fehler++; return null;
    }
    const benutzt = protokoll.map((p) => p.werkzeug);
    let ok = true, warum = '';
    /* v1813f · ERWARTET DARF EINE LISTE SEIN. Seit v1813 gibt es fuer
       dieselbe Frage bessere Wege: 'und die Miete?' beantwortet
       objekt_felder_liste mit bereich=miete genauer als objekt_lesen, und
       eine Rangliste ist objekte_rangliste statt portfolio_lesen.

         > Ein Pruefer, der EINEN Weg erwartet, meldet jeden besseren als
         > Fehler. Das ist hier schon einmal passiert und steht als
         > Prueferfehler Nr. 2 in der README. */
    const erlaubt = [].concat(erwartet.werkzeug || []);
    if (erlaubt.length && !erlaubt.some((w) => benutzt.indexOf(w) >= 0)) {
      ok = false; warum = 'ohne ' + erlaubt.join(' oder ');
    }
    if (erwartet.nicht && benutzt.indexOf(erwartet.nicht) >= 0) {
      ok = false; warum = 'hat ' + erwartet.nicht + ' AUSGEFUEHRT';
    }
    if (erwartet.enthaelt && !new RegExp(erwartet.enthaelt, 'i').test(r.text)) {
      ok = false; warum = 'Antwort ohne "' + erwartet.enthaelt + '"';
    }
    if (!ok) fehler++;
    console.log(titel);
    console.log('  ' + (ok ? 'ok' : 'FALSCH (' + warum + ')')
      + '   Werkzeuge: ' + (benutzt.join(', ') || 'keine'));
    console.log('  > ' + String(r.text).replace(/\s+/g, ' ').slice(0, 180));
    console.log('');
    return r;
  }

  console.log('═══ A-2 · Portfolio-Rueckfragen ═══\n');
  await probe('„Wie hoch ist die Gesamttilgung aller Objekte?"',
    'Wie hoch ist die Gesamttilgung aller Objekte?',
    { werkzeug: 'portfolio_lesen', enthaelt: '51\\.410' });

  await probe('„Welche Objekte haben den hoechsten Finanzierungsbedarf?"',
    'Welche Objekte haben aktuell den höchsten Finanzierungsbedarf?',
    { werkzeug: 'portfolio_lesen' });

  console.log('═══ A-3 · Objektbezug ═══\n');
  await probe('„was hat Objekt 3 fuer Kerndaten?"',
    'sag mir was Objekt 3 davon an Kerndaten hat',
    { werkzeug: 'objekt_lesen' });

  await probe('Anknuepfung: „und die Miete?"',
    'und die Miete?',
    { werkzeug: ['objekt_lesen', 'objekt_felder_liste', 'objekt_kennzahlen'] },
    { letztes: ids[2], verlauf: [
      { rolle: 'user', text: 'was hat Objekt 3 für Kerndaten?' },
      { rolle: 'assistant', text: 'Hermannstraße 9, Hüllhorst: ETW, 100 m², Baujahr 1962.' }] });

  console.log('═══ A-4 · Auswahlfeld, unklare Angabe ═══\n');
  await probe('„setz bei Nummer 1 den Zustand auf total marode"',
    'setz bei Nummer 1 den Zustand auf total marode',
    { enthaelt: '(neubau|gut|normal|renovierung|sanierung)' });

  console.log('═══ A-5 · Sammelaktion, GELD ═══\n');
  await probe('„mach fuer alle Objekte eine Marktpreisindikation"',
    'Erstelle für alle Objekte eine Marktpreisindikation.',
    { werkzeug: 'marktbericht_preis_alle', nicht: 'marktbericht_abrufen' });

  console.log('═══ GELDSPERRE: „ja" OHNE vorherige Preisansage ═══\n');
  await probe('„ja, mach das" ohne Preisansage davor',
    'ja mach das',
    { nicht: 'marktbericht_abrufen' },
    { darfKosten: false });

  console.log('═══ A-8 · Berichtsstufe erfragen ═══\n');
  await probe('„kannst du mir einen Marktbericht ziehen?"',
    'Kannst du mir mal einen aktuellen Marktbericht für Objekt 1 ziehen?',
    { nicht: 'marktbericht_abrufen' });

  console.log('═══ A-6 · Anlage mit allen genannten Angaben ═══\n');
  await probe('„leg mir eine ETW an mit allen Daten"',
    'Leg mir eine Eigentumswohnung in der Musterstraße 12 in Hannover an. '
    + 'Die Wohnung hat 85 m², vier Zimmer, liegt im zweiten Obergeschoss und ist aktuell vermietet.',
    { werkzeug: 'objekt_anlegen' });

  /* aufraeumen: was der Lauf angelegt hat */
  const weg = await query(
    `DELETE FROM objects WHERE user_id = $1 AND data::jsonb->>'ort' = 'Hannover'
       AND created_at > now() - interval '10 minutes' RETURNING id`, [uid]);
  if (weg.rows.length) console.log('(' + weg.rows.length + ' Testobjekt(e) wieder entfernt.)\n');

  console.log('DECKUNG: 9 Proben durch den Agenten, ' + fehler + ' falsch.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('AUSNAHME: ' + e.message); process.exit(2); });
