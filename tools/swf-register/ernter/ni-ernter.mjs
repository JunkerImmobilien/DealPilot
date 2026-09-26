/* ═══════════════════════════════════════════════════════════════════════
   ni-ernter.mjs · Die 26 Kalkulatoren mit Lage-Parameter ernten

   WARUM ES DIESEN ERNTER GIBT. 26 niedersaechsische Kalkulatoren rechnen
   nur mit gesetzter Lage, und die ist ueber die URL grundsaetzlich nicht
   erreichbar: Tableau setzt sie per INDEX
   (`set-parameter-value-from-index`, `[Parameters].[Parameter 2]`).
   Ausserdem loescht JEDER URL-Parameter die Lage. Deshalb muss ein
   echter Browser den Rechner bedienen.

   WIE DER WERT HERAUSKOMMT. Nicht aus der Antwort - die traegt nur
   Bildkacheln. Nicht aus dem Kurzhinweis - der ist abgeschaltet. Nicht
   aus dem DOM - dort stehen nur Beschriftungen. Sondern aus dem
   VEKTORBILD: es traegt den Text als Text, ohne die Ligaturfalle des
   PDF ("Sachwer aktor"), und braucht rund 1,7 Sekunden je Punkt.

   WAS MITGEERNTET WIRD, UND WARUM ES WICHTIGER IST ALS DIE ZAHLEN.
   Der Knopf "Lage einblenden" zeigt eine Tabelle
   `Gemarkung | Lageklasse | Gemarkungsnr`. OHNE SIE WAEREN DIE GITTER
   UNBRAUCHBAR: wir wuessten den Faktor je Lageklasse, koennten einer
   Anschrift aber keine zuordnen - genau der Grund, aus dem Rostock und
   die Region Hannover bis heute keinen Wert bekommen (dort reicht die
   Spanne von 2,68 bis 1,77, und eine geratene Lage waere teurer als gar
   kein Wert). Die Gemarkung ist ein AMTLICHER Schluessel mit Nummer.
   Deshalb wird sie zuerst geerntet, und ein Gebiet ohne lesbaren
   Schluessel wird mit Grund uebersprungen.

   Wiederaufnehmbar: was als Datei liegt, wird nicht neu geholt.

   Aufruf:  node ni-ernter.mjs [--nur <workbook>] [--punkte 5x7]
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import * as T from './tableau.mjs';
import { faktorAus, texteMitLage, zahl, zustandAus } from './svg-lesen.mjs';

const AUS = '/arb/ernte';
const ROH = '/arb/roh';
fs.mkdirSync(AUS, { recursive: true });
fs.mkdirSync(ROH, { recursive: true });

const args = process.argv.slice(2);
const nur = (args.includes('--nur') ? args[args.indexOf('--nur') + 1] : null);
const [NB, NS] = (args.includes('--punkte')
  ? args[args.indexOf('--punkte') + 1] : '5x7').split('x').map(Number);

/* ── Stuetzstellen NUR INNERHALB der Stichprobe ────────────────────────
   "Wo die Quelle endet, endet die Rechnung." Der erste Erntelauf im
   September tastete mit einem festen Gitter ab und erfand damit drei von
   vier Zeilen. Hier werden die Grenzen aus der Stichprobenuebersicht des
   Dashboards gelesen und NIE ueberschritten. */
function stuetzstellen(lo, hi, n, rundung) {
  if (!(hi > lo)) return [];
  const aus = [];
  for (let i = 0; i < n; i++) {
    let v = lo + (hi - lo) * i / (n - 1);
    v = Math.round(v / rundung) * rundung;
    if (v < lo) v = Math.ceil(lo / rundung) * rundung;
    if (v > hi) v = Math.floor(hi / rundung) * rundung;
    if (v >= lo && v <= hi && !aus.includes(v)) aus.push(v);
  }
  return aus;
}

/** Die Stichprobenuebersicht aus dem Vektorbild: je Merkmal min|max|mittel
 *  in einer Zeile. Gelesen ueber die Hoehe, nicht ueber die Reihenfolge. */
