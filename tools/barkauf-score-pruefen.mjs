#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * barkauf-score-pruefen.mjs — v2141
 *
 * EIN BARKAUF HAT KEINEN LTV UND KEINEN DSCR
 *
 * Marcel am 12.10.2026, nach vorgelegten Zahlen: weglassen und
 * umgewichten. Und: "das mit dem score muss aber auch beim quickcheck
 * passen und auch beim investor deal score. also in der gesamten app."
 *
 * ── DER BEFUND, der dahinter steckt ─────────────────────────────────
 *
 * `_scoreLtv(0)` und `_scoreRisiko(0)` gaben je 50 - der Rueckfall fuer
 * "keine Angabe". Bei einem Barkauf ist das keine fehlende Angabe,
 * sondern eine Aussage. Gemessen an fuenf Barkauf-Objekten mit gleichem
 * Kaufpreis und nur verschiedener Miete standen 60 % des Scores fest,
 * bevor das Objekt angesehen wurde (Cashflow immer 100, LTV und DSCR je
 * 50). Eine Wohnung mit 0,90 % Nettorendite hiess "SOLIDE".
 *
 * ── WAS DIESER PRUEFER SICHERT ──────────────────────────────────────
 *
 * 1. Beim Barkauf entfallen LTV und DSCR (score null, weight 0) - und
 *    bleiben als Eintrag mit GRUND in der Liste, damit keine Kachel
 *    verschwindet.
 * 2. Ein FINANZIERTES Objekt aendert sich nicht. Das ist die Probe, die
 *    zaehlt: eine Umgewichtung, die alte Scores verschiebt, waere ein
 *    stiller Umbau jedes gespeicherten Urteils.
 * 3. Ohne den Parameter bleibt alles wie vor v2141 - jeder der sieben
 *    Aufrufer bleibt heil, auch die, die ihn nie mitgeben.
 * 4. Die Rangfolge der Feldnamen (darlehen > d_total > d1+d2) greift in
 *    allen sechs Lagen. Sie ist noetig, weil mehrere Aufrufer
 *    `State.kpis` direkt durchgeben, und dort heisst die Summe beider
 *    Darlehen `d_total` - nicht `darlehen`. Wer nur den einen Namen
 *    liest, greift bei genau diesen Aufrufern ins Leere, und zwar
 *    lautlos: `undefined` sieht aus wie "nichts gesagt".
 *
 * Gerufen wird der ECHTE, gespiegelte Kern ueber
 * `backend/src/services/rechenkerne.js` - also genau der, den das
 * Backend und der Telegram-Bot benutzen, nicht eine Nachbildung.
 *
 * NACH JEDER AENDERUNG AM SCORE LAUFEN LASSEN, zusammen mit
 * `tools/score-ketten-pruefen.mjs` (115 Punkte) und, wenn ein Kern
 * angefasst wurde, `node tools/rechenkerne-spiegeln.mjs`.
 *
 * ⚠ Dieser Kopf war beim ersten Schreiben beschaedigt: ich hatte ihn
 * per `node -e` aus bash gesetzt, und bash hat die Backtick-Stellen als
 * Kommandos AUSGEFUEHRT - vier Textluecken, der Lauf blieb gruen. Fuer
 * Text mit Backticks das Edit-Werkzeug nehmen und danach nachlesen.
 * ══════════════════════════════════════════════════════════════════════ */
import { createRequire } from 'node:module';
const require_ = createRequire('file:///E:/DealPilot/repo/backend/src/x.js');
const rk = require_('./services/rechenkerne.js');
const kp=180000,knk=18900,gi=kp+knk,bwkNul=2400;
let rot=0;
const melde=(ok,txt)=>{if(!ok)rot++;console.log('  '+(ok?'ok  ':'ROT ')+txt)};

