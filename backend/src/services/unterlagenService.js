'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   unterlagenService.js — v1833
   UNTERLAGEN BEIM AMT ANFORDERN
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 04.10.2026: „dann habe ich dir in unseren Dateienordner …
   Unterlagen-App reingegeben. Das wäre also ganz cool, wenn wir
   irgendwelche Unterlagen für ein Objekt brauchen, dass wir die halt
   anfragen können … und dass da halt auch immer vernünftige Sachen bei
   rauskommen."

   Die Fachdaten — Zuständigkeitsregeln und Anschreiben — stammen aus
   seiner eigenständigen Unterlagen-App. Sie sind sorgfältig gemacht und
   juristisch belegt (§ 12 GBO beim Grundbuch, kein Baulastenverzeichnis
   in Bayern) und werden hier übernommen, nicht neu erfunden.

   ── WARUM NICHT DIE APP ANBINDEN ────────────────────────────────────────

   Die App läuft auf dem eigenen Rechner (localhost:8787), hat keinen
   Login und sagt das selbst: „Nicht ohne Zugangsschutz auf einen Server
   stellen." Eine HTTPS-Seite darf zudem kein http://localhost rufen.
   Beides zusammen heißt: anbinden geht nicht, übernehmen geht.

   ── DIE REGEL, DIE HIER ÜBERALL GILT ────────────────────────────────────

   Eine Mailadresse, die niemand belegt hat, ist eine Behauptung. Die KI
   nennt die Seite, auf der sie sie gelesen hat — und dieser Dienst ruft
   die Seite SELBST ab und sieht nach. Steht sie nicht da, wird der Satz
   trotzdem gespeichert, aber als `beleg_ok: false` und mit Warnung.

     > Lieber eine Adresse mit Warnung als eine ohne Zweifel. Wer eine
     > unbelegte Adresse stillschweigend anbietet, lässt den Nutzer in
     > seinem Namen an die falsche Stelle schreiben.

   DealPilot verschickt NICHTS von selbst. Der Dienst erzeugt Entwürfe.
   ═══════════════════════════════════════════════════════════════════════ */
const { query } = require('../db/pool');
const openaiService = require('./openaiService');

/* ── Die fünf Unterlagen ────────────────────────────────────────────────
 *
 * `regel` ist die Zuständigkeitsregel, die der Recherche mitgegeben wird.
 * `bitte` ist der Satz, der im Anschreiben steht — er nennt die
 * Rechtsgrundlage, wo es eine gibt. */
const ARTEN = [
  /* v1855 · Marcel: „für die Sachwertfaktoren und Liegenschaftszinsen …
     auch dort diese Unterlagenanfrage". Zuständig ist der örtliche
     Gutachterausschuss; die Kennzahlen stehen in seinem
     Grundstücksmarktbericht (§ 193 Abs. 5 BauGB), oft kostenpflichtig. */
  {
    id: 'gutachterausschuss', name: 'Grundstücksmarktbericht (Gutachterausschuss)',
    regel: 'Liegenschaftszinssätze, Sachwertfaktoren und Bodenrichtwerte leitet der '
         + 'Gutachterausschuss für Grundstückswerte ab (§ 193 Abs. 5 BauGB). Zuständig ist '
         + 'der Ausschuss des Kreises bzw. der kreisfreien Stadt, in einigen Ländern ein '
         + 'zentraler Ausschuss; die Geschäftsstelle sitzt meist beim Katasteramt.',
    betreff: 'Anfrage Grundstücksmarktbericht · Liegenschaftszinssätze und Sachwertfaktoren',
    bitte: 'Ich bitte um Übersendung des aktuellen Grundstücksmarktberichts bzw. der '
         + 'veröffentlichten Liegenschaftszinssätze und Sachwertfaktoren für den Zuständigkeits- '
         + 'bereich (ersatzweise um den Link zur amtlichen Veröffentlichung) sowie um Mitteilung '
         + 'etwaiger Gebühren vor Versand.'
  },
  {
    id: 'flurkarte', name: 'Flurkarte',
    regel: 'Auszug aus der Liegenschaftskarte. Zuständig ist das Katasteramt '
         + '(Vermessungs- und Katasteramt) des Kreises bzw. der kreisfreien Stadt; '
         + 'in manchen Bundesländern ein Landesamt mit Regionalstellen.',
    betreff: 'Auszug aus der Liegenschaftskarte (Flurkarte)',
    bitte: 'Ich bitte um Übersendung eines aktuellen Auszugs aus der '
         + 'Liegenschaftskarte (Flurkarte, Maßstab 1:1000) sowie, sofern möglich, '
         + 'des Flurstücks- und Eigentumsnachweises.'
  },
  {
    id: 'grundbuch', name: 'Grundbuchauszug',
    regel: 'Grundbuchauszug. Zuständig ist das Grundbuchamt beim Amtsgericht, in '
         + 'dessen Bezirk die Gemeinde liegt (in Baden-Württemberg zentrale '
         + 'grundbuchführende Amtsgerichte).',
    betreff: 'Antrag auf unbeglaubigten Grundbuchauszug',
    bitte: 'Ich beantrage die Erteilung eines vollständigen, unbeglaubigten '
         + 'Grundbuchauszugs (Bestandsverzeichnis, Abteilung I bis III). Das '
         + 'berechtigte Interesse gemäß § 12 GBO ergibt sich aus der Vollmacht '
         + 'des Eigentümers.'
  },
  {
    id: 'altlasten', name: 'Altlastenauskunft',
    regel: 'Auskunft aus dem Altlastenkataster. Zuständig ist die untere '
         + 'Bodenschutzbehörde, meist beim Kreis bzw. der kreisfreien Stadt '
         + '(Umweltamt).',
    betreff: 'Auskunft aus dem Altlastenkataster',
    bitte: 'Ich bitte um Auskunft, ob das Grundstück im Altlastenkataster bzw. '
         + 'im Verzeichnis der Altlastenverdachtsflächen geführt wird, und '
         + 'gegebenenfalls um Mitteilung der vorliegenden Erkenntnisse.'
  },
  {
    id: 'baulasten', name: 'Baulastenauskunft',
    regel: 'Auskunft aus dem Baulastenverzeichnis. Zuständig ist die untere '
         + 'Bauaufsichtsbehörde: die Stadt/Gemeinde, falls sie eine eigene '
         + 'Bauaufsicht hat, sonst der Kreis (Bauamt, Bauordnungsamt, Bau- und '
         + 'Planungsamt), nicht das Katasteramt. In Bayern gibt es kein '
         + 'Baulastenverzeichnis; nenne das dann im Hinweis.',
    betreff: 'Auskunft aus dem Baulastenverzeichnis',
    bitte: 'Ich bitte um Auskunft aus dem Baulastenverzeichnis, ob zulasten oder '
         + 'zugunsten des Grundstücks Baulasten eingetragen sind, und '
         + 'gegebenenfalls um Übersendung der Baulastenblätter in Kopie.'
  },
  {
    id: 'bauakte', name: 'Bauakte',
    regel: 'Einsicht in die Bauakte. Zuständig ist das Bauaktenarchiv der unteren '
         + 'Bauaufsichtsbehörde: die Stadt/Gemeinde, falls sie eine eigene '
         + 'Bauaufsicht hat, sonst der Kreis.',
    betreff: 'Einsicht in die Bauakte',
    bitte: 'Ich bitte um Einsicht in die Bauakte des Objekts. Sofern die Akte '
         + 'digital vorliegt, bitte ich um Übersendung (insbesondere '
         + 'Baugenehmigungen, Grundrisse, Schnitte, Ansichten, '
         + 'Flächenberechnungen und Baubeschreibung); andernfalls bitte ich um '
         + 'einen Terminvorschlag zur Einsichtnahme.'
  }
];
const ARTEN_MAP = {};
ARTEN.forEach((a) => { ARTEN_MAP[a.id] = a; });

/* Gewerbliche Bestellportale sind keine amtliche Quelle — auch nicht für
   die Zuständigkeit. Sie sehen auf den ersten Blick amtlich aus, und
   genau darauf sind sie gebaut. */
/* ── v1833c · DAS MUSTER WAR ZU ENG ───────────────────────────────────────
 *
 * GEMESSEN am 04.10.2026: die Grundbuch-Recherche für Hüllhorst nannte als
 * Quelle `portal-grundbuchamt.de` — ein gewerblicher Antragsservice, der
 * sich im eigenen Hinweis als „privater Antragsservice" zu erkennen gibt.
 * Mein Muster fing ihn NICHT, weil es „portal" nur als Nachsilbe kannte
 * (`katasteramt-portal`), nicht als Vorsilbe.
 *
 * Gehalten hat trotzdem die zweite Linie: die Adresse stand dort nicht,
 * also kein Beleg. Genau dafür sind es zwei Prüfungen.
 *
 *   > Ein Filter, der einmal durchlässt, ist kein kaputter Filter — er ist
 *   > der Grund, warum es einen zweiten gibt. Beide zu haben ist die
 *   > Entscheidung, nicht den einen perfekt zu machen.
 *
 * Erkannt wird jetzt in beide Richtungen, und die amtlichen Domains sind
 * ausdrücklich ausgenommen: eine echte Behördenseite endet auf `.de` unter
 * einem Kreis-, Stadt-, Landes- oder Justiznamen, und `justiz.nrw.de`
 * enthält selbst das Wort „justiz" — ein blindes Muster würde sie treffen. */
