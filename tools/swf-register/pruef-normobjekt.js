/* Die 15 vorhandenen NI-Rezepte gegen die gemessenen Normobjekte.
   Gemessen wird nicht neu - die Werte liegen in ni-ernte/ni-kurven/.
   Verglichen wird, was das Rezept im Feld formel.normobjekt als
   Fliesstext fuehrt, mit dem Punkt, an dem die jeweilige Kurve
   tatsaechlich auf 1,00 steht. */
const fs = require('fs'), path = require('path');
const B = 'E:/DealPilot/repo/tools/swf-register/';

/* Welche Kurvendatei gehoert zu welchem Rezept? Ueber die quelle_url,
   die den Workbook-Namen traegt. */
const kurven = {};
for (const f of fs.readdirSync(B + 'ni-ernte/ni-kurven')) {
  const j = JSON.parse(fs.readFileSync(B + 'ni-ernte/ni-kurven/' + f, 'utf8'));
  kurven[f.replace('.json', '')] = j;
}

/* Aus dem Fliesstext des Rezepts die genannten Werte ziehen. */
function ausRezept(txt) {
  const t = String(txt || '');
  const g = {};
  let m;
  if ((m = t.match(/Wohnfläche\s+([\d.,]+)\s*m²/i))) g.Wohnflächen = m[1];
  if ((m = t.match(/Restnutzungsdauer\s+([\d.,]+)\s*Jahr/i))) g.Restnutzungsdauer = m[1];
  if ((m = t.match(/Standardstufe\s+([\d.,]+)/i))) g.Standardstufen = m[1];
  if ((m = t.match(/[Mm]odifiziertes Baujahr\s+([\d]{4})/))) g['modifiziertes Baujahr'] = m[1];
  return g;
}
/* Was die Messung sagt - direkt gelesen oder interpoliert. */
function ausMessung(j) {
  const g = {};
  for (const k of (j.kurven || [])) {
    const w = k.normobjekt || k.normobjekt_interpoliert || '';
    if (!w) continue;
    /* "Restnutzungsdauern" und "Restnutzungsdauer" sind dasselbe Merkmal. */
    const nm = k.merkmal.replace(/n$/, '').replace(/^Wohnfläche$/, 'Wohnflächen');
    g[nm === 'Wohnfläche' ? 'Wohnflächen' : (nm === 'Standardstufe' ? 'Standardstufen' : nm)] = w;
  }
  /* Schluessel vereinheitlichen */
  const o = {};
  for (const [k, v] of Object.entries(g)) {
    let n = k;
    if (/^Wohnfläche/.test(k)) n = 'Wohnflächen';
    else if (/^Restnutzungsdauer/.test(k)) n = 'Restnutzungsdauer';
    else if (/^Standardstufe/.test(k)) n = 'Standardstufen';
    o[n] = v;
  }
  return o;
}
function gleich(a, b) {
  if (a === undefined || b === undefined) return null;
  const n = s => parseFloat(String(s).replace(',', '.'));
  return Math.abs(n(a) - n(b)) < 0.051;
}

let ok = 0, ab = 0, ohne = 0;
const zeilen = [];
for (const f of fs.readdirSync(B + 'rezepte').filter(x => /^NI-.*\.json$/.test(x))) {
  const j = JSON.parse(fs.readFileSync(B + 'rezepte/' + f, 'utf8'));
  const m = (j.modelle || [])[0];
  const wb = (j.quelle_url || '').match(/views\/([^/]+)/);
  const key = wb ? wb[1] : null;
  const mess = key && kurven[key] ? ausMessung(kurven[key]) : null;
  const rez = ausRezept(m && m.formel && m.formel.normobjekt);

  if (!mess) {
    ohne++;
    zeilen.push(['?', f.replace('.json', ''), key || 'keine quelle_url',
      'keine Messung vorhanden']);
    continue;
  }
  const merk = [...new Set([...Object.keys(rez), ...Object.keys(mess)])];
  const teile = [];
  let schlecht = false, geprueft = 0;
  for (const k of merk) {
    const g = gleich(rez[k], mess[k]);
    if (g === null) { teile.push(k + ': Rezept=' + (rez[k] || '—') + ' Messung=' + (mess[k] || '—')); continue; }
    geprueft++;
    if (g) teile.push(k + ' ' + mess[k] + ' ok');
    else { teile.push(k + ': REZEPT ' + rez[k] + ' ≠ GEMESSEN ' + mess[k]); schlecht = true; }
  }
  if (schlecht) { ab++; zeilen.push(['✗', f.replace('.json', ''), key, teile.join(' · ')]); }
  else if (geprueft > 0) { ok++; zeilen.push(['✓', f.replace('.json', ''), key, teile.join(' · ')]); }
  else { ohne++; zeilen.push(['?', f.replace('.json', ''), key, teile.join(' · ') || 'nichts vergleichbar']); }
}

for (const [z, name, key, txt] of zeilen) {
  console.log(z + ' ' + name.padEnd(28) + txt);
}
console.log('\n── ' + ok + ' stimmen · ' + ab + ' weichen ab · ' + ohne + ' nicht prüfbar ──');
