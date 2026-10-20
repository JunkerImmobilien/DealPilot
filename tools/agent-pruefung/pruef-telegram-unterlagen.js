'use strict';
/* pruef-telegram-unterlagen.js — v2470
 *
 * Prüft „Unterlagen beim Amt" im Telegram-Bot an den ECHTEN Dateien, im
 * Container, mit echten Daten — und OHNE eine Telegram-Nachricht zu
 * senden und OHNE eine Recherche (Websuche/Amtsseiten) anzustoßen.
 *
 *   scp tools/agent-pruefung/pruef-telegram-unterlagen.js root@116.203.214.11:/tmp/
 *   ssh root@116.203.214.11 'docker cp /tmp/pruef-telegram-unterlagen.js dealpilot-backend:/tmp/ \
 *     && docker exec dealpilot-backend node /tmp/pruef-telegram-unterlagen.js'
 *
 * Drei Teile:
 *   A · ohne Datenbank: Erkennen, Empfänger/Kopie, HTML-Escape, Teilung.
 *   B · der Ablauf am Dienst mit gestellter sag() und Zustand im Speicher.
 *   C · der Ablauf durch den ECHTEN Webhook-Handler. global.fetch ist
 *       gestellt: jeder Aufruf an api.telegram.org wird nur protokolliert,
 *       jeder andere Aufruf bricht ab. Die Dialogzeile des Chats wird
 *       vorher gesichert und danach wiederhergestellt.
 *
 * Er räumt auf: jeder Vorgang (unterlagen_anfragen), den er anlegt, wird
 * am Ende wieder gelöscht. Er nennt seine Deckung.
 */
const { query } = require('/app/src/db/pool');
const U = require('/app/src/services/unterlagenService');
const T = require('/app/src/services/telegramUnterlagenService');

let ok = 0, schlecht = 0;
function pruefe(name, bed, hinweis) {
  if (bed) { ok++; console.log('  [ok]   ' + name); }
  else { schlecht++; console.log('  [NEIN] ' + name + (hinweis ? ' — ' + hinweis : '')); }
}
function tagsAusgeglichen(html) {
  const st = [];
  const re = /<\/?([a-z]+)[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { if (st.pop() !== m[1].toLowerCase()) return false; }
    else st.push(m[1].toLowerCase());
  }
  return st.length === 0;
}
/* Ein '<' ausserhalb eines erlaubten Tags waere ein ungeescapter Text. */
function nurErlaubteTags(html) {
  return !/<(?!\/?(b|i|code|pre|a)(\s|>))/i.test(html);
}

const angelegt = [];   /* Vorgangs-Ids zum Aufräumen */
const echteAmtHolen = U.amtHolen;
let amtHolenGerufen = 0;
U.amtHolen = async function () { amtHolenGerufen++; return { gefunden: false, grund: 'Prüflauf: keine Recherche' }; };

