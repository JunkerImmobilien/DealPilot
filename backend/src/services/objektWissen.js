'use strict';
/* services/objektWissen.js — v3025 · EIN Objektwissen für Bot, Co-Pilot und Cockpit-Pilot
 *
 * Marcel 28.10.2026: „wird alles, was wir heute ergänzt haben, auch immer im
 * Objektwissen gespeichert, und kann der Telegram-Bot darauf zugreifen?" und
 * „das muss auch im Cockpit-Piloten für jedes Objekt das Wissen haben ...
 * ‚Wie viel Potenzial steckt dieses Jahr in meinen Immobilien?' ... ‚Welche
 * To-dos gibt es?'"
 *
 * GEMESSEN vorher (tools/agent-pruefung/pruef-objektwissen.js, Lindenallee 14):
 * die Unterlagen-Auswertung `data._dok_auswertung` (8 Dokumente, 14 Risiken,
 * WEG mit Massnahmen, Abt. II, offene Fragen) erreichte KEIN Bot-Werkzeug —
 * `objekt_lesen` wirft alles mit `_` weg und sah nur die zwei Felder, in die
 * der Import Risiken und These geschrieben hatte. Der Co-Pilot bekam drei
 * gekuerzte Zeilen (dok_unterlagen, dok_risiken, dok_weg), ohne Massnahmen,
 * Anteil, Sonderumlagen, Baulasten, Abt. II und offene Fragen.
 *
 * Hier steht deshalb EINE Fassung, die alle drei lesen:
 *   · Telegram-Bot   agentWerkzeuge.js  objekt_unterlagen, portfolio_potenzial, portfolio_todos
 *   · Co-Pilot       routes/ai.js /copilot  (context.objekt_id -> objektwissen)
 *   · Cockpit-Pilot  routes/ai.js /copilot  (context.art === 'portfolio')
 *
 * ── WAS HIER NICHT PASSIERT ──────────────────────────────────────────────
 * Kein Wert wird neu ermittelt. Gelesen wird, was die App im Objekt abgelegt
 * hat: die Auswertung (unterlagen.js), das Potenzial (`_potenzial`, potenzial.js
 * zusammenfassung — dort rechnen § 558/§ 559 und die Kappungsgrenze). Die
 * einzige Rechnung ist die, die auch unterlagen.js `anteil()` macht — ETW:
 * Gesamtkosten x Miteigentumsanteil, sonst ganzes Haus — und das Aufzaehlen
 * von Monaten. Eine zweite Mietrechnung waere eine zweite Wahrheit.
 *
 * Personendaten: die Auswertung ist beim Lesen der Dokumente schon geschwaerzt
 * (seiten-lesen, dokumente-auswerten). Jeder Text geht hier trotzdem noch einmal
 * durch `schwaerzen.schwaerze()`, und Dateinamen sowie die Verwalter-Zeile
 * bleiben draussen.
 */
const { schwaerze } = require('./schwaerzen');

