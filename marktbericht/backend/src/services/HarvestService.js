// HarvestService.js — Ernte der Wertermittlungsparameter.
// ────────────────────────────────────────────────────────────────────────────
// Etappe 1: Finden und Registrieren. Extraktion kommt getrennt, weil Discovery
// billig ist und oft laufen soll, Extraktion teuer und selten.
//
// GRENZE, die nicht verschoben wird: Quellen mit zugang='kostenpflichtig' oder
// 'auf_anfrage' werden NIE abgerufen. Sie stehen im Verzeichnis, damit sichtbar
// bleibt, warum ein Kreis keinen amtlichen Wert traegt — und damit man ihn
// gezielt kaufen kann.
//
// Wir sind Gast auf Behoerdenservern: ein Abruf pro Sekunde, eigene Kennung
// mit Kontakt, robots.txt wird respektiert.

/* v1031 · q() liefert die ZEILEN direkt (res.rows), kein {rows}-Objekt.
 * Ich hatte ueberall .rows drangehaengt — deshalb "Cannot read properties
 * of undefined (reading '0')" beim ersten echten Aufruf. Der Stub in meinen
 * Tests gab {rows:[]} zurueck und hat den Fehler verdeckt: ein Mock, der
 * nicht die echte Schnittstelle abbildet, prueft nichts. */
import { q, q1 } from '../lib/db.js';
import { httpText } from '../lib/http.js';

const PAUSE_MS = 1000;                    // ein Abruf je Sekunde und Host
const GESPERRT = ['kostenpflichtig', 'auf_anfrage'];

function kennung() {
  return {
    'User-Agent': process.env.HARVEST_USER_AGENT
      || 'DealPilot-Harvest/1.0 (Immobilienbewertung; +https://dealpilot.immo; info@dealpilot.immo)',
    'Accept': 'text/html,application/pdf;q=0.9,*/*;q=0.8',
  };
}

const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

/* PDF-Links, die nach einem Marktbericht aussehen. Bewusst eng: lieber einen
 * Treffer verpassen als hundert Formulare einsammeln. */
/* v1032 · Erweitert. Berlin serviert sein PDF als "04-03-010-2400.pdf" —
 * kein Wort im Dateinamen. Deshalb zaehlt jetzt auch der Pfad und die
 * Seite, auf der der Link steht. */
const MUSTER = /(grundst[uü]cksmarktbericht|marktbericht|immobilienmarkt|marktinformation|marktanalyse|grundstuecksmarkt|bodenrichtwert)/i;

/* Unterseiten, die es zu verfolgen lohnt. Genau eine Ebene tief — die
 * Portale sind flach genug, und tiefer wuerde man den halben Auftritt
 * einsammeln. */
const UNTERSEITE = /(marktbericht|marktinformation|marktanalyse|grundstuecksmarkt|grundst[uü]cksmarkt|ver[oö]ffentlichung|publikation|download)/i;

function unterseiten(html, basis) {
  const out = new Set();
  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const roh = m[1];
    if (/\.(pdf|jpg|png|zip|docx?)$/i.test(roh)) continue;
    if (!UNTERSEITE.test(roh)) continue;
    let u;
    try { u = new URL(roh, basis); } catch { continue; }
    if (u.host !== new URL(basis).host) continue;   // nicht auf fremde Hosts
    out.add(u.href.split('?')[0]);
  }
  return [...out].slice(0, 4);   // hoechstens vier je Quelle
}

function linksAusHtml(html, basis) {
  const out = [];
  const re = /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let u = m[1];
    try { u = new URL(u, basis).href; } catch { continue; }
    // Titel = Linktext in der Naehe, grob aus dem Umfeld geschnitten
    const umfeld = html.slice(Math.max(0, m.index - 300), m.index + 300);
    const titel = (umfeld.match(/>([^<>]{8,120})</) || [])[1] || '';
    /* Drittes Kriterium: die Seite selbst. Liegt ein PDF auf einer
     * Marktbericht-Seite, ist es sehr wahrscheinlich einer — auch wenn der
     * Dateiname nur aus Ziffern besteht. */
    if (MUSTER.test(u) || MUSTER.test(titel) || MUSTER.test(basis)) {
      out.push({ url: u, titel: titel.trim().replace(/\s+/g, ' ').slice(0, 200) });
    }
  }
  return out;
}

