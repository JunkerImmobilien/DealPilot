/* ══ v2670 · KI-TEXT: ZAHLEN FERTIG RECHNEN, DANACH NACHPRUEFEN ════════════════
   Gemessen an Bericht 330 (Bismarckstr. 27, Detmold, 21.10.2026):
     - „Der Kaufpreis liegt 58,6 Prozent ueber der Marktpreisindikation" (richtig)
       und zwei Saetze spaeter „Die Marktpreisindikation liegt knapp 60 Prozent
       unter dem Kaufpreis" (falsch: 725.000 / 1.150.000 = 37 Prozent darunter).
       Das Modell hat die Bezugsgroesse gewechselt und die Zahl behalten.
     - „beruecksichtigt vier leerstehende Wohnungen" - leer sind 2 (n_leer);
       die 4 sind die Wohnungen mit Ist-Miete UEBER dem Band (n_oben).
     - „Ertrags- und Sachwerte sind in dieser Berichtsstufe nicht enthalten" -
       der Ertragswert stand im Bericht (kapitelD las ein Feld, das es nicht gibt).
   Grundsatz (Dateien/DealPilot_ImmoWertV_Claude_Prompt.md): die KI wertet
   GEPRUEFTE Berechnungen sprachlich aus, sie rechnet nicht selbst. Deshalb:
     (a) textFakten() rechnet jedes Verhaeltnis in BEIDE Richtungen und jede
         Zaehlung vorab und benennt sie eindeutig;
     (b) pruefeText() haelt den fertigen Text dagegen - deterministisch, ohne
         Modell. Was nicht stimmt, wird neu erzeugt oder entfernt.
   Der Pruefer kennt nur Aussagen, die er sicher zuordnen kann (Prozent + Richtung
   + zwei benannte Groessen; Zaehlwort + leer/Band). Alles andere laesst er stehen:
   eine Nachpruefung, die gute Saetze streicht, waere die naechste Fehlerquelle. */

const ZAHLWORT = { ein: 1, eine: 1, einer: 1, einen: 1, eines: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwoelf: 12 };
const ZAHL_RE = '(\\d{1,3}|ein|eine|einer|einen|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)';

/* Reihenfolge zaehlt: die laengere Bezeichnung zuerst. */
const GROESSEN = [
  { k: 'mpi', re: /Marktpreisindikation|Marktwertindikation|Wertindikation|Marktwert(?!e)|(?<![A-Za-zäöüß])Indikation/gi, name: 'Marktpreisindikation' },
  { k: 'kaufpreis', re: /Kaufpreis(?!faktor|niveau|e\b)(?:forderung|es|s)?/gi, name: 'Kaufpreis' },
  { k: 'ertragswert', re: /Ertragswert/gi, name: 'Ertragswert' },
  { k: 'sachwert', re: /Sachwert(?!faktor)/gi, name: 'Sachwert' },
  { k: 'vergleichswert', re: /Vergleichswert/gi, name: 'Vergleichswert' },
];
const NAME = Object.fromEntries(GROESSEN.map((g) => [g.k, g.name]));

const num = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : null; };
const r1 = (x) => Math.round(x * 10) / 10;
const de1 = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function textFakten(p) {
  p = p || {};
  const mv = (p.valuation && p.valuation.market_value) || {};
  const cc = p.cross_check || {};
  const im = !cc.nicht_im_umfang;
  const ew = im && cc.ertragswert && cc.ertragswert.available ? cc.ertragswert : null;
  const sw = im && cc.sachwert && cc.sachwert.available ? cc.sachwert : null;
  const vw = im && cc.vergleichswert_irw && cc.vergleichswert_irw.verfuegbar ? cc.vergleichswert_irw : null;
  const werte = {
    kaufpreis: num(p.ref && p.ref.purchase_price),
    mpi: num(mv.estimated),
    ertragswert: ew ? num(ew.value_eur ?? ew.wert ?? ew.ertragswert_eur) : null,
    sachwert: sw ? num(sw.value_eur ?? sw.wert ?? sw.sachwert_eur) : null,
    vergleichswert: vw ? num(vw.vergleichswert_eur) : null,
  };
  /* verhaeltnis[a][b] = (a / b - 1) * 100: „a liegt X % ueber/unter b". */
  const verhaeltnis = {};
  const keys = Object.keys(werte).filter((k) => werte[k]);
  for (const a of keys) for (const b of keys) if (a !== b) {
    (verhaeltnis[a] = verhaeltnis[a] || {})[b] = r1((werte[a] / werte[b] - 1) * 100);
  }
  const mh = (ew && ew.miete_herkunft) || {};
  const bog = (ew && ew.miete_bog) || {};
  const ganz = (x) => (Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : null);
  const zaehl = {
    anzahl_wohnungen: ganz(p.ref && p.ref.units),
    anzahl_leer: ew ? ganz(mh.n_leer) ?? 0 : null,
    anzahl_ueber_band: ew ? ganz(mh.n_oben) : null,
    anzahl_unter_band: ew ? ganz(mh.n_unten) : null,
    anzahl_im_band: ew ? ganz(mh.n_band) : null,
    anzahl_ohne_restlaufzeit: ew ? ganz(bog.n_offen) : null,
  };
  /* v2990 · Bodenwert ohne Groessenanpassung: keine Wertung „konservativ" (s. pruefeText 5) */
  const bodenwert_nicht_angepasst = !!(im && cc.flaeche && cc.flaeche.erheblich && cc.flaeche.bodenwert_nicht_angepasst);
  return { werte, verhaeltnis, zaehl, ertragswert_im_umfang: !!ew, sachwert_im_umfang: !!sw, bodenwert_nicht_angepasst };
}

