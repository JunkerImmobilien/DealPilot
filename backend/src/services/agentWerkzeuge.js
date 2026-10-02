'use strict';
/* services/agentWerkzeuge.js — was der Agent tun darf (v1801)
 *
 * Marcel am 02.10.2026: "Also wirklich ein schlauer Agent, der halt genau
 * weiss, was er da machen muss."
 *
 * ── DIE GRENZE, DIE JEDE ZEILE HIER EINHAELT ─────────────────────────────
 *
 *   > Die KI darf entscheiden, WAS GETAN WIRD — nie, WAS WAHR IST.
 *
 * Kein Werkzeug rechnet. Sie lesen aus der Datenbank, aus dem
 * Portfolio-Spiegel oder rufen eine vorhandene Systemfunktion. Was das
 * Modell zurueckbekommt, ist das, was dasteht — nicht das, was es sich
 * denkt.
 *
 * Das ist nicht Vorsicht, sondern Erfahrung: `projectAll` rechnete
 * jahrelang in Cent, und aufgefallen ist es erst, als eine zweite Quelle
 * danebenstand. Ein Modell, das Kennzahlen selbst ableitet, ist genau so
 * eine zweite Quelle — nur eine, die bei jedem Aufruf anders rechnen kann.
 *
 * ── DREI STUFEN ──────────────────────────────────────────────────────────
 *
 *   lesen      laeuft sofort
 *   schreiben  laeuft erst nach einer Bestaetigung im Chat
 *   kostet     laeuft erst nach einer Bestaetigung, in der der PREIS stand
 *
 * Die Stufe steht am Werkzeug, nicht im Prompt. Ein Modell, das man bittet,
 * vorher zu fragen, fragt meistens — und einmal nicht.
 */
const { query } = require('../db/pool');
const dialog = require('./telegramDialogService');
const fuehrung = require('./fuehrungService');
const markt = require('./telegramMarktService');

/* ═══ LESEN ═══════════════════════════════════════════════════════════ */

async function objekte_liste(ctx) {
  const liste = await dialog.objekteListe(ctx.userId, 60);
  const r = await query(
    `SELECT id,
            (data::jsonb->>'_dealpilot_score')::int   AS score,
            (data::jsonb->>'_ds2_score')::int         AS ids_score,
            COALESCE((data::jsonb->>'_ds2_computed')::boolean,false) AS ids_ok
       FROM objects WHERE user_id = $1`,
    [ctx.userId]);
  const extra = {};
  r.rows.forEach((z) => { extra[z.id] = z; });

  return {
    anzahl: liste.length,
    /* Die Nummer ist die Grundlage fuer "Objekt 17" — sie MUSS stabil
       sein und mit dem uebereinstimmen, was der Nutzer im Chat sieht. */
    objekte: liste.map((o, i) => {
      const e = extra[o.id] || {};
      return {
        nummer: i + 1, id: o.id, adresse: o.adresse, kaufpreis_eur: o.kp,
        dealscore: e.score != null ? e.score : null,
        investor_deal_score: e.ids_ok ? e.ids_score : null
      };
    })
  };
}