const AMTLICH = /(^|\.)((kreis|stadt|gemeinde|landkreis|bezirk)-[a-z-]+|justiz|service|serviceportal|amt24|buergerservice)\.[a-z]{2,}$|\.(bund|nrw|bayern|berlin|hamburg|bremen|sachsen|thueringen|niedersachsen|hessen|rlp|saarland|schleswig-holstein|brandenburg|mv-regierung|sachsen-anhalt|baden-wuerttemberg)\.de$/i;
const GEWERBLICH = new RegExp(
  '(katasteramt|baulastenverzeichnis|grundbuchauszug|grundbuchamt|altlasten|bauakte|flurkarte|grundbuch)'
  + '[-._]?(online|portal|direkt|service|24|express|jetzt|antrag)'
  + '|(online|portal|direkt|express|mein|dein)[-._]?'
  + '(katasteramt|baulastenverzeichnis|grundbuchauszug|grundbuchamt|bauakte|flurkarte|grundbuch)'
  + '|geoindex|immobilien-?scout|grundbuch24|antragsservice|\\.shop\\b', 'i');

function istGewerblich(url) {
  if (!url) return false;
  let wirt = String(url), pfad = '';
  try { const x = new URL(url); wirt = x.hostname; pfad = x.pathname; }
  catch (e) { /* kein gueltiger Link — dann gegen die ganze Zeichenkette */ }
  /* Eine amtliche Domain bleibt amtlich, auch wenn ihr Pfad ein
     Schlagwort enthält (`justiz.nrw.de/grundbuchamt`). */
  if (AMTLICH.test(wirt)) return false;
  return GEWERBLICH.test(wirt + pfad);
}

function gemeindeSchluessel(plz, ort) {
  return String((plz || '') + '-' + (ort || ''))
    .toLowerCase().trim()
    .replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '');
}

function _s(v) { return typeof v === 'string' ? v.trim() : ''; }
function _link(v) { return /^https?:\/\//i.test(_s(v)) ? _s(v) : ''; }

/* ── v1844 · EINE ADRESSE MUSS WIE EINE AUSSEHEN ───────────────────────────
 *
 * GEMESSEN am 04.10.2026 beim ersten „Alle abrufen" für Hüllhorst: zwei
 * Ämter kamen mit der Adresse `email` zurück — dem Wort, nicht einer
 * Adresse. Das Modell hatte meinen JSON-Schlüssel als Wert zurückgegeben.
 * Gespeichert wurde es, angezeigt wurde es, und „Im Mailprogramm öffnen"
 * hätte `mailto:email` gebaut.
 *
 * Die Belegprüfung hielt („nicht belegt") — aber sie prüfte, ob „email"
 * auf der Quellseite steht. Das Wort steht auf fast jeder Seite. Ein
 * Zufallstreffer hätte die Zeile grün gemacht.
 *
 *   > Was keine Adresse sein kann, darf nicht als Adresse geprüft werden.
 *   > Eine Prüfung, die auf ein Nichts ein Ja sagen kann, ist keine.
 *
 * Deshalb EINE Stelle für die Form, und beide Wege nutzen sie: der
 * Rückweg der Recherche und die Belegprüfung. Streng: ein @, danach eine
 * Domain mit Punkt, keine Leerzeichen, kein Platzhalterwort. */
function mailGueltig(v) {
  const s = _s(v).toLowerCase();
  if (!s) return false;
  if (/^(email|e-mail|mail|keine|none|null|n\/a|—|-)$/.test(s)) return false;
  return /^[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[a-z]{2,}$/.test(s);
}

/* Trackingparameter raus, bevor die Seite abgerufen oder gespeichert wird.
   Die Websuche hängt `?utm_source=openai` an — gemessen an Hüllhorst. Eine
   Quellenangabe, die verrät, über welches Werkzeug sie gefunden wurde,
   gehört nicht in einen Nachweis, und manche Server antworten darauf
   anders. */
function _sauber(url) {
  const u = _link(url);
  if (!u) return '';
  try {
    const x = new URL(u);
    for (const p of [...x.searchParams.keys()]) {
      if (/^utm_|^ref$|^source$|^fbclid$|^gclid$/i.test(p)) x.searchParams.delete(p);
    }
    return x.toString();
  } catch (e) { return u; }
}

/* ══ v2151 · DIE ADRESSEN AUF EINER SEITE — WIRKLICH LESEN ════════════
 *
 * Marcel am 12.10.2026: „ich meine das unterlagen app das müssen wir
 * ergänzen ist ja schon drin. soll nur ergänzt werden bzw. bissel
 * erweitert." Die Vorlage ist `unterlagen-app-v6-ansprechpartner`.
 *
 * ── DER GEMESSENE DEFEKT ────────────────────────────────────────────
 *
 * Die Belegprüfung suchte bis v2150 `text.includes(adresse)` im rohen
 * HTML. Ämter schreiben ihre Adressen aber gegen Erntemaschinen
 * verschleiert. Am 12.10.2026 an neun echten Schreibweisen gemessen —
 * VIER wurden verfehlt:
 *
 *   gefunden   info@stadt-xy.de
 *   gefunden   info<span>@</span>stadt-xy.de      (über den Rückfall)
 *   gefunden   info(at)stadt-xy.de                (über den Rückfall)
 *   VERFEHLT   info [at] stadt-xy [dot] de
 *   gefunden   info&commat;stadt-xy.de            (über den Rückfall)
 *   VERFEHLT   in<soft hyphen>fo@stadt-xy.de
 *   VERFEHLT   info@stadt<wbr>-xy.de
 *   gefunden   Info@Stadt-XY.de
 *   VERFEHLT   info@stadt<Gedankenstrich>xy.de
 *
 * Eine verfehlte Adresse heisst „steht nicht auf der genannten
 * Quellseite" — für eine Adresse, die dort steht. Der Nutzer bekommt
 * eine Warnung für einen korrekten Fund.
 *
 * ── UND DER RUECKFALL WAR ZUGLEICH ZU LAX ───────────────────────────
 *
 * Drei der fünf Treffer kamen über den Rückfall
 * `text.includes(konto) && text.includes(domain)`. Der prüft nur, ob
 * beide Teile IRGENDWO auf der Seite stehen:
 *
 *   > „info" steht auf fast jeder Amtsseite im Menü, die Domain im
 *   > Impressum. Diese Prüfung sagt dann „bestätigt", ohne dass die
 *   > Adresse dort überhaupt vorkommt. Ein falscher Beleg ist
 *   > schlimmer als keiner — er behauptet eine Herkunft.
 *
 * Beides ersetzt dieser Leser: er stellt die Seite erst her (Entities,
 * zerstückelnde Inline-Tags, (at)/(dot)-Schreibweisen, unsichtbare
 * Zeichen, Gedankenstriche) und liest dann ECHTE Adressen. Danach wird
 * verglichen — vollständig, nicht in Teilen.
 *
 * Die Reihenfolge der Fundstellen bleibt die der Seite. Das ist kein
 * Beiwerk: die erste genannte Person ist die zuständige. */
function mailsAufSeite(html) {
  let t = String(html || '')
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&commat;/gi, '@').replace(/&period;/gi, '.').replace(/%40/gi, '@');
  /* Inline-Tags fallen WEG (eine Adresse ist oft mit <span> zerstückelt),
     alle anderen werden zu einem Leerzeichen — sonst klebt der Text zweier
     Absätze zu einer Scheinadresse zusammen. Beide Fassungen werden
     gelesen: das Entfernen kann selbst zwei Wörter verkleben. */
  const ohneTags = t.replace(/<\/?(span|b|i|u|em|strong|wbr|font|nobr|abbr|small)\b[^>]*>/gi, '')
                    .replace(/<[^>]+>/g, ' ');
  t = (t + '\n' + ohneTags)
    .normalize('NFKC')
    .replace(/[­​-‍⁠﻿]/g, '')   /* Soft-Hyphen, Zero-Width */
    .replace(/[‐-―−]/g, '-')              /* Gedankenstriche zu Bindestrich */
    .replace(/\s*[([{]\s*(at|ät)\s*[)\]}]\s*/gi, '@')
    .replace(/\s*[([{]\s*(dot|punkt)\s*[)\]}]\s*/gi, '.')
    /* v2443 · ⚹ für @ und ◦ für den Punkt — so verschleiert das CMS von
       kassel.de, mainz.de und vv.potsdam.de (Rechercheberichte vom
       19.10.2026). Ohne diese Zeile galt dort jede Adresse als „steht
       nicht auf der Seite". */
    .replace(/\s*✹\s*/g, '@')
    .replace(/([a-z0-9-])\s*◦\s*(?=[a-z0-9-])/gi, '$1.')
    .toLowerCase();
  const treffer = t.match(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) || [];
  return [...new Set(treffer)]
    .filter(function (m) { return mailGueltig(m); })
    /* Eine Bilddatei ist keine Adresse: `logo@2x.png` trifft das Muster. */
    .filter(function (m) { return !/\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$/.test(m); });
}

/* ══ v2440 · DER LESBARE TEXT EINER SEITE — FUER DIE NAMENSPRUEFUNG ════
 *
 * Vorlage v6 verlässt sich darauf, dass das Modell nur Personen nennt,
 * die dort stehen. Das ist eine Bitte, keine Prüfung. Hier wird der
 * Name gegen den Text der selbst abgerufenen Seite gehalten — dieselbe
 * Strenge wie bei der Adresse: belegt ist, was WIR gelesen haben. */
function seitenText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&nbsp;/gi, ' ').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü').replace(/&szlig;/g, 'ß')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFKC')
    .replace(/[­​-‍⁠﻿]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 400000);
}

/* Steht der Name auf einer der Seiten? Anreden und Titel zählen nicht
   („Frau Dr. Anja Müller" -> anja, müller); JEDES übrige Namenswort
   muss als ganzes Wort vorkommen. Liefert die URL der ersten Seite
   oder ''. Umlaute werden beidseitig zu ae/oe/ue gefaltet — Ämter
   schreiben „Mueller" und „Müller" gleichermaßen. */
