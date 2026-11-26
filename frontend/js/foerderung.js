/* foerderung.js · v5120 · FÖRDERPROGRAMME JE OBJEKT UND VORHABEN (JJ6)
   Marcel 26.11.2026: „KfW-Programme drauf geben, welche man nutzen kann. Auch für
   Kapitalanleger interessant, aber nur wenn sinnvoll."

   EIN KERN, liest NICHTS aus Einstellungen, localStorage oder dem DOM. Alles kommt
   als Parameter. Das Register (js/data/foerderregister.js, window.DpFoerderregister)
   wird übergeben oder aus window gelesen, wenn es nicht übergeben wird.

   DpFoerderung.passend(eingabe, register) → { liste, hinweis, leer_grund }
     eingabe = {
       nutzung:    'eigen' | 'vermietet'            (Pflicht)
       neubau:     true | false                     (Neubau oder Erstkauf Neubau)
       kauf:       true | false                     (es geht um den Kauf)
       massnahmen: ['heizung','huelle','effizienzhaus','barriere']  (geplant)
       baujahr, energieklasse ('A+'..'H'), kinder (Zahl unter 18),
       einkommen_zve (zu versteuerndes Haushaltsjahreseinkommen, für 458),
       haushaltseinkommen (für 300/308/358), erste_immobilie (true/false/null),
       heizung_art ('oel'|'gas'|'gas_etage'|'kohle'|'nachtspeicher'|'biomasse'|...),
       heizung_alter (Jahre), stichtag ('JJJJ-MM-TT', für den sinkenden Bonus)
     }
   Regeln:
     Vermieter: Liste NUR bei geplanter Sanierung bzw. Modernisierung oder Neubau,
                nie für den reinen Kauf (Marcel: „nur wenn sinnvoll").
     Selbstnutzer: auch beim Kauf (124, 308 …).
   Keine Rendite-Rechnung mit Zuschüssen (bewusst). Kundentext ohne Gedankenstrich
   und Semikolon. */
