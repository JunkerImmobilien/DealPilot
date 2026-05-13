'use strict';
/**
 * V63.85: Listing-Scraper für Quick-Check
 * ────────────────────────────────────────
 * Holt eine Inserats-URL (IS24 / Kleinanzeigen / ImmoWelt / etc.) und versucht
 * über Open-Graph-Tags + JSON-LD strukturierte Daten zu extrahieren.
 *
 * Bewusst BEST-EFFORT — bei Layout-Änderungen / Cloudflare-Block / Captcha
 * gibt das Frontend dem User eine klare "manuell eingeben"-Meldung.
 *
 * Kein externes Scraping-Framework (Puppeteer etc.), nur fetch + Regex —
 * damit's nicht crashed wenn Cloudflare aggressive Bot-Detection macht.
 */
const express = require('express');
const router = express.Router();

// Erlaubte Hosts — Whitelist gegen Missbrauch
const ALLOWED_HOSTS = [
  'immobilienscout24.de', 'is24.de',
  'immowelt.de',
  'kleinanzeigen.de', 'ebay-kleinanzeigen.de',
  'immonet.de',
  'meinestadt.de'
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                   '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const TIMEOUT_MS = 12000;

function isAllowedUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch (e) { return false; }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timer);
    if (!r.ok) {
      const e = new Error('HTTP ' + r.status);
      e.status = r.status;
      throw e;
    }
    return await r.text();
  } finally { clearTimeout(timer); }
}

// Extraktion: Open-Graph + JSON-LD + simple Regex-Heuristik
function parseListing(html, sourceUrl) {
  const result = {
    sourceUrl: sourceUrl,
    title:        null,
    address:      null,
    price:        null,
    livingArea:   null,
    rooms:        null,
    yearBuilt:    null,
    rentNet:      null,    // monatliche Kaltmiete (für Vermietete)
    objectType:   null,
    description:  null,
    image:        null
  };

  // Open-Graph
  function og(prop) {
    const m = html.match(new RegExp('<meta\\s+property=["\']og:' + prop + '["\']\\s+content=["\']([^"\']+)["\']', 'i'));
    return m ? m[1].trim() : null;
  }
  result.title       = og('title') || result.title;
  result.image       = og('image') || result.image;
  result.description = og('description') || result.description;

  // JSON-LD — strukturierte Daten in Schema.org
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(html))) {
    try {
      const json = JSON.parse(m[1]);
      const arr = Array.isArray(json) ? json : [json];
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        if (item.offers && item.offers.price) {
          const p = parseFloat(item.offers.price);
          if (p > 1000 && !result.price) result.price = Math.round(p);
        }
        if (item.address) {
          const a = item.address;
          const parts = [];
          if (a.streetAddress)   parts.push(a.streetAddress);
          if (a.postalCode)      parts.push(a.postalCode);
          if (a.addressLocality) parts.push(a.addressLocality);
          if (parts.length && !result.address) result.address = parts.join(', ');
        }
        if (item.floorSize && item.floorSize.value && !result.livingArea) {
          result.livingArea = parseFloat(item.floorSize.value);
        }
        if (item.numberOfRooms && !result.rooms) {
          result.rooms = parseFloat(item.numberOfRooms.value || item.numberOfRooms);
        }
        if (item['@type'] && !result.objectType) {
          // 'Apartment', 'House', 'SingleFamilyResidence', etc.
          result.objectType = item['@type'];
        }
      }
    } catch (e) { /* malformed JSON-LD - ignore */ }
  }

  // Regex-Fallback für IS24-spezifische Felder
  if (!result.price) {
    const m2 = html.match(/(?:Kaufpreis|Preis)[\s\S]{0,80}?(\d{1,3}(?:[.,\s]\d{3})+|\d{4,})\s*€/i);
    if (m2) {
      const p = parseInt(m2[1].replace(/[.,\s]/g, ''), 10);
      if (p > 1000 && p < 100000000) result.price = p;
    }
  }
  if (!result.livingArea) {
    const m3 = html.match(/(?:Wohnfl(?:ä|a)che|Wohnfl)[\s\S]{0,40}?(\d{1,4}(?:[.,]\d{1,2})?)\s*m\s*[²2]/i);
    if (m3) result.livingArea = parseFloat(m3[1].replace(',', '.'));
  }
  if (!result.rooms) {
    const m4 = html.match(/(?:Zimmer|Anzahl der Zimmer)[\s\S]{0,40}?(\d{1,2}(?:[.,]\d)?)/i);
    if (m4) result.rooms = parseFloat(m4[1].replace(',', '.'));
  }
  if (!result.yearBuilt) {
    const m5 = html.match(/Baujahr[\s\S]{0,30}?(\d{4})/i);
    if (m5) {
      const y = parseInt(m5[1], 10);
      if (y > 1800 && y < 2100) result.yearBuilt = y;
    }
  }
  if (!result.rentNet) {
    // Bei vermieteten Wohnungen: "Aktuelle Nettokaltmiete: XYZ €"
    const m6 = html.match(/(?:Nettokaltmiete|Kaltmiete)[\s\S]{0,80}?(\d{1,4}(?:[.,]\d{1,2})?)\s*€/i);
    if (m6) {
      const r = parseFloat(m6[1].replace(',', '.'));
      if (r > 50 && r < 50000) result.rentNet = r;
    }
  }

  return result;
}

