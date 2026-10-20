'use strict';
/* services/telegramUnterlagenService.js — v2470
 *
 * UNTERLAGEN BEIM AMT IM TELEGRAM-BOT
 *
 * Marcel am 20.10.2026 zum Telegram-Teil aus unterlagen-app-v5: „ja das
 * wäre top". Der Bot führt durch dieselben drei Schritte wie das Modal im
 * Tab Objekt:
 *
 *   1. Objekt wählen       (Nummer aus der Liste, Adresse, „das letzte")
 *   2. Zuständigkeiten     je Unterlage Amt, Kanal, Gebühr, Ansprechpartner
 *   3. Anschreiben         Entwurf zum Kopieren, Empfänger zum Antippen
 *
 * ── WAS AUS v5 KOMMT UND WAS NICHT ──────────────────────────────────────
 *
 * Übernommen: der Ablauf (Objekt → Lage je Unterlage → Anschreiben), der
 * Lagebericht je Objekt (`lagebericht()` in v5: fertig / ohne Adresse /
 * schon angefragt), die Texte im Ton „hier komme ich allein nicht weiter",
 * „schon angefragt" — und die Rückmeldung, wenn der Nutzer verschickt hat.
 *
 * Bewusst NICHT: Versand (v5 `sendeUndBerichte`, SMTP, „Alle senden"-
 * Knöpfe), Auto-Senden, Vollmacht als PDF in den Chat, Aufgaben, das
 * KI-Sprachverständnis `verstehe()` (hier gibt es den Agenten und feste
 * Muster), Long Polling (DealPilot hat den Webhook) und die Kopplung über
 * TELEGRAM_CHAT_ID (DealPilot verknüpft per Code).
 *
 *   > DealPilot verschickt grundsätzlich nichts (routes/unterlagen.js).
 *   > Ein Bot, der verschickt, wäre derselbe Bruch über einen anderen
 *   > Eingang — und dort fiele er weniger auf.
 *
 * ── EIN KERN ────────────────────────────────────────────────────────────
 *
 * Alles Fachliche kommt aus `unterlagenService`: ARTEN, aemterFuer (nur
 * lesen), amtHolen (Recherche), entwurfAnlegen (Brief + Vorgang),
 * anfrageStatus. Hier steht nur, wie es im Chat aussieht.
 *
 * ── GELD ────────────────────────────────────────────────────────────────
 *
 * Gemessen am 20.10.2026: das Modal ruft POST /unterlagen/amt ohne
 * Kontingent und ohne Feature-Schlüssel (routes/unterlagen.js hat nur
 * `authenticate`, der Knopf im Tab Objekt keine Plan-Sperre). Der Bot
 * hält es genauso — er erfindet keinen Feature-Schlüssel, denn ein
 * unbekannter Schlüssel ist für JEDEN false (CLAUDE.md). Und er zieht
 * auch kein Co-Pilot-Kontingent: diese Schritte laufen ohne Modell, wie
 * die Objektliste.
 *
 * Diese Datei sendet selbst nichts an Telegram. Sie bekommt `sag()` vom
 * Webhook — dadurch läuft sie in der Prüfstrecke mit einer gestellten
 * Sendefunktion, ohne dass eine Nachricht rausgeht.
 */
const { query } = require('../db/pool');
const U = require('./unterlagenService');
const dialog = require('./telegramDialogService');
const absicht = require('./telegramAbsichtService');

const MODUS = 'unterlagen';
/* Wie das Angebot im Webhook (ANGEBOT_FRIST_MS): nach 30 Minuten ist eine
   nackte „3" kein Bezug mehr auf diese Liste, sondern ein Zufall. */
const FRIST_MS = 30 * 60 * 1000;

const KANAL = { email: 'E-Mail', portal: 'Online-Portal', formular: 'Online-Formular', post: 'Post' };

