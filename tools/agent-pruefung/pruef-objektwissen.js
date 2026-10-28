'use strict';
/* pruef-objektwissen.js — v3025
 *
 * Marcel 28.10.2026: „wird alles, was wir heute ergänzt haben, auch immer im
 * Objektwissen gespeichert, und kann der Telegram-Bot darauf zugreifen?"
 *
 * Prueft am ECHTEN Register (agentWerkzeuge.js) gegen die ECHTE Datenbank,
 * ohne Modell und ohne Kosten:
 *
 *   1 · Welche Bot-Werkzeuge erreichen die Unterlagen-Auswertung eines Objekts
 *       (`data._dok_auswertung`)? Gesucht werden Merkmale AUS dem Datensatz
 *       selbst (erster Risikotitel, erste Abt.-II-Last, erste Massnahme,
 *       erste offene Frage, ein Dokumentname ...) in der Werkzeug-Ausgabe —
 *       nicht im Quelltext.
 *   2 · `objekt_unterlagen` steht im Register (Stufe lesen), liefert alle
 *       Abschnitte, rechnet den Anteil nur als reine Rechnung (ETW x MEA,
 *       sonst ganzes Haus) und gibt keine Personendaten (E-Mail, Telefon,
 *       IBAN) und keinen Dateinamen heraus.
 *   3 · Ein Objekt OHNE Auswertung bekommt den fertigen Satz, wie sie
 *       entsteht — keine Erfindung.
 *
 *   docker cp tools/agent-pruefung/pruef-objektwissen.js dealpilot-backend:/tmp/
 *   docker exec dealpilot-backend node /tmp/pruef-objektwissen.js [objekt-id]
 *
 * Ohne Objekt-Id nimmt er das zuletzt geaenderte Objekt mit Auswertung.
 * --zeigen druckt die Werkzeug-Ausgabe von objekt_unterlagen.
 */
const path = require('path');
const fs = require('fs');

const _orte = [
  path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'agentWerkzeuge.js'),
  path.join(__dirname, '..', '..', 'src', 'services', 'agentWerkzeuge.js'),
  path.join(__dirname, 'src', 'services', 'agentWerkzeuge.js'),   /* Arbeitskopie im Container */
  '/app/src/services/agentWerkzeuge.js'
];
const _quelle = _orte.find((p) => fs.existsSync(p));
if (!_quelle) { console.log('ABBRUCH: agentWerkzeuge.js nicht gefunden.'); process.exit(2); }
const W = require(_quelle);
const { query } = require(path.join(path.dirname(_quelle), '..', 'db', 'pool.js'));

let ok = 0, schlecht = 0;
const zeilen = [];
function pruefe(name, bedingung, hinweis) {
  if (bedingung) { ok++; zeilen.push('  [ok]   ' + name); }
  else { schlecht++; zeilen.push('  [NEIN] ' + name + (hinweis ? ' — ' + hinweis : '')); }
}
function ctxFuer(uid) {
  return { userId: uid, letzteListe: null, letztesObjekt: null, entwurf: null, protokoll: [],
    merkeObjekt: function (i) { this.letztesObjekt = i; },
    merkeListe: function (i) { this.letzteListe = i; },
    anlageFertig: async function () {}, angebotObjekt: null,
    merkeAngebot: async function () {}, angebotVerbraucht: async function () {} };
}
const flach = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
/* ein Merkmal = die ersten 40 Zeichen eines Textes aus dem Datensatz */
const merk = (s) => flach(s).slice(0, 40);