/* Benannte Pruefzahlen fuer den Prompt: kaufpreis_ueber_mpi_pct = 58.6 usw. */
export function pruefzahlen(F) {
  const o = {};
  for (const a of Object.keys(F.verhaeltnis)) for (const b of Object.keys(F.verhaeltnis[a])) {
    const v = F.verhaeltnis[a][b];
    o[a + (v >= 0 ? '_ueber_' : '_unter_') + b + '_pct'] = Math.abs(v);
  }
  for (const [k, v] of Object.entries(F.zaehl)) if (v != null) o[k] = v;
  return o;
}

export function faktenAnweisung(F) {
  const s = [];
  const paar = (a, b) => {
    const v = F.verhaeltnis[a] && F.verhaeltnis[a][b];
    if (v == null) return;
    const w = F.verhaeltnis[b][a];
    s.push('Der ' + NAME[a] + ' liegt ' + de1(Math.abs(v)) + ' % ' + (v >= 0 ? 'ÜBER' : 'UNTER') + ' dem Wert „' + NAME[b]
      + '"; umgekehrt liegt „' + NAME[b] + '" ' + de1(Math.abs(w)) + ' % ' + (w >= 0 ? 'ÜBER' : 'UNTER') + ' dem ' + NAME[a] + '.');
  };
  paar('kaufpreis', 'mpi'); paar('kaufpreis', 'ertragswert'); paar('ertragswert', 'mpi');
  paar('kaufpreis', 'sachwert'); paar('kaufpreis', 'vergleichswert');
  const z = F.zaehl;
  if (F.ertragswert_im_umfang) {
    const t = [];
    if (z.anzahl_wohnungen != null) t.push(z.anzahl_wohnungen + ' Wohnungen insgesamt');
    t.push(z.anzahl_leer + ' davon leer stehend');
    if (z.anzahl_ueber_band != null) t.push(z.anzahl_ueber_band + ' mit Ist-Miete ÜBER dem Band');
    if (z.anzahl_unter_band != null) t.push(z.anzahl_unter_band + ' mit Ist-Miete UNTER dem Band');
    if (z.anzahl_im_band != null) t.push(z.anzahl_im_band + ' mit Ist-Miete im Band');
    if (z.anzahl_ohne_restlaufzeit) t.push(z.anzahl_ohne_restlaufzeit + ' Mietverhältnisse ohne bekannte Restlaufzeit');
    s.push('Zählung: ' + t.join(', ') + '. Leer stehende Wohnungen und Wohnungen mit Miete über dem Band sind VERSCHIEDENE Gruppen.');
    s.push('Der Ertragswert ist in diesem Bericht ENTHALTEN' + (F.sachwert_im_umfang ? ', der Sachwert ebenfalls' : '') + ' - schreibe nie, er sei nicht enthalten.');
  }
  if (F.bodenwert_nicht_angepasst) s.push('Der Bodenwert ist NICHT an die Grundstücksgröße angepasst - das ist eine offene Prüfung, '
    + 'kein vorsichtiger Ansatz. Nenne ihn nie „konservativ", „vorsichtig" oder „zurückhaltend".');
  if (!s.length) return '';
  return '\n\nPRÜFZAHLEN (fertig gerechnet, verbindlich): ' + s.join(' ')
    + ' Als Feldnamen: ' + JSON.stringify(pruefzahlen(F)) + '. '
    + 'RECHNE KEINE EIGENE PROZENTZAHL UND ZÄHLE NICHTS SELBST. Ein Verhältnis zweier Werte nennst du nur mit der Zahl, '
    + 'der Richtung und der Bezugsgröße von hier - wechselt die Bezugsgröße, wechselt die Zahl. Steht eine Zahl hier nicht, nennst du sie nicht. '
    + 'Der Text wird nach dem Schreiben automatisch gegen diese Zahlen geprüft.';
}