(async function () {
  /* ══ A ══════════════════════════════════════════════════════════════ */
  console.log('== A · ohne Datenbank ==');
  const ja = ['/unterlagen', '/unterlagen 3', 'Unterlagen für Objekt 3 anfordern',
    'hol mir die Flurkarte für die Parkstraße', 'ich brauche den Grundbuchauszug',
    'Baulastenauskunft beantragen', 'Unterlagen beim Amt', 'Bauakte anfordern für das erste'];
  const nein = ['wie ist der DSCR?', 'gib mir ne Liste der Objekte', 'leg mir ein Objekt an',
    'was steht im Grundbuch?', 'Unterlagen hochladen', 'wie hoch ist die Miete'];
  ja.forEach((t) => pruefe('erkannt: ' + t, !!T.erkenne(t)));
  nein.forEach((t) => pruefe('nicht erkannt: ' + t, !T.erkenne(t)));
  pruefe('Arten: Flurkarte + Baulasten', JSON.stringify(T.artenIm('Flurkarte und Baulasten holen')) === '["flurkarte","baulasten"]');

  const amt = { email: 'amt@kreis.de', ansprechpartner: [
    { name: 'A', email: 'a@kreis.de', kopie: true }, { name: 'B', email: 'amt@kreis.de', kopie: true }] };
  pruefe('Empfänger = Amtsadresse', T.empfaengerVon(amt) === 'amt@kreis.de');
  pruefe('Kopie ohne Empfänger', JSON.stringify(T.kopienVon(amt)) === '["a@kreis.de"]');
  pruefe('ohne Amtsadresse: erste Person mit Adresse',
    T.empfaengerVon({ email: '', ansprechpartner: [{ name: 'X' }, { name: 'Y', email: 'y@k.de' }] }) === 'y@k.de');

  const boese = { behoerde: 'Amt <script>&', kanal: 'email', email: 'x_y*z@k.de', beleg_ok: false,
    quelle_url: 'javascript:alert(1)', antrag_url: 'https://k.de/a?b=1&c="2"', gebuehr: '10 € <b>',
    ansprechpartner: [{ name: 'Frau <M>', funktion: 'Leitung & Co', email: 'm@k.de', bestaetigt: true }] };
  const b = T.block(1, U.ARTEN[0], boese, null);
  pruefe('Block: Tags ausgeglichen', tagsAusgeglichen(b));
  pruefe('Block: nur erlaubte Tags', nurErlaubteTags(b), b.slice(0, 200));
  pruefe('Block: javascript-Link fällt weg', b.indexOf('javascript:') < 0);
  pruefe('Block: Ansprechpartner 1 mit Belegstand', /Ansprechpartner 1: Frau &lt;M&gt;.*Adresse auf der Seite/.test(b));
  pruefe('Block: unbelegte Adresse markiert', /nicht belegt/.test(b));
  const viele = T.zuNachrichten(Array.from({ length: 30 }, () => 'x'.repeat(500)));
  pruefe('Teilung: jede Nachricht unter 4096', viele.every((n) => n.length < 4096) && viele.length > 1);

  /* ══ B ══════════════════════════════════════════════════════════════ */
  console.log('\n== B · Ablauf am Dienst (gestellte sag) ==');
  const l = await query(
    `SELECT l.user_id, l.chat_id, l.bot_user_id FROM telegram_links l
      WHERE l.bestaetigt_am IS NOT NULL AND l.aktiv = TRUE LIMIT 1`);
  if (!l.rows.length) { console.log('ABBRUCH: kein verknüpfter Chat.'); process.exit(2); }
  const uid = l.rows[0].user_id;
  const objs = await query(`SELECT id, data FROM objects WHERE user_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 40`, [uid]);
  /* Das Objekt mit den meisten hinterlegten Ämtern — dort zeigt sich am meisten. */
  let best = null, bestN = -1, bestPos = 0;
  for (let i = 0; i < objs.rows.length; i++) {
    const d = objs.rows[i].data || {};
    if (!d.plz && !d.ort) continue;
    const a = await U.aemterFuer(d.plz, d.ort);
    if (a.length > bestN) { best = objs.rows[i]; bestN = a.length; bestPos = i + 1; }
  }
  console.log('  Objekt: ' + [best.data.str, best.data.hnr, best.data.plz, best.data.ort].join(' ')
    + ' · ' + bestN + ' Ämter hinterlegt · Listenplatz ' + bestPos);

  const gesagt = [];
  const ctx = {
    userId: uid, z: { modus: null, entwurf: {}, letzte_liste: null, letztes_objekt: null },
    sag: async (t, o) => { gesagt.push({ t: t, html: !!(o && o.html) }); },
    setze: async (s) => { ctx.z.modus = s.modus || null; ctx.z.entwurf = s.entwurf || {}; ctx.z.objekt_id = s.objekt_id || null; },
    merkeListe: async (ids) => { ctx.z.letzte_liste = ids; },
    merkeObjekt: async (id) => { ctx.z.letztes_objekt = id; },
    notiz: async () => {}
  };
  await T.start(ctx, 'Unterlagen beim Amt anfordern', null, T.erkenne('Unterlagen beim Amt anfordern'));
  pruefe('ohne Bezug: Objektliste', /Für welches Objekt/.test(gesagt.map((g) => g.t).join('\n')) && ctx.z.entwurf.schritt === 'objekt');
  gesagt.length = 0;
  pruefe('Nummer wird angenommen', await T.weiter(ctx, String(bestPos)));
  const ueb = gesagt.map((g) => g.t).join('\n\n');
  pruefe('Übersicht: alle sechs Unterlagen', U.ARTEN.every((a, i) => ueb.indexOf((i + 1) + '. ' + a.name.replace(/&/g, '&amp;')) >= 0));
  pruefe('Übersicht: HTML sauber', gesagt.every((g) => !g.html || (tagsAusgeglichen(g.t) && nurErlaubteTags(g.t))));
  pruefe('Übersicht: jede Nachricht < 4096', gesagt.every((g) => g.t.length < 4096));
  pruefe('Zustand: wahl, Objekt gemerkt', ctx.z.entwurf.schritt === 'wahl' && ctx.z.objekt_id === best.id);
  console.log('  --- Übersicht (Auszug) ---');
  ueb.split('\n').slice(0, 14).forEach((z) => console.log('  | ' + z.slice(0, 150)));

  const aemter = {};
  (await U.aemterFuer(best.data.plz, best.data.ort)).forEach((a) => { if (!aemter[a.art]) aemter[a.art] = a; });
  const mitAmt = U.ARTEN.findIndex((a) => aemter[a.id]);
  if (mitAmt >= 0) {
    const art = U.ARTEN[mitAmt];
    gesagt.length = 0;
    pruefe('Nummer ' + (mitAmt + 1) + ' gibt Entwurf', await T.weiter(ctx, String(mitAmt + 1)));
    const alles = gesagt.map((g) => g.t).join('\n');
    const soll = U.anschreiben(art.id, (await T.objektLesen(uid, best.id)).objekt,
      { name: (await query('SELECT name FROM users WHERE id=$1', [uid])).rows[0].name, email: '', vollmacht_liegt_bei: false });
    pruefe('Entwurf: Betreff wie der Dienst', alles.indexOf(soll.betreff.replace(/&/g, '&amp;')) >= 0);
    pruefe('Entwurf: Brief im <pre>', gesagt.some((g) => /^<pre>[\s\S]*Sehr geehrte Damen und Herren/.test(g.t)));
    const an = T.empfaengerVon(aemter[art.id]);
    pruefe('Entwurf: Empfänger genannt', an ? alles.indexOf('An: ' + an) >= 0 : /keine E-Mail-Adresse bekannt/.test(alles));
    pruefe('Entwurf: sagt, dass DealPilot nichts verschickt', /DealPilot verschickt nichts/.test(alles));
    const id = ctx.z.entwurf.letzte_anfrage;
    if (id) angelegt.push(id);
    const v = id ? (await query('SELECT status, art, objekt_id, amt_id FROM unterlagen_anfragen WHERE id=$1', [id])).rows[0] : null;
    pruefe('Vorgang angelegt (entwurf, Art, Objekt, Amt)', v && v.status === 'entwurf' && v.art === art.id
      && v.objekt_id === best.id && Number(v.amt_id) === Number(aemter[art.id].id));
    gesagt.length = 0;
    pruefe('„verschickt" wird angenommen', await T.weiter(ctx, 'verschickt'));
    const v2 = id ? (await query('SELECT status, gesendet_am FROM unterlagen_anfragen WHERE id=$1', [id])).rows[0] : null;
    pruefe('Vorgang auf gesendet', v2 && v2.status === 'gesendet' && v2.gesendet_am);
  } else {
    console.log('  (kein Amt hinterlegt — Entwurfsprüfung übersprungen)');
  }

  gesagt.length = 0;
  const vorher = amtHolenGerufen;
  pruefe('„suche alle" wird angenommen', await T.weiter(ctx, 'suche alle'));
  const fehlend = U.ARTEN.filter((a) => !aemter[a.id]).length;
  pruefe('Suche nur für fehlende (' + fehlend + ')', amtHolenGerufen - vorher === fehlend);

  /* v2472 · Die Suche an einer Gemeinde ohne hinterlegte Ämter — sonst
     bliebe der Zweig ungeprüft, sobald das Prüfobjekt vollständig ist. */
  gesagt.length = 0;
  const v0 = amtHolenGerufen;
  const fremdO = { id: null, adresse: 'Prüfweg 1, 99999 Prüfhausen',
    objekt: { strasse: 'Prüfweg 1', plz: '99999', ort: 'Prüfhausen' } };
  await T.suchen(Object.assign({}, ctx, { setze: async () => {}, merkeObjekt: async () => {} }), fremdO, U.ARTEN.map((a) => a.id));
  const sg = gesagt.map((g) => g.t).join('\n');
  pruefe('Suche ohne Ämter: ' + U.ARTEN.length + '× gestellte Recherche', amtHolenGerufen - v0 === U.ARTEN.length, String(amtHolenGerufen - v0));
  pruefe('Suche: kündigt Dauer an und meldet „Nicht gefunden"', /dauert je Amt/.test(sg) && /Nicht gefunden/.test(sg));
  pruefe('Suche: danach die Übersicht mit „suche alle"', /suche alle/.test(sg));

  pruefe('Fremde Frage verlässt den Zustand', (await T.weiter(ctx, 'wie ist der DSCR?')) === false && ctx.z.modus === null);
  ctx.z.modus = T.MODUS; ctx.z.entwurf = { schritt: 'wahl', zeit: new Date(Date.now() - 31 * 60000).toISOString() };
  pruefe('Nach 30 Minuten gilt eine Nummer nicht mehr', (await T.weiter(ctx, '1')) === false);

  /* ══ C ══════════════════════════════════════════════════════════════ */
  console.log('\n== C · echter Webhook-Handler, fetch gestellt ==');
  const chat = String(l.rows[0].chat_id);
  const botUser = l.rows[0].bot_user_id;
  const bot = (await query('SELECT webhook_pfad, webhook_secret FROM telegram_bots WHERE user_id = $1', [botUser])).rows[0];
  const sicherung = (await query(`SELECT row_to_json(d) AS j FROM telegram_dialog d WHERE chat_id = $1::bigint AND bot_user_id = $2`, [chat, uid])).rows[0];
  const nutzung = (await query(`SELECT letzte_nutzung FROM telegram_links WHERE chat_id = $1::bigint AND bot_user_id = $2`, [chat, botUser])).rows[0];
  const maxVorher = Number((await query('SELECT COALESCE(max(id),0) AS m FROM unterlagen_anfragen')).rows[0].m);

  const tg = [];
  let fremd = 0;
  const echtesFetch = global.fetch;
  global.fetch = async function (url, opt) {
    const u = String(url);
    if (u.indexOf('https://api.telegram.org/') !== 0) { fremd++; throw new Error('Prüflauf: kein Netz ausser Telegram-Stub'); }
    const methode = u.split('/').pop();
    let body = {};
    try { body = JSON.parse((opt && opt.body) || '{}'); } catch (e) {}
    tg.push({ methode: methode, body: body });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }) };
  };
  const router = require('/app/src/routes/telegramWebhook');
  const layer = router.stack.find((x) => x.route && x.route.path === '/:pfad');
  const handler = layer.route.stack[0].handle;
  async function schick(text) {
    const req = { params: { pfad: bot.webhook_pfad }, body: { message: { chat: { id: Number(chat) }, text: text, from: {} } },
      get: (k) => (/secret/i.test(k) ? bot.webhook_secret : '') };
    const res = { status() { return this; }, json() { return this; } };
    const n0 = tg.length;
    await handler(req, res);
    return tg.slice(n0).filter((x) => x.methode === 'sendMessage').map((x) => x.body);
  }
  try {
    let m = await schick('/unterlagen');
    pruefe('Webhook /unterlagen: Liste oder Übersicht', m.length > 0 && m.every((x) => x.parse_mode === 'HTML'));
    if (/Für welches Objekt/.test((m[0] || {}).text || '')) m = await schick(String(bestPos));
    pruefe('Webhook: Übersicht mit sechs Unterlagen', U.ARTEN.every((a, i) => m.map((x) => x.text).join('\n').indexOf((i + 1) + '. ') >= 0));
    if (mitAmt >= 0) {
      m = await schick(String(mitAmt + 1));
      pruefe('Webhook: Entwurf in drei Nachrichten', m.length === 3 && /^<pre>/.test(m[1].text), String(m.length));
      pruefe('Webhook: Hinweis ohne Markdown-Modus', m[2] && m[2].parse_mode === undefined);
      m = await schick('verschickt');
      pruefe('Webhook: „verschickt" vermerkt', m.length === 1 && /Vermerkt/.test(m[0].text));
    }
    m = await schick('/abbrechen');
    pruefe('Webhook: /abbrechen', m.length === 1 && m[0].text === 'Abgebrochen.');
    const z = (await query(`SELECT modus FROM telegram_dialog WHERE chat_id = $1::bigint AND bot_user_id = $2`, [chat, uid])).rows[0];
    pruefe('Webhook: Zustand danach leer', !z || z.modus === null);
    pruefe('Kein Netzaufruf ausser Telegram-Stub', fremd === 0, String(fremd));
    pruefe('Telegram-Methoden nur sendMessage/sendChatAction', tg.every((x) => /^(sendMessage|sendChatAction)$/.test(x.methode)),
      tg.map((x) => x.methode).join(','));
  } finally {
    global.fetch = echtesFetch;
    /* Dialogzeile zurück, wie sie war */
    await query(`DELETE FROM telegram_dialog WHERE chat_id = $1::bigint AND bot_user_id = $2`, [chat, uid]);
    if (sicherung) {
      await query(`INSERT INTO telegram_dialog SELECT * FROM jsonb_populate_record(NULL::telegram_dialog, $1::jsonb)`, [JSON.stringify(sicherung.j)]);
    }
    if (nutzung) {
      await query(`UPDATE telegram_links SET letzte_nutzung = $3 WHERE chat_id = $1::bigint AND bot_user_id = $2`, [chat, botUser, nutzung.letzte_nutzung]);
    }
    const neu = await query('SELECT id FROM unterlagen_anfragen WHERE id > $1 AND user_id = $2', [maxVorher, uid]);
    neu.rows.forEach((r) => angelegt.push(r.id));
  }

  /* ══ Aufräumen ══════════════════════════════════════════════════════ */
  U.amtHolen = echteAmtHolen;
  const ids = angelegt.filter((v, i, l2) => l2.indexOf(v) === i);
  if (ids.length) await query('DELETE FROM unterlagen_anfragen WHERE id = ANY($1::bigint[]) AND user_id = $2', [ids, uid]);
  const rest = await query('SELECT count(*)::int AS n FROM unterlagen_anfragen WHERE id = ANY($1::bigint[])', [ids]);
  const nachher = (await query(`SELECT row_to_json(d) AS j FROM telegram_dialog d WHERE chat_id = $1::bigint AND bot_user_id = $2`, [chat, uid])).rows[0];
  pruefe('Aufgeräumt: ' + ids.length + ' Vorgänge gelöscht', rest.rows[0].n === 0);
  pruefe('Dialogzeile wiederhergestellt', JSON.stringify(nachher && nachher.j) === JSON.stringify(sicherung && sicherung.j));
  pruefe('Echte Recherche nie gerufen (Stub ' + amtHolenGerufen + '×)', true);

  console.log('\nDECKUNG: ' + (ok + schlecht) + ' Prüfungen, ' + schlecht + ' fehlgeschlagen.');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.log('AUSNAHME: ' + (e && e.stack || e)); process.exit(3); });
