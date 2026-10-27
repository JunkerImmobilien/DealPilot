/* ═══════════════════════════════════════════════════════════════════════
   lib/lzs_anpassung.js · v3009 — OBJEKTSPEZIFISCH ANGEPASSTER
   LIEGENSCHAFTSZINSSATZ (§ 33 ImmoWertV)

   § 33: der Liegenschaftszinssatz nach § 21 Abs. 2 ist auf seine Eignung zu
   pruefen und bei Abweichungen nach § 9 Abs. 1 Satz 2 und 3 anzupassen;
   § 34 Abs. 1: der Barwertfaktor rechnet mit dem ANGEPASSTEN Zins.
   ImmoWertA zu § 33: Ableitungsmodell und Modellansaetze des Ausschusses
   beachten (§ 10 Abs. 1); was sich nicht ueber den Zins anpassen laesst,
   gehoert in die besonderen objektspezifischen Grundstuecksmerkmale.

   REGEL (Marcel 27.10.2026, „genau recherchieren und so umsetzen, wie es
   gemacht wird"; Belege scratchpad lzs-anpassung-recherche.md):
     1. Angepasst wird NUR mit Funktion/Koeffizienten DESSELBEN Satzes.
     2. Nur innerhalb der Stuetzstellen - ausserhalb keine Anpassung nach
        diesem Merkmal (nie extrapolieren); dazwischen linear, gekennzeichnet.
     3. Fehlt die Eingabe, bleibt das Merkmal offen und wird genannt.
     4. `einheit: faktor` wirkt multiplikativ, `prozentpunkte` additiv; alles
        andere ist keine Zinsanpassung.
     5. Formen != konstante: die Funktion des Ausschusses hat schon
        objektspezifisch gerechnet (gutachterausschuss.js); hier wird das
        nur benannt („A, angepasst").
     6. Ohne Funktion: unangepasst, mit Grund.

   Warum ein eigener Auswerter und nicht swf_modelle.auswerten: dort wirkt
   eine Korrektur ohne `wirkung` ADDITIV und ausserhalb der Tabelle gilt der
   RANDWERT. Die Aurich-Tabellen tragen `einheit: faktor` ohne `wirkung` -
   1,14 waere auf 4,2 % ADDIERT worden. Und die Saetze sperren die
   Extrapolation ausdruecklich.
   ═══════════════════════════════════════════════════════════════════════ */

const de = (x, st = 2) => (Math.round(Number(x) * Math.pow(10, st)) / Math.pow(10, st)).toLocaleString('de-DE', { maximumFractionDigits: st });

/* Feld des Satzes -> Eingabe des Objekts. Nur was eindeutig ist. */
const FELD = {
  restnutzungsdauer: 'restnutzungsdauer',
  bodenrichtwert: 'bodenrichtwert', bodenrichtwert_eur_m2: 'bodenrichtwert', bodenrichtwert_eur_qm: 'bodenrichtwert',
  miete_eur_m2_monat: 'miete_qm', nettokaltmiete_eur_qm_monat: 'miete_qm',
  anteil_gewerbliche_nutzflaeche_pct: 'gewerbeanteil_pct', gewerbeanteil_prozent: 'gewerbeanteil_pct',
  /* „Nutzflaechenanteil" (Aurich) ist im Blatt nicht eindeutig als gewerblicher Anteil
     beschrieben - nur mit ausdruecklicher Eingabe unter genau diesem Namen. */
  nutzflaechenanteil_pct: 'nutzflaechenanteil_pct',
  gemeinde: 'gemeinde',
};
const NAME = { restnutzungsdauer: 'Restnutzungsdauer', bodenrichtwert: 'Bodenrichtwert', miete_qm: 'Miete je m²',
  gewerbeanteil_pct: 'gewerblicher Nutzflächenanteil', nutzflaechenanteil_pct: 'Nutzflächenanteil', gemeinde: 'Gemeinde' };
const EINHEIT_EINGABE = { restnutzungsdauer: ' Jahre', bodenrichtwert: ' €/m²', miete_qm: ' €/m²', gewerbeanteil_pct: ' %', nutzflaechenanteil_pct: ' %' };

function zahl(v) { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; }