(function (root) {
  'use strict';

  var HINWEIS = 'Voraussetzungen und Konditionen vor Antrag beim Förderprogramm prüfen.';
  var SCHLECHT = { F: 1, G: 1, H: 1 };

  function hat(arr, k) { return Array.isArray(arr) && arr.indexOf(k) >= 0; }
  function num(v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function finde(reg, id) {
    var all = [].concat(reg.programme || [], reg.programme_eigen || []);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function grenze(pr, kinder) {
    var g = pr.einkommen_grenze; if (!g) return null;
    var k = Math.max(1, kinder || 1);
    return g.basis + (k - 1) * (g.je_weiteres_kind || 0);
  }

  /* Klimageschwindigkeitsbonus 458: 16 %, ab 1.2.2027 halbjährlich −4, ab 1.8.2028 0 */
  function klimabonusPct(kb, stichtag) {
    if (!kb) return 0;
    var d = String(stichtag || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) d = new Date().toISOString().slice(0, 10);
    if (d >= kb.endet_fuer_antraege_ab) return 0;
    if (d < kb.sinkt_ab) return kb.pct;
    var stufen = ['2027-02-01', '2027-08-01', '2028-02-01'], n = 0;
    stufen.forEach(function (s) { if (d >= s) n++; });
    return Math.max(0, kb.pct - n * kb.schritt_pct);
  }
  function einkommensbonusPct(tab, zve, kinder) {
    if (zve === null || !Array.isArray(tab)) return null;
    for (var i = 0; i < tab.length; i++) if (zve <= tab[i].bis) return (kinder > 0 ? tab[i].mit_kind : tab[i].ohne_kind);
    return 0;
  }
  function fossilAlt(art, alter) {
    var a = String(art || '').toLowerCase();
    if (/oel|öl|kohle|nachtspeicher|gas_etage|gasetage/.test(a)) return true;
    if (/gas|biomasse|pellet|holz/.test(a) && num(alter) !== null && num(alter) >= 20) return true;
    return false;
  }

  function eintrag(pr, warum, extra) {
    var e = {
      id: pr.id, name: pr.name, art: pr.art, betrag: pr.betrag, vorteil: pr.vorteil,
      voraussetzung: pr.voraussetzung || '', antrag: pr.antrag || '', url: pr.url,
      warum: warum, pruefen: [], gelesen: pr.gelesen || null
    };
    if (extra) for (var k in extra) e[k] = extra[k];
    return e;
  }

  function passend(eingabe, register) {
    var reg = register || (root && root.DpFoerderregister) || null;
    var E = eingabe || {};
    var out = { liste: [], hinweis: HINWEIS, stand: reg && reg.stand || null, leer_grund: null };
    if (!reg) { out.leer_grund = 'Förderregister nicht geladen'; return out; }
    var eigen = E.nutzung === 'eigen';
    var m = Array.isArray(E.massnahmen) ? E.massnahmen : [];
    var kinder = num(E.kinder) || 0;
    var hhe = num(E.haushaltseinkommen), zve = num(E.einkommen_zve);
    var klasse = String(E.energieklasse || '').toUpperCase().replace(/\s/g, '');
    var add = function (id, warum, extra) { var pr = finde(reg, id); if (pr) out.liste.push(eintrag(pr, warum, extra)); return out.liste[out.liste.length - 1]; };

    if (!eigen) {
      /* Kapitalanleger: nur bei Vorhaben, nie für den reinen Kauf */
      if (!m.length && !E.neubau) { out.leer_grund = 'Für den reinen Kauf einer vermieteten Immobilie gibt es keine passende Bundesförderung. Programme erscheinen, sobald eine Sanierung oder Modernisierung geplant ist.'; return out; }
      if (E.neubau) {
        add('kfw298', 'Neubau zur Vermietung in klimafreundlichem Standard.');
        add('kfw296', 'Neubau im Niedrigpreissegment mit Effizienzhaus 55, wenn Flächen- und Kostengrenzen passen.').pruefen.push('Flächen- und Kostengrenzen');
      }
      if (hat(m, 'effizienzhaus')) add('kfw261', 'Geplante Sanierung des ganzen Gebäudes auf eine Effizienzhaus-Stufe.');
      if (hat(m, 'heizung')) add('kfw458', 'Geplanter Heizungstausch, für Vermieter mit 30 % Grundförderung.');
      if (hat(m, 'huelle')) add('bafa_huelle', 'Geplante Arbeiten an Fenstern, Fassade oder Dach.');
      if (hat(m, 'heizung') || hat(m, 'huelle')) add('kfw359', 'Kredit zusätzlich zum Zuschuss für die Einzelmaßnahme.');
      if (hat(m, 'barriere')) add('kfw159', 'Geplanter barrierearmer Umbau.');
      if (!out.liste.length) out.leer_grund = 'Für die geplanten Maßnahmen ist kein Bundesprogramm hinterlegt.';
      return out;
    }

    /* Selbstnutzer */
    if (E.kauf || E.neubau) add('kfw124', E.neubau ? 'Bau oder Kauf eines Neubaus zur Selbstnutzung.' : 'Kauf einer Immobilie zum Selbstbewohnen, auch für die Kaufnebenkosten.');

    if (E.kauf && !E.neubau) {
      var p308 = finde(reg, 'kfw308');
      if (p308 && kinder >= 1) {
        var gr = grenze(p308, kinder), e308 = null;
        if (hhe !== null && hhe > gr) {
          /* Einkommen zu hoch: nicht zeigen */
        } else if (klasse && !SCHLECHT[klasse]) {
          /* Energieklasse passt nicht */
        } else {
          var kred = p308.kredit_je_kinder[Math.min(3, kinder)];
          e308 = add('kfw308', 'Familie mit ' + kinder + (kinder === 1 ? ' Kind' : ' Kindern') + ' kauft ein energetisch schwaches Bestandsgebäude, bis ' + eur(kred) + ' Kredit.', { kredit_max: kred, einkommen_grenze: gr });
          if (!klasse) e308.pruefen.push('Energieausweis Klasse F, G oder H');
          if (hhe === null) e308.pruefen.push('Haushaltseinkommen höchstens ' + eur(gr));
          if (E.erste_immobilie !== true) e308.pruefen.push('einzige Wohnimmobilie in Deutschland');
          e308.pruefen.push('Sanierung nach dem Kauf verpflichtend');
        }
      }
    }
    if (E.neubau) {
      var p300 = finde(reg, 'kfw300');
      if (p300 && kinder >= 1) {
        var g3 = grenze(p300, kinder);
        if (!(hhe !== null && hhe > g3)) {
          var e300 = add('kfw300', 'Familie baut klimafreundlich oder kauft einen solchen Neubau erstmals.', { einkommen_grenze: g3 });
          if (hhe === null) e300.pruefen.push('Haushaltseinkommen höchstens ' + eur(g3));
          e300.pruefen.push('Effizienzhaus 40 mit Anforderungen an Treibhausgase');
        }
      }
      add('kfw297', 'Klimafreundlicher Neubau zur Selbstnutzung, ohne Einkommensgrenze.');
      add('kfw296', 'Neubau im Niedrigpreissegment, wenn Flächen- und Kostengrenzen passen.').pruefen.push('Flächen- und Kostengrenzen');
    }

    if (hat(m, 'effizienzhaus')) add('kfw261', 'Geplante Sanierung des ganzen Gebäudes auf eine Effizienzhaus-Stufe.');
    if (hat(m, 'heizung')) {
      var p458 = finde(reg, 'kfw458_eigen');
      var kb = fossilAlt(E.heizung_art, E.heizung_alter) ? klimabonusPct(p458 && p458.klimabonus, E.stichtag) : 0;
      var ek = einkommensbonusPct(p458 && p458.einkommensbonus, zve, kinder);
      var summe = 30 + kb + (ek || 0);
      var deckel = (zve !== null && zve <= (kinder > 0 ? 40000 : 30000)) ? 80 : 70;
      var satz = Math.min(summe, deckel);
      var teile = ['30 % Grundförderung'];
      if (kb) teile.push(kb + ' % Klimageschwindigkeitsbonus');
      if (ek) teile.push(ek + ' % Einkommensbonus');
      var e458 = add('kfw458_eigen', 'Geplanter Heizungstausch: ' + teile.join(', ') + ', zusammen etwa ' + satz + ' % der förderfähigen Kosten.', { satz_pct: satz });
      if (!kb) e458.pruefen.push('Klimageschwindigkeitsbonus nur beim Tausch einer alten fossilen Heizung');
      if (ek === null) e458.pruefen.push('Einkommensbonus hängt vom zu versteuernden Einkommen ab');
    }
    if (hat(m, 'huelle')) add('bafa_huelle', 'Geplante Arbeiten an Fenstern, Fassade oder Dach.');
    if (hat(m, 'heizung') || hat(m, 'huelle')) {
      if (hhe !== null && hhe <= 90000) add('kfw358', 'Zinsverbilligter Kredit zum Zuschuss, Haushaltseinkommen bis 90.000 €.');
      else { var e359 = add('kfw359', 'Kredit zusätzlich zum Zuschuss für die Einzelmaßnahme.'); if (hhe === null) e359.pruefen.push('mit Haushaltseinkommen bis 90.000 € auch zinsverbilligt über KfW 358'); }
    }
    if (hat(m, 'barriere')) add('kfw159', 'Geplanter barrierearmer Umbau.');
    if (!out.liste.length) out.leer_grund = 'Für dieses Vorhaben ist kein Bundesprogramm hinterlegt.';
    return out;
  }

  var api = { passend: passend, klimabonusPct: klimabonusPct, einkommensbonusPct: einkommensbonusPct, HINWEIS: HINWEIS, version: 'v5120' };
  if (root) root.DpFoerderung = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
