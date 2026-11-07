// vergleichsfaktor_eingabe.js — EINE Stelle für Eingabe und Auswertung des amtlichen
// Vergleichsfaktors aus dem Register (§ 20 ImmoWertV).
//
// v3200 · Herausgelöst aus ReportOrchestrator (dort seit v1977a/v2999/v3008 gewachsen), weil der
// Aufteilerwert (PotenzialService) denselben Faktor JE WOHNUNG braucht. Zwei Kopien dieser
// Achsen- und Merkmalsliste würden auseinanderlaufen - die Liste ist das Wissen, welcher
// Ausschuss welche Achse wie nennt. Der Text unten ist unverändert übernommen; nur die
// Variablen kommen jetzt als Parameter.
import { stichtagJahr } from './stichtag.js';

export function regVfEingabe({ ref, landValue, ags, brw, rnd, bgf, extra }) {
  const _rndVorab = { rnd: rnd != null ? rnd : null };
  const _brwVf = brw, _bgfVf = bgf, _agsWert = ags;
  const _ein = {
          ags: String(_agsWert), objektart: ref.property_type,
          brw: _brwVf, brw_eur_qm: _brwVf, bodenwert: _brwVf,
          wohnflaeche: Number(ref.living_area) || null,
          wohnflaeche_qm: Number(ref.living_area) || null,
          bgf_qm: _bgfVf,
          rnd: _rndVorab.rnd != null ? _rndVorab.rnd : null,
          rnd_jahre: _rndVorab.rnd != null ? _rndVorab.rnd : null,
          flaeche: Number(ref.plot_area) > 0 ? Number(ref.plot_area) : null,
          baujahr: Number(ref.build_year) > 0 ? Number(ref.build_year) : null,
          /* v2999 · Gebaeudefaktoren Sachsen-Anhalt (vgf-st-2025) rechnen mit Standardstufe, Unterkellerung,
             Modernisierungspunkten und Garagen - ohne sie halten 115 von 121 Saetzen an (bedingung_nicht_pruefbar).
             Unterkellerung aus der NHK-Angabe (Geschosse 0/1 = mit Keller, 2/3 = ohne; keller_dg kg_/ohne_kg_);
             eine Teilunterkellerung fuehrt DealPilot nicht - dann keine Zahl, kein Raten. */
          standardstufe: Number(ref.standardstufe) > 0 ? Number(ref.standardstufe) : null,
          unterkellerung_pct: (function () {
            const k = String(ref.keller_dg || '');
            if (/^kg_/.test(k)) return 100;
            if (/^ohne_kg/.test(k)) return 0;
            const m = /^\d+\.(\d)/.exec(String(ref.nhk_typ || ''));
            if (m) return (m[1] === '0' || m[1] === '1') ? 100 : ((m[1] === '2' || m[1] === '3') ? 0 : null);
            return null;
          })(),
          mod_punkte: Number.isFinite(Number(ref.mod_punkte)) && ref.mod_punkte !== null && ref.mod_punkte !== '' ? Number(ref.mod_punkte) : null,
          garagen_anzahl: Number.isFinite(Number(ref.garages)) && ref.garages !== null && ref.garages !== '' ? Number(ref.garages) : null,
          /* v2999 · modifiziertes Baujahr (Niedersachsen): Wertermittlungsjahr - (GND 80 - RND nach Anlage 2),
             dieselbe RND wie in allen Verfahren; Alter (Hamburg) = Wertermittlungsjahr - Baujahr */
          baujahr_modifiziert: _rndVorab.rnd != null ? Math.round(stichtagJahr(ref) - (80 - Number(_rndVorab.rnd))) : null,   /* v3010 · Wertermittlungsjahr */
          alter_jahre: Number(ref.build_year) > 0 ? stichtagJahr(ref) - Number(ref.build_year) : null,   /* v3010 */
          /* v3008 · Merkmale des Ausschusses (Merkmalsmatrix, Konstanz): Zimmerzahl, eigene Angaben
             zu Wohnlage und Ausstattungsklasse, dazu die Lageklasse der Bodenrichtwertzone, wie
             BORIS-BW sie im Feld BEM fuehrt („Lageklasse 2,8") - der Satz entscheidet, ob er sie liest. */
          zimmer: Number(ref.rooms) > 0 ? Number(ref.rooms) : null,
          vgf_wohnlage: ref.vgf_wohnlage || null,
          vgf_ausstattung: ref.vgf_ausstattung || null,
          lageklasse_brw: (function () {
            const _bp = (landValue && landValue.properties_raw) || {};
            const m = /Lageklasse\s*(\d+(?:[.,]\d+)?)/i.exec(String(_bp.BEM || _bp.bem || ''));
            return m ? Number(m[1].replace(',', '.')) : null;
          })(),
          ortsteil_brw: (function () {
            const _bp = (landValue && landValue.properties_raw) || {};
            return String(_bp.ORTST || _bp.ortst || '').trim() || null;
          })(),
          /* v3008 · W1 · Merkmale, die DealPilot fuehrt und die Korrekturen der Ausschuesse lesen.
             Nur wo die Zuordnung eindeutig ist: Stellplaetze = Garagen + Stellplaetze aussen
             (OGA BB: „Garagen, Carports und Stellplaetze"), Keller aus der NHK-Angabe (kg_ = mit,
             ohne_kg = ohne, sonst keine Zuordnung), Erbbaurecht aus dem Haekchen,
             Miteigentumsanteil in Zehntausendsteln, Verhaeltnis BGF/Wohnflaeche aus beiden Flaechen. */
          stellplaetze: (ref.garages == null && ref.outdoor_parking == null) ? null
            : (Number(ref.garages) || 0) + (Number(ref.outdoor_parking) || 0),
          keller: (function () {
            const k = String(ref.keller_dg || '');
            if (/^kg_/.test(k)) return 'mit';
            if (/^ohne_kg/.test(k)) return 'ohne';
            return null;
          })(),
          /* Erbbaurecht NUR, wenn das Haekchen gesetzt ist - ein leeres Haekchen reist nicht mit
             (dealpilot-mb.js) und ist damit keine Aussage "kein Erbbaurecht". Dann bleibt es offen. */
          erbbaurecht: ref.leasehold ? 'ja' : null,
          /* Wohnungen im Gebaeude: Feld "Wohneinheiten im Gebaeude" (einheiten). Bei der ETW ist es
             ausgeblendet (objektart-felder.js) - dort kein Wert, das Merkmal bleibt offen. */
          wohnungen_im_gebaeude: (/etw|wohnung/i.test(String(ref.property_type || '')) || !(Number(ref.units) > 0)) ? null : Number(ref.units),
          /* Vermietung aus dem Vermietungsstand: Vollvermietet = ja, Leer = nein; Teilweise leer ist keine
             der beiden Klassen der Ausschuesse - offen. */
          vermietet: /^vollvermietet$/i.test(String(ref.vermietungsstand || '').trim()) ? 'ja'
            : (/^leer$/i.test(String(ref.vermietungsstand || '').trim()) ? 'nein' : null),
          miteigentumsanteil_zehntausendstel: Number(ref.mea_pct) > 0 && Number(ref.mea_pct) <= 100 ? Math.round(Number(ref.mea_pct) * 100) : null,
          bgf_wfl_verhaeltnis: (_bgfVf && Number(ref.living_area) > 0) ? Math.round(_bgfVf / Number(ref.living_area) * 100) / 100 : null,
          normbrw20: ref._normbrw20 != null ? ref._normbrw20 : null,
          normbrw18: ref._normbrw18 != null ? ref._normbrw18 : null,
  };
  /* v3200 · Merkmale, die Ausschuesse je Wohnung abfragen (Hamburg IMB S. 170 f.): Stadtteil aus der
     Verortung, Aufzug nur wenn ausdruecklich ja (ein fehlendes Haekchen ist keine Aussage "kein Aufzug"). */
  if (_ein.stadtteil == null && (ref.stadtteil || ref.ortsteil)) _ein.stadtteil = ref.stadtteil || ref.ortsteil;
  if (_ein.aufzug == null && ref.elevator === true) _ein.aufzug = 'ja';
  /* extra: Merkmale DER WOHNUNG (Aufteilerwert) - Geschosslage, Einbaukueche, vermietet; nur gesetzte */
  if (extra && typeof extra === 'object') Object.keys(extra).forEach((k) => { if (extra[k] != null) _ein[k] = extra[k]; });
  return _ein;
}