function stichprobeAus(texte) {
  const zeilen = {};
  texte.forEach((x) => { const k = Math.round(x.y); (zeilen[k] = zeilen[k] || []).push(x); });
  const aus = {};
  for (const k of Object.keys(zeilen)) {
    const z = zeilen[k].sort((a, b) => a.x - b.x);
    if (z.length < 4) continue;
    const name = z[0].t;
    const werte = z.slice(1).map((e) => zahl(e.t) ?? Number(String(e.t).replace(/\./g, '')))
                     .filter((v) => Number.isFinite(v));
    if (werte.length >= 3) aus[name] = { min: werte[0], max: werte[1], mittel: werte[2] };
  }
  return aus;
}

/** Die Lagetabelle: Gemarkung -> Lageklasse (+ Gemarkungsnummer).
 *  Gelesen ueber die Spaltenkoepfe, nicht ueber feste Abstaende. */
function lagetabelleAus(texte) {
  const kopf = {};
  for (const n of ['Gemarkung', 'Lageklasse', 'Gemarkungsnr']) {
    const t = texte.find((x) => x.t === n);
    if (t) kopf[n] = t;
  }
  if (!kopf.Gemarkung || !kopf.Lageklasse) return null;
  const zeilen = {};
  texte.filter((x) => x.y > kopf.Gemarkung.y + 2).forEach((x) => {
    const k = Math.round(x.y); (zeilen[k] = zeilen[k] || []).push(x);
  });
  const aus = [];
  const nah = (x, spalte) => Math.abs(x.x - kopf[spalte].x) < 60;
  for (const k of Object.keys(zeilen).sort((a, b) => a - b)) {
    const z = zeilen[k];
    const g = z.find((x) => nah(x, 'Gemarkung'));
    const l = z.find((x) => nah(x, 'Lageklasse'));
    const n = kopf.Gemarkungsnr ? z.find((x) => nah(x, 'Gemarkungsnr')) : null;
    if (g && l) aus.push({ gemarkung: g.t, lageklasse: l.t, gemarkungsnr: n ? n.t : null });
  }
  return aus.length ? aus : null;
}

/** Ein Vektorbild holen.
 *
 *  ZWEI DINGE, die der erste Lauf gekostet hat:
 *
 *  1. Ein noch offenes Menue schluckt den naechsten Klick - der Knopf
 *     SCHLIESST es dann, statt es zu oeffnen, und es kommt nie ein
 *     Download. Deshalb vorher Escape. Gemessen am 26.09.2026: nach zwei
 *     sauberen Lagen brach der dritte Abruf so ab.
 *  2. Ein einzelner Fehlpunkt darf nicht das ganze Gebiet mitreissen.
 *     Nach zwei Anlaeufen gibt diese Funktion `null` zurueck; der
 *     Aufrufer traegt dann eine Luecke ein, statt eine Zahl zu erfinden
 *     oder 100 gute Punkte zu verlieren. */
async function vektorbild(seite, ziel) {
  for (let versuch = 1; versuch <= 2; versuch++) {
    try {
      /* KEIN Escape hier. Es schliesst zwar ein offenes Menue, setzt aber
         auch eine gerade eingegebene Zahl zurueck, wenn der Fokus noch im
         Feld liegt (das Dashboard sagt das selbst im Hinweistext). Genau
         daran starben verstreute Gitterpunkte. `setzeZahl` nimmt den Fokus
         jetzt selbst heraus; ein offenes Menue wird hier durch einen Klick
         auf eine neutrale Stelle geschlossen - das macht keine Eingabe
         rueckgaengig. */
      await seite.mouse.click(5, 5);
      await seite.waitForTimeout(250);
      const [dl] = await Promise.all([
        seite.waitForEvent('download', { timeout: 45000 }),
        (async () => {
          await seite.locator('[data-tb-test-id="viz-viewer-toolbar-button-download"]').click();
          await seite.waitForSelector('[data-tb-test-id="download-flyout-download-svg-MenuItem"]',
                                      { timeout: 20000 });
          await seite.locator('[data-tb-test-id="download-flyout-download-svg-MenuItem"]').click();
        })(),
      ]);
      /* `saveAs` wartet, bis der Download WIRKLICH fertig ist - und hat
         dafuer KEINE eigene Zeitgrenze. Bleibt er stecken, wartet es
         ohne Ende. Genau so blieb der Lauf am 26.09.2026 mitten in
         Goslar stehen: letztes Bild 06:51, CPU bei zwei Prozent,
         anderthalb Stunden nichts. Alle anderen Playwright-Aufrufe hier
         tragen eine Frist, dieser eine nicht.

         Deshalb ein Wettlauf gegen die Uhr. Verliert er, gilt der Abruf
         als misslungen und wird wiederholt - nicht als Wert eingetragen. */
      await Promise.race([
        dl.saveAs(ziel),
        new Promise((_, ab) => setTimeout(() => ab(new Error('saveAs haengt')), 40000)),
      ]);
      return fs.readFileSync(ziel, 'utf8');
    } catch (e) {
      if (versuch === 2) return null;
      await seite.waitForTimeout(2500);
    }
  }
  return null;
}

