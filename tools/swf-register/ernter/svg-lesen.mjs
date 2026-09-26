/* ═══════════════════════════════════════════════════════════════════════
   svg-lesen.mjs · Den Sachwertfaktor aus dem Vektorbild holen

   Das Vektorbild traegt den Text als TEXT - anders als das PDF ohne
   Ligaturverlust ("Sachwertfaktor" statt "Sachwer aktor") und anders als
   die Kacheln ueberhaupt lesbar.

   ABER: die Zahl 1,03 steht auch an den Achsen der Diagramme. Sie
   irgendwo im Bild zu suchen waere geraten. Deshalb wird sie ueber die
   LAGE gefunden: der Wert steht rechts neben seiner Beschriftung, auf
   derselben Hoehe - so, wie ein Mensch ihn abliest.
   ═══════════════════════════════════════════════════════════════════════ */

/** XML-Entitaeten aufloesen.
 *
 *  DIE FALLE, die den zweiten Anlauf gekostet hat: im Vektorbild steht
 *  `GS 02 &amp; GS 03`, die Auswahlliste im DOM sagt `GS 02 & GS 03`.
 *  Die Verriegelung verglich beides und fand nie eine Uebereinstimmung -
 *  gemessen am 26.09.2026: die Lage OHNE `&` lief fast sauber durch, ALLE
 *  mit `&` fielen aus. Das Muster war der ganze Hinweis. */