function _falte(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}
function nameAufSeiten(name, texte) {
  const woerter = _falte(name).replace(/[^a-z\s-]/g, ' ').split(/\s+/)
    .filter(function (w) {
      return w.length >= 2 && !/^(frau|herr|herrn|dr|prof|dipl|ing|med|rer|nat|jur|von|van|der|den|zu)$/.test(w);
    });
  if (!woerter.length) return '';
  const urls = Object.keys(texte || {});
  for (let i = 0; i < urls.length; i++) {
    const t = ' ' + _falte(texte[urls[i]]).replace(/[^a-z0-9@.\s-]/g, ' ') + ' ';
    const alle = woerter.every(function (w) {
      return new RegExp('[\\s-]' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s-]').test(t);
    });
    if (alle) return urls[i];
  }
  return '';
}

/* ══ v2440 · KEINE INTERNEN ADRESSEN ABRUFEN ═══════════════════════════
 *
 * Vorlage v6 hat `istLokal()`; unsere Fassung rief jede URL ab, die die
 * Websuche nannte — auch `http://localhost:…` oder eine Adresse im
 * Container-Netz. Eine Belegprüfung, die auf Zuruf interne Dienste
 * abfragt, ist eine Tür nach innen. */
function istLokal(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/.test(h)
      || !/\./.test(h);
  } catch (e) { return true; }
}

/* ══ v2440 · GEMEINDEWEITE SAETZE ═══════════════════════════════════════
 *
 * `gemeinde_schluessel` ist „PLZ-Ort". Eine Großstadt hat dreißig
 * Postleitzahlen — Bielefeld allein vier unter den Staging-Objekten
 * (33602, 33613, 33647, 33719). Ein belegtes Bauamt für 33613 half
 * 33602 nicht, obwohl es dasselbe Amt ist.
 *
 * Darum gibt es Sätze mit dem Schlüssel „gemeinde-<kernname>". Ihr
 * `plz` trägt die PLZ-Leitbereiche (erste zwei Ziffern, kommagetrennt),
 * und NUR wenn die PLZ des Objekts dort hineinfällt, gilt der Satz —
 * sonst träfe „Frankfurt (Oder)" das Amt von Frankfurt am Main. Der
 * PLZ-genaue Satz geht immer vor. Zuständigkeiten, die sich INNERHALB
 * der Gemeinde teilen (Grundbuch in Berlin), bekommen keinen solchen
 * Satz — dort sucht die Recherche je Adresse. */