/** Irgendetwas mit einer Frist versehen.
 *
 *  GEMESSEN AM 26.09.2026: Goslar und Northeim blieben BEIDE nach der
 *  ersten sauberen Lage stehen - 20 Punkte, null Nachfassen, dann
 *  nichts mehr. Nicht am Download: der hat seit dem Vormittag eine
 *  Frist. Sondern am Umschalten der Lage.
 *
 *  `seite.evaluate()` hat in Playwright KEINE Vorgabefrist. Haengt die
 *  Seite, wartet es ohne Ende - und genau damit weise ich nach dem
 *  Umschalten die Lage nach. Der Nachweis, der Vertrauen schaffen
 *  sollte, war die Stelle, an der alles stehenblieb.
 *
 *  Es gibt keine Playwright-Einstellung dafuer; also ein Wettlauf. */

/** Obergrenze fuer EINE Lage, komplett. Gemessen braucht eine volle
 *  Lage mit 20 Punkten rund 60 Sekunden - vier Minuten sind das
 *  Vierfache und treffen nur echte Haenger. */
const LAGE_FRIST = 4 * 60 * 1000;

function mitFrist(versprechen, ms, was) {
  return Promise.race([
    versprechen,
    new Promise((_, ab) => setTimeout(() => ab(new Error(was + ' haengt (' + ms + ' ms)')), ms)),
  ]);
}

