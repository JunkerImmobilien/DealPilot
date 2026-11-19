// tools/miete-reiter-pruefen.mjs · v3840/v3845 — Reiter Miete (Marcel 19.11.2026), ohne Browser, an den ECHTEN Dateien:
//   K  kurzSaetze (potenzial.js): Gedankenstrich, Semikolon und Mittelpunkt werden zu Sätzen, in Klammern zu Komma
//   J  DpJahresbuch.summeWohnungen: Summe der Wohnungen mit Aufschlüsselung (Wohnungen ohne Eintrag mit heutiger Miete)
//   E  DpErhoehungen.rueckmeldung: sagt, wohin ein Eintrag geht, bietet „heutige Miete setzen" nur, wenn sie abweicht
//   R  DpMieteRegel: Vorgabe 120 %, wählbar 110/115/120, unbekannter Wert = Vorgabe, Abruf-Parameter nur abweichend
//   T  Kundentexte der geänderten Stellen ohne „ — “, „; “ (Quelltext-Literale der neuen Sätze)
//   node tools/miete-reiter-pruefen.mjs   (RC=0 sauber)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const W = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
let n = 0, rot = 0;
const ok = (ab, was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + ab + ' · ' + was + (!b && ist !== undefined ? ' → ' + JSON.stringify(ist) : '')); };

/* K */
{
  const src = lies('frontend/js/potenzial.js');
  const a = src.indexOf('  function kurzSaetze(t) {'), b = src.indexOf('  window.DpKurzSaetze = kurzSaetze;');
  ok('K', 'kurzSaetze in potenzial.js gefunden', a > 0 && b > a);
  const kurz = vm.runInNewContext('(function(){' + src.slice(a, b) + ' return kurzSaetze; })()');
  const f = (x, soll) => ok('K', JSON.stringify(x).slice(0, 60) + ' → ' + soll, kurz(x) === soll, kurz(x));
  f('verlangbar ab sofort · wirksam ab 02/2027 · Grenze § 558: Vergleichsmiete', 'Verlangbar ab sofort. Wirksam ab 02/2027. Grenze § 558: Vergleichsmiete.');
  f('Bielefelder Mietspiegel 2026, S. 11 — qualifiziert (§ 558d BGB), oberer Spannenwert', 'Bielefelder Mietspiegel 2026, S. 11. Qualifiziert (§ 558d BGB), oberer Spannenwert.');
  f('höchstens 9,27 €/m² (Vergleichsmiete 8,43 € + 10 %, Mietspiegel — qualifiziert)', 'Höchstens 9,27 €/m² (Vergleichsmiete 8,43 € + 10 %, Mietspiegel, qualifiziert).');
  f('der obere Wert trägt nur mit Merkmalen; die Werte sind zu nennen', 'Der obere Wert trägt nur mit Merkmalen. Die Werte sind zu nennen.');
  f('Mieterschutzverordnung NRW', 'Mieterschutzverordnung NRW.');
  f('Doppel-Haushälfte, Ein-/Zweifamilienhaus', 'Doppel-Haushälfte, Ein-/Zweifamilienhaus.');
  f('', '');
  ok('K', 'nie ein Gedankenstrich oder Semikolon im Ergebnis', !/[—–;]| - /.test(kurz('a — b; c - d · e (f — g; h)')), kurz('a — b; c - d · e (f — g; h)'));
}

/* J */
{
  const ctx = { console, Date, Math, JSON, Object, Array, String, Number, parseInt, parseFloat, isFinite, setTimeout: () => 0 };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(lies('frontend/js/jahresbuch.js'), ctx);
  const JB = ctx.DpJahresbuch;
  const L = [{ nr: '1', ist: 590 }, { nr: '2', ist: 600, status: 'leer' }, { nr: '3', ist: 585 }];
  ok('J', 'ohne Eintrag keine Summe (null)', JB.summeWohnungen({}, L) === null);
  const s1 = JB.summeWohnungen({ '0': { miete_m: 560, leer_monate: 2 } }, L);
  ok('J', 'Whg 1 eingetragen 560 × 10, Whg 2 leer 0, Whg 3 heute 585 × 12 = 12.620', s1 && s1.summe === 560 * 10 + 0 + 585 * 12, s1);
  ok('J', 'Aufschlüsselung kennzeichnet „heutige Miete"', s1 && s1.teile.length === 3 && s1.teile[0].eingetragen === true && s1.teile[2].eingetragen === false);
  ok('J', 'bestehende summeEinheiten unverändert (nur Eingetragene)', JB.summeEinheiten({ '0': { miete_m: 560, leer_monate: 2 } }) === 5600);
}