function ortKern(ort) {
  return String(ort || '').toLowerCase()
    .replace(/\s*[([].*$/, '')
    .replace(/\s+(am|an der|an|im|in|ob der|bei)\s+.*$/, '')
    .trim();
}
function gemeindeweitSchluessel(ort) {
  const k = ortKern(ort).replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '');
  return k ? 'gemeinde-' + k : '';
}
function _passtLeitbereich(satzPlz, plz) {
  const p = String(plz || '').trim();
  if (!/^\d{5}$/.test(p)) return false;
  const liste = String(satzPlz || '').split(/[,\s]+/).filter(Boolean);
  if (!liste.length) return false;
  return liste.some(function (x) { return x.length <= 5 && p.indexOf(x) === 0; });
}
async function gemeindeweitFuer(plz, ort, art) {
  const k = gemeindeweitSchluessel(ort);
  if (!k) return [];
  const r = await query(
    'SELECT * FROM unterlagen_aemter WHERE gemeinde_schluessel = $1'
      + (art ? ' AND art = $2' : '') + ' ORDER BY art',
    art ? [k, art] : [k]);
  return r.rows.filter(function (a) { return _passtLeitbereich(a.plz, plz); });
}

/* ══ v2152a · `seiten` HAT ZWEI FORMEN — UND BEIDE SIND GUELTIG ════════
 *
 * Bis v2150 war die Spalte eine URL-Liste:        ["https://…", …]
 * Seit v2151 ist sie ein Objekt mit dem Beleg:    { liste, pro_seite, … }
 *
 * GEMESSEN auf Staging am 12.10.2026 nach der Migration: alle 19
 * bestehenden Saetze tragen noch `array`, neue bekommen `object`. Die
 * Spalte ist damit GEMISCHT, und das bleibt sie — eine Nachmigration
 * waere falsch, weil die Altsaetze den Beleg je Seite gar nicht haben:
 * ihn zu erfinden waere schlimmer als ihn zu vermissen.
 *
 *   > Wer `amt.seiten.pro_seite` liest, bekommt bei 19 von 19
 *   > vorhandenen Saetzen `undefined` — und das sieht wie „keine Seiten
 *   > gelesen" aus, statt wie „aus der Zeit vor dem Beleg".
 *
 * Darum gibt es EINEN Leser, und der versteht beide Formen. Dieselbe
 * Rangfolge-Technik wie bei `gnd_jahre` im Marktbericht: mehrere Namen
 * oder Formen, eine Stelle, die sie kennt.
 *
 * Heute hat die Spalte noch keinen Leser im Produkt — dieser hier ist
 * fuer den naechsten, damit er nicht erst messen muss. */
function seitenLesen(seiten) {
  if (!seiten) return { liste: [], pro_seite: [], alternativen: [], alt: false };
  if (Array.isArray(seiten)) {
    /* Alte Form: nur URLs, kein Beleg. `alt: true` ist die ehrliche
       Auskunft — der Aufrufer darf nicht glauben, hier sei nichts
       gefunden worden. */
    return { liste: seiten.filter(Boolean), pro_seite: [], alternativen: [], alt: true };
  }
  return {
    liste: Array.isArray(seiten.liste) ? seiten.liste : [],
    pro_seite: Array.isArray(seiten.pro_seite) ? seiten.pro_seite : [],
    alternativen: Array.isArray(seiten.alternativen) ? seiten.alternativen : [],
    beleg_quelle: seiten.beleg_quelle || null,
    alt: false
  };
}

/* ══ v2152 · DIE ZWEI ANSPRECHPERSONEN — ZUSAMMENGEBAUT, NICHT GERATEN ══
 *
 * Marcel am 12.10.2026: „ja mach die ansprechpartner gleich mit."
 * Vorlage: `unterlagen-app-v6-ansprechpartner`, dort server.js:428-446.
 *
 * ── DIE RANGFOLGE, UND WARUM SIE SO IST ────────────────────────────
 *
 *   1. was die KI auf der Seite GELESEN hat (mit Name und Funktion)
 *   2. aufgefüllt mit den persönlichen Postfächern der QUELLSEITE,
 *      in der Reihenfolge der Seite
 *
 * Der zweite Schritt ist kein Notnagel. Viele Amtsseiten nennen die
 * Person im Bild oder in einer Tabelle, die kein Modell zuverlässig
 * liest — die Adresse `a.mueller@…` steht aber im Text. Eine Adresse
 * ohne Namen ist eine brauchbare Angabe; ein Name ohne Beleg ist keine.
 *
 * ── WAS NICHT PASSIERT ─────────────────────────────────────────────
 *
 * Höchstens zwei. Nie die Adresse, die ohnehin Empfänger ist — sonst
 * steht dieselbe Adresse zweimal im Brief, einmal als An und einmal als
 * Kopie. Und `bestaetigt` ist nur dann true, wenn die Adresse auf einer
 * von uns SELBST gelesenen Seite stand:
 *
 *   > Ohne diese Unterscheidung wäre „Ansprechpartner 1" eine
 *   > Behauptung. v5 wusste nur, ob eine Adresse irgendwo stand, v6
 *   > weiß auf WELCHER Seite — und genau dafür liegt seit v2151
 *   > `seiten.pro_seite` vor.
 *
 * `kopie` beginnt bei false. Der Nutzer hakt an, wer ins CC geht; eine
 * Software, die von sich aus jemanden in Kopie setzt, verschickt Post
 * an Menschen, die der Absender nicht gewählt hat.
 */
/* v2445 · Gehört die Adresse zur Domain des Amts? Verglichen werden die
   letzten zwei Namensteile (`kreis-herford.de`), damit `bauamt.stadt.de`
   und `stadt.de` zusammengehören. */
function _stamm(host) {
  const t = String(host || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  return t.slice(-2).join('.');
}
function _gleicheDomain(mail, eigeneMail, quelleUrl) {
  const d = _stamm(String(mail || '').split('@')[1]);
  if (!d) return false;
  if (eigeneMail) return d === _stamm(String(eigeneMail).split('@')[1]);
  try { return d === _stamm(new URL(quelleUrl).hostname); } catch (e) { return false; }
}

function personenAus(roh, eigeneMail, belegDetail, quelleUrl) {
  const personen = [];
  const eigen = _s(eigeneMail).toLowerCase();
  const alle = (belegDetail && belegDetail.alle) || [];
  const proSeite = (belegDetail && belegDetail.pro_seite) || [];
  /* v2440 · Die Seitentexte, soweit gelesen (url -> Text). Nur dann gibt
     es eine Namensprüfung — ohne gelesene Seite lässt sich ein Name
     weder belegen noch widerlegen. */
  const texte = (belegDetail && belegDetail.texte) || null;
  const mitTexten = !!(texte && Object.keys(texte).length);

  /* v2440 · AUF WELCHER SEITE steht die Adresse? Die erste Seite in der
     Reihenfolge der Abrufe, die sie trägt. Das ist der Beleg, den das
     Modal je Person verlinkt — „belegt" ohne Ort ist eine Behauptung. */
  function seiteMit(mail) {
    if (!mail) return '';
    const s = proSeite.find(function (x) { return (x.mails || []).indexOf(mail) >= 0; });
    return s ? s.url : '';
  }

  function merke(p) {
    if (personen.length >= 2) return;
    if (!p.name && !p.email) return;                    /* leere Hülle */
    if (p.email && p.email === eigen) return;           /* ist schon Empfänger */
    if (p.email && personen.some((x) => x.email === p.email)) return;
    if (!p.email && personen.some((x) => x.name && x.name === p.name)) return;
    const mailBelegt = !!(p.email && alle.indexOf(p.email) >= 0);
    /* v2440 · DER NAME MUSS AUF DER SEITE STEHEN. Ein Modell, das nach
       zwei Ansprechpersonen gefragt wird, kann zwei plausible Namen
       liefern. Liegen gelesene Seiten vor und steht der Name auf keiner
       davon, fällt die Person — es sei denn, ihre ADRESSE ist belegt. */
    let nameSeite = '';
    if (p.name && mitTexten) {
      nameSeite = nameAufSeiten(p.name, texte);
      if (!nameSeite && !mailBelegt) return;
    }
    personen.push({
      name: p.name || '', funktion: p.funktion || '',
      email: p.email || '', telefon: p.telefon || '',
      /* Belegt heisst: WIR haben die Adresse auf einer Seite gefunden,
         die wir selbst abgerufen haben. Nicht: die KI hat sie genannt. */
      bestaetigt: mailBelegt,
      /* v2440 · Der Name stand wörtlich auf einer selbst gelesenen Seite. */
      name_belegt: !!nameSeite,
      /* v2440 · Die Seite, die den Beleg trägt (Adresse vor Name). */
      seite: seiteMit(mailBelegt ? p.email : '') || nameSeite || '',
      kopie: false
    });
  }

  /* 1 · Was die Recherche genannt hat */
  const genannt = Array.isArray(roh) ? roh : [];
  genannt.forEach(function (p) {
    if (!p || typeof p !== 'object') return;
    merke({
      name: _s(p.name), funktion: _s(p.funktion),
      email: mailGueltig(p.email) ? _s(p.email).toLowerCase() : '',
      telefon: _s(p.telefon)
    });
  });

  /* 2 · Aufgefüllt mit persönlichen Postfächern der Quellseite, in der
     Reihenfolge, in der sie dort stehen. */
  const seite = ((belegDetail && belegDetail.pro_seite) || [])
    .find(function (s) { return s.url === quelleUrl; })
    || ((belegDetail && belegDetail.pro_seite) || [])[0];
  ((seite && seite.mails) || []).forEach(function (m) {
    /* v2445 · NUR DIE DOMAIN DES AMTS. Gemessen am 19.10.2026: die
       Übersichtsseite der hessischen Vermessungsverwaltung listet alle
       Gutachterausschüsse des Landes — für Frankfurt kamen so
       `…@bad-homburg.de` und `…@giessen.de` als „Ansprechpartner 1
       und 2" an. Eine Adresse fremder Domain auf einer Sammelseite ist
       keine Person DIESES Amts. Ohne eigene Adresse zählt der Server
       der Quellseite. */
    if (istPersonenpostfach(m) && _gleicheDomain(m, eigen, quelleUrl)) {
      merke({ name: '', funktion: '', email: m, telefon: '' });
    }
  });

  /* ══ v2153 · ENTWEDER ZWEI ODER KEINE ═══════════════════════════════
   *
   * Marcel am 12.10.2026: „wenn es nicht 2 ansprechpartner gibt sollte
   * man schauen ob es eine übergeordnete email adresse oder einen
   * kontakt gibt und den ausgeben und die ansprechpartner weg lassen."
   *
   * Das ist eine fachliche Entscheidung, und sie ist richtig: EINE
   * Ansprechperson neben der Amtsadresse sieht aus wie eine
   * Zuständigkeit, ist aber nur die eine, die wir zufällig lesen
   * konnten. Beim Abnahmelauf gegen das Impressum des Kreises
   * Minden-Lübbecke war es genau so — vier Adressen auf der Seite, eine
   * davon persönlich, also eine Person. Wer liest, hält sie für DIE
   * Ansprechperson des Katasteramts.
   *
   *   > Eine halbe Liste behauptet mehr, als sie weiß. Die Amtsadresse
   *   > behauptet nichts und kommt an.
   *
   * Darum fällt die Liste bei weniger als zwei Einträgen GANZ weg. Die
   * übergeordnete Adresse steht ohnehin schon als `email` am Amt — hier
   * wird nur zurückgegeben, dass sie der Weg ist.
   *
   * EINE AUSNAHME: ein Eintrag mit NAMEN und Funktion ist etwas anderes
   * als eine nackte Adresse. „Frau Müller, Katasterauskunft" ist eine
   * Auskunft, die der Nutzer am Telefon brauchen kann, und sie
   * behauptet keine Zuständigkeit, die über das Amt hinausgeht. Sie
   * bleibt deshalb — die nackte Adresse ohne Namen fällt. */
  if (personen.length < 2) {
    const mitNamen = personen.filter(function (p) { return !!p.name; });
    return mitNamen;
  }
  return personen;
}

/* Ein persönliches Postfach oder ein Funktionspostfach? Nur ein
   Sortierkriterium — eine persönliche Adresse ist nicht falsch, aber sie
   veraltet mit der Person. Das Amt bleibt. */
function istPersonenpostfach(email) {
  const k = _s(email).toLowerCase().split('@')[0] || '';
  if (!k) return false;
  /* ══ v2152b · EIN WORT IST KEIN NAME ═══════════════════════════════

     Hier stand als zweite Bedingung:

       return /\./.test(k) || /^[a-z]\.?[a-z]+$/.test(k);

     Der zweite Teil sollte `mweber` treffen (Initial plus Name). Er
     trifft aber JEDES Wort aus Kleinbuchstaben.

     GEMESSEN am 12.10.2026 am echten Impressum des Kreises
     Minden-Lübbecke: `rechnung@invoice.minden-luebbecke.de` wurde als
     PERSOENLICH eingeordnet und erschien damit als „Ansprechpartner 2"
     im Modal — ein Rechnungspostfach als Ansprechperson für eine
     Flurkartenanfrage.

     > Ein erdachter Pruefauftrag hätte das nie gefunden: meine neun
     > Proben waren `info`, `bauamt`, `a.mueller`, … — alles Fälle, die
     > ich mir ausgedacht habe. Erst die echte Seite hatte ein Wort, das
     > weder in meiner Negativliste stand noch wie ein Name aussieht.

     Jetzt zählt NUR der Punkt im Konto (`vorname.nachname`, `m.weber`).
     `mweber` gilt damit als Funktion — und das ist die sichere Seite:

       Funktion, die als persönlich gilt  ->  falsche Ansprechperson
       persönlich, die als Funktion gilt  ->  eine Person weniger

     Der erste Fehler schickt Post an die falsche Stelle, der zweite
     kostet eine Angabe. Bei einem Werkzeug, das Anfragen an Ämter
     stellt, ist die zweite Richtung die richtige.

     Die Negativliste bleibt trotzdem — sie fängt die Funktionspostfächer
     ab, die einen Punkt TRAGEN. Geprüft wird sie gegen das Konto OHNE
     Trennzeichen: `buerger.service@…` sähe sonst wie ein Name aus, weil
     in der Liste `buergerservice` ohne Punkt steht. Gemessen — der
     Prüfer hatte genau diesen Fall als einzigen roten. */
  const glatt = k.replace(/[._-]/g, '');
  if (/^(info|kontakt|post|poststelle|service|amt|buergerbuero|buergerservice|zentrale|mail|office|verwaltung|rathaus|stadt|gemeinde|kreis|bauamt|bauaufsicht|kataster|grundbuch|vermessung|rechnung|buchhaltung|invoice|datenschutz|presse|webmaster|noreply|abuse|support|hilfe|zentral|allgemein|sekretariat|geschaeftsstelle|team|anmeldung|fundbuero|standesamt|posteingang)/.test(glatt)) return false;
  /* ══ v2444 · EIN TEIL MIT AMTSWORT IST KEIN NAME ═════════════════════
     Gemessen am 19.10.2026 im Modal (Kabelsketal, Gutachterausschuss
     LVermGeo Halle): `gaa.stendal.lvermgeo@…` und `gaa.magdeburg…@…`
     erschienen als „Ansprechpartner 1 und 2" — Funktionspostfächer
     ANDERER Standorte, nur weil das Konto Punkte trägt. Ein Konto, von
     dem ein Teil ein Amtswort ist oder Ziffern trägt, ist keine Person. */
  const teile = k.split(/[._-]+/).filter(Boolean);
  if (teile.some(function (t) {
    return /\d/.test(t) || /^(gaa|gag|gutachterausschuss|ga|lvermgeo|vermgeo|lgln|ldbv|tlbg|lgv|kataster|katasteramt|vermessung|vermessungsamt|geodaten|geoinformation|poststelle|post|info|kontakt|service|amt|stadt|gemeinde|kreis|landkreis|region|bauamt|bauaufsicht|bauordnung|bauordnungsamt|baulast|baulasten|bauakte|bauakten|bauaktenarchiv|archiv|umwelt|umweltamt|altlasten|altlastenauskunft|bodenschutz|ubb|grundbuch|grundbuchamt|grundbucheinsicht|verwaltung|zentrale|buero|team|sachgebiet|fachbereich|fachdienst|abteilung|referat|ressort|amtsgericht|ag|poststelle|kundenberatung|kundenzentrum|auskunft|wertermittlung|geschaeftsstelle|stadtmessungsamt|stadtplanung|planung|rd)$/.test(t);
  })) return false;
  return /\./.test(k);
}

function _findeJson(text) {
  if (!text) return null;
  const roh = String(text);
  const von = roh.lastIndexOf('{');
  if (von < 0) return null;
  /* Von hinten, weil die Websuche davor Text schreiben kann. */
  for (let bis = roh.length; bis > von; bis--) {
    const stueck = roh.slice(von, bis);
    if (stueck.trim().endsWith('}')) {
      try { return JSON.parse(stueck); } catch (e) { /* weiter */ }
    }
  }
  return null;
}

/* ═══ DIE BELEGPRÜFUNG ══════════════════════════════════════════════════
 *
 * Wir rufen die genannte Quellseite ab und sehen nach, ob die Adresse dort
 * wirklich steht. Das ist der Unterschied zwischen „die KI sagt" und „wir
 * haben nachgesehen".
 *
 * Gesucht wird unscharf: viele Behördenseiten schreiben die Adresse mit
 * (at) oder als JavaScript-Schnipsel gegen Erntemaschinen. Eine Adresse,
 * die so geschützt ist, gilt als belegt, wenn Konto und Domain beide
 * auftauchen. */
async function belegPruefen(email, quelleUrl) {
  if (!email) return { ok: false, grund: 'keine Adresse genannt' };
  /* v1844 · Vor dem Abruf der Quelle: kann das überhaupt eine Adresse
     sein? „email" steht auf fast jeder Seite — eine Belegprüfung darauf
     wäre ein Zufallsgenerator. */
  if (!mailGueltig(email)) return { ok: false, grund: 'keine gültige Adresse (' + _s(email).slice(0, 30) + ')' };
  if (!quelleUrl) return { ok: false, grund: 'keine Quelle genannt' };
  if (istGewerblich(quelleUrl)) {
    return { ok: false, grund: 'die Quelle ist ein gewerbliches Portal, keine amtliche Seite' };
  }
  /* v2440 · keine internen Adressen (siehe istLokal) */
  if (istLokal(quelleUrl)) return { ok: false, grund: 'die Quelle ist keine öffentliche Adresse' };
  let text = '';
  try {
    const a = await fetch(quelleUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'DealPilot/1.0 (Immobilienbewertung; Belegpruefung)' },
      signal: AbortSignal.timeout(12000)
    });
    if (!a.ok) return { ok: false, grund: 'Quelle antwortete mit HTTP ' + a.status };
    text = (await a.text()).toLowerCase();
  } catch (e) {
    return { ok: false, grund: 'Quelle nicht erreichbar: ' + (e.message || e) };
  }
  /* ══ v2151 · VOLLSTAENDIG VERGLEICHEN, NICHT IN TEILEN ═══════════════

     Hier stand:

       if (text.includes(adr))                      -> woertlich
       if (text.includes(konto) && text.includes(domain))  -> „getrennt"

     Die erste Zeile verfehlte vier von neun echten Schreibweisen (siehe
     `mailsAufSeite`), die zweite fing drei davon auf — aber zu dem
     Preis, dass sie auch dann „bestaetigt" sagt, wenn „info" im Menue
     steht und die Domain im Impressum. Sie hat die Adresse nie gesehen.

     Jetzt wird die Seite erst hergestellt und dann GELESEN. Verglichen
     wird die ganze Adresse gegen die ganze Fundliste. */
  const adr = String(email).toLowerCase();
  const gefundene = mailsAufSeite(text);
  if (gefundene.includes(adr)) {
    return { ok: true, grund: 'auf der Quellseite gefunden', gefundene: gefundene };
  }
  /* Der Beleg fehlt — aber die Seite ist nicht umsonst gelesen worden.
     Was dort STEHT, ist die brauchbarste Auskunft an dieser Stelle:
     Funktionspostfaecher zuerst, persoenliche danach. */
  const andere = gefundene.slice()
    .sort(function (a, b) { return istPersonenpostfach(a) - istPersonenpostfach(b); })
    .slice(0, 6);
  return {
    ok: false,
    grund: 'die Adresse steht nicht auf der genannten Quellseite'
      + (andere.length ? ' (dort stehen ' + andere.length + ' andere: ' + andere.slice(0, 3).join(', ') + ')' : ' (dort steht gar keine Adresse)'),
    gefundene: gefundene,
    alternativen: andere
  };
}

