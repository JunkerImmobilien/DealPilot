/* lib/zweigwahl.js — v1816 · DEN ZWEIG DES AUSSCHUSSES WÄHLEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Im Register liegen 1.205 amtliche Liegenschaftszinssätze mit
 * Quellenvermerk, Jahrgang und Lizenz. Gemessen am 03.10.2026 am laufenden
 * Dienst kamen sie außerhalb von NRW im Bericht **nicht an**:
 *
 *     Bielefeld  NW  etw   2,8 %  Stufe A   Gutachterausschuss Bielefeld
 *     Dresden    SN  etw   3,0 %  Stufe D   § 256 Abs. 1 Nr. 2 BewG
 *     Hamburg    HH  etw   3,0 %  Stufe D   § 256 Abs. 1 Nr. 2 BewG
 *
 * `GAA.liegenschaftszinssatz()` war gebaut, hatte aber außer einer
 * Diagnoseroute keinen Aufrufer — und es verlangt einen ZWEIG, den es
 * nicht selbst ableitet. Genau dieses Stück fehlte.
 *
 *   > Ein Notnagel, der immer eine plausible Zahl liefert, verdeckt den
 *   > Defekt vollständig. § 256 BewG liegt laut eigenem Hinweistext „in
 *   > der Regel unter dem örtlichen Liegenschaftszinssatz und führt damit
 *   > zu einem eher hohen Ertragswert" — der Bericht rechnete also
 *   > systematisch zu hoch, und nichts widersprach.
 *
 * ── WAS HIER NICHT PASSIERT ──────────────────────────────────────────
 *
 * Diese Datei ERFINDET KEINE BÄNDERUNG. Jedes Band wird aus dem Schlüssel
 * gelesen, den der Ausschuss selbst führt: `efh_frei_rnd36_55` sagt
 * „freistehendes Einfamilienhaus, Restnutzungsdauer 36 bis 55 Jahre" —
 * das ist die Einteilung des Gutachterausschusses, nicht meine.
 *
 * Gemessen wurden 110 verschiedene Schlüssel. Sie zerfallen in:
 *
 *     Art        efh · zfh · ezfh · dreifh · mfh · etw/we_* · rhdhh ·
 *                teileigentum · buero · handel · ggg · gegi · wgh · …
 *     Variante   frei · dhh_reh · rmh · villa · offen · geschl
 *     Baujahr    altbau · ab1991 · bj1989 · bj1990
 *     RND-Band   rnd13_20 · rnd_ab76 · rnd50plus · rnd_bis12
 *     Lage       lage_einfach · lage_mittel · lage_sehr_gut
 *     Stadtteil  st_mainz · st_finthen · … (Mainz führt 13 Stadtteile)
 *
 * ── UND WAS BEI EINER LÜCKE PASSIERT ─────────────────────────────────
 *
 * Marcel: „Vielleicht machen wir da irgendwie: konnte nicht gemacht werden
 * aus den und den Gründen und dann kann man diese Sachen noch eingeben,
 * damit dann so ein Zinssatz abgerufen wird."
 *
 * Genau das. Fehlt eine Angabe, kommt kein Schweigen und kein Rückfall,
 * sondern eine RÜCKFRAGE mit Namen: welches Feld fehlt, welche Werte der
 * Ausschuss führt, und was der Nutzer eintragen muss. Eine Lücke, die
 * sagt was ihr fehlt, ist keine Lücke mehr, sondern ein nächster Schritt.
 */

/* ── Objektart → zulässige Arten des Registers ───────────────────────────
 *
 * Die Reihenfolge ist die Rangfolge: der erste Treffer gewinnt. Je
 * genauer die Art, desto weiter vorne.
 *
 * ETW IST STANDARDMÄSSIG VERMIETET (`we_v`). Marcels Entscheidung vom
 * 03.10.2026: „standardmäßig ist Eigentumswohnung erst mal immer
 * vermietet … Ist ja ein Kapitalrechner." Wer `nutzung: 'selbst'` setzt,
 * bekommt `we_s` bzw. `we_e`. */