async function objekt_lesen(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { gefunden: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  const o = await dialog.objektKontext(ctx.userId, id);
  if (!o) return { gefunden: false };
  ctx.merkeObjekt(id);
  const s = dialog.scoreLesen(o.daten);
  return {
    gefunden: true, id: o.objekt_id,
    adresse: [o.daten.str, o.daten.hnr].filter(Boolean).join(' ')
           + (o.daten.ort ? ', ' + [o.daten.plz, o.daten.ort].filter(Boolean).join(' ') : ''),
    kerndaten: dialog.kerndaten(o.daten),
    dealscore: s.dealscore, dealscore_stufe: s.stufe,
    investor_deal_score: s.investor, investor_stufe: s.investorStufe,
    kennzahlen: s.weitere,
    /* Der ganze Datensatz, aber ohne die internen Marker — das Modell
       soll Felder sehen, keine Buchhaltung. */
    felder: _ohneIntern(o.daten),
    stand: o.geaendert
  };
}

async function portfolio_lesen(ctx) {
  const sp = await dialog.portfolioKontext(ctx.userId);
  if (!sp) {
    return {
      vorhanden: false,
      hinweis: 'Es liegt kein Portfolio-Stand vor. Er entsteht in DealPilot selbst; '
             + 'der Nutzer muss die App einmal oeffnen. NICHT selbst ausrechnen.'
    };
  }
  /* ── v1803 · DIE BETRAEGE GEHEN FERTIG FORMATIERT MIT ────────────────
   *
   * GEMESSEN am 02.10.2026: auf "wie hoch sind meine Verbindlichkeiten"
   * antwortete das Modell mit *472.157,90 EUR*. Richtig sind
   * 4.721.579 EUR — es hat die letzten beiden Ziffern als Cent gelesen.
   *
   *   > Dieselbe Falle, die `projectAll` jahrelang in Cent rechnen liess.
   *   > Nur merkt man sie hier schneller, weil ein Mensch die Antwort
   *   > liest — und genau deshalb darf man sich darauf nicht verlassen.
   *
   * Eine Prompt-Regel allein genuegt nicht: ein Modell haelt sich
   * meistens daran. Deshalb bekommt es die Zahl zusaetzlich SO, wie sie
   * dastehen soll. Was fertig dasteht, wird abgeschrieben statt
   * umgerechnet. */
  const bil = (sp.payload && sp.payload.vermoegensbilanz) || {};
  const lesbar = {};
  Object.keys(bil).forEach((k) => {
    if (!/_eur$/.test(k) || !Number.isFinite(Number(bil[k]))) return;
    lesbar[k] = Number(bil[k]).toLocaleString('de-DE') + ' EUR';
  });

  return {
    vorhanden: true,
    stand: dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem),
    geaendert_seitdem: sp.geaendert_seitdem,
    hinweis: 'Alle Betraege sind GANZE EURO. Unter "so_schreiben" stehen sie '
           + 'fertig formatiert — nimm diese Schreibweise unveraendert.',
    so_schreiben: lesbar,
    daten: sp.payload
  };
}

async function feld_katalog(ctx, args) {
  const suche = String((args && args.suche) || '').toLowerCase().trim();
  let felder = fuehrung.katalog();
  if (suche) {
    felder = felder.filter((f) =>
      f.id.toLowerCase().indexOf(suche) >= 0
      || String(f.label || '').toLowerCase().indexOf(suche) >= 0);
  }
  /* Ohne Suche nur die Auswahlfelder und die wichtigsten — der ganze
     Katalog waere ein Dump, und ein Dump macht den Agenten beliebiger. */
  if (!suche) felder = felder.filter((f) => f.kind === 'select').slice(0, 60);
  return { anzahl: felder.length, felder: felder.slice(0, 60) };
}

/* ═══ SCHREIBEN (brauchen Bestaetigung) ═══════════════════════════════ */

