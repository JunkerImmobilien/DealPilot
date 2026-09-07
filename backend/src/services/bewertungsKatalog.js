'use strict';
/* ═══ v1184 · Der Bewertungs-Katalog ════════════════════════════════════
   Die vier Pakete und fuenf Einzelposten des Preismodells v1176. Ihre
   Inhalte stehen NICHT hier und in keiner Migration, sondern als
   Metadaten an den Stripe-Preisen. Diese Datei ist nur der Weg dorthin.

   WARUM ZUR LAUFZEIT UND NICHT HARTVERDRAHTET:
   Eine Price-ID gilt je Konto. Staging rechnet gegen die Sandbox
   `acct_1TWXFqKEjyPDo0wo`, Produktion gegen das Hauptkonto — eine ID im
   Code oder in einer Migration ist deshalb immer in genau einer Umgebung
   falsch, und zwar lautlos. Der `lookup_key` ist ein NAME: er heisst in
   beiden Konten gleich und loest sich dort jeweils richtig auf.

   WAS AN DEN PREISEN STEHT (gemessen am 31.08.2026 in der Sandbox):
     Paket    dp_kind=bewertung_paket   · dp_pack_sku · mpi · mpi_plus · wev
     Einzeln  dp_kind=bewertung_einzeln · dp_art (mpi|mpi_plus|wev|avm_a|avm_b)

   Ein unbekanntes `dp_kind` ergibt KEIN Paket — nie eine grosszuegige
   Annahme, sonst schreibt ein fremder Preis Guthaben gut. Dieselbe Regel
   wie bei den Feature-Schluesseln: unbekannt heisst nein.
   ═════════════════════════════════════════════════════════════════════ */

const stripeService = require('./stripeService');

/* Die acht Namen. Stripe nimmt bis zu 10 lookup_keys je Abfrage — wer hier
   einen elften ergaenzt, muss auf Bloecke umstellen.

   v1246 · Die vier `dp_paket_*` sind weg. Marcels Entscheidung vom
   07.09.2026: die Bewertungs-Pakete werden nicht mehr angeboten, statt
   dessen kauft man sein eigenes Monatskontingent noch einmal — fuer ein
   Viertel des Monatsbeitrags. Die drei `dp_nachkauf_*` tragen dieselben
   Metadaten wie die alten Pakete (dp_kind=bewertung_paket plus mpi,
   mpi_plus, wev), damit der Webhook unveraendert gutschreibt. Die alten
   Preise sind in Stripe stillgelegt, nicht geloescht: wer eines der
   Pakete frueher gekauft hat, behaelt seine Gutschrift und seine
   Rechnung. */
const LOOKUP_KEYS = [
  'dp_nachkauf_starter', 'dp_nachkauf_investor', 'dp_nachkauf_pro',
  'dp_einzeln_mpi', 'dp_einzeln_mpi_plus', 'dp_einzeln_wev',
  'dp_einzeln_avm_a', 'dp_einzeln_avm_b'
];

/* Die Arten, die addKontingent() kennt. Alles andere wird verworfen. */
const ARTEN = ['mpi', 'mpi_plus', 'wev', 'avm_a', 'avm_b'];

const TTL_MS = 10 * 60 * 1000;
let _cache = null;
let _cacheAt = 0;