/* ── Nachpruefung ─────────────────────────────────────────────────────── */
export function saetze(md) {
  /* Zeilen bleiben Zeilen (Ueberschriften), innerhalb eines Absatzes trennt
     ein Satzzeichen vor einem Grossbuchstaben. „1.150.000 €" trennt nicht. */
  const out = [];
  String(md || '').split(/\n/).forEach((zeile, zi) => {
    const teile = zeile.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"])/);
    teile.forEach((t) => { if (t.trim()) out.push({ zeile: zi, text: t }); });
  });
  return out;
}

function groessenIn(text) {
  const treffer = [];
  for (const g of GROESSEN) {
    g.re.lastIndex = 0;
    let m;
    while ((m = g.re.exec(text))) {
      /* „Marktwertindikation" nicht zusaetzlich als „Indikation" zaehlen */
      if (!treffer.some((t) => m.index >= t.i && m.index < t.e)) treffer.push({ k: g.k, i: m.index, e: m.index + m[0].length });
    }
  }
  return treffer.sort((a, b) => a.i - b.i);
}

/* „vier von sechs Wohnungen": gezaehlt sind die vier, nicht die sechs (gemessen an Bericht 331). */
const zahl = (x) => (/^\d+$/.test(x) ? Number(x) : ZAHLWORT[String(x).toLowerCase()]);
const VON_RE = new RegExp('\\b' + ZAHL_RE + '\\s+von\\s+$', 'i');
function zahlAn(t, n) {
  const m = t.slice(0, n.index).match(VON_RE);
  return m ? zahl(m[1]) : zahl(n[1]);
}

const HECKE = /(knapp|rund|etwa|gut|fast|ca\.|circa|nahezu|annähernd|ungefähr|mehr als|beinahe)\s*$/i;

