'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   jacobyService.js — v1832
   DIE UMGEKEHRTE ERTRAGSWERTMETHODE („Kaufpreisaufteilung nach Jacoby®")
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 04.10.2026: „die kaufpreisaufteilung … die machen wir ja
   anders als das gutachten nach jacoby. wir haben ja alle
   liegenschaftszinsen, dann könnte man das ja auch anbieten oder? ich
   würde gerne mal einen test sehen wie sich das verhält und wieviel
   unterschied wir haben."

   Zugelassen durch BFH-Urteil vom 20.09.2022, IX R 12/21. Sie steht dem
   Steuerpflichtigen seit dem Urteil offen und führt bei Ertragsobjekten
   regelmäßig zu einem HÖHEREN Gebäudeanteil als die BMF-Arbeitshilfe.
   Genau dort entscheidet sich für den Kunden Geld.

   ── WAS DIESES MODUL NICHT TUT ──────────────────────────────────────────

   Es ersetzt die BMF-Arbeitshilfe nicht und bewertet sie nicht. Es rechnet
   einen ZWEITEN Weg, damit die Entscheidung auf Zahlen fällt.

     > Zwei Zahlen zu vergleichen, die aus verschiedenen Verfahren stammen,
     > ergibt keine Abweichung, sondern einen Kategorienfehler.

   ── DER PRÜFMASSSTAB ────────────────────────────────────────────────────

   Nicht eine selbst ausgerechnete Zahl, sondern das Gutachten Az.
   25DG02659/HH (Grünwald, 03.07.2025) zum Objekt Am Markt 18, Kabelsketal
   — Zeile für Zeile, wie es in BACKLOG.md steht. `selbsttest()` fährt
   genau diesen Fall.

   ── DIE STAFFEL ─────────────────────────────────────────────────────────

     Kaufpreis (ohne Nebenkosten)
     + Reparatur-/Investitionsbedarf
     − Bodenwert (anteilig nach MEA)
     = vorläufiger Ertragswert der baulichen Anlagen
     ÷ Kapitalisierungsfaktor  V = (1 − (1+p)^−n) / p     § 34 Abs. 2
     = Reinertragsanteil der baulichen Anlagen
     + Bodenwertverzinsungsbetrag
         Diskontierungsfaktor  d = (1+p)^−n               § 34 Abs. 3
         Bodenrestwert nach RND   = Bodenwert × d
         Bodenwert während der RND = Bodenwert − Bodenrestwert
         davon p %
     = jährlicher Reinertrag

     vorläufiger Gebäudeanteil = Reinertragsanteil / Reinertrag
     bereinigter Kaufpreis     = Kaufpreis − Bodenrestwert
     Gebäudewert               = bereinigter Kaufpreis × vorl. Gebäudeanteil
     ERGEBNIS                  = Gebäudewert / Kaufpreis

   Der doppelte Durchgang über den Bodenrestwert ist kein Fehler, sondern
   der Kern der Methode: der Boden ist nach Ablauf der Restnutzungsdauer
   noch da, das Gebäude nicht. Dieser Rest gehört vor der Aufteilung
   herausgenommen und danach dem Boden zugeschlagen.
   ═══════════════════════════════════════════════════════════════════════ */

/* § 34 Abs. 2 ImmoWertV — Barwertfaktor (Kapitalisierungsfaktor).
   Bei p = 0 wäre die Formel undefiniert; dann ist der Barwert schlicht n. */
function kapitalisierungsfaktor(zinsPct, rndJahre) {
  const p = Number(zinsPct) / 100;
  const n = Number(rndJahre);
  if (!isFinite(p) || !isFinite(n) || n <= 0) return null;
  if (p === 0) return n;
  return (1 - Math.pow(1 + p, -n)) / p;
}

/* § 34 Abs. 3 ImmoWertV — Abzinsungsfaktor. */
function diskontierungsfaktor(zinsPct, rndJahre) {
  const p = Number(zinsPct) / 100;
  const n = Number(rndJahre);
  if (!isFinite(p) || !isFinite(n) || n <= 0) return null;
  return Math.pow(1 + p, -n);
}

function _zahl(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ═══ DIE RECHNUNG ══════════════════════════════════════════════════════
 *
 * Eingaben (alle in Euro bzw. Prozent bzw. Jahren):
 *   kaufpreis            Kaufpreis OHNE Erwerbsnebenkosten
 *   bodenwert            Bodenwert, bereits anteilig nach MEA
 *   lzs_pct              Liegenschaftszinssatz in %
 *   rnd_jahre            Restnutzungsdauer in Jahren
 *   reparaturbedarf      optional, Reparatur-/Investitionsstau
 *   nebenkosten          optional, zur Aufteilung der Erwerbsnebenkosten
 *
 * KEIN VERFAHREN RECHNET HALB. Fehlt eine Pflichtangabe, kommt kein Wert
 * zurück, sondern was fehlt — dieselbe Regel wie im Marktbericht.
 */
function berechne(ein = {}) {
  /* ── v1832 · DIE RUNDUNGSREGEL DER QUELLE ───────────────────────────────
   *
   * GEMESSEN beim Selbsttest: fünf Größen wichen um 0,12 bis 0,31 EUR vom
   * Gutachten ab. Die Ursache ist keine Formel, sondern eine Konvention —
   * das Gutachten RUNDET den Diskontierungsfaktor auf vier Nachkommastellen
   * (0,2448) und rechnet damit weiter. Exakt sind es 0,244764…
   *
   *   > Ein Soll-Wert ohne die Rundungsregel der Quelle macht einen
   *   > richtigen Rechenweg zum Fehlschlag.
   *
   * Gerechnet wird deshalb standardmäßig EXAKT — das ist genauer, und der
   * Unterschied im Endergebnis liegt bei 0,0002 Prozentpunkten. Mit
   * `faktor_stellen: 4` lässt sich die Konvention des Gutachtens
   * nachstellen, und genau damit trifft der Selbsttest es auf den Cent.
   * Das ist der Nachweis, dass der Rechenweg stimmt und nur die Rundung
   * abweicht. */
  const stellen = _zahl(ein.faktor_stellen);
  const _r = (x) => (stellen != null && stellen >= 0 && x != null)
    ? Number(x.toFixed(stellen)) : x;

  const kaufpreis = _zahl(ein.kaufpreis);
  const bodenwert = _zahl(ein.bodenwert);
  const lzs = _zahl(ein.lzs_pct);
  const rnd = _zahl(ein.rnd_jahre);
  const reparatur = _zahl(ein.reparaturbedarf) || 0;
  const nebenkosten = _zahl(ein.nebenkosten);

  const fehlt = [];
  if (kaufpreis == null || kaufpreis <= 0) fehlt.push('kaufpreis');
  if (bodenwert == null || bodenwert < 0) fehlt.push('bodenwert');
  if (lzs == null || lzs <= 0) fehlt.push('lzs_pct');
  if (rnd == null || rnd <= 0) fehlt.push('rnd_jahre');
  if (fehlt.length) {
    return {
      verfuegbar: false, fehlt: fehlt,
      hinweis: 'Ohne ' + fehlt.join(', ') + ' rechnet das Verfahren nicht.'
    };
  }

  const schritte = [];
  const V = _r(kapitalisierungsfaktor(lzs, rnd));
  const d = _r(diskontierungsfaktor(lzs, rnd));

  /* 1 · vorläufiger Ertragswert der baulichen Anlagen */
  const ewba = kaufpreis + reparatur - bodenwert;
  schritte.push({ nr: 1, text: 'Kaufpreis ohne Nebenkosten', wert: kaufpreis });
  if (reparatur) schritte.push({ nr: 2, text: '+ Reparatur-/Investitionsbedarf', wert: reparatur });
  schritte.push({ nr: 3, text: '− Bodenwert (anteilig)', wert: -bodenwert });
  schritte.push({ nr: 4, text: '= vorläufiger Ertragswert der baulichen Anlagen', wert: ewba });

  /* Der Kaufpreis muss den Bodenwert übersteigen — sonst ist der
     Gebäudeanteil rechnerisch negativ, und das Verfahren trägt nicht. */
  if (ewba <= 0) {
    return {
      verfuegbar: false, fehlt: [],
      hinweis: 'Der Bodenwert erreicht oder übersteigt den Kaufpreis. '
             + 'Die umgekehrte Ertragswertmethode trägt hier nicht — '
             + 'das ist kein Rechenfehler, sondern ein Objekt, dessen Wert '
             + 'im Boden liegt.',
      bodenwert: bodenwert, kaufpreis: kaufpreis
    };
  }

  /* 2 · Reinertragsanteil der baulichen Anlagen */
  const reBa = ewba / V;
  schritte.push({ nr: 5, text: '÷ Kapitalisierungsfaktor (§ 34 Abs. 2)', wert: V,
    beleg: 'Liegenschaftszins ' + lzs + ' %, RND ' + rnd + ' Jahre' });
  schritte.push({ nr: 6, text: '= Reinertragsanteil der baulichen Anlagen', wert: reBa });

  /* 3 · Bodenwertverzinsungsbetrag */
  const bodenrestwert = bodenwert * d;
  const bodenWaehrendRnd = bodenwert - bodenrestwert;
  const bodenverzinsung = bodenWaehrendRnd * (lzs / 100);
  schritte.push({ nr: 7, text: 'Diskontierungsfaktor (§ 34 Abs. 3)', wert: d });
  schritte.push({ nr: 8, text: 'Bodenrestwert nach Ablauf der RND', wert: bodenrestwert });
  schritte.push({ nr: 9, text: 'Bodenwert während der RND', wert: bodenWaehrendRnd });
  schritte.push({ nr: 10, text: '+ Bodenwertverzinsungsbetrag (' + lzs + ' %)', wert: bodenverzinsung });

  /* 4 · jährlicher Reinertrag und die vorläufigen Anteile */
  const reinertrag = reBa + bodenverzinsung;
  schritte.push({ nr: 11, text: '= jährlicher Reinertrag', wert: reinertrag });
  const anteilGebVorl = reBa / reinertrag;
  const anteilBodVorl = bodenverzinsung / reinertrag;

  /* 5 · bereinigter Kaufpreis und das Ergebnis */
  const bereinigt = kaufpreis - bodenrestwert;
  const gebaeudewert = bereinigt * anteilGebVorl;
  const bodenwertErgebnis = kaufpreis - gebaeudewert;
  const anteilGeb = gebaeudewert / kaufpreis;

  schritte.push({ nr: 12, text: 'vorläufiger Gebäudeanteil', wert: anteilGebVorl * 100, einheit: '%' });
  schritte.push({ nr: 13, text: 'bereinigter Kaufpreis (Kaufpreis − Bodenrestwert)', wert: bereinigt });
  schritte.push({ nr: 14, text: '= steuerlich absetzbarer Gebäudeanteil', wert: gebaeudewert });

  const erg = {
    verfuegbar: true,
    verfahren: 'umgekehrte Ertragswertmethode (Jacoby®, BFH IX R 12/21)',
    gebaeudeanteil_pct: anteilGeb * 100,
    bodenanteil_pct: (1 - anteilGeb) * 100,
    gebaeudewert_eur: gebaeudewert,
    bodenwert_eur: bodenwertErgebnis,
    /* Zwischenwerte, damit der Rechenweg nachvollziehbar bleibt und ein
       Prüfer nicht auf das Endergebnis allein angewiesen ist. */
    kapitalisierungsfaktor: V,
    diskontierungsfaktor: d,
    ertragswert_bauliche_anlagen: ewba,
    reinertragsanteil_gebaeude: reBa,
    bodenrestwert: bodenrestwert,
    bodenwert_waehrend_rnd: bodenWaehrendRnd,
    bodenwertverzinsung: bodenverzinsung,
    reinertrag_jahr: reinertrag,
    gebaeudeanteil_vorlaeufig_pct: anteilGebVorl * 100,
    bodenanteil_vorlaeufig_pct: anteilBodVorl * 100,
    bereinigter_kaufpreis: bereinigt,
    eingaben: { kaufpreis, bodenwert, lzs_pct: lzs, rnd_jahre: rnd, reparaturbedarf: reparatur },
    schritte: schritte
  };

  /* Die Erwerbsnebenkosten folgen demselben Schlüssel — sie gehören
     anteilig zur Bemessungsgrundlage. */
  if (nebenkosten != null && nebenkosten > 0) {
    erg.nebenkosten_eur = nebenkosten;
    erg.nebenkosten_gebaeude_eur = nebenkosten * anteilGeb;
    erg.afa_bemessungsgrundlage_eur = gebaeudewert + nebenkosten * anteilGeb;
  } else {
    erg.afa_bemessungsgrundlage_eur = gebaeudewert;
  }

  return erg;
}

/* ═══ SELBSTTEST GEGEN DAS GUTACHTEN ════════════════════════════════════
 *
 * Az. 25DG02659/HH, Grünwald 03.07.2025, Am Markt 18 Kabelsketal.
 * Der Prüfmaßstab ist das Anwendungsbeispiel des Dokuments, nie eine
 * selbst ausgerechnete Zahl.
 *
 * Die Toleranzen sind an der Rundung des Gutachtens bemessen: es rechnet
 * mit vier Nachkommastellen bei den Faktoren und zwei beim Geld. Ein
 * Soll-Wert ohne die Rundungsregel der Quelle macht einen richtigen
 * Rechenweg zum Fehlschlag.
 */
function selbsttest() {
  const soll = {
    kapitalisierungsfaktor: 30.2100,
    diskontierungsfaktor: 0.2448,
    ertragswert_bauliche_anlagen: 103293.44,
    reinertragsanteil_gebaeude: 3419.18,
    bodenrestwert: 1864.78,
    bodenwert_waehrend_rnd: 5752.78,
    bodenwertverzinsung: 143.82,
    reinertrag_jahr: 3563.00,
    gebaeudeanteil_vorlaeufig_pct: 95.96,
    bereinigter_kaufpreis: 109046.22,
    gebaeudewert_eur: 104644.60,
    gebaeudeanteil_pct: 94.35,
    bodenanteil_pct: 5.65,
    bodenwert_eur: 6266.40
  };
  /* MIT der Rundungsregel des Gutachtens: vier Nachkommastellen an den
     Faktoren. Nur so ist ein Vergleich auf den Cent ueberhaupt fair. */
  const r = berechne({
    faktor_stellen: 4,
    kaufpreis: 110911.00,
    bodenwert: 7617.56,       /* 3.878 m2 x 130 EUR = 504.140, davon 15,11/1000 */
    lzs_pct: 2.5,
    rnd_jahre: 57,
    reparaturbedarf: 0,
    nebenkosten: 11723.29
  });
  if (!r.verfuegbar) return { ok: false, grund: r.hinweis, proben: [] };

  /* Toleranz je Größe: Faktoren auf 4 Stellen, Geld auf 10 Cent,
     Prozente auf 0,02 Punkte — das ist die Rundung der Quelle. */
  const tol = {
    kapitalisierungsfaktor: 0.0005, diskontierungsfaktor: 0.00005,
    gebaeudeanteil_vorlaeufig_pct: 0.02, gebaeudeanteil_pct: 0.02,
    bodenanteil_pct: 0.02
  };
  const proben = Object.keys(soll).map((k) => {
    const ist = r[k];
    const t = tol[k] != null ? tol[k] : 0.10;
    /* SUBTRAHIEREN, nicht nebeneinander drucken. */
    const diff = ist == null ? null : (ist - soll[k]);
    return { groesse: k, soll: soll[k], ist: ist,
      differenz: diff, toleranz: t,
      ok: diff != null && Math.abs(diff) <= t };
  });
  const schlecht = proben.filter((p) => !p.ok);
  return { ok: schlecht.length === 0, proben: proben, abweichungen: schlecht,
    nebenkosten_gebaeude_eur: r.nebenkosten_gebaeude_eur };
}

module.exports = { berechne, selbsttest, kapitalisierungsfaktor, diskontierungsfaktor };