/* Eine Korrektur des Satzes auf die Eingabe anwenden. -> {ok, ...} oder {offen, grund} */
function eineKorrektur(k, e) {
  const bez = k.bez || k.merkmal || k.feld || 'Merkmal';
  const einheit = String(k.einheit || '').toLowerCase();
  const wirkung = einheit === 'faktor' ? 'faktor' : (einheit === 'prozentpunkte' ? 'pp' : null);
  if (!wirkung) return { offen: true, merkmal: bez, grund: 'keine Zinsanpassung in Zahlen (Einheit „' + (k.einheit || '–') + '")' };
  const schl = FELD[k.feld];
  if (!schl) return { offen: true, merkmal: bez, grund: 'Merkmal „' + k.feld + '" wird nicht erfasst' };

  /* Ausprägungen als Liste [{auspraegung, wert}] (Hameln-Hannover) */
  if (Array.isArray(k.werte)) {
    const g = String(e[schl] || '').trim().toLowerCase();
    if (!g) return { offen: true, merkmal: bez, grund: NAME[schl] + ' fehlt' };
    const wortGleich = (a) => a.toLowerCase().split(/[\s,()/-]+/).includes(g) || a.toLowerCase() === g;
    let t = k.werte.find((w) => !/^übrige/i.test(String(w.auspraegung)) && wortGleich(String(w.auspraegung)));
    if (!t) t = k.werte.find((w) => /^übrige/i.test(String(w.auspraegung)));   /* „übrige Region …" = alle anderen im Geltungsbereich */
    if (!t || zahl(t.wert) === null) return { offen: true, merkmal: bez, grund: 'keine Ausprägung für ' + e[schl] };
    return { ok: true, merkmal: bez, wirkung, wert: zahl(t.wert), auspraegung: String(t.auspraegung), interpoliert: false };
  }
  /* Ausprägungen als Objekt {name: wert} */
  if (k.werte && typeof k.werte === 'object' && schl === 'gemeinde') {
    const g = String(e[schl] || '').trim().toLowerCase();
    const key = Object.keys(k.werte).find((n) => n.toLowerCase() === g);
    if (!key || zahl(k.werte[key]) === null) return { offen: true, merkmal: bez, grund: g ? 'keine Ausprägung für ' + e[schl] : NAME[schl] + ' fehlt' };
    return { ok: true, merkmal: bez, wirkung, wert: zahl(k.werte[key]), auspraegung: key, interpoliert: false };
  }
  /* Stuetzstellen-Tabelle */
  const tab = k.stufen;
  if (!tab || typeof tab !== 'object') return { offen: true, merkmal: bez, grund: 'keine Tabelle im Satz' };
  const x = zahl(e[schl]);
  if (x === null) return { offen: true, merkmal: bez, grund: NAME[schl] + ' fehlt' };
  const st = Object.keys(tab).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (st.length < 2) return { offen: true, merkmal: bez, grund: 'Tabelle mit weniger als zwei Stützstellen' };
  const y = (s) => zahl(tab[String(s)] !== undefined ? tab[String(s)] : tab[Object.keys(tab).find((kk) => Number(kk) === s)]);
  if (x < st[0] || x > st[st.length - 1]) {
    return { offen: true, merkmal: bez, ausserhalb: true,
      grund: NAME[schl] + ' ' + de(x, 2) + (EINHEIT_EINGABE[schl] || '') + ' liegt außerhalb der Tabelle des Ausschusses ('
        + de(st[0], 2) + '–' + de(st[st.length - 1], 2) + '), nicht extrapoliert' };
  }
  let v, interp = false;
  const genau = st.find((s) => s === x);
  if (genau !== undefined) v = y(genau);
  else {
    const i = st.findIndex((s) => s > x); const x0 = st[i - 1], x1 = st[i];
    v = y(x0) + (y(x1) - y(x0)) * (x - x0) / (x1 - x0); interp = true;
  }
  if (!Number.isFinite(v)) return { offen: true, merkmal: bez, grund: 'Tabellenwert nicht lesbar' };
  return { ok: true, merkmal: bez, wirkung, wert: Math.round(v * 10000) / 10000,
    auspraegung: de(x, 2) + (EINHEIT_EINGABE[schl] || ''), interpoliert: interp,
    /* v3010 · Marcel 27.10.2026: lineare Interpolation bestaetigt; ob der Ausschuss sie selbst vorgibt */
    regel_ausschuss: /linear/i.test(String(k.interpolation || '')) && !/nicht/i.test(String(k.interpolation || '')) };
}

/**
 * @param {object} o
 * @param {object} o.satz      Registersatz des verwendeten Zinses (kennzahl liegenschaftszinssatz)
 * @param {number} o.wert_pct  Zins, den das Register fuer dieses Objekt geliefert hat (%)
 * @param {object} o.eingabe   { restnutzungsdauer, bodenrichtwert, miete_qm, gewerbeanteil_pct, gemeinde }
 * @param {object} [o.roh]     Rueckgabe des Abrufs (rechenweg, modellform) fuer Funktionsformen
 */