/* ── Erkennen ────────────────────────────────────────────────────────────
 *
 * Feste Muster, kein Modell: der Einstieg startet einen ZUSTAND, und der
 * gehört in den Webhook (v1809). */
const WOERTER = [
  { art: 'flurkarte',          re: /\b(flurkarte|liegenschaftskarte|katasterauszug)\b/i },
  { art: 'grundbuch',          re: /\bgrundbuch(auszug|amt)?\b/i },
  { art: 'altlasten',          re: /\baltlast(en)?(auskunft|kataster)?\b/i },
  { art: 'baulasten',          re: /\bbaulast(en)?(auskunft|verzeichnis)?\b/i },
  { art: 'bauakte',            re: /\bbauakte(n)?\b/i },
  { art: 'gutachterausschuss', re: /\b(gutachterausschuss|grundst(ü|ue)cksmarktbericht|marktbericht des gutachterausschusses)\b/i }
];
const VERB = /\b(anfordern|anfragen|beantragen|bestellen|besorgen|holen|hol|besorg|bestell|beantrag|vorbereiten|brauche|br(ä|ae)uchte|anschreiben|schreiben|entwurf|amt|(ä|ae)mter(n)?)\b/i;

function artenIm(text) {
  const t = String(text || '');
  return WOERTER.filter((w) => w.re.test(t)).map((w) => w.art);
}

/** Ist das der Wunsch, Unterlagen beim Amt anzufordern? */
function erkenne(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (/^\/unterlagen\b/i.test(t)) return { arten: artenIm(t) };
  if (/\bunterlagen\b/i.test(t) && /\b(amt|(ä|ae)mter|(ä|ae)mtern|beh(ö|oe)rde|anfordern|anfragen|beantragen|bestellen|besorgen|holen|vorbereiten)\b/i.test(t)) {
    return { arten: artenIm(t) };
  }
  const arten = artenIm(t);
  if (arten.length && VERB.test(t)) return { arten: arten };
  return null;
}