console.log('=== 1 · Die drei Lagen ===');
function lauf(ueber){
  const K=rk.kpis({kp,nk:knk,san:0,moebl:0,nkm:940,ze:0,uf:0,bwk_ul:0,bwk_nul:bwkNul,
    d1:ueber.d1,d1z:4,d1t:2,ek:ueber.ek,afa:0,grenz:0,svw:0});
  const e={kp,cf_m:K.cf_m,nmy:K.nmy,ltv:K.ltv,dscr:K.dscr,wp_kpi:kp*0.05,mstg:1.5};
  if('darlehen' in ueber) e.darlehen=ueber.darlehen;
  const S=rk.score(e);
  const b={};S.breakdown.forEach(x=>b[x.key]=x);
  return {S,b,K};
}
const fin=lauf({d1:gi*0.8,ek:gi*0.2,darlehen:gi*0.8});
console.log('  finanziert : Score '+fin.S.score+'  ltv '+Math.round(b2(fin.b.ltv))+'/'+fin.b.ltv.weight
  +'  dscr '+Math.round(b2(fin.b.risiko))+'/'+fin.b.risiko.weight);
const bar=lauf({d1:0,ek:gi,darlehen:0});
console.log('  BARKAUF    : Score '+bar.S.score+'  ltv '+(bar.b.ltv.score===null?'entfaellt':'?')+'/'+bar.b.ltv.weight
  +'  dscr '+(bar.b.risiko.score===null?'entfaellt':'?')+'/'+bar.b.risiko.weight);
const alt=lauf({d1:0,ek:gi});   /* kein darlehen-Parameter = alter Zustand */
console.log('  ohne Angabe: Score '+alt.S.score+'  ltv '+Math.round(b2(alt.b.ltv))+'/'+alt.b.ltv.weight
  +'  dscr '+Math.round(b2(alt.b.risiko))+'/'+alt.b.risiko.weight);
function b2(x){return x&&x.score!=null?x.score:0}
console.log('');

console.log('=== 2 · Die Pruefungen ===');
melde(bar.b.ltv.score===null && bar.b.ltv.weight===0, 'Barkauf: LTV entfaellt (score null, weight 0)');
melde(bar.b.risiko.score===null && bar.b.risiko.weight===0, 'Barkauf: DSCR entfaellt');
melde(!!bar.b.ltv.entfaellt && /kein Darlehen/.test(bar.b.ltv.entfaellt), 'und der Grund steht dabei');
melde(bar.b.ltv.label==='LTV' && bar.b.risiko.label==='Risiko (DSCR)', 'die Kacheln bleiben in der Liste (label da)');
melde(bar.S.breakdown.length===5, 'fuenf Einträge, keiner verschwindet (ist: '+bar.S.breakdown.length+')');
melde(alt.S.score===72, 'OHNE darlehen-Parameter: unveraendert 72 (ist: '+alt.S.score+')');
melde(bar.S.score===82, 'MIT darlehen=0: 82 statt 72 (ist: '+bar.S.score+')');
melde(fin.b.ltv.weight===15 && fin.b.risiko.weight===15, 'finanziert: beide Gewichte stehen');
/* Die Gegenprobe, die zaehlt: aendert sich ein finanziertes Objekt? */
const finOhne=lauf({d1:gi*0.8,ek:gi*0.2});
melde(fin.S.score===finOhne.S.score,
  'finanziert MIT und OHNE Parameter gleich ('+fin.S.score+' / '+finOhne.S.score+')');
console.log('');

console.log('=== 3 · Die Rangfolge der Feldnamen ===');
const basis={kp,cf_m:740,nmy:4.46,ltv:0,dscr:0,wp_kpi:9000,mstg:1.5};
[['darlehen: 0',{darlehen:0},true],
 ['d_total: 0 (State.kpis direkt)',{d_total:0},true],
 ['d1: 0',{d1:0},true],
 ['darlehen: 0 schlaegt d1: 99999',{darlehen:0,d1:99999},true],
 ['d_total: 150000 (finanziert)',{d_total:150000},false],
 ['nichts gesagt',{},false]
].forEach(f=>{
  const S=rk.score(Object.assign({},basis,f[1]));
  const weg=S.breakdown.find(x=>x.key==='ltv').weight===0;
  melde(weg===f[2], f[0].padEnd(34)+' -> '+(weg?'entfaellt':'zaehlt')+'  Score '+S.score);
});
console.log('');
console.log(rot===0?'SAUBER — alle Proben gruen.':'ROT — '+rot+' Probe(n).');
process.exit(rot?1:0);