function jahrgangAus(text) {
  const m = String(text || '').match(/(20\d{2})/g);
  if (!m) return null;
  const j = Math.max(...m.map(Number));
  const jetzt = new Date().getFullYear();
  return (j >= 2008 && j <= jetzt + 1) ? j : null;
}

export const HarvestService = {

  /**
   * Discovery ueber alle abrufbaren Quellen.
   * @param {object} o
   * @param {number} [o.limit]  hoechstens so viele Quellen je Lauf
   * @param {string} [o.land]   auf ein Bundesland beschraenken
   * @param {boolean} [o.archiv] alle Jahrgaenge sammeln statt nur neue
   */
  /* WADM-9 · quelleId erlaubt das gezielte Anstossen aus dem Admin. */
  async discover({ limit = 20, land = null, archiv = false, quelleId = null } = {}) {
    const bed = ["status = 'aktiv'", `zugang NOT IN ('${GESPERRT.join("','")}')`, 'portal_url IS NOT NULL'];
    const args = [];
    if (land) { args.push(land); bed.push(`bundesland = $${args.length}`); }
    /* WADM-10 */
    if (quelleId) { args.push(quelleId); bed.push(`id = $${args.length}::bigint`); }
    args.push(limit);

    const r = await q(
      `SELECT id, name, bundesland, portal_url, zugang
         FROM mb.gaa_sources
        WHERE ${bed.join(' AND ')}
        ORDER BY letzter_check NULLS FIRST
        LIMIT $${args.length}`, args);

    const bericht = { geprueft: 0, neu: 0, uebersprungen: 0, fehler: [], quellen: [] };

    for (const src of r || []) {
      bericht.geprueft++;
      let html = null;
      try {
        const res = await httpText(src.portal_url, { timeoutMs: 20000, retries: 1, headers: kennung() });
        html = res.text;
      } catch (e) {
        bericht.fehler.push(`${src.name}: ${String(e.message).slice(0, 80)}`);
        await q('UPDATE mb.gaa_sources SET letzter_check = now(), status = $2 WHERE id = $1',
          [src.id, 'portal_defekt']).catch(() => {});
        await schlafen(PAUSE_MS);
        continue;
      }

      let gefunden = linksAusHtml(html, src.portal_url);

      /* v1034 · ZWEI Ebenen tief. Eine reichte nicht: Berlins Startseite
       * traegt gar keine PDFs, nur den Verteiler "/marktinformationen/", und
       * die Berichte liegen darunter in "/marktanalyse/". Gemessen mit
       * --portal 3.
       *
       * Begrenzt auf hoechstens 20 Seiten je Quelle, ein Abruf je Sekunde.
       * Tiefer zu gehen hiesse, den halben Behoerdenauftritt einzusammeln. */
      const gesehenSeiten = new Set([src.portal_url]);
      const warteschlange = unterseiten(html, src.portal_url).map((u) => ({ u, tiefe: 1 }));
      let abgerufen = 0;

      while (warteschlange.length && abgerufen < 20) {
        const { u, tiefe } = warteschlange.shift();
        if (gesehenSeiten.has(u)) continue;
        gesehenSeiten.add(u);
        await schlafen(PAUSE_MS);
        abgerufen++;
        try {
          const r2 = await httpText(u, { timeoutMs: 20000, retries: 0, headers: kennung() });
          gefunden = gefunden.concat(linksAusHtml(r2.text, u));
          if (tiefe < 2) {
            unterseiten(r2.text, u).forEach((u2) => {
              if (!gesehenSeiten.has(u2)) warteschlange.push({ u: u2, tiefe: tiefe + 1 });
            });
          }
        } catch (e) { /* eine tote Unterseite kippt den Lauf nicht */ }
      }
      bericht.seiten = (bericht.seiten || 0) + 1 + abgerufen;
      /* Doppelte ueber die URL entfernen. */
      const gesehen = new Set();
      gefunden = gefunden.filter((g) => (gesehen.has(g.url) ? false : gesehen.add(g.url)));
      let neuHier = 0;
      for (const g of gefunden) {
        const jg = jahrgangAus(g.titel) || jahrgangAus(g.url);
        if (!archiv && jg && jg < new Date().getFullYear() - 2) continue;
        try {
          const ins = await q1(
            `INSERT INTO mb.gaa_documents (source_id, url, titel, jahrgang, lauf_typ)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (url) DO NOTHING
             RETURNING id`,
            [src.id, g.url, g.titel || null, jg, archiv ? 'archiv' : 'regel']);
          if (ins && ins.id) { neuHier++; bericht.neu++; }
        } catch (e) { /* Doppelfund ist kein Fehler */ }
      }

      await q(`UPDATE mb.gaa_sources
                  SET letzter_check = now(),
                      letzter_fund = CASE WHEN $2 > 0 THEN CURRENT_DATE ELSE letzter_fund END,
                      status = 'aktiv'
                WHERE id = $1`, [src.id, neuHier]).catch(() => {});

      bericht.quellen.push({ name: src.name, land: src.bundesland, gefunden: gefunden.length, neu: neuHier });
      await schlafen(PAUSE_MS);
    }

    // Gesperrte der Vollstaendigkeit halber zaehlen
    const g = await q(
      `SELECT count(*)::int AS n FROM mb.gaa_sources WHERE zugang = ANY($1)`, [GESPERRT]).catch(() => null);
    bericht.uebersprungen = g && g[0] ? g[0].n : 0;
    return bericht;
  },

  /**
   * Wert von Hand eintragen — der Weg fuer gekaufte Berichte.
   * Landet als Stufe A in mb.wert_parameter, mit Quellenangabe.
   */
  async wertEintragen({ ags, objektart, typ = 'lzs', wert, stichtag, quelle, modellversion = 'immowertv2021' }) {
    if (!ags || !objektart || wert == null) throw new Error('ags, objektart und wert sind Pflicht');
    const r = await q1(
      `INSERT INTO mb.wert_parameter
         (ags, ags_ebene, objektart, typ, wert, einheit, qualitaet, quelle_text, modellversion, stichtag, gueltig_von, geprueft_am)
       VALUES ($1,'kreis',$2,$3,$4,
               CASE WHEN $3 = 'lzs' THEN 'prozent' ELSE 'faktor' END,
               'A',$5,$6,$7::date, COALESCE($7::date, CURRENT_DATE), now())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [String(ags).slice(0, 5), objektart, typ, wert, quelle || 'manuell aus Grundstuecksmarktbericht',
       modellversion, stichtag || null]);
    return r ? { id: r.id, angelegt: true } : { angelegt: false, grund: 'Fassung existiert bereits' };
  },

  /**
   * v1036 · Zustaendigen Gutachterausschuss aus einem BORIS-Abruf vermerken.
   *
   * BORIS liefert Name, Nummer und Gemeindeschluessel gratis mit. Damit muss
   * niemand 400 Kreise recherchieren — die Liste waechst mit der Nutzung, und
   * zwar genau um die Kreise, in denen tatsaechlich bewertet wird.
   *
   * Die Adresse des Berichts kennen wir nicht; sie wird beim ersten Import
   * oder von Hand nachgetragen. Dafuer steht der Kreis schon mal da, mit
   * seiner Stufe — und man sieht, wo noch Stufe D liegt.
   */
  async merkeAusschuss({ name, nummer, ags, bundesland, gemeinde, hinweis_url }) {
    if (!name || !bundesland) return { angelegt: false, grund: 'Name oder Land fehlt' };

    /* v1037 · BORIS nennt den Ausschuss anders als unser Startbestand:
     * "Landkreis Meissen" gegen "Gutachterausschuss Landkreis Meissen", und
     * mal mit ss, mal mit ß. Ohne Normalisierung stand Meissen doppelt in der
     * Liste — einmal kostenpflichtig mit Kreis, einmal unbekannt ohne.
     *
     * Deshalb: erst ueber den KREIS suchen (der ist eindeutig), dann ueber
     * den normalisierten Namen. Der Name ist die schwaechere Kennung. */
    const norm = (t) => String(t || '')
      .toLowerCase()
      .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/gutachterausschuss|gutachterausschuß|fuer grundstueckswerte|f. grundstueckswerte/g, '')
      .replace(/[^a-z0-9]/g, '');

    let vorhanden = null;
    if (ags) {
      vorhanden = await q1(
        'SELECT id, name, ags_liste FROM mb.gaa_sources WHERE $1 = ANY(ags_liste) AND bundesland = $2',
        [ags, bundesland]);
    }
    if (!vorhanden) {
      const kandidaten = await q(
        'SELECT id, name, ags_liste FROM mb.gaa_sources WHERE bundesland = $1', [bundesland]);
      const n = norm(name);
      vorhanden = (kandidaten || []).find((k) => norm(k.name) === n
        || norm(k.name).includes(n) || n.includes(norm(k.name))) || null;
    }

    if (vorhanden) {
      /* Kreis anfuegen, falls neu — ein Ausschuss kann mehrere betreuen. */
      if (ags && !(vorhanden.ags_liste || []).includes(ags)) {
        await q(`UPDATE mb.gaa_sources
                    SET ags_liste = array_append(COALESCE(ags_liste, ARRAY[]::text[]), $2)
                  WHERE id = $1`, [vorhanden.id, ags]).catch(() => {});
      }
      return { angelegt: false, id: vorhanden.id, grund: 'bereits erfasst' };
    }

    const r = await q1(
      `INSERT INTO mb.gaa_sources
         (name, bundesland, ebene, ags_liste, zugang, notiz, status)
       VALUES ($1,$2,'kreis',$3,'unbekannt',$4,'aktiv')
       ON CONFLICT (name, bundesland) DO NOTHING
       RETURNING id`,
      [name, bundesland, ags ? [ags] : null,
       'Automatisch erfasst beim Bodenrichtwert-Abruf'
       + (gemeinde ? ' (' + gemeinde + ')' : '')
       + (nummer ? ', GAA-Nr. ' + nummer : '')
       + (hinweis_url ? '. Hinweise: ' + String(hinweis_url).slice(0, 160) : '')]);
    return { angelegt: !!r, id: r ? r.id : null };
  },

  /* Diagnose: was liegt auf dem Portal? Zeigt ALLE PDF-Links, auch die
   * nicht passenden, samt Grund. Ohne das raet man ueber fremde Seiten. */
  async pruefePortal(sourceId) {
    const src = await q1('SELECT id, name, bundesland, portal_url FROM mb.gaa_sources WHERE id = $1', [sourceId]);
    if (!src) return { fehler: 'Quelle nicht gefunden' };
    const out = { quelle: src.name, portal: src.portal_url, seiten: [], pdfs: [] };
    let html;
    try {
      const r = await httpText(src.portal_url, { timeoutMs: 20000, retries: 1, headers: kennung() });
      html = r.text;
      out.bytes = html.length;
    } catch (e) { return { ...out, fehler: e.message }; }

    const alleP = [];
    const re = /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      try { alleP.push(new URL(m[1], src.portal_url).href); } catch {}
    }
    out.pdfs = [...new Set(alleP)].slice(0, 25).map((u) => ({ url: u, passt: MUSTER.test(u) }));
    /* Diagnose zeigt beide Ebenen — sonst sieht man nicht, wo der Bericht
     * wirklich liegt. */
    out.seiten = unterseiten(html, src.portal_url);
    out.seiten2 = [];
    for (const u of out.seiten.slice(0, 3)) {
      await schlafen(PAUSE_MS);
      try {
        const r2 = await httpText(u, { timeoutMs: 15000, retries: 0, headers: kennung() });
        const p2 = [];
        const re2 = /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
        let m2;
        while ((m2 = re2.exec(r2.text)) !== null) {
          try { p2.push(new URL(m2[1], u).href); } catch {}
        }
        out.seiten2.push({ seite: u, unter: unterseiten(r2.text, u), pdfs: [...new Set(p2)].slice(0, 6) });
      } catch (e) { out.seiten2.push({ seite: u, fehler: String(e.message).slice(0, 60) }); }
    }
    out.treffer_regel = linksAusHtml(html, src.portal_url).length;
    return out;
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * KI-RECHERCHE — mit Quellenzwang.
   * ───────────────────────────────────────────────────────────────────────
   * Ein Modell, das man nach einem Liegenschaftszinssatz fragt, NENNT einen.
   * Plausibel, selbstsicher, moeglicherweise erfunden. Diese Zahl landet neben
   * einem Paragraphenzitat in einem Bankdossier — ein halber Punkt Abweichung
   * verschiebt den Ertragswert um acht Prozent.
   *
   * Deshalb vier Sperren, die alle greifen muessen:
   *   1. Websuche ist Pflicht. Ohne Suchwerkzeug keine Anfrage.
   *   2. Ohne Quellen-URL wird das Ergebnis verworfen — kommentarlos.
   *   3. Die URL muss erreichbar sein (HEAD-Probe).
   *   4. Der Wert muss im Plausibilitaetsband liegen.
   *
   * Und selbst dann: gespeichert wird als Stufe C mit Pruefkennzeichen, NIE
   * als A. Stufe A bleibt dem amtlichen Beleg vorbehalten. Erst wenn du den
   * Wert gegen die Quelle geprueft hast, wird daraus ein A.
   * ═══════════════════════════════════════════════════════════════════════ */
  async kiRecherche({ ags, objektart, typ = 'lzs', kreisname = null }) {
    const cfgMod = await import('../lib/config.js');
    const cfg = cfgMod.cfg;
    if (!cfg.ai.openaiKey) throw new Error('Kein OPENAI_API_KEY — KI-Recherche nicht moeglich.');
    if (!ags || !objektart) throw new Error('ags und objektart sind Pflicht');

    const BAND = { lzs: [0.5, 7.0], sachwertfaktor: [0.4, 2.2], vergleichsfaktor: [5, 45] };
    const band = BAND[typ] || [0, 1e9];

    const was = typ === 'lzs' ? 'Liegenschaftszinssatz' : typ === 'sachwertfaktor' ? 'Sachwertfaktor' : typ;
    const frage = [
      `Suche den ${was} fuer ${kreisname || ('den Kreis mit AGS ' + ags)}, Objektart ${objektart}.`,
      'Quelle muss der Grundstuecksmarktbericht des zustaendigen Gutachterausschusses sein',
      'oder eine amtliche Veroeffentlichung daraus.',
      '',
      'ANTWORTE AUSSCHLIESSLICH mit JSON, ohne Markdown, in dieser Form:',
      '{"gefunden":true|false,"wert":Zahl|null,"stichtag":"JJJJ-MM-TT"|null,',
      '"quelle_url":"https://..."|null,"quelle_text":"..."|null,"zitat":"..."|null}',
      '',
      'REGELN, die du nicht brechen darfst:',
      '- Wenn du keine belegte Quelle findest: gefunden=false. Schaetze NICHT.',
      '- quelle_url muss die Seite oder das PDF sein, auf der der Wert steht.',
      '- zitat ist der Satz oder die Tabellenzeile mit dem Wert, hoechstens 15 Woerter.',
      '- Kein Wert aus deinem Gedaechtnis. Nur was du in der Suche gelesen hast.',
    ].join('\n');

    let roh;
    try {
      const res = await httpText(cfg.ai.base + '/responses', {
        method: 'POST', timeoutMs: 90000, retries: 0,
        headers: { Authorization: 'Bearer ' + cfg.ai.openaiKey, 'Content-Type': 'application/json' },
        body: {
          model: cfg.ai.model,
          input: frage,
          tools: [{ type: 'web_search' }],       // ohne Suche keine Recherche
          temperature: 0,
        },
      });
      roh = res.text;
    } catch (e) {
      return { uebernommen: false, grund: 'Anfrage fehlgeschlagen: ' + String(e.message).slice(0, 120) };
    }

    let d;
    try {
      const j = JSON.parse(roh);
      const txt = (j.output_text)
        || (Array.isArray(j.output) ? j.output
              .flatMap((o) => (o.content || []))
              .map((c) => c.text || '')
              .join('') : '');
      d = JSON.parse(String(txt).replace(/```json|```/g, '').trim());
    } catch (e) {
      return { uebernommen: false, grund: 'Antwort nicht auswertbar' };
    }

    /* Sperre 2 — ohne Quelle kein Wert. */
    if (!d.gefunden || d.wert == null) return { uebernommen: false, grund: 'Kein belegter Wert gefunden' };
    if (!d.quelle_url || !/^https?:\/\//i.test(String(d.quelle_url))) {
      return { uebernommen: false, grund: 'Keine Quellen-URL — verworfen', vorschlag: d };
    }

    /* Sperre 4 — Plausibilitaetsband. */
    const w = Number(d.wert);
    if (!Number.isFinite(w) || w < band[0] || w > band[1]) {
      return { uebernommen: false, grund: `Wert ${d.wert} ausserhalb des Bandes ${band[0]}–${band[1]}`, vorschlag: d };
    }

    /* Sperre 3 — URL muss erreichbar sein. */
    try {
      await httpText(d.quelle_url, { method: 'HEAD', timeoutMs: 15000, retries: 0, headers: kennung() });
    } catch (e) {
      return { uebernommen: false, grund: 'Quellen-URL nicht erreichbar — verworfen', vorschlag: d };
    }

    /* Stufe C, nicht A. Und mit Pruefkennzeichen. */
    const r = await q1(
      `INSERT INTO mb.wert_parameter
         (ags, ags_ebene, objektart, typ, wert, einheit, qualitaet, quelle_text, quelle_url,
          modellversion, stichtag, gueltig_von, fallzahl)
       VALUES ($1,'kreis',$2,$3,$4,
               CASE WHEN $3 = 'lzs' THEN 'prozent' ELSE 'faktor' END,
               'C',$5,$6,'immowertv2021',$7::date, COALESCE($7::date, CURRENT_DATE), NULL)
       ON CONFLICT DO NOTHING RETURNING id`,
      [String(ags).slice(0, 5), objektart, typ, w,
       'KI-Recherche, UNBESTAETIGT: ' + (d.quelle_text || d.quelle_url).slice(0, 180),
       d.quelle_url, d.stichtag || null]);

    return {
      uebernommen: !!r, id: r ? r.id : null, stufe: 'C',
      wert: w, stichtag: d.stichtag, quelle_url: d.quelle_url, zitat: d.zitat,
      hinweis: 'Als Stufe C gespeichert und NICHT bestaetigt. Nach Pruefung gegen die Quelle '
             + 'mit --wert als Stufe A nachtragen.',
    };
  },

  /** Abdeckung: wie viele Kreise auf welcher Stufe. */
  async status() {
    const quellen = await q(
      `SELECT zugang, count(*)::int AS n FROM mb.gaa_sources GROUP BY zugang ORDER BY 2 DESC`).catch(() => ({ rows: [] }));
    const dok = await q(
      `SELECT status, count(*)::int AS n FROM mb.gaa_documents GROUP BY status ORDER BY 2 DESC`).catch(() => ({ rows: [] }));
    const par = await q(
      `SELECT qualitaet, count(*)::int AS n FROM mb.wert_parameter
        WHERE gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE
        GROUP BY qualitaet ORDER BY 1`).catch(() => ({ rows: [] }));
    const stumm = await q(
      `SELECT name, bundesland, letzter_fund FROM mb.gaa_sources
        /* v1032 · "nie geprueft" ist NICHT "stumm". Vorher standen alle zehn
         * Quellen als stumm da, obwohl die Discovery noch gar nicht gelaufen
         * war — eine Warnung, die immer leuchtet, nimmt nach zwei Wochen
         * niemand mehr ernst. */
        WHERE status = 'aktiv' AND zugang NOT IN ('kostenpflichtig','auf_anfrage')
          AND letzter_check IS NOT NULL
          AND (letzter_fund IS NULL OR letzter_fund < CURRENT_DATE - INTERVAL '18 months')
        ORDER BY letzter_fund NULLS FIRST LIMIT 10`).catch(() => ({ rows: [] }));
    return { quellen: quellen, dokumente: dok, parameter: par, stumme_quellen: stumm };
  },
};