/* Wertet die Antwort des Registers aus: verfügbar mit Objektwert, zurückgehalten (nur steuerlich),
   Fläche fehlt, oder Sperre mit Weg zum Ausschuss. step() schreibt ins Protokoll des Aufrufers. */
export function regVfErgebnis(_r, { ref, bgf, hhNorm, step }) {
  const _bgfVf = bgf, _hhNorm = hhNorm;
  if (typeof step !== 'function') step = () => {};
  let _regVf = null;
  try {
        if (_r && _r.verfuegbar && _r.wert != null) {
          if (String(_r.verwendung || '') === 'intern') {
            _regVf = { verfuegbar: false, grund: 'nur_steuerliche_bewertung',
              hinweis: 'Für dieses Gebiet führt der Gutachterausschuss amtliche '
                + 'Vergleichsfaktoren, aber ausdrücklich nur für die steuerliche '
                + 'Bedarfsbewertung und die Kaufpreisaufteilung. Sie ersetzen nach '
                + 'eigener Angabe des Ausschusses keine Ermittlung des Verkehrswertes '
                + 'nach § 194 BauGB und tragen deshalb hier kein Verfahren.',
              ausschuss: _r.ausschuss || null, quelle_url: _r.quelle_url || null };
            step('vergleichsfaktor-register: zurueckgehalten (nur steuerliche Bewertung)');
          } else {
            /* ══ v1977a · DIE BEZUGSGROESSE IST NICHT IMMER DIE WOHNFLAECHE

               Hier stand `* Number(ref.living_area)`. Barnim rechnet in
               Euro je Quadratmeter WOHNFLAECHE, Berlin in Euro je
               Quadratmeter BRUTTO-GRUNDFLAECHE. Mit der Wohnflaeche
               multipliziert waere der Berliner Wert um den Faktor
               Wfl/BGF daneben — bei einem Haus rund 25 Prozent, und
               nichts haette widersprochen.

               Die Leseroutine gibt `bezugsgroesse` zurueck; sie
               entscheidet. Fehlt sie oder ist die passende Flaeche
               nicht erfasst, gibt es KEINEN Objektwert — kein
               Rateversuch mit der anderen Flaeche. */
            const _bez = String(_r.bezugsgroesse || _r.einheit_bez || '');
            const _istBgf = /bgf|brutto/i.test(_bez);
            const _flaecheFuerWert = _istBgf ? _bgfVf : (Number(ref.living_area) || null);
            if (_flaecheFuerWert == null) {
              _regVf = { verfuegbar: false, grund: _istBgf ? 'bgf_fehlt' : 'wohnflaeche_fehlt',
                faktor_qm: Number(_r.wert), bezugsgroesse: _bez || null,
                hinweis: 'Für dieses Gebiet liegt ein amtlicher Vergleichsfaktor von '
                  + _r.wert + ' €/m² vor, bezogen auf die '
                  + (_istBgf ? 'Brutto-Grundfläche' : 'Wohnfläche')
                  + '. Diese Fläche ist am Objekt nicht erfasst, deshalb wird kein '
                  + 'Objektwert daraus gebildet.',
                ausschuss: _r.ausschuss || null, quelle_url: _r.quelle_url || null };
              step('vergleichsfaktor-register: Faktor da, aber Bezugsflaeche fehlt ('
                + (_istBgf ? 'BGF' : 'Wohnflaeche') + ')');
              throw { _abbruch: true };
            }
            const _wert = Number(_r.wert) * _flaecheFuerWert;
            _regVf = { verfuegbar: true, faktor_qm: Number(_r.wert),
              wert_eur: Math.round(_wert), einheit: _r.einheit || null,
              rechenweg: _r.rechenweg || null, ausschuss: _r.ausschuss || null,
              quelle_url: _r.quelle_url || null, stufe: _r.stufe || null,
              quellenvermerk: _r.quellenvermerk || null,
              /* v3008 · Herkunft der Merkmale (Wohnlage, Ausstattung) und gepruefte Korrekturen */
              merkmale: _r.merkmale || [], korrekturen_geprueft: _r.korrekturen_geprueft || [],
              quellen_zusatz: (_hhNorm && /normbrw/.test(JSON.stringify(_r.korrekturen || []))) ? [_hhNorm.quelle] : [],
              lizenz: _r.lizenz || null,
              stichtag: _r.stichtag || null, bezugsgroesse: _r.bezugsgroesse || null,
              hinweis: ((_r.hinweise && _r.hinweise.length) ? _r.hinweise.join(' ') + ' ' : '')
                + 'Amtlicher Vergleichsfaktor nach § 20 ImmoWertV, abgeleitet aus '
                + 'der Kaufpreissammlung des Gutachterausschusses. Anders als '
                + 'Angebotspreise beruht er auf beurkundeten Kaufpreisen (§ 25 Abs. 1 '
                + 'ImmoWertV).' };
            step('vergleichsfaktor-register: ' + _r.wert + ' EUR/m2 -> '
              + Math.round(_wert) + ' EUR');
          }
        } else if (_r && _r.grund) {
          step('vergleichsfaktor-register: keiner (' + _r.grund + ')');
          /* v2999 · der Grund und der Weg zum Ausschuss reisen mit (Sperre, fehlende Angabe) */
          if (_r.grund !== 'kein_satz' && _r.hinweis) _regVf = { verfuegbar: false, grund: _r.grund, hinweis: _r.hinweis,
            zugang: _r.zugang || null, quelle_url: _r.quelle_url || _r.bestell_url || null, ausschuss: _r.ausschuss || null,
            /* v3008 · W1/Konstanz: was fehlt und wo man es eintraegt, mit Rechenweg-Zeile bis in den Bericht */
            fehlende_merkmale: _r.fehlende_merkmale || null, korrekturen_offen: (_r.korrekturen_offen && _r.korrekturen_offen.length) ? _r.korrekturen_offen : null,
            rechenweg: _r.rechenweg || null, faktor_tabelle: _r.faktor_tabelle ?? null, stichtag: _r.stichtag || null };
        }
  } catch (e) { if (!(e && e._abbruch)) throw e; }
  return _regVf;
}