(async () => {
  const argId = process.argv.slice(2).find((a) => /^[0-9a-f-]{36}$/.test(a));
  const zeigen = process.argv.includes('--zeigen');
  console.log('== pruef-objektwissen (v3025) ==');
  const r = await query(
    `SELECT id, user_id, data FROM objects
      WHERE COALESCE(data->>'_dok_auswertung','') <> '' ${argId ? 'AND id = $1' : ''}
      ORDER BY updated_at DESC LIMIT 1`, argId ? [argId] : []);
  if (!r.rows.length) { console.log('ABBRUCH: kein Objekt mit Unterlagen-Auswertung.'); process.exit(2); }
  const o = r.rows[0];
  const d = o.data || {};
  const dok = JSON.parse(d._dok_auswertung);
  const a = dok.auswertung || {};
  console.log('   Objekt: ' + o.id + ' · ' + [d.str, d.hnr, d.ort].filter(Boolean).join(' ') + ' · ' + d.objart);

  /* Merkmale aus dem Datensatz */
  const M = {};
  if ((a.risiken || [])[0]) M.risiko = merk(a.risiken[0].titel);
  if (a.investitionsthese) M.these = merk(a.investitionsthese);
  if (a.weg && (a.weg.kernpunkte || [])[0]) M.weg_kernpunkt = merk(String(a.weg.kernpunkte[0]).replace(/^\s*\d{4}\s*[:–-]\s*/, ''));
  if (a.weg && a.weg.ruecklage) M.ruecklage = merk(a.weg.ruecklage);
  if (a.weg && (a.weg.sanierungen || [])[0]) M.massnahme = merk(a.weg.sanierungen[0].massnahme);
  if (a.weg && (a.weg.sonderumlagen || [])[0]) M.sonderumlage = merk(a.weg.sonderumlagen[0]);
  if (a.grundbuch && (a.grundbuch.lasten || [])[0]) M.abt2 = merk(a.grundbuch.lasten[0]);
  if (a.baulasten && (a.baulasten.eintraege || [])[0]) M.baulast = merk(a.baulasten.eintraege[0]);
  if ((a.offene_fragen || [])[0]) M.frage = merk(a.offene_fragen[0]);
  if ((dok.dokumente || [])[0]) M.dokument = merk(dok.dokumente[0].label);
  console.log('   Merkmale aus dem Datensatz: ' + Object.keys(M).join(', '));
  if (!M.baulast) console.log('   Hinweis: diese Auswertung fuehrt keine Baulasten (keine Auskunft nachgereicht).');

  /* 1 · Welche Werkzeuge erreichen die Auswertung? */
  const register = W.WERKZEUGE || [];
  const lese = ['objekt_lesen', 'objekt_kennzahlen', 'objekt_schnellblick', 'pilot_analyse_lesen', 'objekt_unterlagen'];
  const ausgaben = {};
  for (const name of lese) {
    const w = register.find((x) => x.name === name);
    if (!w) { console.log('   ' + name.padEnd(22) + ' — nicht im Register'); continue; }
    let aus;
    try { aus = await w.fn(ctxFuer(o.user_id), { id: o.id }); } catch (e) { aus = { fehler: e.message }; }
    const txt = flach(JSON.stringify(aus));
    ausgaben[name] = { aus, txt };
    const treffer = Object.keys(M).filter((k) => txt.includes(M[k]));
    console.log('   ' + name.padEnd(22) + ' ' + String(txt.length).padStart(6) + ' Zeichen · erreicht: '
      + (treffer.length ? treffer.join(', ') : '—'));
  }

  /* 2 · Das neue Werkzeug */
  const w = register.find((x) => x.name === 'objekt_unterlagen');
  pruefe('objekt_unterlagen steht im Register', Boolean(w));
  if (w) {
    pruefe('Stufe ist "lesen" (kostet nichts)', w.stufe === 'lesen', 'ist ' + w.stufe);
    pruefe('Beschreibung nennt Risiken, Baulasten, Anteil', /Risiken/.test(w.beschreibung) && /Baulast/.test(w.beschreibung) && /anteil/i.test(w.beschreibung));
    const { aus, txt } = ausgaben.objekt_unterlagen;
    pruefe('liefert vorhanden: true', aus && aus.vorhanden === true, JSON.stringify(aus).slice(0, 160));
    Object.keys(M).forEach((k) => pruefe('Merkmal kommt an: ' + k, txt.includes(M[k]), M[k]));
    const ris = (aus && aus.risiken) || [];
    const ord = { hoch: 0, mittel: 1, niedrig: 2 };
    pruefe('Risiken nach Schwere sortiert', ris.every((x, i) => i === 0 || (ord[ris[i - 1].schwere] ?? 1) <= (ord[x.schwere] ?? 1)));
    pruefe('Risiken tragen Quelle', ris.length === 0 || ris.every((x) => 'quelle' in x));
    const mass = (aus && aus.massnahmen) || [];
    if (mass.length) {
      const objart = String(d.objart || ''), mea = parseFloat(String(d.mea || '').replace(/\./g, '').replace(',', '.'));
      const m0 = mass.find((x) => x.kosten_gesamt_eur > 0);
      if (m0) {
        const soll = objart === 'ETW' ? (mea > 0 ? Math.round(m0.kosten_gesamt_eur * mea / 100) : null) : m0.kosten_gesamt_eur;
        pruefe('Anteil = ' + (objart === 'ETW' ? 'Gesamt x MEA' : 'ganzes Haus'), (m0.anteil_eur ?? null) === soll,
          'ist ' + m0.anteil_eur + ', soll ' + soll);
      }
    }
    pruefe('Dokumentliste ohne Dateinamen', !/"datei"/.test(JSON.stringify(aus)));
    pruefe('keine E-Mail/IBAN/Telefon in der Ausgabe',
      !/[\w.+-]+@[\w-]+\.[a-z]{2,}|\bDE\d{2}\s?\d{4}|\+49\s?\d|\b0\d{3,4}[\s/-]\d{4,}/i.test(JSON.stringify(aus)));
    pruefe('Stand der Auswertung genannt', Boolean(aus && aus.stand));
    if (zeigen) console.log(JSON.stringify(aus, null, 2));

    /* 3 · Ohne Auswertung */
    const leer = await query(
      `SELECT id, user_id FROM objects WHERE user_id = $1 AND COALESCE(data->>'_dok_auswertung','') = '' LIMIT 1`, [o.user_id]);
    if (leer.rows.length) {
      const aus2 = await w.fn(ctxFuer(leer.rows[0].user_id), { id: leer.rows[0].id });
      pruefe('ohne Auswertung: vorhanden false + so_sagen', aus2 && aus2.vorhanden === false && /Unterlagen/.test(aus2.so_sagen || ''),
        JSON.stringify(aus2).slice(0, 160));
    }
  }
  /* 4 · Potenzial im Jahr, To-dos, Marktmiete (Erweiterung 28.10.2026) */
  const ctxU = ctxFuer(o.user_id);
  const wp = register.find((x) => x.name === 'portfolio_potenzial');
  pruefe('portfolio_potenzial im Register, Stufe lesen', wp && wp.stufe === 'lesen');
  if (wp) {
    const p = await wp.fn(ctxU, {});
    pruefe('Potenzial: Summe und Objekte', p && (p.anzahl === 0 || (p.summe && Array.isArray(p.objekte))), JSON.stringify(p).slice(0, 160));
    if (p && p.objekte && p.objekte.length) {
      const pos = p.objekte.flatMap((x) => x.positionen);
      pruefe('Potenzial: jede Position mit mehr_monat und Grund (art)', pos.every((x) => typeof x.mehr_monat === 'number' && x.art));
      const s = p.objekte.reduce((a, x) => a + x.in_diesem_jahr.mieterhoehungen_mehr_monat, 0);
      pruefe('Potenzial: Summe = Summe der Objekte', s === p.summe.mehrmiete_monat_eur, s + ' / ' + p.summe.mehrmiete_monat_eur);
      if (zeigen) console.log('POTENZIAL ' + JSON.stringify({ jahr: p.jahr, anzahl: p.anzahl, summe: p.summe, erstes: p.objekte[0] }, null, 1).slice(0, 2500));
    }
  }
  const wt = register.find((x) => x.name === 'portfolio_todos');
  pruefe('portfolio_todos im Register, Stufe lesen', wt && wt.stufe === 'lesen');
  if (wt) {
    const t = await wt.fn(ctxU, { id: o.id });
    const L = (t && t.objekte && t.objekte[0] && t.objekte[0].todos) || [];
    pruefe('To-dos am Objekt: offene Fragen aus den Unterlagen', !M.frage || L.some((x) => x.art === 'Unterlagen'), L.length + ' Punkte');
    pruefe('To-dos: jeder Punkt mit Quelle', L.every((x) => x.quelle));
    if (zeigen) console.log('TODOS ' + JSON.stringify(t, null, 1).slice(0, 2500));
    const alle = await wt.fn(ctxU, {});
    console.log('   To-dos im Konto: ' + (alle.anzahl || 0) + ' ' + JSON.stringify(alle.nach_art || {}));
  }
  const wm = register.find((x) => x.name === 'marktmiete');
  pruefe('marktmiete im Register, Stufe lesen', wm && wm.stufe === 'lesen');
  if (wm) {
    const m = await wm.fn(ctxU, { ort: 'Herford', objektart: 'ETW', wohnflaeche: 80 });
    const arten = (m.quellen || []).map((q) => q.art);
    console.log('   Marktmiete Herford ETW 80 m²: Quellen ' + JSON.stringify(arten) + ', fehlt ' + JSON.stringify((m.fehlt || []).map((f) => f.art)));
    pruefe('Marktmiete: mindestens eine Quelle mit Stand', (m.quellen || []).some((q) => q.stand || q.art === 'eigene Objekte'));
    pruefe('Marktmiete: kein Anbietername', !/geomap|immoscout|immobilienscout|pricehubble|sprengnetter|immometrica/i.test(JSON.stringify(m)));
    if (zeigen) console.log('MARKTMIETE ' + JSON.stringify(m, null, 1).slice(0, 3000));
  }

  /* 5 · Co-Pilot und Cockpit-Pilot: dieselben Funktionen ueber die Route */
  let ai = null;
  for (const p of [path.join(path.dirname(_quelle), '..', 'routes', 'ai.js')]) { try { ai = require(p); } catch (e) { console.log('   ai.js nicht ladbar: ' + e.message); } }
  if (ai && ai.copilotObjektwissen) {
    const pl = { message: 'Welche Risiken gibt es?', context: { objekt_id: o.id } };
    await ai.copilotObjektwissen(o.user_id, pl);
    const ow = pl.context.objektwissen || {};
    pruefe('Co-Pilot: Objektwissen mit Unterlagen', ow.unterlagen && ow.unterlagen.vorhanden === true);
    pruefe('Co-Pilot: Merkmal kommt an (risiko)', !M.risiko || flach(JSON.stringify(ow)).includes(M.risiko));
    const pp = { message: 'Wie viel Potenzial steckt dieses Jahr in meinen Immobilien?', context: { art: 'portfolio' } };
    await ai.copilotObjektwissen(o.user_id, pp);
    const pw = pp.context.objektwissen || {};
    pruefe('Cockpit-Pilot: Potenzial, To-dos, Unterlagen je Objekt', pw.mietpotenzial_dieses_jahr && pw.todos && Array.isArray(pw.unterlagen_je_objekt));
    console.log('   Cockpit-Pilot Objektwissen: ' + JSON.stringify(pw).length + ' Zeichen');
    const pm = { message: 'Wie ist aktuell die Miete für ETWs in Herford mit 80 m²?', context: { art: 'portfolio' } };
    await ai.copilotObjektwissen(o.user_id, pm);
    pruefe('Cockpit-Pilot: Mietfrage erkannt -> marktmiete', pm.context.objektwissen && pm.context.objektwissen.marktmiete && pm.context.objektwissen.marktmiete.gefunden);
  } else pruefe('routes/ai.js exportiert copilotObjektwissen', false);

  console.log(zeilen.join('\n'));
  console.log('-- ' + ok + ' ok, ' + schlecht + ' nein');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