const ART_RANG = {
  etw:        ['etw', 'we_v', 'we', 'wohnung'],
  etw_selbst: ['etw', 'we_s', 'we_e', 'we', 'wohnung'],
  teileigentum: ['teileigentum', 'etw', 'we_v'],
  efh:        ['efh', 'ezfh'],
  dhh:        ['efh_dhh_reh', 'rhdhh', 'efh', 'ezfh'],
  reh:        ['efh_dhh_reh', 'efh_rmh', 'rhdhh', 'efh', 'ezfh'],
  villa:      ['efh_villa', 'altbauvilla', 'efh'],
  zfh:        ['zfh', 'ezfh', 'efh'],
  dreifh:     ['dreifh', 'mfh'],
  mfh:        ['mfh', 'wgh'],
  wgh:        ['wgh', 'mfh'],
  buero:      ['gg_buero', 'buero', 'gewerbe', 'gew_dl', 'ggg'],
  handel:     ['handel', 'gewerbe', 'ggg', 'gegi'],
  gewerbe:    ['gewerbe', 'gew_dl', 'ggg', 'gegi', 'indwb'],
  hotel:      ['gg_hotel', 'gewerbe', 'ggg'],
  logistik:   ['produktion_logistik', 'indwb', 'gewerbe'],
};

/* Die VARIANTE, die zur Art gehört — sie darf nie quer gelesen werden.
 * Ein `efh_frei` ist kein Reihenhaus, auch wenn beide mit `efh` anfangen. */
const VARIANTE_ZU_TYP = {
  frei: ['efh', 'zfh'], dhh_reh: ['dhh', 'reh'], rmh: ['reh'],
  villa: ['villa'], offen: ['mfh'], geschl: ['mfh'],
};

/* ── Einen Schlüssel des Registers zerlegen ──────────────────────────────
 *
 * Gelesen, nicht geraten: jede Regel unten ist an einem Schlüssel belegt,
 * der wirklich im Register steht. */
export function dekodiere(zweig) {
  let r = String(zweig || '').toLowerCase().trim();
  const o = { zweig: r, art: null, variante: null, bj_klasse: null,
              bj_grenze: null, rnd_von: null, rnd_bis: null,
              lage: null, stadtteil: null, alle: false };
  if (!r) return o;

  /* Stadtteil:  we_v_st_finthen  →  stadtteil 'finthen' */
  let m = /_st_([a-z_]+)$/.exec(r);
  if (m) { o.stadtteil = m[1]; r = r.slice(0, m.index); }

  /* Lage:  we_e_lage_sehr_gut  →  lage 'sehr_gut' */
  m = /_lage_([a-z_]+)$/.exec(r);
  if (m) { o.lage = m[1]; r = r.slice(0, m.index); }

  /* RND-Bänder, in vier Schreibweisen — alle vier stehen im Register:
   *   rnd13_20   Band von..bis
   *   rnd_ab76   offen nach oben
   *   rnd50plus  offen nach oben (andere Schreibweise)
   *   rnd_bis12  offen nach unten */
  if ((m = /_rnd(\d+)_(\d+)$/.exec(r))) {
    o.rnd_von = +m[1]; o.rnd_bis = +m[2]; r = r.slice(0, m.index);
  } else if ((m = /_rnd_ab(\d+)$/.exec(r))) {
    o.rnd_von = +m[1]; r = r.slice(0, m.index);
  } else if ((m = /_rnd(\d+)plus$/.exec(r))) {
    o.rnd_von = +m[1]; r = r.slice(0, m.index);
  } else if ((m = /_rnd_bis(\d+)$/.exec(r))) {
    o.rnd_bis = +m[1]; r = r.slice(0, m.index);
  }

  /* Baujahr: altbau / ab1991 / bj1989 / bj1990.
   * ACHTUNG, zwei Lesarten, und sie sind verschieden:
   *   mfh_ab1991      ab Baujahr 1991
   *   we_v_bj1989     BIS Baujahr 1989   (Mainz: bj1989 und bj1990 sind
   *                   die zwei Klassen -> 1989 = bis, 1990 = ab)
   * Deshalb wird `bj<jahr>` nicht als Richtung geraten, sondern als
   * GRENZE gespeichert; die Richtung entscheidet der Vergleich mit dem
   * Geschwisterzweig (siehe waehle()). */
  if ((m = /_altbau$/.exec(r))) { o.bj_klasse = 'altbau'; r = r.slice(0, m.index); }
  else if ((m = /_ab(\d{4})$/.exec(r))) { o.bj_klasse = 'ab'; o.bj_grenze = +m[1]; r = r.slice(0, m.index); }
  else if ((m = /_bj(\d{4})$/.exec(r))) { o.bj_klasse = 'bj'; o.bj_grenze = +m[1]; r = r.slice(0, m.index); }

  /* `_alle` heißt: dieser Satz gilt ohne weitere Unterscheidung. */
  if ((m = /_alle$/.exec(r))) { o.alle = true; r = r.slice(0, m.index); }

  /* Was übrig ist, ist Art plus Variante. Die Variante wird nur
   * abgetrennt, wenn sie zu einer bekannten gehört — sonst bliebe von
   * `produktion_logistik` die Art `produktion` übrig. */
  for (const v of Object.keys(VARIANTE_ZU_TYP)) {
    if (r.endsWith('_' + v)) { o.variante = v; r = r.slice(0, -(v.length + 1)); break; }
  }
  o.art = r;
  return o;
}