/* ══ v2151 · DER BELEG JE SEITE ═══════════════════════════════════════
 *
 * Aus der Vorlage v6 (`pruefeAdresse`). Der Kern des Gewinns ist nicht
 * die zusaetzliche Seite, sondern der BELEG:
 *
 *   > v5 wusste nur, ob eine Adresse IRGENDWO auf einer der gelesenen
 *   > Seiten stand. v6 weiss, auf WELCHER — und kann deshalb eine
 *   > Adresse ueberhaupt als „belegt" ausweisen.
 *
 * Das ist dieselbe Lehre wie bei der Herkunftsangabe im Marktbericht:
 * eine Angabe gehoert an den ORT, nicht an den Wert. Ohne `pro_seite`
 * waere „Ansprechpartner 1" eine Behauptung.
 *
 * Hoechstens sechs Seiten, parallel, je acht Sekunden. Gewerbliche
 * Portale fallen vorher weg — eine Adresse von einem Bestellportal ist
 * kein amtlicher Beleg, auch wenn sie stimmt.
 */
async function belegSeiten(email, urls) {
  const seiten = [...new Set((urls || []).map(_link).filter(Boolean))]
    .filter(function (u) { return !istGewerblich(u) && !istLokal(u); })
    .slice(0, 6);
  if (!seiten.length) return { bestaetigt: false, alle: [], alternativen: [], pro_seite: [], texte: {} };
  /* v2440 · Der lesbare Text je Seite, fuer die Namenspruefung in
     `personenAus`. Er wird NICHT gespeichert — nur `pro_seite` geht in
     die Datenbank. */
  const texte = {};
  const funde = await Promise.all(seiten.map(async function (url) {
    try {
      const a = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'DealPilot/1.0 (Immobilienbewertung; Belegpruefung)',
                   'Accept-Language': 'de' },
        signal: AbortSignal.timeout(8000)
      });
      if (!a.ok) return [];
      /* Ein PDF oder Bild hat keinen Text, den dieser Leser versteht —
         er wuerde Bytefolgen als Adressen deuten. */
      if (!/html|text|xml/.test(a.headers.get('content-type') || '')) return [];
      const roh = (await a.text()).slice(0, 2e6);
      texte[url] = seitenText(roh);
      return mailsAufSeite(roh);
    } catch (e) { return []; }
  }));
  const alle = [...new Set(funde.flat())];
  const adr = _s(email).toLowerCase();
  const andere = alle.filter(function (m) { return m !== adr; })
    .sort(function (a, b) { return istPersonenpostfach(a) - istPersonenpostfach(b); });
  return {
    bestaetigt: !!(adr && alle.includes(adr)),
    alle: alle,
    alternativen: andere.slice(0, 6),
    /* In der Reihenfolge der Seite — die erste genannte Stelle ist die
       zustaendige. Das ist die Grundlage fuer Ansprechpartner 1 und 2. */
    pro_seite: seiten.map(function (url, i) { return { url: url, mails: funde[i] }; }),
    texte: texte
  };
}

/* ══ v2440 · EINE ADRESSE SAEUBERN (Vorlage v6 `saeubereMail`) ════════
   Modelle setzen gern Sonder-Bindestriche in Domains; `mailGueltig`
   prüft danach die Form. */
function mailSauber(v) {
  const m = String(v || '').normalize('NFKC')
    .replace(/[­​-‍⁠﻿]/g, '')
    .replace(/^\s*mailto:/i, '').trim()
    .replace(/^[<\s]+|[>\s.,;]+$/g, '')
    .replace(/[‐-―−﹘﹣－]/g, '-')
    .toLowerCase();
  return mailGueltig(m) ? m : '';
}

/* v2440 · Der Weg, den das Amt will (v6 `verfahren`). */
function kanalAus(genannt, email, antragUrl) {
  const k = ['email', 'portal', 'formular', 'post'];
  if (k.indexOf(genannt) >= 0 && !(genannt === 'post' && email)) return genannt;
  return antragUrl ? 'formular' : email ? 'email' : 'post';
}

/* v2440 · Die zweite Suche (v6 `sucheAdresse`), wörtlich in der Strenge. */
async function adresseNachsuchen(behoerde, abteilung, u, adresse) {
  if (!behoerde) return { email: '', quelle: '', seiten: [] };
  /* Zeilen als Liste, mit join verbunden — keine Escape-Folgen im Quelltext. */
  const prompt = [
    'Gesucht ist die allgemeine E-Mail-Adresse (Funktionspostfach) dieser deutschen Behörde:',
    '',
    'Behörde: ' + behoerde + (abteilung ? ', ' + abteilung : ''),
    'Zuständig für: ' + adresse,
    'Anliegen: ' + u.name,
    '',
    'Die Website der Behörde zeigt die Adresse oft nicht im Text. Suche deshalb gezielt auch hier:',
    '- Serviceportale und Websites der Städte und Gemeinden im selben Kreis (dort stehen die Ämter des Kreises mit E-Mail)',
    '- Behördenverzeichnisse des Landes und Listen von Landesämtern',
    '- Kontaktseite und Impressum der Behörde',
    'Regeln: Nur offizielle Seiten, keine gewerblichen Bestellportale. Gib die Adresse nur an, wenn sie auf '
      + 'einer dieser Seiten wörtlich steht; rate nicht. Funktionsadresse des Amts, kein persönliches Postfach. '
      + 'Einfache Zeichen, normaler Bindestrich. Stelle keine Rückfragen.',
    '',
    'Antworte ausschließlich mit einem JSON-Objekt:',
    '{"email":"","quelle":"URL der Seite, auf der die Adresse steht","seiten":["weitere offizielle Seiten mit dieser Adresse"]}'
  ].join(String.fromCharCode(10));
  try {
    const antwort = await openaiService.callOpenAI(prompt, {});
    const r = _findeJson(antwort && (antwort.text || antwort.output_text || antwort)) || {};
    return {
      email: mailSauber(r.email), quelle: _sauber(_link(r.quelle)),
      seiten: (Array.isArray(r.seiten) ? r.seiten : []).map(_link).filter(Boolean).map(_sauber)
    };
  } catch (e) {
    return { email: '', quelle: '', seiten: [] };
  }
}

/* ═══ DIE RECHERCHE ═════════════════════════════════════════════════════
 *
 * Der Prompt stammt aus Marcels App und bleibt in seiner Strenge: nur
 * amtliche Seiten, keine geratene Adresse, Funktionspostfach statt
 * persönlichem. */
