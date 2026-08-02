#!/usr/bin/env node
/* harvest.js — Kommandozeile fuer die Ernte.
 *
 *   node src/lib/harvest.js --status
 *   node src/lib/harvest.js --discover [--land NW] [--limit 5] [--archiv]
 *   node src/lib/harvest.js --wert --ags 14627 --art etw --lzs 2.5 \
 *        --stichtag 2024-01-01 --quelle "GAA Landkreis Meissen, Bericht 2024"
 *
 * Kostenpflichtige Quellen werden NIE abgerufen — dafuer ist --wert da.
 */
import { HarvestService } from '../services/HarvestService.js';

const arg = (n, d = null) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d;
};

const zeile = (o) => Object.entries(o).map(([k, v]) => k + '=' + v).join('  ');

async function main() {
  if (arg('status')) {
    const s = await HarvestService.status();
    console.log('\nQUELLEN');
    s.quellen.forEach((r) => console.log('  ' + String(r.zugang).padEnd(18) + r.n));
    console.log('\nDOKUMENTE');
    if (!s.dokumente.length) console.log('  noch keine');
    s.dokumente.forEach((r) => console.log('  ' + String(r.status).padEnd(18) + r.n));
    console.log('\nPARAMETER nach Stufe');
    s.parameter.forEach((r) => console.log('  ' + r.qualitaet + ': ' + r.n));
    if (s.stumme_quellen.length) {
      console.log('\nSTUMM seit >18 Monaten (Portal pruefen)');
      s.stumme_quellen.forEach((r) => console.log('  ' + r.bundesland + '  ' + r.name));
    }
    console.log('');
    return;
  }

  if (arg('discover')) {
    const o = { limit: parseInt(arg('limit', '20'), 10), land: arg('land', null), archiv: !!arg('archiv') };
    console.log('Discovery laeuft (ein Abruf je Sekunde) ...');
    const b = await HarvestService.discover(o);
    console.log('\n' + zeile({ geprueft: b.geprueft, neu: b.neu, gesperrt_uebersprungen: b.uebersprungen }));
    b.quellen.forEach((r) => console.log('  ' + r.land.padEnd(3) + String(r.name).slice(0, 44).padEnd(46)
      + 'gefunden=' + String(r.gefunden).padStart(3) + '  neu=' + r.neu));
    if (b.fehler.length) { console.log('\nFEHLER'); b.fehler.forEach((f) => console.log('  ' + f)); }
    console.log('');
    return;
  }

  if (arg('opendata')) {
    const { OpenDataConnector } = await import('../connectors/OpenDataConnector.js');
    const land = arg('land', 'NW');
    const trocken = !!arg('trocken');
    console.log('Lade Grundstuecksmarktdaten ' + land + (trocken ? ' (Trockenlauf)' : '') + ' ...');
    const b = await OpenDataConnector.importiere({ land, trockenlauf: trocken });
    if (!b.ok) { console.log('FEHLER: ' + b.grund); return; }
    console.log('');
    console.log('  Quelle    ' + b.quelle + '  (' + b.lizenz + ')');
    console.log('  Stand     ' + (b.stand || 'unbekannt'));
    console.log('  Gemeinden ' + b.gemeinden);
    console.log('  angelegt  ' + b.angelegt + '   uebersprungen ' + b.uebersprungen
      + '   unplausibel ' + b.unplausibel + '   unsicher ' + b.unsicher);
    console.log('');
    Object.entries(b.arten).sort((a, c) => c[1] - a[1])
      .forEach(([k, v]) => console.log('    ' + k.padEnd(20) + v));
    console.log('');
    return;
  }

  if (arg('portal')) {
    const r = await HarvestService.pruefePortal(arg('portal'));
    if (r.fehler) { console.log('FEHLER: ' + r.fehler); return; }
    console.log('\n' + r.quelle);
    console.log('  ' + r.portal + '   (' + (r.bytes || 0) + ' Bytes)');
    console.log('  Treffer nach Regel: ' + r.treffer_regel);
    console.log('\n  Unterseiten, die verfolgt wuerden:');
    (r.seiten || []).forEach((u) => console.log('    ' + u));
    if (!r.seiten.length) console.log('    keine');
    (r.seiten2 || []).forEach(function (x) {
      console.log('\n  ' + x.seite);
      if (x.fehler) { console.log('    FEHLER: ' + x.fehler); return; }
      (x.unter || []).forEach(function (u) { console.log('    \u2192 ' + u); });
      (x.pdfs || []).forEach(function (u) { console.log('    PDF ' + u.slice(0, 105)); });
      if (!x.unter.length && !x.pdfs.length) console.log('    nichts');
    });
    console.log('\n  PDF-Links auf der Startseite:');
    (r.pdfs || []).forEach((p) => console.log('    ' + (p.passt ? '\u2713' : '\u00b7') + ' ' + p.url.slice(0, 110)));
    if (!r.pdfs.length) console.log('    keine');
    console.log('');
    return;
  }

  if (arg('ki')) {
    const r = await HarvestService.kiRecherche({
      ags: arg('ags'), objektart: arg('art'), typ: arg('typ', 'lzs'),
      kreisname: arg('kreis', null),
    });
    if (!r.uebernommen) {
      console.log('NICHT uebernommen: ' + r.grund);
      if (r.vorschlag) console.log('  Vorschlag war: ' + JSON.stringify(r.vorschlag).slice(0, 300));
      return;
    }
    console.log('Uebernommen als Stufe C (unbestaetigt), id=' + r.id);
    console.log('  Wert     ' + r.wert + (arg('typ', 'lzs') === 'lzs' ? ' %' : ''));
    console.log('  Stichtag ' + (r.stichtag || '-'));
    console.log('  Quelle   ' + r.quelle_url);
    if (r.zitat) console.log('  Zitat    ' + r.zitat);
    console.log('\n  ' + r.hinweis);
    return;
  }

  if (arg('wert')) {
    const r = await HarvestService.wertEintragen({
      ags: arg('ags'), objektart: arg('art'), typ: arg('typ', 'lzs'),
      wert: parseFloat(arg('lzs') || arg('faktor')),
      stichtag: arg('stichtag', null), quelle: arg('quelle', null),
    });
    console.log(r.angelegt ? 'angelegt, id=' + r.id : 'nicht angelegt: ' + r.grund);
    return;
  }

  console.log('Nutzung:');
  console.log('  --status');
  console.log('  --portal <id>   zeigt, was auf einem Portal wirklich liegt');
  console.log('  --opendata [--land NW] [--trocken]   amtliche Werte aus dem Open-Data-Portal');
  console.log('  --discover [--land XX] [--limit N] [--archiv]');
  console.log('  --ki   --ags 14627 --art etw [--kreis "Landkreis Meissen"]   (Stufe C, unbestaetigt)');
  console.log('  --wert --ags 14627 --art etw --lzs 2.5 --stichtag 2024-01-01 --quelle "..."   (Stufe A)');
}

main().then(() => process.exit(0)).catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