/* E */
{
  const ctx = { console, Date, Math, JSON, Object, Array, String, Number, parseInt, parseFloat, isFinite, setTimeout: () => 0 };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(lies('frontend/js/mieterhoehungen.js'), ctx);
  const E = ctx.DpErhoehungen;
  const gestern = new Date(Date.now() - 864e5).toISOString().slice(0, 10), morgen = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  const e1 = { datum: gestern, art: '558', von: 650, auf: 700 };
  const a1 = E.ableiten([e1]);
  const t1 = E.rueckmeldung(e1, a1, 650, 'in der Mietentwicklung');
  ok('E', 'vergangene Erhöhung: sagt wohin, bietet „Auf 700 € setzen"', /Sie zählt in der Mietentwicklung/.test(t1) && /data-erh-heute="700"/.test(t1), t1);
  ok('E', 'gleiche heutige Miete: kein Knopf', !/data-erh-heute/.test(E.rueckmeldung(e1, a1, 700, 'x')));
  const t2 = E.rueckmeldung({ datum: morgen, art: '558', auf: 720 }, E.ableiten([{ datum: morgen, art: '558', auf: 720 }]), 700, 'x');
  ok('E', 'künftige Erhöhung: sagt, dass die Prognose weiterrechnet', /liegt in der Zukunft/.test(t2) && !/data-erh-heute/.test(t2), t2);
  ok('E', 'Rückmeldung ohne Gedankenstrich und Semikolon', !/[—–;]/.test(t1 + t2));
}

/* R */
{
  const mk = (wert) => {
    const st = {}; if (wert != null) st.dp_miete_neu_faktor = wert;
    const ctx = { console, Math, JSON, Object, Array, String, Number, parseFloat, CustomEvent: function () {}, dispatchEvent() {},
      localStorage: { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: (k) => { delete st[k]; } } };
    ctx.window = ctx; vm.createContext(ctx); vm.runInContext(lies('frontend/js/miete-regel.js'), ctx); return { R: ctx.DpMieteRegel, st };
  };
  let x = mk(null);
  ok('R', 'ohne Wahl 1,20 und kein Abruf-Parameter', x.R.faktorOhne() === 1.2 && x.R.query() === '' && x.R.istVorgabe());
  ok('R', 'Satz bei 120 % nennt die Grenze', /rechnet mit 120 %/.test(x.R.satz()) && /rechtliche Grenze/.test(x.R.satz()));
  x = mk('1.1');
  ok('R', '110 %: Faktor 1,1, Parameter faktor_ohne=1.1, Satz nennt 120 % als Grenze', x.R.faktorOhne() === 1.1 && x.R.query() === '&faktor_ohne=1.1' && /bis 120 %/.test(x.R.satz()));
  x = mk('1.3');
  ok('R', 'unbekannter Wert → Vorgabe', x.R.faktorOhne() === 1.2);
  x = mk('1.15'); x.R.setzen(1.2);
  ok('R', 'zurück auf 120 % löscht den Schlüssel', !('dp_miete_neu_faktor' in x.st));
  ok('R', 'setzen nimmt nur die drei Stufen', mk(null).R.setzen(1.25) === false);
  ok('R', 'vorgaben-sync führt den Schlüssel (Konto statt Browser)', /'dp_miete_neu_faktor'/.test(lies('frontend/js/vorgaben-sync.js')));
}

/* T · neue Kundentexte ohne Gedankenstrich/Semikolon */
{
  const proben = [
    ['frontend/js/mietentwicklung.js', /me-herkunft">Vergangene Jahre[\s\S]*?<\/div>'/],   /* v3860 */
    ['frontend/js/potenzial.js', /var kopf = '<div class="dp-zv-kopf"><b>Zielmiete je Wohnung[^\n]*/],   /* v3860 */
    ['frontend/js/potenzial.js', /Eine Mieterhöhung nach § 558 BGB geht nur bis zur Vergleichsmiete[^\n]*/],   /* v3860 */
    ['frontend/js/mfh-einheiten.js', /ist die Miete aus dem Mietvertrag[^\n]*/],   /* v3860c */
    ['frontend/js/hausgeld-positionen.js', /Reine Aufstellung[^\n]*/],   /* v3860 */
    ['frontend/js/potenzial.js', /function mrIntro\(\)[^\n]*/],
    ['frontend/js/potenzial.js', /Beim Mehrfamilienhaus legst du Soll-Miete[^\n]*/],
    ['frontend/js/jahresbuch.js', /Die Summe kommt aus den Wohnungen[^\n]*/],
    ['frontend/js/miete-regel.js', /function karteHtml[\s\S]*?<\/p>/]
  ];
  for (const [p, re] of proben) {
    const m = lies(p).match(re);
    const t = m ? m[0].replace(/\/\*[\s\S]*?\*\//g, '') : '';
    ok('T', p.split('/').pop() + ' ' + String(re).slice(1, 30), !!m && !/ — | – |; [A-ZÄÖÜa-zäöü]/.test(t.replace(/'[^']*';/g, (s) => s.replace(/;$/, ''))), m && m[0].slice(0, 120));
  }
}

console.log('miete-reiter-pruefen (v3840, v3845): ' + (n - rot) + ' von ' + n + ' ok');
process.exit(rot ? 1 : 0);