async function amtSuchen(art, ort, opts = {}) {
  const u = ARTEN_MAP[art];
  if (!u) throw new Error('Unbekannte Unterlagenart: ' + art);
  const adresse = [ort.strasse, [ort.plz, ort.ort].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');

  const nachtrag = opts.nachtrag || '';
  const prompt = 'Du recherchierst für einen Immobiliensachverständigen die '
    + 'zuständige Behörde in Deutschland.\n\n'
    + 'Objekt: ' + adresse + '\n'
    + 'Gesuchte Unterlage: ' + u.name + '\n'
    + 'Zuständigkeitsregel: ' + u.regel + '\n\n'
    + 'Nutze die Websuche und ermittle die Kontaktdaten für genau diese Anfrage. Regeln:\n'
    + '- Verwende nur offizielle Seiten: die Behörde selbst, Kreis, Stadt oder '
    + 'Gemeinde, Land, Justiz oder kommunale Serviceportale. Gewerbliche Bestell- '
    + 'und Vermittlungsportale sind keine Quelle, auch nicht für die Zuständigkeit.\n'
    + '- Die Zuständigkeit muss sich aus einer offiziellen Seite ergeben. Weicht '
    + 'sie von der Regel oben ab, gilt die offizielle Seite; nenne das im Hinweis.\n'
    + '- Gib nur eine E-Mail-Adresse an, die du wörtlich auf einer offiziellen '
    + 'Seite gelesen hast. Rate keine Adresse aus dem Namen des Amts. Findest du '
    + 'keine, bleibt "email" leer.\n'
    + '- Nimm die Funktionsadresse des Fachbereichs (z. B. katasteramt@…), kein '
    + 'persönliches Postfach einzelner Beschäftigter, solange es eine '
    + 'Funktionsadresse gibt.\n'
    + '- Schreibe die Adresse in einfachen Zeichen mit normalem Bindestrich.\n'
    + '- "quelle" ist ein PFLICHTFELD: dort gehört die URL der Seite hinein, '
    + 'auf der du die Adresse gelesen hast. Schreibe den Link nicht in den '
    + 'Hinweis und nicht in den Fließtext, sondern in dieses Feld.\n'
    /* ══ v2152 · DIE ANSPRECHPERSONEN — WOERTLICH AUS DER VORLAGE ═══════

       Marcel am 12.10.2026: „ja mach die ansprechpartner gleich mit."
       Vorlage: `unterlagen-app-v6-ansprechpartner`, dort server.js:386.

       DER PROMPT IST DIE STELLE, AN DER ERFUNDENE NAMEN ENTSTEHEN. Ein
       Modell, das nach „den beiden Ansprechpartnern" gefragt wird und
       keine findet, nennt zwei plausible — Nachname plus Sachgebiet
       liest sich wie ein Beleg und ist keiner.

       > Deshalb stehen die drei Einschraenkungen aus v6 hier WOERTLICH:
       > nur Personen, die dort wirklich stehen; eine E-Mail nur, wenn
       > sie dort woertlich steht, sonst leer; stehen dort keine
       > Personen, bleibt die Liste leer.

       Die dritte ist die wichtigste. Ohne sie ist „leer" kein zulaessiges
       Ergebnis, und das Modell MUSS etwas liefern. Dasselbe Muster wie
       bei der Mietpreisuebersicht: wo die Quelle endet, endet die
       Rechnung — eine leere Liste ist eine Antwort, keine Luecke.

       Die REIHENFOLGE DER SEITE ist ausdruecklich verlangt: die zuerst
       genannte Person ist die zustaendige. Ein Modell, das sie nach
       Rang oder Alphabet sortiert, zerstoert genau die Information,
       auf die sich „Ansprechpartner 1" stuetzt. */
    + '- Nenne zusätzlich unter "ansprechpartner" die ersten beiden '
    + 'Ansprechpersonen, die auf der offiziellen Seite für dieses Anliegen '
    + 'aufgeführt sind, in der Reihenfolge der Seite: Name, Funktion, E-Mail, '
    + 'Telefon. Nur Personen, die dort wirklich stehen. Eine E-Mail nur, wenn '
    + 'sie dort wörtlich steht, sonst leer. Stehen dort keine Personen, bleibt '
    + 'die Liste leer.\n'
    + '- Stelle keine Rückfragen und bitte nicht um Erlaubnis. Antworte direkt.'
    + nachtrag + '\n\n'
    + 'Antworte am Ende ausschließlich mit einem JSON-Objekt, ohne Einleitung '
    + 'und ohne Markdown:\n'
    + '{"behoerde":"","abteilung":"","email":"","telefon":"","kanal":"email | portal | formular | post",'
    + '"antragUrl":"","quelle":"","seiten":[],'
    /* Ohne Zielfeld faellt der Auftrag oben lautlos auf den Boden —
       dieselbe Lehre wie bei den KI-Prompts der Pilot-Analyse (v2139). */
    + '"ansprechpartner":[{"name":"","funktion":"","email":"","telefon":""}],'
    + '"gebuehr":"","hinweis":"","kreis":"","bundesland":""}';

  const antwort = await openaiService.callOpenAI(prompt, {});
  const r = _findeJson(antwort && (antwort.text || antwort.output_text || antwort));
  if (!r || !r.behoerde) {
    const e = new Error('Keine eindeutige Behörde gefunden.');
    e.rohtext = String((antwort && (antwort.text || antwort.output_text)) || '').slice(0, 400);
    throw e;
  }

  /* Stammt die Auskunft von einem gewerblichen Portal, EINMAL mit klarer
     Ansage neu suchen — nicht endlos, sonst dreht sich das im Kreis. */
  if (istGewerblich(_link(r.quelle)) && !opts.nachtrag) {
    return amtSuchen(art, ort, {
      nachtrag: '\n- Die zuvor gefundene Quelle war ein gewerbliches Portal. '
              + 'Suche ausschließlich auf der Seite des Kreises, der Stadt, der '
              + 'Gemeinde, des Landes oder der Justiz.'
    });
  }

  /* ── v1833b · DEN BELEG EINSAMMELN, WO ER WIRKLICH LIEGT ───────────────
   *
   * GEMESSEN am 04.10.2026 an Hüllhorst: das Modell fand beide Behörden
   * richtig (Kreis Minden-Lübbecke, Amtsgericht Lübbecke), ließ `quelle`
   * aber LEER und schrieb den Link stattdessen in den Hinweis:
   *
   *     "... ([minden-luebbecke.de](https://www.minden-luebbecke.de/...))"
   *
   * Die Belegprüfung meldete daraufhin „keine Quelle genannt" — richtig
   * nach ihrer Regel und trotzdem falsch, denn die Quelle stand da.
   *
   *   > Eine Angabe im falschen Feld ist keine fehlende Angabe. Wer sie
   *   > als fehlend behandelt, verwirft, was er schon hat.
   *
   * Deshalb wird der Beleg jetzt aus allen drei Stellen eingesammelt:
   * `quelle`, `seiten`, und zuletzt die Links im Fließtext des Hinweises.
   * Das ist keine Nachsicht — geprüft wird danach genauso streng. */
  let quelle = _link(r.quelle);
  const seiten = Array.isArray(r.seiten) ? r.seiten.map(_link).filter(Boolean) : [];
  const hinweisLinks = (_s(r.hinweis).match(/https?:\/\/[^\s)\]"']+/g) || []);
  if (!quelle) quelle = seiten.find((u) => !istGewerblich(u)) || '';
  if (!quelle) quelle = hinweisLinks.find((u) => !istGewerblich(u)) || '';

  /* ══ v2440 · ZWEITE SUCHE NACH DER AMTSADRESSE (Vorlage v6 `sucheAdresse`)
     Steht das Amt fest, aber keine Adresse, fragt v6 ein zweites Mal
     gezielt nach dem Funktionspostfach — viele Kreisseiten verstecken es
     hinter einem „E-Mail"-Link, im Serviceportal der Gemeinde steht es
     offen. Gefunden zählt es nur mit amtlicher Quelle; der Beleg wird
     danach genauso geprüft wie beim ersten Fund. */
  let email = mailSauber(r.email);
  let zweiteSeiten = [];
  let zweitHinweis = '';
  if (!email && !opts.ohneNachsuche) {
    const k = await adresseNachsuchen(_s(r.behoerde), _s(r.abteilung), u, adresse);
    if (k.email && k.quelle && !istGewerblich(k.quelle)) {
      email = k.email;
      zweiteSeiten = [k.quelle].concat(k.seiten);
      quelle = k.quelle;
      zweitHinweis = 'Allgemeine Adresse des Amts, in einer zweiten Suche gefunden.';
    }
  }
  const antragUrl = _link(r.antragUrl);

  return {
    behoerde: _s(r.behoerde), abteilung: _s(r.abteilung),
    /* v1844 · Nur, was eine Adresse sein kann. Sonst leer — und leer heißt
       im Modal „nur über das Portal" oder „keine Adresse", nie `mailto:`.
       v2440 · vorher gesäubert (Sonder-Bindestriche, mailto:, Klammern). */
    email: email,
    telefon: _s(r.telefon),
    /* v2440 · Der Weg wie in v6 (`verfahren`): „post" mit Adresse ist kein
       Postweg, und ohne Angabe entscheidet, was vorliegt. */
    kanal: kanalAus(_s(r.kanal), email, antragUrl),
    antrag_url: antragUrl, quelle_url: _sauber(quelle),
    /* v2152 · ROH durchreichen. Der Zusammenbau braucht den Beleg, und
       der steht erst fest, wenn die Seiten gelesen sind — also eine
       Ebene weiter in `amtHolen`. Hier wird nichts entschieden. */
    _ansprechpartner_roh: Array.isArray(r.ansprechpartner) ? r.ansprechpartner : [],
    seiten: [...new Set(zweiteSeiten.concat(seiten, hinweisLinks).filter(Boolean))].map(_sauber).slice(0, 8),
    gebuehr: _s(r.gebuehr), hinweis: [_s(r.hinweis), zweitHinweis].filter(Boolean).join(' '),
    kreis: _s(r.kreis), bundesland: _s(r.bundesland)
  };
}

/* ═══ ERNTEN: suchen, belegen, hinterlegen ══════════════════════════════
 *
 * `erzwingen: true` sucht neu, auch wenn ein Satz da ist. Sonst wird der
 * hinterlegte genommen — das ist der Sinn der Tabelle. */
/* v1865 · Der zuständige Gutachterausschuss aus dem Register des Marktberichts
   (GET /quellen?plz=): Name, Link des amtlichen Datensatzes, Jahrgang. Liefert
   null, wenn das Register nichts führt — dann bleibt es bei der Websuche. */
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');
async function ausschussAusRegister(ort) {
  if (!ort || !ort.plz) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  let q;
  try {
    const r = await fetch(MB_BASE + '/quellen?plz=' + encodeURIComponent(ort.plz)
      + (ort.ort ? '&ort=' + encodeURIComponent(ort.ort) : ''), { signal: ctrl.signal });
    if (!r.ok) return null;
    q = await r.json();
  } finally { clearTimeout(t); }
  const name = _s(q && q.ausschuss);
  if (!name) return null;
  const saetze = Array.isArray(q.hinterlegt) ? q.hinterlegt : [];
  const mitLink = saetze.filter((e) => _link(e.quelle_url));
  const istArchiv = (u) => /\.(zip|csv|xlsx?|gz)(\?|$)/i.test(u);
  const pdf = mitLink.find((e) => /\.pdf(\?|$)/i.test(e.quelle_url));
  const seite = mitLink.find((e) => !istArchiv(e.quelle_url) && !/\.pdf(\?|$)/i.test(e.quelle_url));
  const erster = pdf || seite || mitLink[0] || null;
  const archiv = erster && istArchiv(erster.quelle_url);
  const jahre = [...new Set(saetze.map((e) => e.jahrgang || e.berichtsjahr).filter(Boolean))].sort();
  const kennzahlen = [...new Set(saetze.map((e) => e.name || e.kennzahl).filter(Boolean))];
  return {
    behoerde: name,
    quelle_url: erster ? erster.quelle_url : null,
    kreis: _s(q.ort) || null, bundesland: _s(q.bundesland) || null,
    hinweis: 'Zuständig laut DealPilot-Register' + (kennzahlen.length ? ' (' + kennzahlen.slice(0, 4).join(', ') + ')' : '')
      + (jahre.length ? ', Jahrgang ' + jahre[jahre.length - 1] : '') + '. Die Geschäftsstelle sitzt meist beim Kataster- und '
      + 'Vermessungsamt; der Grundstücksmarktbericht ist dort oft kostenpflichtig.'
      + (archiv ? ' Der verlinkte Datensatz ist die amtliche Veröffentlichung des Landes (CSV), aus der unser Register liest — '
                + 'den Bericht selbst gibt der Ausschuss heraus.' : '')
  };
}

async function amtHolen(userId, art, ort, opts = {}) {
  const schluessel = gemeindeSchluessel(ort.plz, ort.ort);
  if (!schluessel || schluessel === '-') {
    return { gefunden: false, grund: 'Ohne Postleitzahl und Ort lässt sich keine Zuständigkeit bestimmen.' };
  }
  if (!opts.erzwingen) {
    const vorhanden = await query(
      `SELECT * FROM unterlagen_aemter WHERE gemeinde_schluessel = $1 AND art = $2`,
      [schluessel, art]);
    if (vorhanden.rows.length) {
      return { gefunden: true, aus_register: true, amt: vorhanden.rows[0] };
    }
    /* v2440 · Danach der gemeindeweite Satz — nur im passenden
       PLZ-Leitbereich (siehe gemeindeweitFuer). */
    const weit = await gemeindeweitFuer(ort.plz, ort.ort, art);
    if (weit.length) {
      return { gefunden: true, aus_register: true, gemeindeweit: true, amt: weit[0] };
    }
  }

  let gefunden;
  /* v1865 · Marcel (Parkstr. 9): „der Text zum Grundstücksmarktbericht passt
     nicht, auch die Quelle passt nicht." Gemessen: die KI-Suche lieferte
     „Gutachterausschuss für Grundstüctswerte", „Gebühr: email" und eine
     Allerweltsquelle. Dabei WISSEN wir den Ausschuss: er steht mit Link,
     Jahrgang und Lizenz im Register des Marktberichts. Register zuerst;
     die KI-Suche darf danach nur noch E-Mail und Telefon beisteuern. */
  let register = null;
  if (art === 'gutachterausschuss') {
    try { register = await ausschussAusRegister(ort); } catch (e) { register = null; }
  }
  try { gefunden = await amtSuchen(art, ort); }
  catch (e) {
    if (!register) return { gefunden: false, grund: e.message || String(e), rohtext: e.rohtext || null };
    gefunden = { behoerde: '', abteilung: '', email: '', telefon: '', kanal: 'post', seiten: [], hinweis: '' };
  }
  if (register) {
    const alt = gefunden;
    gefunden = {
      behoerde: register.behoerde,
      abteilung: 'Geschäftsstelle des Gutachterausschusses',
      email: alt.email || '', telefon: alt.telefon || '',
      kanal: alt.email ? 'email' : 'post',
      antrag_url: alt.antrag_url || null,
      quelle_url: register.quelle_url || alt.quelle_url || null,
      seiten: [].concat(register.quelle_url ? [register.quelle_url] : [], alt.seiten || []),
      gebuehr: (alt.gebuehr && !/@|email|mail/i.test(String(alt.gebuehr))) ? alt.gebuehr : null,
      hinweis: register.hinweis + (alt.hinweis ? ' — Kontakt laut Websuche: ' + alt.hinweis : ''),
      kreis: register.kreis || alt.kreis || null, bundesland: register.bundesland || alt.bundesland || null,
      _beleg_quelle: alt.quelle_url || null
    };
  }

  const beleg = await belegPruefen(gefunden.email, gefunden._beleg_quelle || gefunden.quelle_url);

  /* ══ v2151 · DIE WEITEREN SEITEN WERDEN JETZT AUCH GELESEN ═══════════
   *
   * `seiten` wurde bis v2150 gespeichert und von NIEMANDEM gelesen —
   * gemessen am 12.10.2026: ein grep nach `.seiten` ueber backend/src
   * und frontend/js findet ausser dem eigenen INSERT keinen Treffer.
   * Bis zu acht amtliche Seiten lagen in der Datenbank, und keine davon
   * wurde je abgerufen.
   *
   * Das ist teuer, denn genau dort steht oft die Adresse: viele
   * Kreis-Websites verstecken sie hinter einem „E-Mail"-Link, waehrend
   * sie im Serviceportal der Gemeinde offen steht (so beschreibt es die
   * Vorlage v6 in `sucheAdresse`).
   *
   * ZWEI DINGE KOMMEN DABEI HERAUS, und das zweite ist das wichtigere:
   *   1. Ein Beleg, wenn die Quellseite selbst nichts hergab.
   *   2. `pro_seite` — WELCHE Seite WELCHE Adresse trug. Ohne diese
   *      Zuordnung bleibt jede spaetere Personenangabe eine Behauptung.
   *
   * Der Beleg der Quellseite wird dadurch NICHT schwaecher: ein Fund auf
   * einer Nebenseite heisst ausdruecklich „auf einer weiteren amtlichen
   * Seite", nicht „auf der Quellseite". Wer das zusammenwirft, verliert
   * genau die Unterscheidung, um die es hier geht. */
  let belegDetail = { bestaetigt: false, alle: [], alternativen: [], pro_seite: [], texte: {} };
  try {
    /* v2440 · Die Quellseite wird jetzt MITGELESEN (vorher nur die
       weiteren): die Namenspruefung der Ansprechpersonen braucht ihren
       Text, und ohne sie stand die Quellseite nie in pro_seite. */
    const bq = gefunden._beleg_quelle || gefunden.quelle_url;
    const weitere = [bq, gefunden.quelle_url].concat(gefunden.seiten || [])
      .filter(function (u, i, l) { return u && l.indexOf(u) === i; });
    if (gefunden.email && weitere.length) {
      belegDetail = await belegSeiten(gefunden.email, weitere);
      if (!beleg.ok && belegDetail.bestaetigt) {
        beleg.ok = true;
        beleg.grund = 'auf einer weiteren amtlichen Seite gefunden ('
          + (belegDetail.pro_seite.find(function (s) {
              return s.mails.includes(_s(gefunden.email).toLowerCase()); }) || {}).url + ')';
      }
      /* ══ v2440 · PERSOENLICHES POSTFACH -> FUNKTIONSADRESSE (Vorlage v6)
         Nennt die Suche ein persönliches Postfach, und auf den gelesenen
         Seiten steht GENAU EINE Funktionsadresse derselben Domain, wird
         die genommen — die Person bleibt als Ansprechperson erhalten. */
      const em = _s(gefunden.email).toLowerCase();
      if (istPersonenpostfach(em)) {
        const dom = em.slice(em.indexOf('@'));
        const fkt = (belegDetail.alle || []).filter(function (m) {
          return !istPersonenpostfach(m) && m.slice(m.indexOf('@')) === dom; });
        if (fkt.length === 1) {
          gefunden._ansprechpartner_roh = [{ name: '', funktion: '', email: em, telefon: '' }]
            .concat(gefunden._ansprechpartner_roh || []);
          gefunden.email = fkt[0];
          beleg.ok = true;
          beleg.grund = 'Funktionsadresse von derselben amtlichen Seite statt eines persönlichen Postfachs ('
            + ((belegDetail.pro_seite.find(function (x) { return x.mails.includes(fkt[0]); }) || {}).url || '') + ')';
        }
      }
    } else if (weitere.length) {
      /* Ohne eigene Adresse trotzdem lesen: die Fundliste ist dann der
         brauchbarste Hinweis, den wir dem Nutzer geben koennen. */
      belegDetail = await belegSeiten('', weitere);
    }
  } catch (e) {
    console.warn('[unterlagen] Belegseiten nicht lesbar:', e.message);
  }

  /* v2152 · Erst JETZT, nachdem die Seiten gelesen sind: der Beleg je
     Person haengt an `belegDetail`. Vorher gebaut waere `bestaetigt`
     immer false — und ein Feld, das immer dasselbe sagt, sagt nichts. */
  const personen = personenAus(
    gefunden._ansprechpartner_roh,
    gefunden.email,
    belegDetail,
    gefunden._beleg_quelle || gefunden.quelle_url
  );
  if (register) {
    beleg.grund = 'Zuständigkeit und Quelle aus dem DealPilot-Register (amtlicher Datensatz)'
      + (gefunden.email ? (beleg.ok ? '; E-Mail wörtlich auf der Quellseite gefunden' : '; E-Mail aus der Websuche, nicht belegt') : '; keine E-Mail-Adresse ermittelt');
    beleg.ok = beleg.ok || !gefunden.email;
  }

  /* ══ v2152 · DIE ANGEHAKTE KOPIE UEBERLEBT EINE NEURECHERCHE ════════
   *
   * Im `ON CONFLICT`-Zweig unten steht `ansprechpartner` NICHT einfach
   * auf `EXCLUDED.ansprechpartner`. Das wuerde die Liste komplett
   * ersetzen und damit jedes `kopie: true` loeschen, das der Nutzer
   * gesetzt hat. Eine Neurecherche bringt oft genau dieselben Personen —
   * dann waere seine Auswahl ohne Grund weg.
   *
   * Die NEUEN Personen gewinnen deshalb nur, wenn ueberhaupt welche
   * gefunden wurden. Eine leere Liste ueberschreibt eine gefuellte
   * NICHT: „nichts gefunden" ist kein Grund, Bekanntes zu verwerfen.
   *
   * ── WARUM DIESER KOMMENTAR HIER STEHT UND NICHT IM SQL ────────────
   *
   * Der erste Entwurf hatte ihn IM Template-Literal. Er nannte dort
   * `_beleg_quelle` in Backticks — und ein Backtick beendet ein
   * Template-Literal, auch mitten in einem, was wie ein Kommentar
   * aussieht. `node --check` meldete „missing ) after argument list",
   * 500 Zeilen weiter unten.
   *
   *   > Dieselbe Klasse wie ein zitiertes Kommentarende in einem
   *   > CSS-Kommentar: das Zeichen wirkt, egal was drumherum steht.
   *   > In einem Template-Literal gibt es keine Kommentare.
   */
  const r = await query(
    `INSERT INTO unterlagen_aemter
       (gemeinde_schluessel, plz, ort, art, behoerde, abteilung, email, telefon,
        kanal, antrag_url, quelle_url, seiten, gebuehr, hinweis, kreis, bundesland,
        beleg_ok, beleg_grund, ansprechpartner, geprueft_am, erstellt_von)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),$20)
     ON CONFLICT (gemeinde_schluessel, art) DO UPDATE SET
       behoerde = EXCLUDED.behoerde, abteilung = EXCLUDED.abteilung,
       email = EXCLUDED.email, telefon = EXCLUDED.telefon, kanal = EXCLUDED.kanal,
       antrag_url = EXCLUDED.antrag_url, quelle_url = EXCLUDED.quelle_url,
       seiten = EXCLUDED.seiten, gebuehr = EXCLUDED.gebuehr,
       hinweis = EXCLUDED.hinweis, kreis = EXCLUDED.kreis,
       bundesland = EXCLUDED.bundesland, beleg_ok = EXCLUDED.beleg_ok,
       beleg_grund = EXCLUDED.beleg_grund,
       -- v2152: siehe den Kommentar oberhalb dieser Abfrage
       ansprechpartner = CASE
         WHEN jsonb_array_length(EXCLUDED.ansprechpartner) > 0
           THEN EXCLUDED.ansprechpartner
         ELSE unterlagen_aemter.ansprechpartner
       END,
       geprueft_am = now()
     RETURNING *`,
    [schluessel, ort.plz || null, ort.ort || null, art, gefunden.behoerde,
     gefunden.abteilung || null, gefunden.email || null, gefunden.telefon || null,
     gefunden.kanal, gefunden.antrag_url || null, gefunden.quelle_url || null,
     /* v2151 · `seiten` traegt jetzt den BELEG je Seite, nicht nur die
        URL-Liste. Form: { liste: [url,…], pro_seite: [{url,mails}],
        alternativen: [mail,…] }. Das bricht nichts — gemessen hat diese
        Spalte keinen einzigen Leser; die `liste` bleibt trotzdem drin,
        damit ein kuenftiger Leser nicht erst parsen muss. */
     JSON.stringify({
       liste: gefunden.seiten || [],
       pro_seite: belegDetail.pro_seite,
       alternativen: belegDetail.alternativen,
       beleg_quelle: beleg.gefundene ? { url: gefunden._beleg_quelle || gefunden.quelle_url,
                                         mails: beleg.gefundene } : null
     }), gefunden.gebuehr || null,
     gefunden.hinweis || null, gefunden.kreis || null, gefunden.bundesland || null,
     beleg.ok, beleg.grund, JSON.stringify(personen), userId || null]);

  return { gefunden: true, aus_register: false, amt: r.rows[0], beleg: beleg };
}

/* ═══ DAS ANSCHREIBEN ═══════════════════════════════════════════════════
 *
 * Ein Entwurf, kein Versand. Die Flurstücksangaben kommen mit, wenn sie da
 * sind — ohne sie muss das Amt selbst suchen, und das dauert. */
function anschreiben(art, objekt, absender) {
  const u = ARTEN_MAP[art];
  if (!u) throw new Error('Unbekannte Unterlagenart: ' + art);
  const o = objekt || {};
  const a = absender || {};
  const adresse = [o.strasse, [o.plz, o.ort].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');

  const flur = [
    o.gemarkung && ('Gemarkung ' + o.gemarkung),
    o.flur && ('Flur ' + o.flur),
    o.flurstueck && ('Flurstück ' + o.flurstueck)
  ].filter(Boolean);

  const zeilen = [];
  zeilen.push('Sehr geehrte Damen und Herren,');
  zeilen.push('');
  zeilen.push('ich bin mit der Bewertung des folgenden Objekts beauftragt:');
  zeilen.push('');
  zeilen.push('    ' + adresse);
  if (flur.length) zeilen.push('    ' + flur.join(' · '));
  if (o.eigentuemer) zeilen.push('    Eigentümer: ' + o.eigentuemer);
  zeilen.push('');
  zeilen.push(u.bitte);
  zeilen.push('');
  /* Die Vollmacht wird nur erwähnt, wenn sie wirklich beiliegt. Ein Satz
     über eine Anlage, die fehlt, kostet den ganzen Vorgang eine Runde. */
  if (a.vollmacht_liegt_bei) {
    zeilen.push('Die Vollmacht des Eigentümers liegt diesem Schreiben bei.');
  } else {
    zeilen.push('Eine Vollmacht des Eigentümers kann ich auf Anforderung '
      + 'unverzüglich nachreichen.');
  }
  zeilen.push('');
  zeilen.push('Für Rückfragen stehe ich gern zur Verfügung. Über eine kurze '
    + 'Mitteilung zu Bearbeitungsdauer und etwaigen Gebühren würde ich mich freuen.');
  zeilen.push('');
  zeilen.push('Mit freundlichen Grüßen');
  if (a.name) zeilen.push(a.name);
  if (a.firma) zeilen.push(a.firma);
  if (a.anschrift) zeilen.push(a.anschrift);
  if (a.telefon) zeilen.push('Telefon ' + a.telefon);
  if (a.email) zeilen.push(a.email);

  return {
    betreff: u.betreff + (o.strasse ? ' — ' + adresse : ''),
    text: zeilen.join('\n')
  };
}

/* ═══ LESEN: was die Ernte für eine Gemeinde schon hält ═════════════════
 *
 * v1844 · Das Modal zählte beim Öffnen „5 von 5 fehlen", obwohl für
 * Hüllhorst zwei Ämter längst hinterlegt waren — es erfuhr das erst beim
 * Klick. Eine Anzeige, die mehr Arbeit ankündigt als da ist, ist eine
 * falsche Anzeige. */
async function aemterFuer(plz, ort) {
  const schluessel = gemeindeSchluessel(plz, ort);
  if (!schluessel || schluessel === '-') return [];
  const r = await query(
    `SELECT * FROM unterlagen_aemter WHERE gemeinde_schluessel = $1 ORDER BY art`,
    [schluessel]);
  /* v2440 · Was der PLZ-genaue Satz nicht abdeckt, darf der
     gemeindeweite füllen (nur im passenden Leitbereich). */
  const da = {};
  r.rows.forEach(function (a) { da[a.art] = true; });
  let weit = [];
  try { weit = await gemeindeweitFuer(plz, ort); } catch (e) { weit = []; }
  return r.rows.concat(weit.filter(function (a) { return !da[a.art]; })
    .map(function (a) { return Object.assign({}, a, { gemeindeweit: true }); }));
}

module.exports = {
  ARTEN, ARTEN_MAP, gemeindeSchluessel, istGewerblich, mailGueltig,
  amtSuchen, amtHolen, aemterFuer, belegPruefen, anschreiben,
  /* v2151 · fuer die Pruefstrecke und kuenftige Aufrufer */
  mailsAufSeite, istPersonenpostfach, belegSeiten,
  /* v2152 · der Zusammenbau der Ansprechpersonen */
  personenAus,
  /* v2152a · der Leser, der beide Formen von `seiten` versteht */
  seitenLesen,
  /* v2440 · Namenspruefung, Schutz vor internen Adressen, gemeindeweite
     Saetze, Adresssaeuberung, Kanal — fuer Pruefstrecke und Einspielweg */
  seitenText, nameAufSeiten, istLokal, ortKern, gemeindeweitSchluessel,
  gemeindeweitFuer, mailSauber, kanalAus
};