/* ── Hilfen ──────────────────────────────────────────────────────────── */
function h(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function hAttr(s) { return h(s).replace(/"/g, '&quot;'); }
/* Nur http(s) wird verlinkt: Telegram verwirft eine Nachricht mit einem
   ungueltigen Link GANZ (400), und der Nutzer saehe dann gar nichts. */
function link(url, text) {
  return /^https?:\/\//i.test(String(url || '')) ? '<a href="' + hAttr(url) + '">' + h(text) + '</a>' : '';
}
function datum(d) {
  const t = d ? new Date(d) : null;
  if (!t || isNaN(t.getTime())) return '';
  return String(t.getDate()).padStart(2, '0') + '.' + String(t.getMonth() + 1).padStart(2, '0') + '.' + t.getFullYear();
}

/* Dieselbe Abbildung wie `_objekt()` im Modal (unterlagen-modal.js Z. 76):
   die Felder heißen im Datensatz wie die Eingabefelder im Tab Objekt. */
async function objektLesen(userId, objektId) {
  if (!objektId) return null;
  const r = await query('SELECT id, data FROM objects WHERE id = $1 AND user_id = $2', [objektId, userId]);
  if (!r.rows.length) return null;
  const d = r.rows[0].data || {};
  const strasse = [d.str, d.hnr].filter(Boolean).join(' ');
  return {
    id: r.rows[0].id,
    adresse: strasse + ((d.plz || d.ort) ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : ''),
    objekt: {
      strasse: strasse, plz: d.plz || '', ort: d.ort || '',
      gemarkung: d.gemarkung || '', flur: d.flur || '', flurstueck: d.flurstueck || '',
      eigentuemer: d.eigentuemer || ''
    }
  };
}

/* ── Empfänger und Kopie: wie im Modal ──────────────────────────────────
 *
 * unterlagen-modal.js `_empfaenger()` / `_kopienVon()` (v2441): Standard
 * ist die Amtsadresse; ohne sie die erste Ansprechperson mit Adresse. In
 * Kopie geht, wer am Amt angehakt ist — nie der Empfänger selbst. Das ist
 * Anzeige, keine Rechnung; die Häkchen setzt nur das Modal. */
function personen(amt) {
  return (amt && Array.isArray(amt.ansprechpartner)) ? amt.ansprechpartner : [];
}
function empfaengerVon(amt) {
  if (!amt) return '';
  if (amt.email) return amt.email;
  const p = personen(amt).find((x) => !!x.email);
  return p ? p.email : '';
}
function kopienVon(amt) {
  const an = empfaengerVon(amt);
  return personen(amt).filter((p) => p.kopie && p.email && p.email !== an).map((p) => p.email);
}

async function absenderVon(userId) {
  const r = await query('SELECT name, email FROM users WHERE id = $1', [userId]);
  const u = r.rows[0] || {};
  /* Wie im Modal: Name und E-Mail des Kontos, keine Vollmacht als Anlage. */
  return { name: u.name || '', email: u.email || '', vollmacht_liegt_bei: false };
}

async function vorgaengeVon(userId, objektId) {
  const r = await query(
    `SELECT DISTINCT ON (art) id, art, status, erstellt_am, gesendet_am
       FROM unterlagen_anfragen
      WHERE user_id = $1 AND objekt_id = $2
      ORDER BY art, erstellt_am DESC`,
    [userId, objektId]);
  const m = {};
  r.rows.forEach((a) => { m[a.art] = a; });
  return m;
}

async function aemterJeArt(o) {
  const liste = await U.aemterFuer(o.objekt.plz, o.objekt.ort);
  const m = {};
  (liste || []).forEach((a) => { if (!m[a.art]) m[a.art] = a; });
  return m;
}

/* ── Die Übersicht: ein Block je Unterlage ──────────────────────────────
 *
 * v5 `lagebericht()` sortierte nach Zustand (fertig / ohne Adresse /
 * angefragt). Hier steht dieselbe Auskunft je Unterlage, in der Reihenfolge
 * von ARTEN — die Nummer davor ist die, die der Nutzer zurückschreibt. */
function block(nr, art, amt, vorgang) {
  const z = [];
  z.push('<b>' + nr + '. ' + h(art.name) + '</b>');
  if (!amt) {
    z.push('Amt noch nicht ermittelt. „suche ' + nr + '“ sucht die zuständige Stelle.');
  } else {
    z.push(h(amt.behoerde) + (amt.abteilung ? ' · ' + h(amt.abteilung) : '')
      + (amt.gemeindeweit ? ' <i>(für die ganze Gemeinde hinterlegt)</i>' : ''));
    const kanal = KANAL[amt.kanal] || amt.kanal || 'unbekannt';
    const an = empfaengerVon(amt);
    z.push('Kanal: ' + h(kanal)
      + (an ? ' · ' + h(an) + (amt.email && an === amt.email && !amt.beleg_ok ? ' <i>(nicht belegt, bitte prüfen)</i>' : '') : ''));
    if (amt.antrag_url) {
      z.push(link(amt.antrag_url, amt.email ? 'Online-Antrag / Portal' : 'nur über das Portal: hier öffnen'));
    }
    if (amt.telefon) z.push('Telefon ' + h(amt.telefon));
    z.push('Gebühr: ' + (amt.gebuehr ? h(amt.gebuehr) : 'nicht angegeben'));
    personen(amt).slice(0, 2).forEach((p, i) => {
      const teile = [p.name || 'Name nicht genannt'];
      if (p.funktion) teile.push(p.funktion);
      if (p.telefon) teile.push('Tel. ' + p.telefon);
      if (p.email) teile.push(p.email);
      const beleg = p.bestaetigt ? '✓ Adresse auf der Seite'
        : p.name_belegt ? '✓ Name auf der Seite' : '⚠ nur genannt';
      z.push('Ansprechpartner ' + (i + 1) + ': ' + h(teile.join(' · ')) + ' <i>(' + h(beleg)
        + (p.kopie ? ', geht in Kopie' : '') + ')</i>');
    });
    if (!an && !amt.antrag_url) {
      z.push('<i>Hier komme ich allein nicht weiter: keine Adresse und kein Portal.</i>'
        + (link(amt.quelle_url, 'Quelle ansehen') ? ' ' + link(amt.quelle_url, 'Quelle ansehen') : ''));
    } else if (link(amt.quelle_url, 'Quelle ansehen')) {
      z.push(link(amt.quelle_url, 'Quelle ansehen'));
    }
  }
  if (vorgang) {
    z.push(vorgang.status === 'gesendet'
      ? '<i>Schon angefragt am ' + datum(vorgang.gesendet_am || vorgang.erstellt_am) + '.</i>'
      : vorgang.status === 'erledigt' ? '<i>Erledigt.</i>'
      : vorgang.status === 'entwurf' ? '<i>Entwurf vom ' + datum(vorgang.erstellt_am) + ' liegt vor.</i>' : '');
  }
  return z.filter(Boolean).join('\n');
}

async function uebersicht(userId, o) {
  const aemter = await aemterJeArt(o);
  const vorgaenge = await vorgaengeVon(userId, o.id);
  const bloecke = U.ARTEN.map((a, i) => block(i + 1, a, aemter[a.id], vorgaenge[a.id]));
  const fehlen = U.ARTEN.filter((a) => !aemter[a.id]).length;
  const kopf = '<b>Unterlagen beim Amt</b>\n' + h(o.adresse || 'ohne Adresse');
  const fuss = 'Schreib die <b>Nummer</b> (1–' + U.ARTEN.length + '), dann bekommst du das Anschreiben als Entwurf.'
    + (fehlen ? '\n„suche alle“ ermittelt die ' + fehlen + ' fehlenden Ämter (Websuche, je Amt bis zu einer Minute).' : '')
    + '\nVerschicken tust du selbst, DealPilot sendet nichts. /abbrechen beendet.';
  return { teile: [kopf].concat(bloecke, [fuss]), fehlen: fehlen, aemter: aemter };
}

/* Telegram schneidet bei 4096 Zeichen ab. Geteilt wird an Blockgrenzen,
   nie mitten in einem Tag. */
function zuNachrichten(teile, max) {
  const M = max || 3800;
  const out = [];
  let cur = '';
  teile.forEach((t) => {
    if (cur && (cur.length + 2 + t.length) > M) { out.push(cur); cur = ''; }
    cur = cur ? cur + '\n\n' + t : t;
  });
  if (cur) out.push(cur);
  return out;
}

/* ── Zustand ──────────────────────────────────────────────────────────── */
function aktiv(z) {
  if (!z || z.modus !== MODUS) return null;
  const e = z.entwurf || {};
  const t = Date.parse(e.zeit || '');
  if (!Number.isFinite(t) || Date.now() - t > FRIST_MS) return null;
  return e;
}
async function merke(ctx, objektId, e) {
  await ctx.setze({ modus: MODUS, objekt_id: objektId || null,
    entwurf: Object.assign({}, e, { zeit: new Date().toISOString() }) });
}

/* ── Schritt 2: die Übersicht zeigen ─────────────────────────────────── */
async function zeigen(ctx, o, wunsch) {
  const u = await uebersicht(ctx.userId, o);
  for (const n of zuNachrichten(u.teile)) await ctx.sag(n, { html: true });
  await ctx.merkeObjekt(o.id);
  await merke(ctx, o.id, { schritt: 'wahl' });
  await ctx.notiz('Unterlagen-Übersicht für ' + (o.adresse || 'das Objekt') + ' gezeigt (' + U.ARTEN.length + ' Unterlagen, '
    + u.fehlen + ' Ämter offen). Nächster Schritt: Nummer für den Entwurf.');
  /* Genau eine Unterlage genannt und ihr Amt ist bekannt: gleich den
     Entwurf dazu. Bei mehreren fragt die Übersicht nach. */
  if (wunsch && wunsch.length === 1 && u.aemter[wunsch[0]]) {
    await entwurf(ctx, o, wunsch[0]);
  }
}

/* ── Schritt 3: das Anschreiben ──────────────────────────────────────── */
async function entwurf(ctx, o, artId) {
  const art = U.ARTEN_MAP[artId];
  const amt = (await aemterJeArt(o))[artId] || null;
  const r = await U.entwurfAnlegen(ctx.userId, {
    art: artId, objekt_id: o.id, amt_id: amt ? amt.id : null,
    objekt: o.objekt, absender: await absenderVon(ctx.userId)
  });
  const an = empfaengerVon(amt);
  const cc = kopienVon(amt);
  const kopf = ['<b>Anschreiben: ' + h(art.name) + '</b>', h(o.adresse)];
  if (an) {
    kopf.push('An: ' + h(an) + (amt && an === amt.email && !amt.beleg_ok ? ' <i>(nicht belegt, bitte vor dem Senden prüfen)</i>' : ''));
  } else {
    kopf.push('An: <i>keine E-Mail-Adresse bekannt</i>');
  }
  if (cc.length) kopf.push('Kopie an: ' + h(cc.join(', ')));
  if (amt && link(amt.antrag_url, 'x')) kopf.push(link(amt.antrag_url, an ? 'Oder online beantragen' : 'Online beantragen'));
  if (amt && !an && !amt.antrag_url) kopf.push('Kanal: ' + h(KANAL[amt.kanal] || amt.kanal || 'Post') + ' — den Text kannst du ausdrucken.');
  kopf.push('Betreff (antippen kopiert):\n<code>' + h(r.betreff) + '</code>');
  await ctx.sag(kopf.join('\n'), { html: true });
  /* Der Brief als <pre>: ein Tipp darauf kopiert ihn in Telegram ganz. */
  await ctx.sag('<pre>' + h(r.text) + '</pre>', { html: true });
  /* Telegram lässt einen mailto-Link nicht als Knopf zu (Inline-Knöpfe
     nehmen nur http(s) und tg://). Die Adresse selbst öffnet beim Antippen
     das Mailprogramm. */
  await ctx.sag((an ? 'Tipp auf die Adresse öffnet dein Mailprogramm. Betreff und Text kopierst du mit einem Tipp auf die grauen Felder.\n' : '')
    + 'DealPilot verschickt nichts. Schreib „verschickt“, wenn du es abgeschickt hast, dann steht der Vorgang auf gesendet. '
    + 'Eine andere Nummer gibt den nächsten Entwurf.', {});
  await merke(ctx, o.id, { schritt: 'wahl', letzte_anfrage: r.anfrage ? r.anfrage.id : null, letzte_art: artId });
  await ctx.notiz('Anschreiben-Entwurf ' + art.name + ' für ' + (o.adresse || 'das Objekt') + ' gezeigt.');
  return r;
}

/* ── Ämter suchen (dieselbe Recherche wie „abrufen“ im Modal) ─────────── */
async function suchen(ctx, o, artIds) {
  const da = await aemterJeArt(o);
  const offen = artIds.filter((a) => !da[a]);
  if (!offen.length) {
    await ctx.sag('Dafür liegt das Amt schon vor.', {});
    return [];
  }
  if (!o.objekt.plz && !o.objekt.ort) {
    await ctx.sag('Am Objekt fehlen Postleitzahl und Ort — ohne sie lässt sich keine Zuständigkeit bestimmen.', {});
    return [];
  }
  await ctx.sag('Ich suche ' + offen.map((a) => U.ARTEN_MAP[a].name).join(', ')
    + ' für ' + o.adresse + ' … das dauert je Amt bis zu einer Minute.', {});
  const erg = [];
  for (const art of offen) {
    if (ctx.tippt) { try { await ctx.tippt(); } catch (e) {} }
    let r;
    try {
      r = await U.amtHolen(ctx.userId, art, { plz: o.objekt.plz, ort: o.objekt.ort, strasse: o.objekt.strasse });
    } catch (e) { r = { gefunden: false, grund: e.message || String(e) }; }
    erg.push({ art: art, ok: Boolean(r && r.gefunden), grund: r && r.grund });
  }
  const nicht = erg.filter((x) => !x.ok);
  if (nicht.length) {
    await ctx.sag('Nicht gefunden: ' + nicht.map((x) => U.ARTEN_MAP[x.art].name
      + (x.grund ? ' (' + String(x.grund).slice(0, 120) + ')' : '')).join('; '), {});
  }
  await zeigen(ctx, o, null);
  return erg;
}

/* ── Einstieg ────────────────────────────────────────────────────────────
 *
 * ctx = { userId, z, sag(text,{html}), setze(zustand), merkeListe(ids),
 *         merkeObjekt(id), notiz(text), tippt?() }
 * bezugObjektId: was der Webhook schon aus der letzten Liste aufgelöst hat.
 */
async function start(ctx, text, bezugObjektId, wunsch) {
  const arten = (wunsch && wunsch.arten) || artenIm(text);
  let id = bezugObjektId || null;
  /* „/unterlagen 3" — die Zahl hinter dem Befehl steht allein und meint
     die zuletzt gezeigte Liste (dieselbe Regel wie absicht.bezug). */
  const rest = String(text || '').replace(/^\/unterlagen\b/i, '').trim();
  if (!id && rest && ctx.z && Array.isArray(ctx.z.letzte_liste) && ctx.z.letzte_liste.length) {
    const b = absicht.bezug(rest, ctx.z.letzte_liste);
    if (b && b.id) id = b.id;
  }
  const liste = await dialog.objekteListe(ctx.userId, 40);
  if (!id && liste.length) {
    const g = dialog.objektRaten(text, liste);
    if (g.art === 'eindeutig') id = g.objekt.id;
  }
  if (!id && ctx.z && ctx.z.letztes_objekt && /\b(daf(ü|ue)r|dazu|da|dort|das objekt|dieses objekt|hier)\b/i.test(text)) {
    id = ctx.z.letztes_objekt;
  }
  if (id) {
    const o = await objektLesen(ctx.userId, id);
    if (o) return zeigen(ctx, o, arten);
  }
  if (!liste.length) {
    await ctx.sag('Ich sehe noch keine Objekte in deinem Konto. Leg zuerst eines an, dann hole ich die Zuständigkeiten.', {});
    return;
  }
  await ctx.merkeListe(liste.map((x) => x.id));
  const zeilen = liste.map((x, i) => (i + 1) + '. ' + h(x.adresse || 'ohne Adresse'));
  for (const n of zuNachrichten(['<b>Für welches Objekt?</b>'].concat(zeilen.join('\n'),
    ['Schreib die Nummer oder die Adresse.']))) {
    await ctx.sag(n, { html: true });
  }
  await merke(ctx, null, { schritt: 'objekt', arten: arten, liste: liste.map((x) => x.id) });
  await ctx.notiz('Objektliste für die Unterlagen-Anfrage gezeigt (' + liste.length + ' Objekte).');
}

/* ── Antworten im laufenden Zustand ──────────────────────────────────────
 *
 * Gibt true zurück, wenn die Nachricht hierher gehörte. Alles andere
 * beendet den Zustand und geht ganz normal weiter (Agent, Liste, …) — eine
 * Frage zwischendurch darf nicht als Nummer gelesen werden. */
async function weiter(ctx, text) {
  const e = aktiv(ctx.z);
  if (!e) return false;
  const t = String(text || '').trim();

  if (e.schritt === 'objekt') {
    const ids = Array.isArray(e.liste) ? e.liste : [];
    let id = null;
    const b = absicht.bezug(t, ids);
    if (b && b.fehler === 'ausserhalb') {
      await ctx.sag('Die Liste hat ' + b.laenge + ' Einträge — eine ' + b.genannt + ' gibt es darin nicht.', {});
      return true;
    }
    if (b && b.id) id = b.id;
    if (!id) {
      const liste = await dialog.objekteListe(ctx.userId, 40);
      const g = dialog.objektRaten(t, liste);
      if (g.art === 'eindeutig') id = g.objekt.id;
      else if (g.art === 'mehrdeutig') {
        await ctx.sag('Das passt zu mehreren: ' + g.kandidaten.map((k) => k.adresse).join(' · ') + '. Welche Nummer?', {});
        return true;
      }
    }
    if (!id) { await ctx.setze({ modus: null }); return false; }
    const o = await objektLesen(ctx.userId, id);
    if (!o) { await ctx.setze({ modus: null }); return false; }
    await zeigen(ctx, o, e.arten || null);
    return true;
  }

  /* schritt 'wahl' */
  const o = await objektLesen(ctx.userId, ctx.z.objekt_id);
  if (!o) { await ctx.setze({ modus: null }); return false; }

  if (/^(verschickt|gesendet|abgeschickt|raus|ist raus|erledigt)\b/i.test(t)) {
    if (!e.letzte_anfrage) {
      await ctx.sag('Ich habe hier noch keinen Entwurf erzeugt, den ich als gesendet vermerken könnte.', {});
      return true;
    }
    const a = await U.anfrageStatus(ctx.userId, e.letzte_anfrage, 'gesendet');
    await ctx.sag(a ? 'Vermerkt: ' + U.ARTEN_MAP[a.art].name + ' für ' + o.adresse + ' gesendet am ' + datum(a.gesendet_am) + '.'
      : 'Den Vorgang finde ich nicht mehr.', {});
    await merke(ctx, o.id, Object.assign({}, e, { letzte_anfrage: null }));
    return true;
  }

  const such = /^(such|suche|ermittle|finde|recherchiere)\b(.*)$/i.exec(t);
  if (such) {
    const rest = such[2] || '';
    let ziel = [];
    if (/\balle\b|\bfehlende\b|^\s*$/i.test(rest)) ziel = U.ARTEN.map((a) => a.id);
    else {
      (rest.match(/\d+/g) || []).forEach((n) => { const a = U.ARTEN[Number(n) - 1]; if (a) ziel.push(a.id); });
      ziel = ziel.concat(artenIm(rest));
    }
    if (!ziel.length) { await ctx.sag('Welche Nummer soll ich suchen? Zum Beispiel „suche 2“ oder „suche alle“.', {}); return true; }
    await suchen(ctx, o, ziel.filter((a, i, l) => l.indexOf(a) === i));
    return true;
  }

  if (/^(zur(ü|ue)ck|(ü|ue)bersicht|liste|nochmal|zeig)\b/i.test(t)) { await zeigen(ctx, o, null); return true; }

  const nr = /^\s*(\d{1,2})\s*[.)]?\s*$/.exec(t);
  let artId = null;
  if (nr) {
    const a = U.ARTEN[Number(nr[1]) - 1];
    if (!a) { await ctx.sag('Die Nummern gehen von 1 bis ' + U.ARTEN.length + '.', {}); return true; }
    artId = a.id;
  } else {
    const genannt = artenIm(t);
    if (genannt.length === 1 && t.length < 60) artId = genannt[0];
  }
  if (artId) { await entwurf(ctx, o, artId); return true; }

  /* Etwas anderes: Zustand verlassen, normal weiter. */
  await ctx.setze({ modus: null });
  return false;
}

module.exports = {
  MODUS, erkenne, artenIm, start, weiter, aktiv,
  /* für die Prüfstrecke */
  uebersicht, block, empfaengerVon, kopienVon, zuNachrichten, objektLesen, suchen
};