export function lzsAnpassung({ satz, wert_pct, eingabe = {}, roh = null } = {}) {
  const basis = zahl(wert_pct);
  if (!satz || basis === null) return null;
  const f = satz.formel || {};
  const form = f.form || 'konstante';
  const fund = [satz.gaa_name, satz.berichtsjahr ? 'Grundstücksmarktbericht ' + satz.berichtsjahr : null,
    satz.seite ? 'S. ' + satz.seite : null].filter(Boolean).join(', ');

  /* 5 · Funktion des Ausschusses: schon objektspezifisch gerechnet */
  if (form !== 'konstante') {
    const rw = roh && roh.rechenweg;
    const rwText = Array.isArray(rw) ? rw.map((z) => (typeof z === 'string' ? z : (z && (z.text || z.pos)) || '')).filter(Boolean).join('; ')
      : (typeof rw === 'string' ? rw : null);
    return { angepasst: true, art: 'funktion', etikett: 'A, angepasst', basis_pct: null, zins_pct: basis, form,
      schritte: [], offen: [], fundstelle: fund,
      text: 'Liegenschaftszinssatz nach der Funktion des Gutachterausschusses (' + (f.bezeichnung || form) + ') für dieses Objekt: '
        + de(basis) + ' %' + (rwText ? ' — ' + rwText : '') + (fund ? ' (' + fund + ')' : '') + '.',
      eingabe };
  }

  const korr = Array.isArray(satz.korrekturen) ? satz.korrekturen : [];
  if (!korr.length) {
    return { angepasst: false, art: 'keine_funktion', etikett: null, basis_pct: basis, zins_pct: basis, form,
      schritte: [], offen: [], fundstelle: fund,
      text: 'Der Gutachterausschuss veröffentlicht zu diesem Liegenschaftszinssatz keine Umrechnungskoeffizienten oder '
        + 'Anpassungsfunktion. Der Zinssatz gilt unangepasst (§ 33 ImmoWertV: Eignung geprüft; erhebliche Abweichungen '
        + 'wären als besondere objektspezifische Grundstücksmerkmale zu berücksichtigen, ImmoWertA zu § 33).',
      eingabe };
  }

  const schritte = [], offen = [];
  let z = basis;
  for (const k of korr) {
    const r = eineKorrektur(k, eingabe || {});
    if (r.ok) {
      const vor = z;
      z = r.wirkung === 'faktor' ? z * r.wert : z + r.wert;
      schritte.push({ merkmal: r.merkmal, auspraegung: r.auspraegung, wirkung: r.wirkung, wert: r.wert, interpoliert: r.interpoliert,
        vor_pct: Math.round(vor * 10000) / 10000, nach_pct: Math.round(z * 10000) / 10000, fundstelle: k.hinweis ? String(k.hinweis).split('.')[0] : null });
      schritte[schritte.length - 1].regel_ausschuss = !!r.regel_ausschuss;
    } else offen.push({ merkmal: r.merkmal, grund: r.grund, ausserhalb: !!r.ausserhalb });
  }
  const st = f.rundung_stellen != null ? Number(f.rundung_stellen) : 2;
  const zins = Math.round(z * Math.pow(10, st)) / Math.pow(10, st);
  const angepasst = schritte.length > 0 && Math.abs(zins - basis) > 1e-9;
  const teile = schritte.map((s) => s.merkmal.replace(/\s*\(.*\)\s*$/, '') + ' ' + s.auspraegung + ': '
    + (s.wirkung === 'faktor' ? '× ' + de(s.wert, 4) : (s.wert >= 0 ? '+ ' : '− ') + de(Math.abs(s.wert), 2) + ' Pp.')
    + (s.interpoliert ? (s.regel_ausschuss ? ' (zwischen den Stützstellen linear interpoliert, wie vom Ausschuss vorgegeben)'
      : ' (lineare Interpolation (DealPilot), Tabelle des Ausschusses ohne eigene Regel)') : ''));   /* v3010 */
  const offenText = offen.length ? ' Nicht angepasst: ' + offen.map((o) => o.merkmal.replace(/\s*\(.*\)\s*$/, '') + ' (' + o.grund + ')').join('; ') + '.' : '';
  return {
    angepasst, art: 'koeffizienten', etikett: angepasst ? 'A, angepasst' : null,
    basis_pct: basis, zins_pct: angepasst ? zins : basis, form, schritte, offen, fundstelle: fund,
    text: (schritte.length
      ? 'Umrechnung mit den Koeffizienten des Gutachterausschusses' + (fund ? ' (' + fund + ')' : '') + ': ' + teile.join('; ') + '.'
      : 'Der Gutachterausschuss veröffentlicht Umrechnungskoeffizienten, für dieses Objekt greift keiner.') + offenText,
    eingabe,
  };
}

export default { lzsAnpassung };