router.post('/scrape', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL fehlt' });
  }
  if (!isAllowedUrl(url)) {
    return res.status(400).json({
      error: 'Plattform nicht unterstützt. Aktuell: ImmobilienScout24, ImmoWelt, Kleinanzeigen, Immonet, Meinestadt.'
    });
  }

  // V63.91: Suchergebnis-URLs erkennen — das sind keine einzelnen Inserate
  // sondern Listen-Seiten, die wir nicht sinnvoll auswerten können.
  // Marcel-Beispiel: https://www.immobilienscout24.de/Suche/de/.../anlageimmobilie?...
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const isSearchPage =
      path.startsWith('/suche/') ||                             // IS24 Suche
      path.startsWith('/expose-suche/') ||                      // alt
      path.includes('/s-immobilien/') ||                        // Kleinanzeigen Liste
      path.includes('/liste/') ||
      path.endsWith('/anlageimmobilie') || path.endsWith('/wohnung') ||
      path.endsWith('/haus') || path.endsWith('/grundstueck');
    if (isSearchPage) {
      return res.status(200).json({
        success: false,
        is_search_page: true,
        note: 'Diese URL ist eine Suchergebnis-Seite, kein einzelnes Inserat. ' +
              'Bitte ein konkretes Inserat öffnen (Klick auf eine Anzeige in der Liste) und dessen URL hier einfügen. ' +
              'Eine Inserats-URL endet typischerweise mit einer Inserats-ID, z.B. /expose/123456789.'
      });
    }
  } catch (e) { /* URL-Parse fail — fällt durch */ }

  // V63.87: IS24 hat Cloudflare-Bot-Detection → direktes fetch failt fast immer mit 401/403.
  // Statt false hope geben wir dem User direkt einen pragmatischen Workaround:
  //   1. Inserat im Browser öffnen
  //   2. Strg+P → "Als PDF speichern"
  //   3. Dann via "PDF importieren"-Button uploaden — der KI-Extract-Endpoint
  //      kann das PDF parsen und Felder befüllen
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.endsWith('immobilienscout24.de') || host.endsWith('is24.de')) {
      return res.status(200).json({
        success: false,
        is_blocked: true,
        platform: 'ImmobilienScout24',
        note: 'ImmobilienScout24 blockiert automatisierte Abfragen mit Cloudflare-Bot-Schutz. ' +
              'Bitte das Inserat im Browser öffnen, mit Strg+P als PDF speichern und über den ' +
              'Button "PDF importieren" hochladen — die KI extrahiert dann die Daten zuverlässig.'
      });
    }
  } catch (e) { /* hostname-Parse fail → falls through to normal flow */ }

  try {
    const html = await fetchWithTimeout(url);
    const data = parseListing(html, url);

    // Mindest-Datenqualität: Wenn KEIN Preis UND KEINE Wohnfläche → wahrscheinlich Cloudflare/Bot-Block
    if (!data.price && !data.livingArea) {
      return res.status(200).json({
        success: false,
        partial: data,
        note: 'Strukturierte Daten konnten nicht ausgelesen werden. ' +
              'Möglich: Bot-Schutz aktiv, Inserat abgelaufen, oder geänderte Seitenstruktur. ' +
              'Tipp: Inserat als PDF speichern (Strg+P) und über "PDF importieren" hochladen.'
      });
    }

    // V63.91: Wenn nur teilweise extrahiert (Adresse fehlt o.ä.) — partial-Flag setzen
    // damit das Frontend dem User Bescheid sagt was er manuell ergänzen muss.
    const missingFields = [];
    if (!data.address) missingFields.push('Adresse');
    if (!data.price) missingFields.push('Kaufpreis');
    if (!data.livingArea) missingFields.push('Wohnfläche');
    if (!data.yearBuilt) missingFields.push('Baujahr');

    return res.json({
      success: true,
      data: data,
      partial: missingFields.length > 0,
      missing_fields: missingFields
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'Zeitüberschreitung beim Abruf' });
    }
    // V63.87: HTTP 401/403 → Bot-Block, klarer Workaround-Hinweis
    if (e.status === 401 || e.status === 403) {
      return res.status(200).json({
        success: false,
        is_blocked: true,
        note: 'Diese Plattform blockiert automatisierte Abfragen (HTTP ' + e.status + '). ' +
              'Bitte das Inserat als PDF speichern (Strg+P) und über "PDF importieren" hochladen.'
      });
    }
    return res.status(502).json({
      error: 'Abruf fehlgeschlagen: ' + (e.message || 'unbekannt'),
      hint: 'Bitte Werte manuell eintragen oder als PDF speichern und via PDF-Import hochladen.'
    });
  }
});

module.exports = router;