async function felder_aendern(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { ok: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  const felder = (args && args.felder) || {};

  /* ── Auswahlfelder: niemals einen ungueltigen Wert schreiben ────────
   *
   * Marcel, Punkt 3: "Bei Feldern mit definierten Auswahlmoeglichkeiten
   * darf der Copilot keine ungueltigen Werte einfach uebernehmen."
   *
   * Was sich eindeutig zuordnen laesst, wird zugeordnet (Gross-/Klein-
   * schreibung, Teilwort). Was nicht, kommt als Rueckfrage zurueck — mit
   * den Moeglichkeiten. */
  const geprueft = {}, nachfragen = [], unbekannt = [];
  for (const [fid, wert] of Object.entries(felder)) {
    const f = fuehrung.feld(fid);
    if (!f) { unbekannt.push(fid); continue; }
    if (f.kind === 'select' && f.optionen && f.optionen.length) {
      const treffer = _ordneOption(wert, f.optionen);
      if (treffer.eindeutig) geprueft[fid] = treffer.wert;
      else nachfragen.push({
        feld: fid, label: f.label || fid, gesagt: wert,
        moeglich: f.optionen.map((o) => o.text || o.wert)
      });
      continue;
    }
    geprueft[fid] = wert;
  }

  if (nachfragen.length) {
    return { ok: false, rueckfrage: true, auswahl_unklar: nachfragen,
      hinweis: 'Diese Werte passen zu keiner Auswahl. Frag den Nutzer, '
             + 'welche der genannten Moeglichkeiten er meint. NICHTS speichern.' };
  }
  if (!Object.keys(geprueft).length) {
    return { ok: false, unbekannte_felder: unbekannt,
      hinweis: 'Keine bekannten Felder dabei. Nenne dem Nutzer, was nicht zugeordnet werden konnte.' };
  }

  const o = await dialog.objektKontext(ctx.userId, id);
  const belegt = Object.keys(geprueft).filter((fid) =>
    fuehrung.gefuellt(o.daten, fid) && String(o.daten[fid]) !== String(geprueft[fid]));

  /* Ein belegtes Feld wird nie still ueberschrieben — und die Rueckfrage
     nennt BEIDE Werte, sonst kann der Nutzer sie nicht beantworten. */
  if (belegt.length && !(args && args.bestaetigt)) {
    return { ok: false, rueckfrage: true,
      bereits_belegt: belegt.map((fid) => ({
        feld: fid, label: (fuehrung.feld(fid) || {}).label || fid,
        steht_auf: o.daten[fid], soll_werden: geprueft[fid] })),
      hinweis: 'Diese Felder sind belegt. Nenne dem Nutzer ALTEN und NEUEN Wert '
             + 'und frage, ob geaendert werden soll. Erst nach einem Ja erneut '
             + 'aufrufen, dann mit bestaetigt: true.' };
  }

  const neu = Object.assign({}, o.daten, geprueft);
  await query(`UPDATE objects SET data = $3::jsonb, updated_at = now()
                WHERE id = $1 AND user_id = $2`,
    [id, ctx.userId, JSON.stringify(neu)]);
  ctx.merkeObjekt(id);
  return { ok: true, geaendert: geprueft,
    unbekannte_felder: unbekannt.length ? unbekannt : undefined,
    hinweis: 'Gespeichert. Die Kennzahlen rechnet DealPilot beim naechsten Oeffnen neu.' };
}

async function objekt_anlegen(ctx, args) {
  const felder = (args && args.felder) || {};
  const sauber = {};
  const unbekannt = [];
  Object.entries(felder).forEach(([fid, w]) => {
    if (fuehrung.feld(fid)) sauber[fid] = w; else unbekannt.push(fid);
  });
  if (!Object.keys(sauber).length) {
    return { ok: false, unbekannte_felder: unbekannt,
      hinweis: 'Keine verwertbaren Felder. Frag nach Adresse, Objektart und Flaeche.' };
  }
  const r = await query(
    `INSERT INTO objects (user_id, data) VALUES ($1, $2::jsonb) RETURNING id`,
    [ctx.userId, JSON.stringify(sauber)]);
  ctx.merkeObjekt(r.rows[0].id);
  const fo = fuehrung.fortschritt(sauber);
  const offen = fuehrung.luecken(sauber, { modus: 'anlegen' }).slice(0, 3);
  return { ok: true, id: r.rows[0].id, uebernommen: sauber,
    unbekannte_felder: unbekannt.length ? unbekannt : undefined,
    fortschritt: fo.fertig + ' von ' + fo.bloecke + ' Bloecken',
    naechste_fragen: offen.map((b) => b.frage),
    hinweis: 'Angelegt. Nenne dem Nutzer, was uebernommen wurde, und frage die '
           + 'naechsten offenen Punkte — aber NUR die, die oben stehen.' };
}

async function anlage_luecken(ctx, args) {
  const felder = (args && args.felder) || {};
  const fo = fuehrung.fortschritt(felder);
  const offen = fuehrung.luecken(felder, { modus: 'anlegen' });
  return {
    fortschritt: fo, offene_bloecke: offen.slice(0, 5).map((b) => ({
      frage: b.frage, felder: b.ids.filter((id) => !fuehrung.gefuellt(felder, id))
        .map((id) => {
          const f = fuehrung.feld(id) || {};
          return { id, label: f.label || id, art: f.kind,
            auswahl: f.optionen ? f.optionen.map((o) => o.text || o.wert) : undefined };
        })
    }))
  };
}

/* ═══ KOSTET (braucht Bestaetigung MIT PREIS) ═════════════════════════ */

async function marktbericht_preis(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { ok: false, hinweis: 'Kein Objekt gefunden.' };
  const stufe = _stufe(args);
  const v = await markt.voranschlag(ctx.userId, id, stufe);
  return Object.assign({ objekt_id: id }, v, {
    hinweis: 'Das kostet NICHTS. Nenne dem Nutzer Name und Preis und frage, '
           + 'ob abgerufen werden soll. Erst nach einem Ja marktbericht_abrufen.' });
}

async function marktbericht_abrufen(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { ok: false, hinweis: 'Kein Objekt gefunden.' };
  const stufe = _stufe(args);
  const o = await dialog.objektKontext(ctx.userId, id);
  try {
    const r = await markt.abrufen(ctx.userId, o, stufe);
    ctx.merkeObjekt(id);
    return { ok: true, stufe, ergebnis: r };
  } catch (e) {
    return { ok: false, fehler: e.message, kontingent: Boolean(e.kontingent),
      upgrade_zu: e.upgradeTo || undefined };
  }
}

/* ═══ Helfer ═════════════════════════════════════════════════════════ */

function _ohneIntern(d) {
  const o = {};
  Object.keys(d || {}).forEach((k) => {
    if (k.indexOf('_') === 0) return;      /* _kpis_*, _ds2_*, _dealpilot_score */
    if (d[k] == null || d[k] === '') return;
    o[k] = d[k];
  });
  return o;
}

function _stufe(args) {
  const s = Number((args && args.stufe) || 1);
  return (s === 1 || s === 2 || s === 3) ? s : 1;
}

/* Ordnet eine Nutzerangabe einer Auswahl zu. Eindeutig heisst: genau ein
   Treffer. Zwei Treffer sind keine Entscheidung. */
function _ordneOption(wert, optionen) {
  const w = String(wert == null ? '' : wert).toLowerCase().trim();
  if (!w) return { eindeutig: false };
  const genau = optionen.filter((o) =>
    String(o.wert).toLowerCase() === w || String(o.text || '').toLowerCase() === w);
  if (genau.length === 1) return { eindeutig: true, wert: genau[0].wert };
  const teil = optionen.filter((o) =>
    String(o.text || '').toLowerCase().indexOf(w) >= 0
    || w.indexOf(String(o.text || '').toLowerCase()) >= 0
    || String(o.wert).toLowerCase().indexOf(w) >= 0);
  if (teil.length === 1) return { eindeutig: true, wert: teil[0].wert };
  return { eindeutig: false };
}

/* Objekt finden — Nummer aus der letzten Liste, ID, Adresse, oder das
   zuletzt besprochene. Die Reihenfolge ist dieselbe wie im Webhook. */
async function _findeObjekt(ctx, args) {
  const a = args || {};
  if (a.nummer != null && ctx.letzteListe && ctx.letzteListe.length) {
    const n = Number(a.nummer);
    if (n >= 1 && n <= ctx.letzteListe.length) return ctx.letzteListe[n - 1];
    return null;
  }
  if (a.id && /^[0-9a-f-]{36}$/i.test(String(a.id))) {
    const r = await query(`SELECT id FROM objects WHERE id = $1 AND user_id = $2`,
      [a.id, ctx.userId]);
    return r.rows.length ? r.rows[0].id : null;
  }
  if (a.adresse) {
    const liste = await dialog.objekteListe(ctx.userId, 60);
    const t = dialog.objektRaten(String(a.adresse), liste);
    if (t.art === 'eindeutig') return t.objekt.id;
    if (t.art === 'mehrdeutig') return null;
  }
  return ctx.letztesObjekt || null;
}

/* ═══ Das Register ═══════════════════════════════════════════════════ */

const OBJEKT_ARGS = {
  nummer: { type: 'integer', description: 'Nummer aus der zuletzt gezeigten Liste' },
  id: { type: 'string', description: 'Objekt-UUID' },
  adresse: { type: 'string', description: 'Adresse oder Teil davon' }
};

const WERKZEUGE = [
  { name: 'objekte_liste', stufe: 'lesen', fn: objekte_liste,
    beschreibung: 'Alle Objekte des Nutzers mit Nummer, Adresse, Kaufpreis und Scores. '
      + 'Die Nummer ist die, auf die sich der Nutzer spaeter bezieht.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  { name: 'objekt_lesen', stufe: 'lesen', fn: objekt_lesen,
    beschreibung: 'Alle Daten EINES Objekts: Kerndaten, Scores, Kennzahlen, Felder. '
      + 'Ohne Angabe wird das zuletzt besprochene Objekt genommen.',
    parameter: { type: 'object', properties: OBJEKT_ARGS, additionalProperties: false } },

  { name: 'portfolio_lesen', stufe: 'lesen', fn: portfolio_lesen,
    beschreibung: 'Die Portfolio-Zahlen: Vermoegensbilanz, Projektion, alle Objekte mit '
      + 'Kennzahlen. IMMER aufrufen bei Fragen zum Gesamtbestand, zu Summen, '
      + 'Verbindlichkeiten, Tilgung, Rendite ueber alles oder zur Zukunft. '
      + 'Rechne Summen NUR aus diesen Zahlen, nie aus eigener Annahme.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  { name: 'feld_katalog', stufe: 'lesen', fn: feld_katalog,
    beschreibung: 'Welche Felder es gibt und welche Werte bei Auswahlfeldern erlaubt sind. '
      + 'Vor dem Aendern eines Auswahlfeldes aufrufen.',
    parameter: { type: 'object',
      properties: { suche: { type: 'string', description: 'Feldname oder Teil davon' } },
      additionalProperties: false } },

  { name: 'anlage_luecken', stufe: 'lesen', fn: anlage_luecken,
    beschreibung: 'Was fehlt an einem Objektentwurf noch? Gibt die naechsten Fragen in '
      + 'der richtigen Reihenfolge und die erlaubten Auswahlwerte.',
    parameter: { type: 'object',
      properties: { felder: { type: 'object', description: 'bisher bekannte Felder' } },
      additionalProperties: false } },

  { name: 'felder_aendern', stufe: 'schreiben', fn: felder_aendern,
    beschreibung: 'Aendert Felder an einem Objekt. Prueft Auswahlwerte und meldet belegte '
      + 'Felder zurueck, statt sie zu ueberschreiben.',
    parameter: { type: 'object',
      properties: Object.assign({}, OBJEKT_ARGS, {
        felder: { type: 'object', description: 'Feld-Id zu Wert, z.B. {"zimmer":"5"}' },
        bestaetigt: { type: 'boolean', description: 'true erst, wenn der Nutzer ja gesagt hat' }
      }),
      required: ['felder'], additionalProperties: false } },

  { name: 'objekt_anlegen', stufe: 'schreiben', fn: objekt_anlegen,
    beschreibung: 'Legt ein neues Objekt an. Uebergib ALLE Felder, die der Nutzer genannt '
      + 'hat — frage nichts erneut, was schon gesagt wurde.',
    parameter: { type: 'object',
      properties: { felder: { type: 'object', description: 'Feld-Id zu Wert' } },
      required: ['felder'], additionalProperties: false } },

  { name: 'marktbericht_preis', stufe: 'lesen', fn: marktbericht_preis,
    beschreibung: 'Was kostet eine Bewertung? Stufe 1 Marktpreisindikation, '
      + '2 erweiterte, 3 Wertermittlung nach ImmoWertV. Kostet selbst nichts. '
      + 'IMMER vor marktbericht_abrufen.',
    parameter: { type: 'object',
      properties: Object.assign({}, OBJEKT_ARGS,
        { stufe: { type: 'integer', description: '1, 2 oder 3' } }),
      additionalProperties: false } },

  { name: 'marktbericht_abrufen', stufe: 'kostet', fn: marktbericht_abrufen,
    beschreibung: 'Ruft die Bewertung ab. KOSTET GUTHABEN. Nur aufrufen, wenn der Nutzer '
      + 'nach einer Preisansage ausdruecklich zugestimmt hat.',
    parameter: { type: 'object',
      properties: Object.assign({}, OBJEKT_ARGS,
        { stufe: { type: 'integer', description: '1, 2 oder 3' } }),
      additionalProperties: false } }
];

function fuerModell() {
  return WERKZEUGE.map((w) => ({
    type: 'function',
    name: w.name,
    description: w.beschreibung,
    parameters: w.parameter
  }));
}

function finde(name) { return WERKZEUGE.find((w) => w.name === name) || null; }

module.exports = { WERKZEUGE, fuerModell, finde };