function _int(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* Aus den Metadaten EINES Preises die Gutschrift ableiten.
   Gibt null zurueck, wenn der Preis keiner von unseren ist oder nichts
   gutzuschreiben waere — der Aufrufer darf dann nichts buchen. */
function paketAusMeta(meta, quantity) {
  if (!meta || typeof meta !== 'object') return null;
  const menge = Math.max(1, _int(quantity) || 1);
  let paket = null;

  if (meta.dp_kind === 'bewertung_paket') {
    paket = {};
    ['mpi', 'mpi_plus', 'wev'].forEach(function (art) {
      const n = _int(meta[art]);
      if (n) paket[art] = n * menge;
    });
  } else if (meta.dp_kind === 'bewertung_einzeln') {
    const art = String(meta.dp_art || '');
    if (ARTEN.indexOf(art) === -1) return null;
    paket = {};
    paket[art] = menge;
  } else {
    return null;
  }

  return Object.keys(paket).length ? paket : null;
}

/* Die Summe aller Einheiten — nur fuer die Kaufhistorie
   (credit_purchases.credits_granted), nie fuer die Abrechnung. */
function summe(paket) {
  return Object.keys(paket || {}).reduce(function (s, k) { return s + (paket[k] || 0); }, 0);
}

/* Der SKU ist das, was das Frontend schickt: `paket_kurz` oder `mpi`.
   Er kommt aus den Metadaten, nicht aus einer Namensregel — sonst haette
   man dieselbe Zuordnung an zwei Stellen. */
function _skuVon(price) {
  const m = price.metadata || {};
  if (m.dp_kind === 'bewertung_paket') return m.dp_pack_sku || null;
  if (m.dp_kind === 'bewertung_einzeln') {
    return ARTEN.indexOf(String(m.dp_art)) >= 0 ? m.dp_art : null;
  }
  return null;
}

async function ladeKatalog(force) {
  if (!force && _cache && (Date.now() - _cacheAt) < TTL_MS) return _cache;

  const stripe = stripeService.getStripe();
  const res = await stripe.prices.list({
    lookup_keys: LOOKUP_KEYS,
    active: true,
    limit: 20
  });

  const katalog = {};
  (res.data || []).forEach(function (p) {
    const sku = _skuVon(p);
    if (!sku) return;
    const paket = paketAusMeta(p.metadata, 1);
    if (!paket) return;
    katalog[sku] = {
      sku:          sku,
      lookup_key:   p.lookup_key,
      price_id:     p.id,
      amount_cents: p.unit_amount,
      currency:     p.currency,
      label:        (p.metadata && p.metadata.dp_label) || p.nickname || sku,
      kind:         p.metadata.dp_kind === 'bewertung_paket' ? 'paket' : 'einzeln',
      paket:        paket
    };
  });

  /* Ein leerer Katalog ist immer ein Fehler der Umgebung (falsches Konto,
     Preise nicht angelegt) — dann lieber der alte Stand aus dem Cache als
     ein "Paket unbekannt" fuer jeden Kunden. */
  if (!Object.keys(katalog).length) {
    if (_cache) return _cache;
    throw new Error('bewertungs_katalog_leer — kein Preis mit dp_-lookup_key im Stripe-Konto gefunden');
  }

  _cache = katalog;
  _cacheAt = Date.now();
  return katalog;
}

async function getBySku(sku) {
  if (!sku || typeof sku !== 'string') return null;
  const k = await ladeKatalog(false);
  if (k[sku]) return k[sku];
  /* Einmal frisch nachsehen: ein gerade angelegter Preis soll nicht bis
     zum Ablauf des Caches unverkaeuflich sein. */
  const frisch = await ladeKatalog(true);
  return frisch[sku] || null;
}

/* v1246d · Die Weiche in credits.js:136 fragt hier, ob ein SKU zum
   Bewertungs-Zweig gehoert. Fiel er durch, landete er beim alten
   Kerosin-Weg und kam als `invalid_pack` mit HTTP 400 zurueck.

   `nachkauf_starter` und seine beiden Geschwister fielen genau so durch:
   das Muster kannte nur `paket_*`. Gemessen nach dem Anlegen der Preise —
   Stripe hatte sie, der Katalog fuehrte sie, und der Kauf waere trotzdem
   an dieser Zeile gescheitert.

   Das ist dieselbe Falle wie v1184, nur eine Ebene tiefer: dort war es
   der Tuersteher im Frontend, hier der im Backend. Wer eine neue
   SKU-Familie einfuehrt, sucht ALLE Stellen, die SKUs aufzaehlen. */
function istBewertungsSku(sku) {
  return typeof sku === 'string' &&
    /^(paket_[a-z]+|nachkauf_[a-z]+|mpi|mpi_plus|wev|avm_a|avm_b)$/.test(sku);
}

module.exports = {
  LOOKUP_KEYS,
  ARTEN,
  ladeKatalog,
  getBySku,
  istBewertungsSku,
  paketAusMeta,
  summe
};