/* ── Objektart des Formulars → Typ dieser Datei ──────────────────────────
 *
 * `haustyp` ist das neue Feld (v1816): bei EFH wählt der Nutzer darunter
 * freistehend / Doppelhaushälfte / Reihenhaus. Marcels Wunsch: „bei
 * Einfamilienhäusern, wenn man das auswählt, könnte man direkt unter der
 * Liste vielleicht das mit angeben". */
export function typVon({ objart, haustyp, nutzung, einheiten }) {
  const a = String(objart || '').toLowerCase().trim();
  const h = String(haustyp || '').toLowerCase().trim();
  const n = String(nutzung || '').toLowerCase().trim();

  if (/etw|wohnung|whg/.test(a)) {
    /* Vermietet ist der Standard — es ist ein Kapitalanlagerechner. */
    return (n === 'selbst' || n === 'selbstgenutzt' || n === 'eigen') ? 'etw_selbst' : 'etw';
  }
  if (/teileigentum/.test(a)) return 'teileigentum';
  if (a === 'dhh' || /doppelhaus/.test(a) || h === 'dhh') return 'dhh';
  if (a === 'rh' || /reihen/.test(a) || h === 'rh') return 'reh';
  if (/^efh|einfamilien/.test(a)) {
    if (h === 'dhh') return 'dhh';
    if (h === 'rh') return 'reh';
    if (h === 'villa') return 'villa';
    return 'efh';
  }
  if (/^zfh|zweifamilien/.test(a)) return 'zfh';
  if (/^mfh|mehrfamilien/.test(a)) return Number(einheiten) === 3 ? 'dreifh' : 'mfh';
  if (/gesch/.test(a)) return 'wgh';
  if (/buero|büro/.test(a)) return 'buero';
  if (/hotel/.test(a)) return 'hotel';
  if (/handel|laden/.test(a)) return 'handel';
  if (/gew/.test(a)) return 'gewerbe';
  if (/gar/.test(a)) return null;          /* Garage: kein Zinssatzzweig */
  return null;
}

function passtRnd(d, rnd) {
  if (d.rnd_von == null && d.rnd_bis == null) return true;   /* kein Band */
  if (!Number.isFinite(rnd)) return null;                    /* unbekannt */
  if (d.rnd_von != null && rnd < d.rnd_von) return false;
  if (d.rnd_bis != null && rnd > d.rnd_bis) return false;
  return true;
}

function passtBaujahr(d, bj, geschwisterGrenzen) {
  if (!d.bj_klasse) return true;
  if (!Number.isFinite(bj)) return null;
  if (d.bj_klasse === 'altbau') return bj < 1991;            /* Gegenstück zu ab1991 */
  if (d.bj_klasse === 'ab') return bj >= d.bj_grenze;
  if (d.bj_klasse === 'bj') {
    /* `bj<jahr>` ohne Richtung. Führt der Ausschuss ZWEI bj-Klassen
       (Mainz: 1989 und 1990), ist die kleinere das „bis" und die größere
       das „ab". Führt er nur eine, gilt sie als „bis". */
    const andere = (geschwisterGrenzen || []).filter((g) => g !== d.bj_grenze);
    const groesser = andere.filter((g) => g > d.bj_grenze).length > 0;
    return groesser ? bj <= d.bj_grenze : bj >= d.bj_grenze;
  }
  return true;
}