function entzerrt(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Den Versatz einer Gruppe lesen. Tableau schreibt
 *  `transform="matrix(1,0,0,1,246,338)"` — die letzten beiden Zahlen sind
 *  die Verschiebung. `translate(x,y)` kommt auch vor. */
function versatzAus(attr) {
  const mm = attr.match(/matrix\(\s*[-\d.]+[,\s]+[-\d.]+[,\s]+[-\d.]+[,\s]+[-\d.]+[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/);
  if (mm) return { dx: Number(mm[1]), dy: Number(mm[2]) };
  const tt = attr.match(/translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/);
  if (tt) return { dx: Number(tt[1]), dy: Number(tt[2]) };
  return { dx: 0, dy: 0 };
}

/** Alle Textstuecke mit ihrer ABSOLUTEN Lage.
 *
 *  DIE FALLE, die den ersten Anlauf gekostet hat: der Versatz steht nicht
 *  am `<text>`, sondern an der umgebenden `<g>` — und als `matrix`, nicht
 *  als `translate`. Gemessen am 26.09.2026: die Beschriftung
 *  "Sachwertfaktor:" liegt bei x=48,6 y=353 ohne Versatz, der Wert 1,03
 *  bei x=75 y=15 INNERHALB von matrix(1,0,0,1,246,338) — absolut also
 *  x=321 y=353. Auf derselben Hoehe, rechts daneben, genau wie man es
 *  abliest. Wer nur das `<text>` liest, findet die Beschriftung und den
 *  Wert nie auf derselben Zeile.
 *
 *  Deshalb ein echter Gruppenstapel, kein Muster ueber Einzelelemente. */
export function texteMitLage(svg) {
  const aus = [];
  const stapel = [{ dx: 0, dy: 0 }];
  const teile = svg.matchAll(/<(\/?)(g|text)\b([^>]*?)(\/?)>([\s\S]*?)(?=<)/g);
  for (const m of teile) {
    const [, schliesst, tag, attr, leer, inhalt] = m;
    if (tag === 'g') {
      if (schliesst) { if (stapel.length > 1) stapel.pop(); continue; }
      const oben = stapel[stapel.length - 1];
      const v = versatzAus(attr);
      const neu = { dx: oben.dx + v.dx, dy: oben.dy + v.dy };
      if (!leer) stapel.push(neu);
      continue;
    }
    if (schliesst) continue;
    const txt = entzerrt(inhalt.replace(/<[^>]+>/g, '').trim());
    if (!txt) continue;
    const oben = stapel[stapel.length - 1];
    const x = Number((attr.match(/\bx="(-?[\d.]+)"/) || [])[1]) || 0;
    const y = Number((attr.match(/\by="(-?[\d.]+)"/) || [])[1]) || 0;
    aus.push({ t: txt, x: x + oben.dx, y: y + oben.dy });
  }
  return aus;
}

/** Eine deutsche Dezimalzahl lesen. `null` heisst: da stand keine —
 *  NICHT 0. Eine 0 waere hier ein erfundener Faktor. */
export function zahl(s) {
  const m = String(s).trim().match(/^(-?\d{1,3}(?:\.\d{3})*|-?\d+),(\d+)$/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '') + '.' + m[2]);
  return Number.isFinite(n) ? n : null;
}

/** Den Wert rechts neben einer Beschriftung holen.
 *
 *  `muster` trifft die Beschriftung, `pruef` entscheidet, ob ein
 *  Textstueck als Wert taugt. Gibt es keinen Treffer, kommt `null`
 *  zurueck — kein Rateweg, kein Rueckfall auf den naechstbesten. */
export function wertNeben(texte, muster, pruef, hoehenFenster = 6) {
  const beschriftung = texte.find((t) => muster.test(t.t));
  if (!beschriftung) return { wert: null, grund: 'Beschriftung nicht im Bild' };
  const rechts = texte
    .filter((t) => t !== beschriftung
                && Math.abs(t.y - beschriftung.y) <= hoehenFenster
                && t.x > beschriftung.x
                && pruef(t.t))
    .sort((a, b) => a.x - b.x);
  if (!rechts.length) return { wert: null, grund: 'kein Wert rechts der Beschriftung' };
  return { wert: rechts[0].t, x: rechts[0].x, y: rechts[0].y };
}

/** Welchen Zustand ZEIGT das Bild wirklich?
 *
 *  DIE VERRIEGELUNG, ohne die die Ernte still falsch wird. Der erste
 *  Lauf am 26.09.2026 wartete feste 1,1 Sekunden nach jeder Eingabe und
 *  griff das Bild dann ab - zu frueh. Ergebnis: Goslar lieferte bei
 *  Bodenrichtwert 15 einen HOEHEREN Faktor als bei 65, und in einer
 *  Zeile standen vier identische 0,46. Beides unmoeglich, beides sah
 *  aber aus wie eine Ernte.
 *
 *  Das Bild traegt die gesetzten Werte selbst mit. Statt auf eine Uhr zu
 *  warten, wird also NACHGESEHEN, ob der gezeigte Zustand der gewollte
 *  ist. Stimmt er nicht, war es der vorige - und der Punkt wird
 *  wiederholt, nicht eingetragen. */
export function zustandAus(svg) {
  const texte = texteMitLage(svg);
  /* Die erste (oberste) Beschriftung nehmen: die Stichprobenuebersicht
     weiter unten fuehrt dieselben Namen noch einmal. */
  const nimm = (praefix, pruef) => {
    const b = texte.filter((t) => t.t.startsWith(praefix)).sort((a, b2) => a.y - b2.y)[0];
    if (!b) return null;
    const r = texte.filter((t) => Math.abs(t.y - b.y) <= 6 && t.x > b.x && pruef(t.t))
                   .sort((a, b2) => a.x - b2.x)[0];
    return r ? r.t : null;
  };
  const ganzeZahl = (s) => /^\d{1,3}(\.\d{3})*$|^\d+$/.test(s.trim());
  return {
    sachwert: (() => { const s = nimm('Vorläufiger Sachwert', ganzeZahl);
                       return s ? Number(s.replace(/\./g, '')) : null; })(),
    brw: (() => { const s = nimm('Bodenrichtwert', ganzeZahl);
                  return s ? Number(s.replace(/\./g, '')) : null; })(),
    lage: nimm('Lage', (s) => /\S/.test(s) && s.trim() !== ':'),
  };
}

/** Faktor und Streuung aus einem Vektorbild. */
export function faktorAus(svg) {
  const texte = texteMitLage(svg);
  const istFaktor = (s) => /^[0-2],\d{2}$/.test(s.trim());
  const istStreuung = (s) => /^±\s*[0-2],\d{2}$/.test(s.trim());

  const f = wertNeben(texte, /^Sachwertfaktor\s*:?$/i, istFaktor);
  const s = wertNeben(texte, /^Standardabweichung\s*:?$/i, istStreuung);

  return {
    faktor: f.wert ? zahl(f.wert) : null,
    faktor_roh: f.wert || null,
    faktor_grund: f.wert ? null : f.grund,
    streuung: s.wert ? zahl(s.wert.replace(/^±\s*/, '')) : null,
    textstuecke: texte.length,
  };
}