export function pruefeText(md, F) {
  const befunde = [];
  const z = F.zaehl || {};
  for (const s of saetze(md)) {
    const t = s.text;
    /* 1) Prozent mit Richtung zwischen zwei benannten Groessen */
    const PRO = /(\d{1,3}(?:[.,]\d+)?)\s*(?:Prozent|%)\s+(über|oberhalb|höher als|unter|unterhalb|niedriger als)\s+/gi;
    let m;
    while ((m = PRO.exec(t))) {
      const g = groessenIn(t);
      const vor = g.filter((x) => x.e <= m.index);
      const nach = g.filter((x) => x.i >= m.index + m[0].length && x.i <= m.index + m[0].length + 40);
      if (!vor.length || !nach.length) continue;
      const a = vor[vor.length - 1].k, b = nach[0].k;
      if (a === b) continue;
      const soll = F.verhaeltnis[a] && F.verhaeltnis[a][b];
      if (soll == null) continue;
      const ist = Number(m[1].replace(',', '.')) * (/über|oberhalb|höher/i.test(m[2]) ? 1 : -1);
      const hecke = HECKE.test(t.slice(Math.max(0, m.index - 14), m.index));
      const tol = hecke ? Math.max(2, Math.abs(soll) * 0.05) : 0.6;
      if (Math.abs(ist - soll) > tol) {
        befunde.push({ art: 'prozent', satz: t.trim(), zeile: s.zeile,
          ist: m[1] + ' % ' + m[2], soll: de1(Math.abs(soll)) + ' % ' + (soll >= 0 ? 'über' : 'unter'),
          bezug: NAME[a] + ' gegen ' + NAME[b] });
      }
    }
    /* 2) Zaehlung leer stehender Wohnungen */
    if (z.anzahl_leer != null) {
      const LEER = new RegExp('\\b' + ZAHL_RE + '\\s+(?:leer\\s?stehenden?|leeren?|unvermieteten?)\\s+(?:Wohnung|Einheit|Wohneinheit)', 'gi');
      const LEER2 = new RegExp('\\b' + ZAHL_RE + '\\s+(?:Wohnungen|Einheiten|Wohneinheiten)\\s+(?:stehen|sind)\\s+(?:derzeit\\s+|aktuell\\s+)?(?:leer|unvermietet)', 'gi');
      for (const re of [LEER, LEER2]) {
        let n;
        while ((n = re.exec(t))) {
          const w = zahlAn(t, n);
          if (w !== z.anzahl_leer) befunde.push({ art: 'zaehlung_leer', satz: t.trim(), zeile: s.zeile, ist: n[0], soll: String(z.anzahl_leer) + ' leer stehend' });
        }
      }
    }
    /* 3) Zaehlung der Mieten ueber dem Band */
    if (z.anzahl_ueber_band != null) {
      const UEB = new RegExp('\\b' + ZAHL_RE + '\\s+(?:Mietverhältniss?e?|Wohnungen|Einheiten)\\b[^.]{0,60}?(?:höheren Ist-Mieten|über dem (?:marktüblichen )?Band|oberhalb des Bandes)', 'gi');
      let n;
      while ((n = UEB.exec(t))) {
        const w = zahlAn(t, n);
        if (w !== z.anzahl_ueber_band) befunde.push({ art: 'zaehlung_band', satz: t.trim(), zeile: s.zeile, ist: n[0], soll: String(z.anzahl_ueber_band) + ' über dem Band' });
      }
    }
    /* 5) v2990 · Bodenwert „konservativ", obwohl er nur NICHT angepasst ist (Bericht Am Markt 9).
          Nicht angepasst heisst: Richtung offen. Gezaehlt wird nur ein Satz, der den Bodenwert oder
          die Grundstuecksflaeche nennt UND ihn als vorsichtig wertet. */
    if (F.bodenwert_nicht_angepasst && /Bodenwert|Grundstücksfläche|Grundstücksgröße/i.test(t)
      && /(konservativ|vorsichtig|zurückhaltend|auf der sicheren Seite|bewusst niedrig)/i.test(t)) {
      befunde.push({ art: 'bodenwert_wertung', satz: t.trim(), zeile: s.zeile, ist: 'Bodenwert als vorsichtig/konservativ gewertet',
        soll: 'nicht an die Grundstücksgröße angepasst, insoweit vorläufig (Richtung offen)' });
    }
    /* 4) Verfahren im Umfang als „nicht enthalten" bezeichnet */
    if (F.ertragswert_im_umfang && /Ertrags/i.test(t) && /(nicht enthalten|nicht Teil|liegen? nicht vor|wurden? nicht ermittelt|nicht ausgewiesen)/i.test(t)) {
      befunde.push({ art: 'umfang', satz: t.trim(), zeile: s.zeile, ist: 'Ertragswert „nicht enthalten"', soll: 'Ertragswert ist enthalten' });
    }
  }
  return befunde;
}

export function entferneSaetze(md, befunde) {
  let out = String(md || '');
  for (const b of befunde) out = out.split(b.satz).join('');
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n');
}

export function korrekturHinweis(befunde) {
  return '\n\nKORREKTUR: Dein erster Entwurf enthielt falsche Zahlen. '
    + befunde.map((b) => '„' + b.satz.slice(0, 200) + '" - dort steht ' + b.ist + ', richtig ist ' + b.soll
      + (b.bezug ? ' (' + b.bezug + ')' : '') + '.').join(' ')
    + ' Schreibe das Kapitel neu und halte dich an die PRÜFZAHLEN.';
}

/* Ablauf je Kapitelgruppe: pruefen -> bei Befund EINMAL neu schreiben lassen ->
   was danach noch falsch ist, wird entfernt. Rueckgabe mit Protokoll, damit der
   Bericht festhaelt, WAS geprueft und geaendert wurde (nicht nur „ok"). */
export async function pruefeUndRepariere(md, F, neuSchreiben) {
  const prot = { befunde_erst: [], neu_erzeugt: false, befunde_danach: [], entfernt: [] };
  let bef = pruefeText(md, F);
  prot.befunde_erst = bef;
  if (!bef.length) return { md, prot };
  let text = md;
  if (typeof neuSchreiben === 'function') {
    try {
      const neu = await neuSchreiben(korrekturHinweis(bef));
      if (neu && String(neu).trim()) {
        const bef2 = pruefeText(neu, F);
        prot.neu_erzeugt = true;
        if (bef2.length <= bef.length) { text = neu; bef = bef2; }
        prot.befunde_danach = bef2;
      }
    } catch (e) { prot.neu_fehler = String(e && e.message || e); }
  }
  if (bef.length) { text = entferneSaetze(text, bef); prot.entfernt = bef.map((b) => b.satz); }
  return { md: text, prot };
}