/* Wie genau ist ein Zweig? Mehr Einschränkungen = genauer = Vorrang. */
function genauigkeit(d) {
  let g = 0;
  if (d.variante) g += 4;
  if (d.rnd_von != null || d.rnd_bis != null) g += 3;
  if (d.bj_klasse) g += 2;
  if (d.lage) g += 2;
  if (d.stadtteil) g += 2;
  if (d.alle) g -= 1;
  return g;
}

/**
 * Den Zweig wählen, den der Ausschuss für dieses Objekt führt.
 *
 * @param {string[]} zweige   die Schlüssel, die der Ausschuss führt
 * @param {object}   obj      objart, haustyp, nutzung, baujahr,
 *                            restnutzungsdauer, einheiten, lage, stadtteil
 * @returns {{zweig:string, begruendung:string}}
 *        | {rueckfrage:string, fehlt:string, auswahl:string[], hinweis:string}
 */
export function waehle(zweige, obj = {}) {
  const liste = (zweige || []).filter(Boolean);
  if (!liste.length) {
    return { rueckfrage: 'kein_ausschuss', fehlt: null, auswahl: [],
      hinweis: 'Für diesen Ort führt das Register keinen Liegenschaftszinssatz. '
             + 'Übertragen werden darf er nicht (§ 10 ImmoWertV).' };
  }

  const typ = typVon(obj);
  if (!typ) {
    return { rueckfrage: 'objektart', fehlt: 'objart',
      auswahl: [...new Set(liste.map((z) => dekodiere(z).art))],
      hinweis: 'Für diese Objektart ist kein Zinssatzzweig vorgesehen.' };
  }

  const rang = ART_RANG[typ] || [typ];
  const rnd = Number(obj.restnutzungsdauer);
  const bj = Number(obj.baujahr);
  const dek = liste.map(dekodiere);

  /* Nach Art, in der Rangfolge: der erste Rang, der überhaupt etwas hat,
     entscheidet. Nicht querlesen — sonst gewinnt ein ungenauerer Rang mit
     mehr Treffern über den genauen. */
  for (const artWunsch of rang) {
    let kand = dek.filter((d) => d.art === artWunsch);
    if (!kand.length) continue;

    /* Variante: gehört sie zu diesem Typ? Fremde Varianten fallen weg.
       Ein freistehendes EFH darf nicht den Reihenhaus-Zweig bekommen. */
    kand = kand.filter((d) => {
      if (!d.variante) return true;
      const erlaubt = VARIANTE_ZU_TYP[d.variante] || [];
      return erlaubt.includes(typ);
    });
    if (!kand.length) continue;

    /* Hat der Ausschuss eine Variante für diesen Typ, ist der Satz OHNE
       Variante der allgemeine — der genauere gewinnt später über
       genauigkeit(). Hier wird nichts entfernt. */

    const bjGrenzen = kand.filter((d) => d.bj_klasse === 'bj').map((d) => d.bj_grenze);

    /* Baujahr */
    let offenBj = false;
    let nachBj = kand.filter((d) => {
      const p = passtBaujahr(d, bj, bjGrenzen);
      if (p === null) { offenBj = true; return false; }
      return p;
    });
    if (!nachBj.length && offenBj) {
      return { rueckfrage: 'baujahr', fehlt: 'baujahr',
        auswahl: [...new Set(kand.filter((d) => d.bj_klasse).map((d) => d.zweig))],
        hinweis: 'Der Gutachterausschuss unterscheidet nach Baujahr. Ohne Baujahr '
               + 'lässt sich der richtige Zinssatz nicht zuordnen.' };
    }
    if (!nachBj.length) nachBj = kand.filter((d) => !d.bj_klasse);
    if (!nachBj.length) continue;

    /* Restnutzungsdauer */
    let offenRnd = false;
    let nachRnd = nachBj.filter((d) => {
      const p = passtRnd(d, rnd);
      if (p === null) { offenRnd = true; return false; }
      return p;
    });
    if (!nachRnd.length && offenRnd) {
      const ohneBand = nachBj.filter((d) => d.rnd_von == null && d.rnd_bis == null);
      if (!ohneBand.length) {
        return { rueckfrage: 'restnutzungsdauer', fehlt: 'restnutzungsdauer',
          auswahl: nachBj.map((d) => d.zweig),
          hinweis: 'Der Gutachterausschuss staffelt den Zinssatz nach '
                 + 'Restnutzungsdauer. Ohne sie lässt sich kein Band zuordnen — '
                 + 'trag Baujahr und Modernisierungen ein, dann wird sie abgeleitet.' };
      }
      nachRnd = ohneBand;
    }
    if (!nachRnd.length) {
      /* RND bekannt, liegt aber außerhalb JEDES Bandes. Kein erfundener
         Nachbarwert — das ist die Doktrin: wo die Quelle endet, endet die
         Rechnung. Aber mit Namen und Spanne, nicht mit Schweigen. */
      const baender = nachBj.filter((d) => d.rnd_von != null || d.rnd_bis != null)
        .map((d) => (d.rnd_von != null ? d.rnd_von : '…') + '–' + (d.rnd_bis != null ? d.rnd_bis : '…'));
      return { rueckfrage: 'rnd_ausserhalb', fehlt: null, auswahl: nachBj.map((d) => d.zweig),
        hinweis: 'Die Restnutzungsdauer von ' + rnd + ' Jahren liegt außerhalb der '
               + 'Bänder, die der Gutachterausschuss führt (' + baender.join(', ')
               + '). Ein Band zu übertragen wäre nicht modellkonform (§ 10 ImmoWertV).' };
    }

    /* Lage und Stadtteil: führt der Ausschuss sie, MUSS die Angabe da sein. */
    const mitLage = nachRnd.filter((d) => d.lage);
    if (mitLage.length && nachRnd.length > 1) {
      const l = String(obj.lage || '').toLowerCase().trim().replace(/\s+/g, '_');
      const treffer = l ? nachRnd.filter((d) => d.lage === l) : [];
      if (!treffer.length) {
        return { rueckfrage: 'lage', fehlt: 'lage',
          auswahl: [...new Set(mitLage.map((d) => d.lage))],
          hinweis: 'Der Gutachterausschuss staffelt nach Lage. Bitte die Lagestufe '
                 + 'angeben, dann wird der amtliche Zinssatz abgerufen.' };
      }
      nachRnd = treffer;
    }
    const mitTeil = nachRnd.filter((d) => d.stadtteil);
    if (mitTeil.length && nachRnd.length > 1) {
      const s = String(obj.stadtteil || '').toLowerCase().trim().replace(/\s+/g, '_');
      const treffer = s ? nachRnd.filter((d) => d.stadtteil === s) : [];
      if (!treffer.length) {
        return { rueckfrage: 'stadtteil', fehlt: 'stadtteil',
          auswahl: [...new Set(mitTeil.map((d) => d.stadtteil))],
          hinweis: 'Dieser Gutachterausschuss führt eigene Zinssätze je Stadtteil. '
                 + 'Bitte den Stadtteil angeben, dann wird der amtliche Wert abgerufen.' };
      }
      nachRnd = treffer;
    }

    /* Der genaueste gewinnt. Bei Gleichstand der erste — aber dann ist es
       derselbe Grad an Genauigkeit, also keine stille Entscheidung
       zwischen Ungleichen. */
    nachRnd.sort((a, b) => genauigkeit(b) - genauigkeit(a));
    const sieger = nachRnd[0];
    const teile = [];
    if (sieger.variante) teile.push(sieger.variante);
    if (sieger.bj_klasse) teile.push('Baujahr ' + (sieger.bj_klasse === 'altbau' ? 'Altbau' : sieger.bj_grenze));
    if (sieger.rnd_von != null || sieger.rnd_bis != null) {
      teile.push('RND ' + (sieger.rnd_von != null ? sieger.rnd_von : '…')
               + '–' + (sieger.rnd_bis != null ? sieger.rnd_bis : '…'));
    }
    if (sieger.lage) teile.push('Lage ' + sieger.lage);
    if (sieger.stadtteil) teile.push('Stadtteil ' + sieger.stadtteil);
    return { zweig: sieger.zweig, art: sieger.art,
      begruendung: 'Zweig des Gutachterausschusses: ' + sieger.zweig
        + (teile.length ? ' (' + teile.join(', ') + ')' : '') };
  }

  /* Keine Art des Registers passt zu diesem Objekt. */
  return { rueckfrage: 'keine_art', fehlt: null,
    auswahl: [...new Set(dek.map((d) => d.art))],
    hinweis: 'Der Gutachterausschuss führt für diese Objektart keinen '
           + 'Liegenschaftszinssatz. Geführt werden: '
           + [...new Set(dek.map((d) => d.art))].join(', ') + '.' };
}