async function ernteGebiet(browser, wb, ags, name) {
  const zieldatei = path.join(AUS, wb + '.json');
  /* Uebersprungen wird nur, was das Siegel traegt.
     GEMESSEN: `lauf.sh` fragte nach `vollstaendig`, DIESE Stelle aber
     nur, ob die Datei da ist - und Goslar war in EINER Sekunde
     "fertig", obwohl erst eine von vier Lagen drinsteht. Zwei Waechter
     mit verschiedenen Massstaeben sind einer zu viel: der laxere
     gewinnt, und der strengere sieht dabei aus, als wirke er. */
  if (fs.existsSync(zieldatei)) {
    try {
      const alt = JSON.parse(fs.readFileSync(zieldatei, 'utf8'));
      if (alt && (alt.vollstaendig || alt.gesperrt)) { console.log(`  schon da: ${wb}`); return 'schon'; }
      console.log(`  Teilstand da: ${wb} - wird fortgesetzt`);
    } catch (e) { console.log(`  ${wb}: Datei unlesbar - fange neu an`); }
  }

  const seite = await T.seiteAuf(browser);
  const satz = { workbook: wb, ags, gebiet_name: name, geerntet_am: new Date().toISOString() };
  try {
    const V = await T.viewName(wb);
    satz.view = V;
    await T.dashboardAuf(seite, wb, V);

    const st = await T.steuerungen(seite);
    /* ── Die Steuerungen NACH IHRER BESCHRIFTUNG, nicht nach Position ──
       Am 26.09.2026 an drei Ausfaellen gemessen, und jeder hatte einen
       eigenen Grund:

       · Luechow-Dannenberg kennt gar keinen "Bodenrichtwert" - dort
         heisst dieselbe Groesse `Lagewert [EUR/m2]`.
       · Helmstedt fuehrt ZWEI Auswahlwaehler: einen Wertermittlungs-
         stichtag und die eigentliche Lage. `st.find(art === 'auswahl')`
         nahm den ersten - und das war der Stichtag. Das Gebiet fiel
         deshalb als "gesperrt" heraus, obwohl es vollstaendig ist.

       Deshalb wird die Lage ueber ihre Beschriftung gesucht und der
       Stichtag ausdruecklich ausgeschlossen. */
    const brw = T.finde(st, /Bodenrichtwert|Lagewert/i);
    const sw = T.finde(st, /Sachwert/i);
    const lage = st.find((s) => s.art === 'auswahl' && s.beschriftung
                             && /lage/i.test(s.beschriftung)
                             && !/stichtag/i.test(s.beschriftung));
    if (!brw) throw new Error('weder Bodenrichtwert- noch Lagewert-Steuerung gefunden');
    if (!sw) throw new Error('Sachwert-Steuerung fehlt');
    if (!lage) throw new Error('keine Lage-Auswahl - gehoert nicht zu diesem Ernter');
    satz.steuerungen = st.map((s) => ({ i: s.i, art: s.art, beschriftung: s.beschriftung }));
    /* Die Vorgabestellung IST das Normobjekt - sie wird festgehalten,
       damit spaeter nachvollziehbar ist, wofuer das Gitter gilt. */
    satz.normobjekt = Object.fromEntries(st.filter((s) => s.beschriftung)
      .map((s) => [s.beschriftung.replace(/\s*:\s*$/, ''), s.wert]));

    /* 1. Ein Bild in Vorgabestellung: Stichprobengrenzen und Kopfdaten. */
    const erstes = await vektorbild(seite, path.join(ROH, `${wb}-vorgabe.svg`));
    if (!erstes) throw new Error('Vorgabebild nicht abrufbar - Gebiet nicht abgetastet');
    const texte0 = texteMitLage(erstes);
    satz.kopf = texte0.slice(0, 4).map((t) => t.t);
    satz.stichprobe = stichprobeAus(texte0);
    /* Die Zeilennamen der Stichprobenuebersicht sind NICHT einheitlich -
       mal "Bodenrichtwert [EUR/m2]", mal "Lagewert [EUR/m2]", und die
       Schreibweise der Einheit wechselt. Ein exakter Schluessel liess
       Hameln-Pyrmont am 26.09.2026 durchfallen, obwohl die Zahlen dort
       stehen. Deshalb ueber ein Muster, nicht ueber den genauen Namen. */
    const ausStichprobe = (muster) => {
      const k = Object.keys(satz.stichprobe || {}).find((n) => muster.test(n));
      return k ? satz.stichprobe[k] : null;
    };
    const sBrw = ausStichprobe(/Bodenrichtwert|Lagewert/i);
    const sSw = ausStichprobe(/Sachwert/i);
    if (!sBrw || !sSw) throw new Error('Stichprobengrenzen nicht lesbar - nicht abgetastet');

    /* 2. Die Lagetabelle - OHNE SIE IST DAS GITTER UNBRAUCHBAR. */
    const knopf = seite.locator('text=Lage einblenden').first();
    if (await knopf.count()) {
      await knopf.click();
      await seite.waitForTimeout(3500);
      const bild = await vektorbild(seite, path.join(ROH, `${wb}-lagen.svg`));
      satz.lagetabelle = bild ? lagetabelleAus(texteMitLage(bild)) : null;
      const zu = seite.locator('text=Lage ausblenden').first();
      if (await zu.count()) { await zu.click(); await seite.waitForTimeout(2500); }
    }
    /* ── Nennt die Lage sich selbst? ──────────────────────────────────
       Nicht jeder Ausschuss braucht eine Gemarkungstabelle. Helmstedt
       nennt seine Lagegruppen direkt beim Namen und haengt sogar den
       Koeffizienten an: "Helmstedt, Koenigslutter [1,00]". Eine solche
       Angabe ist einer Anschrift zuzuordnen - eine Kennung wie "GS 01"
       ist es nicht.

       Die Unterscheidung wird MITGESCHRIEBEN, nicht nur getroffen: wer
       den Satz spaeter prueft, muss sehen koennen, woran die Zuordnung
       haengt. */
    const lagenVorab = await T.auswahlWerte(seite, lage.i);
    satz.lagen_sprechend = lagenVorab.every((w) =>
      /[A-Za-zÄÖÜäöüß]{4,}/.test(String(w).replace(/\[.*?\]/g, '')));
    satz.lage_schluessel = satz.lagetabelle ? 'gemarkungstabelle'
      : (satz.lagen_sprechend ? 'lagenamen_im_waehler' : null);

    if (!satz.lage_schluessel) {
      satz.gesperrt = true;
      satz.gesperrt_grund = 'Es gibt keinen Weg, einer Anschrift eine Lage zuzuordnen: '
        + 'weder eine Gemarkungstabelle ("Lage einblenden") noch sprechende '
        + 'Lagenamen im Waehler - dort stehen nur Kennungen wie "GS 01". '
        + 'nicht lesbar. Ohne sie liesse sich einer Anschrift keine Lage zuordnen, '
        + 'und eine geratene Lage ist teurer als gar kein Wert (siehe Rostock, '
        + 'Spanne 2,68 gegen 1,77). Das Gitter waere Zahlenmaterial ohne Weg zur '
        + 'Anwendung - deshalb gar nicht erst abgetastet.';
      fs.writeFileSync(zieldatei, JSON.stringify(satz, null, 1));
      console.log(`  GESPERRT ${wb} (${name}): keine Lagetabelle`);
      await seite.close();
      return 'gesperrt';
    }
    /* Der Schluessel kann AUCH aus sprechenden Lagenamen kommen - dann
       gibt es keine Gemarkungstabelle, und das ist kein Mangel. */
    console.log(satz.lagetabelle
      ? `  Lageschluessel: Gemarkungstabelle, ${satz.lagetabelle.length} Eintraege`
      : `  Lageschluessel: sprechende Lagenamen im Waehler`);

    /* 3. Die Gitter, je Lage eines. */
    const lagen = lagenVorab;
    satz.lagen = lagen;
    const achseB = stuetzstellen(sBrw.min, sBrw.max, NB, 5);
    const achseS = stuetzstellen(sSw.min, sSw.max, NS, 10000);
    satz.achse_brw = achseB;
    satz.achse_sachwert = achseS;
    console.log(`  Gitter ${achseB.length}x${achseS.length} je Lage, ${lagen.length} Lagen`);

    /* ── TEILSTAND ─────────────────────────────────────────────────────
       Goslar fuehrt 24 Lageklassen; eine davon dauert rund 900 Sekunden.
       Die Zeitgrenze des Laufs hat das Gebiet zweimal abgebrochen und
       dabei JEDE FERTIGE LAGE WEGGEWORFEN - beim zweiten Mal genau
       dieselbe noch einmal. Ein Lauf, der jedes Mal bei null anfaengt,
       kommt bei 24 Lagen nie an, egal wie oft man ihn startet.

       Deshalb: nach JEDER Lage wird geschrieben, und ein vorhandener
       Teilstand wird fortgesetzt statt ueberschrieben. `vollstaendig`
       sagt, ob alle Lagen drin sind - nur ein vollstaendiger Satz darf
       uebersprungen werden. */
    satz.gitter = {};
    let n = 0, leer = 0, verriegelt = 0;
    satz.lagen_ausgefallen = [];
    if (fs.existsSync(zieldatei)) {
      try {
        const alt = JSON.parse(fs.readFileSync(zieldatei, 'utf8'));
        if (alt && alt.gitter && Object.keys(alt.gitter).length) {
          satz.gitter = alt.gitter;
          n = alt.punkte || 0;
          leer = alt.punkte_leer || 0;
          verriegelt = alt.verriegelt || 0;
          if (Array.isArray(alt.lagen_ausgefallen)) satz.lagen_ausgefallen = alt.lagen_ausgefallen;
          console.log('  Teilstand gefunden: ' + Object.keys(alt.gitter).length
            + ' von ' + lagen.length + ' Lagen schon da');
        }
      } catch (e) { console.log('  Teilstand unlesbar - fange neu an'); }
    }
    for (let li = 0; li < lagen.length; li++) {
     if (satz.gitter[lagen[li]]) { console.log('    Lage "' + lagen[li] + '" schon geerntet'); continue; }
     /* ── JEDE LAGE FUER SICH ──────────────────────────────────────────
        Faellt eine aus, bleibt der Rest stehen. Bis hierher riss ein
        haengendes Umschalten das ganze Gebiet mit - 20 fertige Punkte
        gingen mit verloren, obwohl sie gut waren. Die ausgefallene Lage
        wird BENANNT, nicht verschwiegen: ein Gebiet mit drei von vier
        Lagen sieht sonst aus wie ein vollstaendiges. */
     try {
      /* ── EINE FRIST UM DIE GANZE LAGE ────────────────────────────────
         GEMESSEN am 26.09.2026 an Goslar: Lage 1 war nach EINER Minute
         fertig, Lage 2 stand danach zwanzig Minuten ohne Ausgabe. Die
         einzelnen Schritte tragen zwar Fristen - `setzeAuswahl` 30 s,
         `evaluate` 20 s, `vektorbild` 40 s -, aber `setzeZahl` und die
         Wartezeiten dazwischen nicht, und was ausserhalb jeder Frist
         haengt, haengt unbegrenzt.

         > EINE FRIST AUF JEDEM EINZELSCHRITT ERGIBT KEINE FRIST AUF DEM
         > GANZEN. Dazwischen bleibt immer Code ohne Deckung.

         Deshalb hier eine Obergrenze fuer den ganzen Block. Vier Minuten
         sind reichlich: eine vollstaendige Lage mit 20 Punkten braucht
         nach Messung rund 60 Sekunden.

         Zurueckgenommen wird damit meine eigene Diagnose von heute
         frueh: ich hielt Goslar fuer zu GROSS (ich hatte die 24
         Eintraege der Gemarkungstabelle fuer 24 Lagen gehalten - es
         sind VIER). Es war nie die Menge, es war ein Haenger. */
      await mitFrist((async () => {
      await mitFrist(T.setzeAuswahl(seite, lage.i, li), 30000, 'Lage umstellen');
      await seite.waitForTimeout(1600);
      /* Die Lage EINMAL je Block nachweisen, statt bei jedem Punkt.
         Der Nachweis bleibt - er wandert nur an die Stelle, an der sich
         wirklich etwas aendert. Stimmt sie hier nicht, waere das ganze
         Gitter falsch beschriftet; das muss auffallen. */
      const nachLage = await mitFrist(seite.evaluate((i) => {
        const b = document.querySelectorAll('[class*="ParameterControlBox"]')[i];
        return b ? ((b.querySelector('.tabComboBoxName') || {}).textContent || '').trim() : null;
      }, lage.i), 20000, 'Lage-Nachweis');
      if (nachLage !== lagen[li]) {
        throw new Error(`Lage liess sich nicht auf "${lagen[li]}" stellen `
          + `(Waehler zeigt "${nachLage}") - Gebiet nicht abgetastet`);
      }
      const tafel = {};
      for (const b of achseB) {
        await T.setzeZahl(seite, brw.i, b);
        await seite.waitForTimeout(500);
        tafel[b] = [];
        for (const s of achseS) {
          await T.setzeZahl(seite, sw.i, s);
          await seite.waitForTimeout(650);
          /* ── VERRIEGELUNG: zeigt das Bild WIRKLICH diesen Punkt? ──
             Nicht auf die Uhr warten, sondern nachsehen. Das Bild traegt
             die gesetzten Werte mit; stimmen sie nicht, war es der
             vorige Zustand und der Punkt wird wiederholt. */
          let r = { faktor: null, streuung: null };
          for (let versuch = 1; versuch <= 6; versuch++) {
            const bild = await vektorbild(seite, path.join(ROH, `${wb}-t.svg`));
            if (!bild) { await seite.waitForTimeout(1500); continue; }
            const z = zustandAus(bild);
            /* NUR die beiden Zahlen vergleichen, die sich je Punkt
               aendern. Die Lage wird einmal je Block gesetzt und kann
               sich dazwischen nicht bewegen - sie mitzupruefen hat bei
               Helmstedt jeden Punkt sechsmal wiederholen lassen, weil
               der Waehler dort "Helmstedt, Koenigslutter [1,00]" zeigt
               und das Bild die Klammer anders setzt. 20 Sekunden je
               Punkt statt 3, und kein einziger Fehler dahinter. */
            if (z.brw === b && z.sachwert === s) {
              r = faktorAus(bild); break;
            }
            verriegelt++;
            /* Ansteigend warten: der Kalkulator braucht nach einem
               Lagewechsel spuerbar laenger als nach einer Zahl. */
            await seite.waitForTimeout(700 + versuch * 600);
          }
          /* Kein passendes Bild = LUECKE, keine Zahl. Lieber ein Loch im
             Gitter, das man sieht, als ein Wert, der keiner ist. */
          tafel[b].push(r.faktor);
          if (r.faktor == null) leer++;
          if (satz.streuung == null && r.streuung != null) satz.streuung = r.streuung;
          n++;
        }
      }
      satz.gitter[lagen[li]] = tafel;
      })(), LAGE_FRIST, `Lage "${lagen[li]}" insgesamt`);
      /* Sofort sichern. Eine fertige Lage muss eine Zeitgrenze
         ueberleben - sonst erntet der naechste Lauf dasselbe noch
         einmal und scheitert an genau derselben Stelle. */
      satz.punkte = n; satz.punkte_leer = leer; satz.verriegelt = verriegelt;
      satz.vollstaendig = Object.keys(satz.gitter).length >= lagen.length;
      fs.writeFileSync(zieldatei, JSON.stringify(satz, null, 1));
      console.log(`    Lage "${lagen[li]}" fertig (${n} Punkte, ${leer} leer, ${verriegelt}x nachgefasst) - gesichert`);
     } catch (eL) {
      satz.lagen_ausgefallen.push({ lage: lagen[li], grund: String(eL && eL.message || eL) });
      console.log(`    Lage "${lagen[li]}" AUSGEFALLEN: ${eL && eL.message}`);
     }
    }
    if (!Object.keys(satz.gitter).length) {
      throw new Error('keine einzige Lage abgetastet - Gebiet unbrauchbar');
    }
    satz.punkte = n;
    satz.punkte_leer = leer;
    /* Wie oft das Bild den vorigen Zustand zeigte - eine Null hier
       waere verdaechtig, nicht beruhigend. */
    satz.verriegelt = verriegelt;
    /* Das Siegel. Nur wer es traegt, wird beim naechsten Lauf
       uebersprungen - alles andere ist ein Teilstand und wird
       fortgesetzt. */
    satz.vollstaendig = Object.keys(satz.gitter).length >= lagen.length;
    fs.writeFileSync(zieldatei, JSON.stringify(satz, null, 1));
    console.log(`  + ${wb} (${name}): ${n} Punkte, ${leer} ohne Wert, `
      + `${Object.keys(satz.gitter).length}/${lagen.length} Lagen`
      + (satz.lagen_ausgefallen.length ? ` (AUSGEFALLEN: ${satz.lagen_ausgefallen.map((x) => x.lage).join(', ')})` : ''));
    await seite.close();
    return 'neu';
  } catch (e) {
    satz.fehler = String(e && e.message || e);
    /* Die Spur mitschreiben: "Cannot read properties of undefined" ohne
       Zeilennummer sagt nichts. */
    satz.spur = String(e && e.stack || '').split(/\r?\n/).slice(0, 4).join(' | ');
    fs.writeFileSync(path.join(AUS, wb + '.FEHLER.json'), JSON.stringify(satz, null, 1));
    console.log(`  FEHLER ${wb} (${name}): ${satz.fehler}`);
    if (satz.spur) console.log(`     ${satz.spur}`);
    try { await seite.close(); } catch {}
    return 'fehler';
  }
}

/* ── Los ──────────────────────────────────────────────────────────────── */
const liste = JSON.parse(fs.readFileSync('/arb/gebiete.json', 'utf8'))
  .filter((g) => !nur || g.workbook === nur);
console.log(`Zu ernten: ${liste.length} Gebiete, Gitter ${NB}x${NS} je Lage\n`);

const browser = await T.browserAuf();
const zaehler = { neu: 0, schon: 0, gesperrt: 0, fehler: 0 };
for (const g of liste) {
  console.log(`── ${g.workbook}  ${g.ags}  ${g.name}`);
  zaehler[await ernteGebiet(browser, g.workbook, g.ags, g.name)]++;
}
await browser.close();
console.log('\nFertig:', JSON.stringify(zaehler));