const ORD = { hoch: 0, mittel: 1, niedrig: 2 };
const MON = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function _daten(d) {
  if (typeof d === 'string') { try { return JSON.parse(d) || {}; } catch (e) { return {}; } }
  return d || {};
}
function _zahl(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim().replace(/[€%\s]/g, '');
  const n = /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function _txt(s, max) {
  if (s == null || s === '') return null;
  let t = String(schwaerze(String(s)).text || '').replace(/\s+/g, ' ').trim();
  if (max && t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + ' …';
  return t || null;
}
function _eur(n) { return n == null ? null : Math.round(n).toLocaleString('de-DE') + ' €'; }
function adresse(d) {
  d = _daten(d);
  return [d.str, d.hnr].filter(Boolean).join(' ') + (d.ort ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : '');
}
function _ym(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function _ymText(ym) { return /^\d{4}-\d{2}/.test(ym || '') ? MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : null; }

/* ── 1 · Anteil an Gemeinschaftskosten — wie unterlagen.js anteil() ─────── */
function anteil(d, gesamt) {
  const g = _zahl(gesamt); if (g == null) return null;
  const mea = parseFloat(String(d.mea == null ? '' : d.mea).replace(/\./g, '').replace(',', '.'));
  if (String(d.objart || '') === 'ETW') return mea > 0 ? { eur: Math.round(g * mea / 100), wie: 'Gesamtkosten × MEA ' + String(mea).replace('.', ',') + ' %' } : null;
  return { eur: Math.round(g), wie: 'ganzes Haus (100 %)' };
}

/* ── 2 · Unterlagen-Auswertung kompakt ──────────────────────────────────── */
/**
 * unterlagen(data, opts) -> null | { stand, dokumente, risiken, ... }
 * opts.kurz: fuer den Cockpit-Piloten (viele Objekte) — Top-Risiken, Summen, Zaehler.
 */
function unterlagen(data, opts) {
  const d = _daten(data);
  const kurz = !!(opts && opts.kurz);
  let roh = d._dok_auswertung;
  if (!roh) return null;
  if (typeof roh === 'string') { try { roh = JSON.parse(roh); } catch (e) { return null; } }
  const a = roh && roh.auswertung;
  if (!a) return null;

  const risiken = (Array.isArray(a.risiken) ? a.risiken : []).filter(Boolean).slice()
    .sort((x, y) => ((ORD[x.schwere] ?? 1) - (ORD[y.schwere] ?? 1)) || ((_zahl(y.kosten_eur) || 0) - (_zahl(x.kosten_eur) || 0)))
    .map((x) => {
      const r = { schwere: x.schwere || 'mittel', titel: _txt(x.titel, 120), quelle: _txt(x.quelle || x.fundstelle, 120) };
      if (!kurz) r.beschreibung = _txt(x.beschreibung, 360);
      const k = _zahl(x.kosten_eur), kg = _zahl(x.kosten_gesamt_eur);
      if (k != null) r.kosten_eur = Math.round(k);
      if (kg != null && kg > 0) { r.kosten_gesamt_eur = Math.round(kg); const an = anteil(d, kg); if (an) { r.anteil_eur = an.eur; r.anteil_wie = an.wie; } }
      if (x.jahr) r.jahr = x.jahr;
      return r;
    });
  const zaehl = { hoch: 0, mittel: 0, niedrig: 0 };
  risiken.forEach((x) => { if (zaehl[x.schwere] != null) zaehl[x.schwere]++; });

  const w = a.weg || null;
  const massnahmen = w && Array.isArray(w.sanierungen) ? w.sanierungen.filter(Boolean).map((s) => {
    const m = { massnahme: _txt(s.massnahme, 140), status: s.status || null, jahr: s.jahr || null };
    const g = _zahl(s.kosten_eur);
    if (g != null) {
      m.kosten_gesamt_eur = Math.round(g);
      const an = anteil(d, g);
      if (an) { m.anteil_eur = an.eur; m.anteil_wie = an.wie; }
      else if (_zahl(s.anteil_objekt_eur) != null) { m.anteil_eur = Math.round(_zahl(s.anteil_objekt_eur)); m.anteil_wie = 'laut Auswertung (kein MEA im Objekt)'; }
    }
    return m;
  }) : [];

  const bl = a.baulasten || null;
  const gb = a.grundbuch || null;
  const aus = {
    stand: roh.stand || null,
    dokumente: (Array.isArray(roh.dokumente) ? roh.dokumente : []).map((x) => (x.label || x.typ || 'Dokument') + (x.datum ? ' (' + x.datum + ')' : '')),
    risiken_anzahl: zaehl,
    risiken: kurz ? risiken.slice(0, 3) : risiken.slice(0, 15),
    investitionsthese: kurz ? null : _txt(a.investitionsthese, 700),
    weg: w ? {
      kernpunkte: kurz ? undefined : (w.kernpunkte || []).slice(0, 10).map((x) => _txt(x, 220)).filter(Boolean),
      ruecklage: _txt(w.ruecklage, kurz ? 160 : 320),
      hausgeld: kurz ? undefined : _txt(w.hausgeld, 260),
      sonderumlagen: (w.sonderumlagen || []).slice(0, 6).map((x) => _txt(x, 200)).filter(Boolean),
      fazit: kurz ? undefined : _txt(w.fazit, 400)
    } : null,
    massnahmen: kurz ? massnahmen.filter((m) => /beschlossen|geplant/.test(String(m.status || ''))) : massnahmen,
    abt2_lasten: gb && Array.isArray(gb.lasten) ? gb.lasten.slice(0, 8).map((x) => _txt(x, kurz ? 140 : 260)).filter(Boolean) : [],
    grundschulden: kurz || !gb ? undefined : _txt(gb.grundschulden, 220),
    baulasten: bl ? (bl.keine && !(bl.eintraege || []).length
      ? 'Laut Auskunft aus dem Baulastenverzeichnis sind keine Baulasten eingetragen.'
      : (bl.eintraege || []).slice(0, 8).map((x) => _txt(x, 260)).filter(Boolean))
      : 'Keine Baulastenauskunft in den Unterlagen - Baulasten stehen nicht im Grundbuch, sondern im Baulastenverzeichnis der Bauaufsicht; sie kann im Reiter „Unterlagen & WEG“ nachgereicht werden.',
    offene_fragen: (a.offene_fragen || []).slice(0, kurz ? 5 : 12).map((x) => _txt(x, 220)).filter(Boolean),
    zuletzt_nachgereicht: kurz ? undefined : ((a.aenderungen || []).slice(0, 8).map((x) => _txt(x, 220)).filter(Boolean))
  };
  /* Anteil-Regel einmal nennen, damit das Modell nicht selbst teilt */
  const an1 = anteil(d, 1);
  aus.anteil_regel = an1 ? (an1.wie === 'ganzes Haus (100 %)' ? 'Ganzes Haus: dein Anteil sind 100 % der Kosten der Gemeinschaft.' : 'Eigentumswohnung: dein Anteil = Gesamtkosten × Miteigentumsanteil (' + an1.wie.replace('Gesamtkosten × ', '') + ').')
    : 'Eigentumswohnung ohne Miteigentumsanteil im Objekt - der Anteil ist nicht bestimmbar; MEA im Reiter Objekt eintragen.';
  return aus;
}

/* ── 3 · Potenzial im Jahr — gelesen aus _potenzial.zusammenfassung ──────── */
/* v3028 · TERMINE: Marcel 28.10.2026 („ja, mach das so") - „sofort" hiess in der App nur, dass
   das Erhoehungsverlangen JETZT gestellt werden darf. Getrennt ausgewiesen werden seither
   „verlangbar ab" (frühester Zugang) und „wirksam ab" (Beginn der Zahlungspflicht):
     § 558b Abs. 1 BGB  „... schuldet er die erhöhte Miete mit Beginn des dritten Kalendermonats
                         nach dem Zugang des Erhöhungsverlangens."
     § 559b Abs. 2 BGB  „Der Mieter schuldet die erhöhte Miete mit Beginn des dritten Monats nach
                         dem Zugang der Erklärung."
     § 557b Abs. 3 BGB  „Die geänderte Miete ist mit Beginn des übernächsten Monats nach dem
                         Zugang der Erklärung zu entrichten."
     (gesetze-im-internet.de, gelesen 28.10.2026)
   GERECHNET wird das an EINER Stelle: frontend/js/potenzial.js mhTermine(). Die Zusammenfassung
   speichert je Wohnung soll_verlangbar_ab, soll_verlangbar_sofort, soll_wirksam_ab, soll_termin -
   hier wird nur gelesen. Der Indexpfad liest index.erklaerung_ab / index.ab (js/indexmiete.js).

   ALTER SPEICHERSTAND (vor v3028, nur `soll_ab` als Text „sofort"/„Okt 2026"): bis das Objekt
   einmal in der App geöffnet wurde, gibt es die Felder nicht. Dafür steht unten _altTermin(),
   gekennzeichnet als „aus altem Speicherstand umgerechnet". tools/mieterhoehung-termine-pruefen.mjs
   haelt TERMIN_PLUS und _altTermin() gegen mhTermine() zusammen (dieselben Faelle, dasselbe Ergebnis). */
const TERMIN_PLUS = { '558': 3, '559': 3, '557b': 2 };
const TERMIN_NORM = { '558': '§ 558b Abs. 1 BGB', '559': '§ 559b Abs. 2 BGB', '557b': '§ 557b Abs. 3 BGB' };
function _mmjj(ym) { return /^\d{4}-\d{2}/.test(ym || '') ? ym.slice(5, 7) + '/' + ym.slice(0, 4) : null; }
function _plusM(ym, n) {
  const m = /^(\d{4})-(\d{2})/.exec(ym || ''); if (!m) return null;
  const t = +m[1] * 12 + (+m[2] - 1) + n; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0');
}
function _terminText(verl, sofort, wirk) {
  return 'verlangbar ab ' + (sofort ? 'sofort' : _mmjj(verl)) + ' · wirksam ab ' + _mmjj(wirk);
}
/* nur alter Speicherstand: `soll_ab` als Text, gerechnet am Stand der Zusammenfassung */
function _abYm(text, stand, heuteYm) {
  const t = String(text || '');
  const m = t.match(/\b(Jan|Feb|Mrz|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\s+((?:19|20)\d\d)\b/);
  if (m) return m[2] + '-' + String(MON.indexOf(m[1]) + 1).padStart(2, '0');
  if (/^sofort/i.test(t)) { const s = /^\d{4}-\d{2}/.test(stand || '') ? stand.slice(0, 7) : heuteYm; return s > heuteYm ? s : heuteYm; }
  return null;
}
/* Der alte Text war der früheste WIRKSAM-Monat nach § 558 Abs. 1 (letzte + 15) oder „sofort"
   (schon erreicht). verlangbar = wirksam - plus, nie vor heute; wirksam = verlangbar + plus. */
function _altTermin(soll_ab, stand, heuteYm, art) {
  const ab = _abYm(soll_ab, stand, heuteYm); if (!ab) return null;
  const plus = TERMIN_PLUS[art] || 3;
  let verl = _plusM(ab, -plus); if (!verl || verl < heuteYm) verl = heuteYm;
  return { verlangbar_ab: verl, verlangbar_sofort: verl <= heuteYm, wirksam_ab: _plusM(verl, plus), alt: true };
}
function _monateIm(jahr, abYm) {
  if (!abYm) return null;
  const j = +abYm.slice(0, 4), mo = +abYm.slice(5, 7);
  if (j > jahr) return 0;
  if (j < jahr) return 12;
  return 13 - mo;
}
/**
 * potenzial(data, jahr) -> null | { stand, positionen:[...], summe_monat, summe_im_jahr, ... }
 * Positionen: Mieterhoehung (§ 558 / § 559 / eigene Angabe / Indexmiete), Zielbild.
 * Je Mieterhoehung: verlangen_ab (JJJJ-MM), verlangbar_sofort, ab = wirksam_ab (JJJJ-MM),
 * ab_text = „verlangbar ab … · wirksam ab …", termin = Langform mit Norm.
 */
function potenzial(data, jahr, heute) {
  const d = _daten(data);
  const z = d._potenzial && d._potenzial.zusammenfassung;
  const now = heute || new Date();
  const heuteYm = _ym(now);
  jahr = Number(jahr) || now.getFullYear();
  const pos = [], ohne = [];
  const einh = d._mfh && Array.isArray(d._mfh.einheiten) ? d._mfh.einheiten : [];
  const vertragVon = (nr) => { const e = einh.find((x) => x && String(x.nr || '') === String(nr || '')); return e ? (e.mv_art || null) : (einh.length === 1 ? einh[0].mv_art || null : null); };
  if (z && Array.isArray(z.wohnungen)) {
    z.wohnungen.forEach((w) => {
      const ist = _zahl(w.ist), soll = _zahl(w.soll);
      const name = (w.nr ? 'Whg ' + w.nr : 'Wohnung') + (w.lage ? ' (' + w.lage + ')' : '');
      const vertrag = vertragVon(w.nr);
      /* Indexmiete: potenzial.js legt je Wohnung `index` ab ({miete, ab = wirksam, erklaerung_ab}) -
         die Rechnung nach § 557b bleibt in js/indexmiete.js. */
      if (w.index && _zahl(w.index.miete) > ist) {
        const wirk = /^\d{4}-\d{2}/.test(w.index.ab || '') ? w.index.ab.slice(0, 7) : null;
        const erk = /^\d{4}-\d{2}/.test(w.index.erklaerung_ab || '') ? String(w.index.erklaerung_ab).slice(0, 7) : null;
        const sofort = !!erk && erk <= heuteYm;
        pos.push({ art: 'Indexmiete (§ 557b BGB)', einheit: name, ist_monat: ist, neu_monat: _zahl(w.index.miete), mehr_monat: Math.round((_zahl(w.index.miete) - ist) * 100) / 100,
          verlangen_ab: erk, verlangbar_sofort: sofort, ab: wirk, wirksam_ab: wirk,
          ab_text: wirk ? (erk ? _terminText(erk, sofort, wirk) : 'wirksam ab ' + _mmjj(wirk)) : (w.index.ab_text || null),
          termin: wirk ? 'Erklärung ' + (sofort ? 'ab sofort' : 'ab ' + _mmjj(erk)) + ', wirksam ab dem übernächsten Monat nach Zugang (§ 557b Abs. 3 BGB): ' + _mmjj(wirk) + (sofort ? ' (Zugang heute angenommen)' : '') : null,
          annahme: w.index.annahme ? 'VPI-Zukunftswert ist eine Annahme, kein amtlicher Wert' : undefined,
          herkunft: w.index.herkunft || 'gerechnet in DealPilot (Indexmiete)' });
      } else if (soll != null && ist != null && soll > ist + 0.01) {
        const her = String(w.soll_herkunft || '');
        const art = vertrag === 'index' ? 'Indexmiete (§ 557b BGB, eigene Angabe)'
          : vertrag === 'staffel' ? 'Staffelmiete (eigene Angabe)'
          : /559/.test(her) && /558/.test(her) ? 'Mieterhöhung § 558 + Modernisierungsumlage § 559 BGB'
          : /559/.test(her) ? 'Modernisierungsumlage § 559 BGB'
          : /558/.test(her) ? 'Mieterhöhung § 558 BGB (Vergleichsmiete, Kappungsgrenze)'
          : 'Soll-Miete (eigene Angabe)';
        const norm = vertrag === 'index' ? '557b' : (/559/.test(her) && !/558/.test(her)) ? '559' : '558';
        let t = null;
        /* Staffel steigt ohne Erklärung (§ 557a BGB) - Termin = nächste Staffel aus den Einheiten */
        const eSt = vertrag === 'staffel' ? einh.find((x) => x && String(x.nr || '') === String(w.nr || '')) || (einh.length === 1 ? einh[0] : null) : null;
        const stYm = eSt && /^\d{4}-\d{2}/.test(eSt.mv_naechste_anpassung || '') ? String(eSt.mv_naechste_anpassung).slice(0, 7) : null;
        if (vertrag === 'staffel') t = null;
        else if (/^\d{4}-\d{2}/.test(w.soll_wirksam_ab || '')) {
          /* v3028: gespeichert von potenzial.js mhTermine() */
          t = { verlangbar_ab: String(w.soll_verlangbar_ab || '').slice(0, 7) || null, wirksam_ab: w.soll_wirksam_ab.slice(0, 7), alt: false };
          t.verlangbar_sofort = !!t.verlangbar_ab && t.verlangbar_ab <= heuteYm;
          /* gespeichert in einem früheren Monat: was damals „sofort" war, geht frühestens heute zu */
          if (t.verlangbar_ab && t.verlangbar_ab < heuteYm) {
            t.verlangbar_ab = heuteYm;
            const fr = _plusM(heuteYm, TERMIN_PLUS[norm]);
            if (t.wirksam_ab < fr) { t.wirksam_ab = fr; t.verschoben = true; }
          }
        } else t = _altTermin(w.soll_ab, z.stand, heuteYm, norm);
        pos.push({ art, einheit: name, ist_monat: ist, neu_monat: soll, mehr_monat: Math.round((soll - ist) * 100) / 100,
          verlangen_ab: t ? t.verlangbar_ab : null, verlangbar_sofort: t ? t.verlangbar_sofort : undefined,
          ab: t ? t.wirksam_ab : (vertrag === 'staffel' ? stYm : null), wirksam_ab: t ? t.wirksam_ab : (vertrag === 'staffel' ? stYm : null),
          ab_text: t ? _terminText(t.verlangbar_ab, t.verlangbar_sofort, t.wirksam_ab)
            : vertrag === 'staffel' ? (stYm ? 'nächste Staffel wirksam ab ' + _mmjj(stYm) + ' (§ 557a BGB, ohne Erklärung)' : 'nächste Staffel laut Vertrag - Datum nicht eingetragen (§ 557a BGB, ohne Erklärung)')
            : (/^sofort/i.test(w.soll_ab || '') ? null : (w.soll_ab || null)),   /* v3028: nie ein nacktes „sofort“ */
          termin: !t ? null : (!t.alt && !t.verschoben && w.soll_termin) ? w.soll_termin
            : _terminText(t.verlangbar_ab, t.verlangbar_sofort, t.wirksam_ab) + ' (' + (t.verlangbar_sofort ? 'Zugang heute angenommen, ' : 'bei Zugang im ' + _mmjj(t.verlangbar_ab) + ', ') + TERMIN_NORM[norm] + ')'
              + (t.alt ? ' - aus altem Speicherstand umgerechnet; genau nach einmal Öffnen von „Mieterhöhung & Zielbild"' : ''),
          wartefrist: /\(letzte Erh/.test(w.soll_ab || '') || /nicht eingetragen/.test(w.soll_termin || '') ? 'letzte Erhöhung nicht eingetragen - Sperrfrist § 558 Abs. 1 BGB (ein Jahr bis zum Verlangen, 15 Monate bis zur Wirkung) nicht geprüft' : undefined,
          herkunft: her || null });
      }
      const ziel = _zahl(w.ziel);
      if (ziel != null && ist != null && ziel > Math.max(ist, soll || 0) + 0.01) {
        const jm = String(w.ziel_wann || '').match(/\b((?:19|20)\d\d)\b/);
        const ab = jm ? jm[1] + '-01' : null;
        pos.push({ art: 'Zielbild (nach Maßnahmen' + (w.massnahmen ? ': ' + w.massnahmen : '') + ')', einheit: name, ist_monat: ist, neu_monat: ziel,
          mehr_monat: Math.round((ziel - Math.max(ist, soll || 0)) * 100) / 100, ab, ab_text: w.ziel_wann || null,
          kosten_eur: _zahl(w.kosten) || null, herkunft: 'Zielbild (eigene Planung)', zeitpunkt_unscharf: !!jm });
      }
    });
  }
  einh.forEach((e) => { if (e && e.mv_art === 'index' && !pos.some((p) => /Index/.test(p.art))) ohne.push('Whg ' + (e.nr || '?') + ': Indexmietvertrag - die Anpassung nach § 557b ist im Objekt noch nicht gespeichert (Reiter Investition, „Mieterhöhung & Zielbild“ einmal öffnen, dann rechnet DealPilot sie)'); });
  if (!z && !ohne.length) return null;
  pos.forEach((p) => {
    p.mehr_jahr_voll = Math.round(p.mehr_monat * 12);
    const mon = _monateIm(jahr, p.ab);
    p.monate_in_jahr = mon;
    p.wirksam_im_jahr_eur = mon == null ? null : Math.round(p.mehr_monat * mon);
  });
  const imJahr = pos.filter((p) => !/^Zielbild/.test(p.art) && ((p.verlangen_ab && +p.verlangen_ab.slice(0, 4) <= jahr) || (p.ab && +p.ab.slice(0, 4) <= jahr)));   /* im Jahr verlangbar oder wirksam */
  const ziel = pos.filter((p) => /^Zielbild/.test(p.art) && p.ab && +p.ab.slice(0, 4) <= jahr);
  return {
    stand: z ? z.stand : null,
    kappung: z && z.kappung ? z.kappung.text || null : null,
    positionen: pos,
    in_diesem_jahr: {
      jahr,
      mieterhoehungen_mehr_monat: Math.round(imJahr.reduce((s, p) => s + p.mehr_monat, 0)),
      mieterhoehungen_mehr_jahr_voll: Math.round(imJahr.reduce((s, p) => s + p.mehr_monat * 12, 0)),
      mieterhoehungen_wirksam_im_jahr: Math.round(imJahr.reduce((s, p) => s + (p.wirksam_im_jahr_eur || 0), 0)),
      zielbild_mehr_monat: ziel.length ? Math.round(ziel.reduce((s, p) => s + p.mehr_monat, 0)) : 0
    },
    nicht_erfasst: ohne.length ? ohne : undefined
  };
}

/* ── 4 · To-dos eines Objekts — nur was belegt ist, je mit Quelle ─────────── */
function _plusJahre(dt, j) { const x = new Date(dt.getTime()); x.setFullYear(x.getFullYear() + j); return x; }
function _datum(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (m) return new Date(+m[1], +m[2] - 1, +(m[3] || 1));
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{1,2})[./](\d{4})$/); if (m) return new Date(+m[2], +m[1] - 1, 1);
  return null;
}
function _de(dt) { return String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + dt.getFullYear(); }
/**
 * todos(data, opts) -> [{ was, faellig?, quelle, art }]
 * opts.anfragen: Zeilen aus unterlagen_anfragen fuer dieses Objekt
 */
function todos(data, opts) {
  const d = _daten(data);
  const o = opts || {};
  const heute = o.heute || new Date();
  const jahr = heute.getFullYear();
  const L = [];
  const u = unterlagen(d);
  const uq = u ? 'Unterlagen-Auswertung' + (u.stand ? ' vom ' + _de(new Date(u.stand)) : '') : null;
  if (u) {
    u.offene_fragen.forEach((f) => L.push({ art: 'Unterlagen', was: 'Beim Verwalter oder Verkäufer anfragen: ' + f, quelle: uq }));
    u.massnahmen.filter((m) => /beschlossen|geplant/.test(String(m.status || '')) && (!m.jahr || m.jahr >= jahr))
      .forEach((m) => L.push({ art: 'WEG', was: 'WEG-Maßnahme ' + m.status + ': ' + m.massnahme + (m.anteil_eur != null ? ' - dein Anteil ' + _eur(m.anteil_eur) : (m.kosten_gesamt_eur != null ? ' - gesamt ' + _eur(m.kosten_gesamt_eur) : '')) + ' (Liquidität einplanen)',
        faellig: m.jahr ? String(m.jahr) : null, quelle: uq }));
    ((u.weg && u.weg.sonderumlagen) || []).forEach((s) => L.push({ art: 'WEG', was: 'Sonderumlage: ' + s, quelle: uq }));
  }
  const p = potenzial(d, jahr, heute);
  if (p) {
    p.positionen.filter((x) => !/^Zielbild/.test(x.art) && ((x.verlangen_ab && +x.verlangen_ab.slice(0, 4) <= jahr) || (x.ab && +x.ab.slice(0, 4) <= jahr))).forEach((x) =>
      L.push({ art: 'Miete', was: (x.verlangen_ab ? 'Erhöhung verlangen ' + (x.verlangbar_sofort ? 'ab sofort' : 'ab ' + _mmjj(x.verlangen_ab)) + ' - ' : '') + x.art + ' ' + x.einheit + ': +' + _eur(x.mehr_monat) + '/Monat (' + _eur(x.ist_monat) + ' → ' + _eur(x.neu_monat) + ')' + (x.wirksam_ab ? ', wirksam ab ' + _mmjj(x.wirksam_ab) : (x.ab_text ? ', ' + x.ab_text : '')) + (x.termin ? ' [' + x.termin + ']' : '') + (x.wartefrist ? '; ' + x.wartefrist : ''), faellig: x.verlangen_ab ? (x.verlangbar_sofort ? 'sofort (verlangbar)' : _mmjj(x.verlangen_ab)) : x.ab_text,   /* v3028 */ quelle: 'Mieterhöhung & Zielbild, Stand ' + (p.stand || '?') }));
    (p.nicht_erfasst || []).forEach((t) => L.push({ art: 'Miete', was: t, quelle: 'Einheiten (Mietvertragsart)' }));
  }
  [['d1', 'Darlehen I'], ['d2', 'Darlehen II']].forEach(([k, name]) => {
    const bj = _zahl(d[k + '_bindj']); const start = _datum(d[k + '_auszahl']) || _datum(d[k + '_vertragsdatum']);
    if (!(_zahl(d[k]) > 0) || !(bj > 0) || !start) return;
    const ende = _plusJahre(start, bj);
    const monate = (ende.getFullYear() - heute.getFullYear()) * 12 + ende.getMonth() - heute.getMonth();
    if (monate >= 0 && monate <= 24) L.push({ art: 'Finanzierung', was: name + ': Zinsbindung endet ' + _ymText(_ym(ende)) + ' - Anschlussfinanzierung/Forward-Darlehen vorbereiten' + (d.bank_inst ? ' (' + d.bank_inst + ')' : ''),
      faellig: _ymText(_ym(ende)), quelle: 'Auszahlung ' + d[k + '_auszahl'] + ' + ' + bj + ' Jahre Zinsbindung (Reiter Finanzierung)' });
  });
  const kd = _datum(d.kaufdat);
  if (kd) {
    const ende = _plusJahre(kd, 3);
    if (ende >= heute) L.push({ art: 'Steuer', was: 'Frist anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG): bis ' + _de(ende) + ' dürfen Instandsetzungen netto 15 % der Gebäude-Anschaffungskosten nicht übersteigen, sonst über die AfA statt sofort absetzbar. Grenze und Stand: Reiter Investition, Sanierung.',
      faellig: _de(ende), quelle: 'Kaufdatum ' + _de(kd) });
  }
  (o.anfragen || []).forEach((a) => {
    if (a.status === 'entwurf') L.push({ art: 'Unterlagen beim Amt', was: 'Anfrage „' + (a.art_name || a.art) + '“ liegt als Entwurf - noch nicht verschickt', quelle: 'Unterlagen beim Amt, angelegt ' + _de(new Date(a.erstellt_am)) });
    else if (a.status === 'gesendet') L.push({ art: 'Unterlagen beim Amt', was: 'Anfrage „' + (a.art_name || a.art) + '“ verschickt' + (a.gesendet_am ? ' am ' + _de(new Date(a.gesendet_am)) : '') + ' - Antwort ausstehend, ggf. nachfassen', quelle: 'Unterlagen beim Amt' });
  });
  /* Pflichtangaben der PDFs - dieselben Felder wie js/pdf-pruefung.js (Steuer-PDF, Kaufpreisaufteilung) */
  const fehl = [];
  if (!(_zahl(d.kp) > 0)) fehl.push('Kaufpreis');
  const ga = _zahl(d.geb_ant); if (ga == null || !(ga > 0 && ga <= 100)) fehl.push('Gebäudeanteil');
  if (!(_zahl(d.afa_satz) > 0)) fehl.push('AfA-Satz');
  if (String(d.objart || '') === 'ETW' && !(_zahl(d.mea) > 0)) fehl.push('Miteigentumsanteil');
  if (!(_zahl(d.nkm) > 0) && !(Array.isArray(d._mfh && d._mfh.einheiten) && d._mfh.einheiten.some((e) => _zahl(e && e.ist) > 0))) fehl.push('Miete');
  if (fehl.length) L.push({ art: 'Daten', was: 'Für die PDFs fehlt: ' + fehl.join(', ') + ' (Investment-, Steuer-PDF und Kaufpreisaufteilung prüfen das vor dem Export)', quelle: 'Pflichtangaben wie in der PDF-Prüfung' });
  return L;
}

/* ── 5 · Marktmiete — alle Quellen nebeneinander, keine verrechnet ─────────
 *
 * Marcel 28.10.2026: „Woher beziehen wir Marktmieten? ... ‚Wie ist aktuell die
 * Miete für ETWs in Herford mit 80 m²?' – wenn wir mehr Quellen haben, können
 * wir es ausgeben."
 *
 * GEMESSEN, was es ohne Kontingent gibt (Staging, 28.10.2026):
 *   amtlich   Register der Gutachterausschüsse: die durchschnittliche Miete der
 *             Kauffälle, aus denen der Liegenschaftszins abgeleitet ist
 *             (`modell.marktmiete_eur_qm`, /register/probe) — Herford we_v 7,00 €/m²
 *             (Bericht 2025). Mietpreisübersicht eines Ausschusses: nur aus einem
 *             vorhandenen Bericht Stufe 3 (eine Tabelle: Minden-Lübbecke).
 *   Bestand   Zensus 2022 (/zensus/objekt): Klasse nach Baujahr und Größe, Gemeinde
 *             vor Kreis, Stichtag 15.05.2022 — seit v3028 dazu fortgeschrieben
 *             auf den jüngsten Monat des Nettokaltmieten-Index (mb-backend
 *             /zensus/fortgeschrieben, rechnet lib/zensus_miete.js).
 *   Angebot   aktueller Marktdurchschnitt aus Angeboten: nur aus einem schon
 *             erstellten Marktbericht zu einem Objekt am Ort (mietBelegeService,
 *             kostenlos lesbar). Ein neuer Abruf kostet Kontingent — der Weg wird
 *             genannt, nicht gegangen.
 *   eigene    Ist-Mieten der eigenen Objekte am Ort (Nettokaltmiete / Wohnfläche).
 * Keine Quelle wird mit einer anderen verrechnet; jede steht mit Stand und Herkunft.
 * Nach aussen kein Anbietername (Marcel 14.10.2026). */
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');
async function _json(url, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms || 4000);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; } finally { clearTimeout(t); }
}
const ZWEIG = { ETW: ['we_v', 'Wohnungseigentum (vermietet)'], WOHNUNG: ['we_v', 'Wohnungseigentum (vermietet)'], EFH: ['efh', 'Ein-/Zweifamilienhaus'],
  ZFH: ['zfh', 'Zweifamilienhaus'], DHH: ['rhdhh', 'Reihen-/Doppelhaus'], RH: ['rhdhh', 'Reihen-/Doppelhaus'], REH: ['rhdhh', 'Reihen-/Doppelhaus'],
  MFH: ['mfh', 'Mehrfamilienhaus'], DREIFH: ['dreifh', 'Dreifamilienhaus'] };
function _art(a) {
  const t = String(a || '').toUpperCase();
  if (/EIGENTUMSWOHNUNG|^ETW|WOHNUNG/.test(t)) return 'ETW';
  if (/MEHRFAMILIEN|^MFH/.test(t)) return 'MFH';
  if (/ZWEIFAMILIEN|^ZFH/.test(t)) return 'ZFH';
  if (/DOPPEL|^DHH/.test(t)) return 'DHH';
  if (/REIHEN|^RH|^REH/.test(t)) return 'RH';
  if (/EINFAMILIEN|^EFH/.test(t)) return 'EFH';
  return t || null;
}
/**
 * marktmiete({ ort, plz, objektart, wohnflaeche, baujahr, objekte: [{id,d}], userId })
 */
async function marktmiete(opt) {
  const o = opt || {};
  const art = _art(o.objektart);
  const wfl = _zahl(o.wohnflaeche), bj = _zahl(o.baujahr);
  const objekte = Array.isArray(o.objekte) ? o.objekte : [];
  const flach = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
  let plz = /^\d{5}$/.test(String(o.plz || '').trim()) ? String(o.plz).trim() : null;
  let ort = o.ort ? String(o.ort).trim().slice(0, 80) : null;
  let ags = null, gemeinde = null;
  /* Ort -> PLZ/AGS: erst die eigenen Objekte, dann das öffentliche PLZ-Verzeichnis (OpenPLZ, ohne Schlüssel) */
  if (!plz && ort) {
    const eig = objekte.find((x) => x.d && x.d.plz && flach(x.d.ort).startsWith(flach(ort)));
    if (eig) plz = String(eig.d.plz);
    else {
      const l = await _json('https://openplzapi.org/de/Localities?name=' + encodeURIComponent(ort), 5000);
      const z = Array.isArray(l) ? l.find((x) => flach(x.name) === flach(ort)) || l[0] : null;
      if (z) { plz = z.postalCode; ags = z.municipality && z.municipality.key; gemeinde = z.municipality && z.municipality.name; }
    }
  }
  if (!plz) return { gefunden: false, so_sagen: 'Zu „' + (ort || '?') + '“ finde ich keine Postleitzahl - nenn mir bitte PLZ oder Ort genauer.' };
  if (!ags) { const a = await _json(MB_BASE + '/ags?plz=' + plz, 4000); if (a && a.gemeinde_ags) { ags = a.gemeinde_ags; } else if (a && a.kreis_ags) ags = a.kreis_ags; }

  const quellen = [], fehlt = [];
  const zq = '?plz=' + plz + '&ort=' + encodeURIComponent(ort || '') + '&baujahr=' + (bj || '') + '&wfl=' + (wfl || '');
  const [zen, zfort, reg] = await Promise.all([
    _json(MB_BASE + '/zensus/objekt' + zq, 5000),
    _json(MB_BASE + '/zensus/fortgeschrieben' + zq, 5000),   /* v3028 · Fortschreibung mit dem Nettokaltmieten-Index */
    (ags && ZWEIG[art]) ? _json(MB_BASE + '/register/probe?ags=' + ags + '&kennzahl=liegenschaftszinssatz&zweig=' + ZWEIG[art][0], 4000) : Promise.resolve(null)
  ]);

  /* amtlich · Register */
  const e = reg && reg.ergebnis;
  if (e && e.verfuegbar && e.modell && _zahl(e.modell.marktmiete_eur_qm) > 0) {
    const sp = e.modell.marktmiete_spanne_eur_qm;
    quellen.push({ art: 'amtlich', wert_qm: _zahl(e.modell.marktmiete_eur_qm),
      spanne_qm: Array.isArray(sp) ? sp : (sp && sp.von != null ? [sp.von, sp.bis] : null),
      was: 'durchschnittliche Miete der ausgewerteten Kauffälle (' + ZWEIG[art][1] + '), aus denen der Gutachterausschuss den Liegenschaftszinssatz abgeleitet hat',
      herkunft: e.ausschuss || 'Gutachterausschuss', stand: e.stichtag || null, jahrgang: e.berichtsjahr || null, fallzahl: e.fallzahl || null,
      quelle_url: e.quelle_url || null,
      hinweis: 'Mittel über die Kauffälle des Ausschusses, nicht an Fläche/Baujahr angepasst; keine Vergleichsmiete nach § 558 BGB.' });
  } else {
    fehlt.push({ art: 'amtlich', grund: !ZWEIG[art] ? 'Objektart nicht genannt oder ohne Zweig im Register' : (e && e.hinweis) || 'kein Satz im Register',
      weg: 'Grundstücksmarktbericht des zuständigen Gutachterausschusses (Mietpreisübersicht, falls veröffentlicht) oder qualifizierter Mietspiegel der Gemeinde.' });
  }

  /* Bestand · Zensus 2022 */
  if (zen && zen.available) {
    const g = zen.gemeinde && (zen.gemeinde.miete_baujahr || zen.gemeinde.nettokaltmiete_qm) ? zen.gemeinde : null;
    const b = g || zen.kreis;
    if (b) {
      const klassen = [];
      if (b.miete_baujahr && _zahl(b.miete_baujahr.wert) > 0) klassen.push({ nach: 'Baujahr ' + b.miete_baujahr.klasse, wert_qm: _zahl(b.miete_baujahr.wert) });
      if (b.miete_flaeche && _zahl(b.miete_flaeche.wert) > 0) klassen.push({ nach: 'Wohnungsgröße ' + b.miete_flaeche.klasse, wert_qm: _zahl(b.miete_flaeche.wert) });
      const q = { art: 'Bestand', wert_qm: _zahl(b.nettokaltmiete_qm), klassen,
        was: 'durchschnittliche Nettokaltmiete der bewohnten Mietwohnungen (alle Mietverhältnisse, auch alte)',
        herkunft: 'Zensus 2022, ' + (g ? 'Gemeinde ' : 'Kreis ') + (b.name || ''), stand: '15.05.2022',
        hinweis: 'Bestandsmieten von 2022, nicht fortgeschrieben - liegen typisch unter Neuvermietungsmieten.' };
      /* v3028 · fortgeschrieben im mb-backend (/zensus/fortgeschrieben, lib/zensus_miete.js - dieselbe
         Rechnung wie im Ertragswert). Hier wird nichts gerechnet, nur übernommen. */
      if (zfort && zfort.available && _zahl(zfort.qm) > 0) {
        q.fortgeschrieben = { wert_qm: _zahl(zfort.qm), zensus_qm: _zahl(zfort.roh_qm), faktor: zfort.faktor, auf_monat: zfort.fortgeschrieben_auf || null,
          klassen: (zfort.klassen || []).map((x) => ({ nach: x.art + (x.klasse ? ' ' + x.klasse : ''), zensus_qm: x.roh_qm, wert_qm: x.qm })),
          index: zfort.index ? { wert: zfort.index.wert, monat: zfort.index.monat, basis: zfort.index.basis_wert + ' (' + zfort.index.basis_monat + ')' } : null,
          etikett: zfort.etikett, rechenweg: zfort.text };
        q.hinweis = zfort.etikett + ': ' + _zahl(zfort.qm).toFixed(2).replace('.', ',') + ' €/m² (Mittel der Klassen Baujahr/Wohnungsgröße, Zensus '
          + _zahl(zfort.roh_qm).toFixed(2).replace('.', ',') + ' €/m² × ' + String(zfort.faktor).replace('.', ',') + '). Bestandsmieten - liegen typisch unter Neuvermietungsmieten.';
      }
      quellen.push(q);
    }
  } else fehlt.push({ art: 'Bestand', grund: 'keine Zensuswerte zur PLZ ' + plz, weg: 'ergebnisse.zensus2022.de' });

  /* Angebot · aus vorhandenen Berichten der eigenen Objekte am Ort (kostenlos lesbar) */
  const amOrt = objekte.filter((x) => x.d && (String(x.d.plz || '') === plz || (ort && flach(x.d.ort).startsWith(flach(ort)))));
  amOrt.sort((a, b) => (_art(b.d.objart) === art) - (_art(a.d.objart) === art));
  let angebot = null;
  if (o.userId && amOrt.length) {
    const mbs = require('./mietBelegeService');
    for (const x of amOrt.slice(0, 4)) {
      const s = await mbs.sammeln({ userId: o.userId, objId: x.id, plz: x.d.plz, ort: x.d.ort });
      if (s && s.markt && !s.markt.fehlt) {
        angebot = { art: 'Angebot', wert_qm: s.markt.wert_qm, spanne_qm: [s.markt.q25_qm, s.markt.q75_qm], anzahl: s.markt.anzahl, umkreis_km: s.markt.umkreis_km,
          was: 'aktueller Marktdurchschnitt aus Angeboten (Median, Spanne 25-75 %)', herkunft: 'Marktbericht zu ' + adresse(x.d) + ' (' + (x.d.objart || '') + ')',
          stand: s.markt.stand, hinweis: 'Angebotsmieten im Umkreis dieses Objekts, alle Größen und Baujahre - Angebote, keine Abschlüsse.' };
        if (s.amtlich && !s.amtlich.fehlt) quellen.push({ art: 'amtlich', wert_qm: s.amtlich.wert_qm, was: 'Vergleichsmiete aus der Mietpreisübersicht', herkunft: s.amtlich.ausschuss || s.amtlich.quelle, stand: s.amtlich.stand, hinweis: 'gilt für ' + adresse(x.d) });
        break;
      }
    }
  }
  if (angebot) quellen.push(angebot);
  else fehlt.push({ art: 'Angebot', grund: amOrt.length ? 'kein Marktbericht mit Mietangeboten zu deinen Objekten am Ort' : 'kein eigenes Objekt am Ort mit Marktbericht',
    weg: 'Den aktuellen Marktdurchschnitt aus Angeboten liefert die Marktpreisindikation (kostet ein Kontingent) - für ein Objekt am Ort im Reiter Objekt → Marktbericht.' });

  /* eigene Objekte am Ort */
  const eigene = amOrt.map((x) => { const n = _zahl(x.d.nkm), f = _zahl(x.d.wfl); return n > 0 && f > 0 ? { adresse: adresse(x.d), objektart: x.d.objart || null, baujahr: x.d.baujahr || null, wfl: f, nkm_monat: n, wert_qm: Math.round(n / f * 100) / 100 } : null; }).filter(Boolean).slice(0, 8);
  if (eigene.length) quellen.push({ art: 'eigene Objekte', was: 'Ist-Nettokaltmiete deiner Objekte am Ort', objekte: eigene, herkunft: 'deine Angaben in DealPilot' });

  return { gefunden: true, anfrage: { ort: ort || gemeinde || null, plz, ags, objektart: art, wohnflaeche: wfl, baujahr: bj }, quellen, fehlt,
    offen: quellen.some((x) => x.fortgeschrieben) ? undefined : 'Zensus-Fortschreibung (Nettokaltmieten-Index) gerade nicht abrufbar - der Zensuswert steht mit Stand 15.05.2022.' };
}

module.exports = { unterlagen, potenzial, todos, anteil, adresse, marktmiete, _art,
  _termine: { TERMIN_PLUS, _altTermin, _monateIm } };   /* v3028: fuer tools/mieterhoehung-termine-pruefen.mjs */