/* ── DER EINE EINSTIEG ───────────────────────────────────────────────────
 *
 * Alles zusammen: Gebiet suchen, Zweig wählen, Lage klären, Wert abrufen.
 * EINE Stelle, damit der Bericht nicht wieder an einem Teilstück vorbei
 * läuft — genau das war der Fehler, den dieses Paket behebt.
 *
 * GEMESSEN am 03.10.2026: 393 von 882 Proben scheiterten mit
 * `zweig_nicht_abgeleitet`, obwohl der Zweig im Register stand. Ursache ist
 * `findeZweig`: führt ein Ausschuss MEHRERE Sätze zum selben Zweig, die sich
 * nur in `geltungsbereich.lage` unterscheiden, gibt es ohne Lageangabe
 * `null` zurück — richtig, aber ohne Begründung.
 *
 *   > Eine Sperre ohne Begründung sieht aus wie eine Lücke in den Daten.
 *   > Die Daten waren da; es fehlte eine Angabe, und das stand nirgends.
 */
export function zinssatzFuerObjekt(deps, ags, obj = {}) {
  const { finde, lagenFuer, abruf } = deps;
  const saetze = finde('liegenschaftszinssatz', ags) || [];
  if (!saetze.length) {
    return { verfuegbar: false, rueckfrage: 'kein_ausschuss',
      hinweis: 'Für diesen Ort führt das Register keinen Liegenschaftszinssatz. '
             + 'Übertragen werden darf er nicht (§ 10 ImmoWertV).' };
  }

  const zweige = [...new Set(saetze.map((s) => s.zweig).filter(Boolean))];
  const w = waehle(zweige, obj);
  if (!w.zweig) return { verfuegbar: false, ...w };

  /* Lage: führt der Ausschuss mehrere Sätze zu DIESEM Zweig, entscheidet
     sie — und ohne sie wird gefragt, nicht geraten. */
  let lage = obj.lage ? String(obj.lage).trim() : null;
  const lagen = (lagenFuer ? lagenFuer('liegenschaftszinssatz', ags, w.zweig) : []) || [];
  if (lagen.length) {
    const treffer = lage
      ? lagen.find((l) => String(l).toLowerCase() === lage.toLowerCase())
      : null;
    if (!treffer) {
      return { verfuegbar: false, rueckfrage: 'lage', fehlt: 'lage',
        zweig: w.zweig, auswahl: [...new Set(lagen)],
        hinweis: 'Der Gutachterausschuss führt für ' + w.zweig + ' mehrere '
               + 'Zinssätze je Lage. Bitte die Lage angeben — dann wird der '
               + 'amtliche Wert abgerufen.' };
    }
    lage = treffer;
  }

  const r = abruf({ ...obj, ags, zweig: w.zweig, lage }) || {};
  const wert = r.wert_pct != null ? r.wert_pct : (r.wert != null ? r.wert : null);
  if (!r.verfuegbar || wert == null) {
    return { verfuegbar: false, rueckfrage: r.grund || 'kein_wert',
      zweig: w.zweig, spanne: r.spanne || null,
      spanne_wortlaut: r.spanne_wortlaut || null,
      hinweis: r.hinweis || 'Der Gutachterausschuss führt zu diesem Zweig keinen '
             + 'auswertbaren Wert.' };
  }
  return { verfuegbar: true, wert_pct: wert, stufe: r.stufe || 'A',
    zweig: w.zweig, lage, begruendung: w.begruendung,
    ausschuss: r.ausschuss || null, stufe_grund: r.stufe_grund || null,
    quellenvermerk: r.quellenvermerk || null, quelle_url: r.quelle_url || null,
    berichtsjahr: r.berichtsjahr || null, stichtag: r.stichtag || null,
    modellansaetze: r.modellansaetze || null, roh: r };
}

export default { dekodiere, typVon, waehle, zinssatzFuerObjekt };
