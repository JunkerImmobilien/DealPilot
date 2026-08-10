# MA-Serie ausbauen, normale Ansicht fürs Handy freigeben

**Stand:** 2026-08-10 · Vorschlag zu Backlog-Punkt 1 · **gemessen, nicht
angenommen** · Entscheidung von Marcel, 2026-08-08

---

## Kurzfassung

Der Backlog-Punkt nennt **zwei** Sperren und **eine** Datei. Gemessen sind es
**zwei Sperren und neun Fundstellen in sieben Dateien** — darunter zwei, die
der Punkt nicht kennt und die beide echte Löcher reißen, wenn man sie übersieht:

1. **Ein Service Worker liegt auf den Geräten der Nutzer.** Er hat den
   Geltungsbereich `/mobile-demo.html` und liefert die Hülle aus seinem Cache,
   wenn das Netz sie nicht mehr hergibt. Wer die Datei löscht, ohne ihn
   abzumelden, lässt installierte Handy-Apps **dauerhaft** auf einer Fassung
   stehen, die es nicht mehr gibt. Kein Rollout erreicht diese Geräte je wieder.
2. **Die Landingpage wirbt aktiv für die MA.** „App installieren" und der
   QR-Code zeigen auf `mobile-demo.html`. Das ist der sichtbarste Weg, auf dem
   heute überhaupt jemand dort ankommt.

Deshalb ist die Reihenfolge nicht Geschmack, sondern die eigentliche Arbeit.

---

## 1 · Was es wirklich gibt (gemessen)

### Die zwei Sperren

| | Datei | Was sie sperrt | Kennzeichen |
|---|---|---|---|
| **v970** | `frontend/js/mobile-redirect.js` (179 Z.) | die **Haupt-App** auf schmalem Schirm mit grobem Zeiger | Marker `MB1-hardblock` |
| **MA35** | `frontend/mobile-demo.html` ab Z. 556 | den **Direktaufruf** von `mobile-demo.html` auf echten Handys | Overlay `dp-mobile-block` |

Beide bauen dasselbe Overlay-Muster, beide sind bewusst gesetzt. Der Name
`mobile-redirect.js` täuscht: **es leitet nichts um**, es legt ein Overlay auf.

### Die MA-Serie ist mehr als eine Datei

| Datei | Umfang | Rolle |
|---|---|---|
| `frontend/mobile-demo.html` | **2.866 Z., 238 KB** | der Prototyp, in sich geschlossen, enthält MA35 |
| `frontend/dp-mobile-sw.js` | 28 Z. | **Service Worker**, Geltungsbereich `/mobile-demo.html` |
| `frontend/dp-mobile.webmanifest` | 17 Z. | PWA-Manifest, `start_url` und `scope` = `/mobile-demo.html` |
| `frontend/js/mobile-branding.js` | 125 Z. (W2) | Whitelabel für die MA |
| `frontend/assets/dp-pwa-192.png` · `-512.png` · `-512-maskable.png` | 3 Dateien | die Symbole der installierten App |
| `frontend/landing/index.html` Z. **1272**, **1290–1292** | CTA + QR | **wirbt für die MA** |
| `tools/gold-audit.py` Z. 58 | 1 Zeile | listet `mobile-demo.html` als zu prüfendes Dokument |

Marker im Bestand: `MA06 MA15 MA16 MA21 MA25 MA35 MA36 MA37` — **alle acht in
`mobile-demo.html`**, keiner sonst in der App. `MA27` in `rp-pdf-engine.js` ist
**kein** MA-Punkt, sondern ein Verweis auf ein Bauartmuster („MA27-Muster");
diese Datei bleibt unberührt.

### Wer die Erkennungsregeln sonst noch liest

Der Punkt warnt zu Recht vor `dp_wl_cache`. Gemessen, drei Leser:

| Datei | liest `dp_wl_cache` als | Schicksal |
|---|---|---|
| `js/mandant-branding.js` (Z. 233, 234, 259, 269, 270) | **Eigentümer** — schreibt und räumt es | **bleibt** |
| `js/ui-varianten.js` (Z. 528, 534) | Kennzeichen „Mandant eines Partners" für die **Whitelabel-Sperre im Panel** (v1111) | **bleibt** |
| `js/mobile-redirect.js` (Z. 152) | Kennzeichen für die **Plan-Freigabe der Handy-Sperre** (v1085) | **fällt mit** |

**Damit ist die Warnung des Punktes bestätigt und zugleich entschärft:** die
Whitelabel-Sperre hängt an `ui-varianten.js`, nicht an der Handy-Sperre. Wer
`mobile-redirect.js` löscht, nimmt ihr nichts weg. Es fällt **eine** von drei
Lesestellen.

Ebenfalls betroffen und **nur** in `mobile-redirect.js`:
`dp_mb_bypass` (die Hintertür `?nomobileblock`), `dp_mobile_choice` (Altlast der
v939-Weiche, wird dort beim Start gelöscht), die Schwellen `NARROW_MAX 700` und
`SHORT_EDGE_MAX 1400`, sowie `dp_last_plan` als zweiter Freigabeweg
(`dp_last_plan` selbst gehört `subscription.js` und **bleibt**).

---

## 2 · Die Reihenfolge — und warum sie so herum sein muss

Der Punkt sagt: „erst die Umleitung, dann die Sperre". Das ist richtig, aber
unvollständig: es sind **vier** Schritte, und der Service Worker gehört an den
**Anfang**, nicht ans Ende.

### Schritt 1 · Den Service Worker abmelden — **zuerst**

Solange `mobile-demo.html` noch ausgeliefert wird, bekommt jedes Gerät, das die
Seite öffnet, den Abmeldebefehl. `dp-mobile-sw.js` wird dazu **nicht gelöscht,
sondern ersetzt** durch eine Fassung, die sich selbst abräumt:

```js
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (k) { return Promise.all(k.map(function(n){ return caches.delete(n); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({type:'window'}); })
      .then(function (cs) { cs.forEach(function (c) { c.navigate('/'); }); })
  );
});
```

Dazu in `mobile-demo.html` neben der bestehenden Registrierung ein
`navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))`.

**Warum zuerst:** ein Service Worker wird nur ausgetauscht, wenn das Gerät die
Seite noch erreicht. Ist die Datei weg, greift `caches.match('/mobile-demo.html')`
als Offline-Rückfall — die alte Hülle bleibt für immer stehen. **Das ist der
einzige Schritt, der sich später nicht mehr nachholen lässt.**

Diese Fassung muss **stehen bleiben**, bis mit hinreichender Sicherheit jedes
Gerät sie einmal gesehen hat. Vorschlag: **eine Rollout-Runde stehen lassen**,
erst danach Schritt 4.

### Schritt 2 · Die Landingpage umhängen

`landing/index.html` Z. 1272 und 1290–1292: Ziel von `/mobile-demo.html` auf
`/` (die normale App). Der QR-Code zeigt ohnehin schon die nackte Domain — die
Zeile, die `/mobile-demo.html` wegschneidet, wird damit überflüssig, nicht falsch.

Text und Versprechen der Kachel („Quick Check vor Ort", „Boarding-Pässe im
Blick", „auf den Startbildschirm") bleiben gültig — **sie beschreiben die
Haupt-App genauso.** Der iPhone-Hinweis „Zum Home-Bildschirm" trägt weiter.

**Offen und Marcels Entscheidung:** Soll die Haupt-App ein **eigenes**
PWA-Manifest bekommen, damit „auf den Startbildschirm" wieder ein echtes
App-Symbol ergibt? Die drei Symbole liegen bereits (`dp-pwa-*.png`). Das wäre
ein kleiner Nachschlag mit eigenem Namensraum, **kein** Teil dieses Punktes.
Ohne ihn legt das Handy ein Lesezeichen-Symbol an, keine App-Kachel.

### Schritt 3 · Die Sperre der Haupt-App entfernen

`js/mobile-redirect.js` wird aus `index.html` genommen und gelöscht. Erst
**nach** Schritt 2, denn ab hier ist die Haupt-App auf dem Handy offen und die
Landingpage darf niemanden mehr woanders hinschicken.

**Mitzunehmen, sonst bleiben Leichen:**
- der `<script>`-Eintrag in `index.html` samt Cache-Buster
- die Erwähnung in **CLAUDE.md** unter „Nicht anfassen" (siehe Abschnitt 4)
- **nichts** an `ui-varianten.js` — die Whitelabel-Sperre bleibt unangetastet

**Die Hintertür `?nomobileblock` fällt mit.** Sie hat ohne Sperre keinen Zweck.
Sie steht in CLAUDE.md und in mehreren Backlog-Einträgen als Prüfweg — dort
gehört ein Vermerk hin, sonst sucht die nächste Sitzung eine Hintertür, die es
nicht mehr gibt.

### Schritt 4 · Die MA ablegen, nicht löschen

**Empfehlung, wie im Punkt vorgeschlagen: ablegen.** `mobile-demo.html` war
Marcels Bildvorlage für mehrere Umbauten (v1105 Stapel-Modus, v1112, v1116) und
ist mit 2.866 Zeilen die vollständigste Gestaltungsvorlage, die es gibt.

Nach `design/mockups/dp-handy-mockup-ma.html` — **derselbe Ordner, in dem schon
`dp-handy-mockup-v2.html` liegt**, damit Layoutfragen weiter dort beantwortet
werden. Der MA35-Block wird dabei **entfernt** (eine Vorlage, die sich auf dem
Handy selbst sperrt, ist als Vorlage wertlos), ebenso die
Service-Worker-Registrierung und das Manifest-`<link>`.

Ersatzlos **gelöscht** werden dann:
`frontend/mobile-demo.html`, `frontend/dp-mobile.webmanifest`,
`frontend/js/mobile-branding.js` und — als Letztes, eine Runde später —
`frontend/dp-mobile-sw.js`.

`frontend/assets/dp-pwa-*.png` **bleiben liegen**: sie kosten nichts und werden
gebraucht, sobald die Haupt-App ihr eigenes Manifest bekommt.

`tools/gold-audit.py` Z. 58: `mobile-demo.html` aus der Dokumentenliste nehmen,
sonst meldet der Prüflauf eine fehlende Datei.

---

## 3 · Das Zeitfenster, das der Punkt meint

Der Punkt warnt: „andersherum steht ein Zeitfenster offen, in dem beides
erreichbar ist." Gemessen ist die Lage **entspannter als befürchtet**, weil die
zwei Sperren einander nicht brauchen:

- `mobile-redirect.js` prüft `alreadyOnPwa()` und tritt auf `mobile-demo.html`
  **gar nicht erst an** (Z. 159: `if (alreadyOnPwa()) return;`). Die beiden
  Sperren überlappen also nicht, sie grenzen aneinander.
- Fällt v970 zuerst, ist die Haupt-App offen **und** die MA weiter per MA35
  gesperrt — kein Loch, nur zwei Wege, von denen einer noch blockt.
- Fällt MA35 zuerst, steht die halbfertige MA auf dem Handy offen, **während**
  die Haupt-App noch sperrt. **Das** ist der schlechte Zustand: der Nutzer
  landet auf dem Prototyp und hält ihn für das Produkt.

**Also: MA35 fällt zuletzt** — genauer, es fällt gar nicht, sondern verschwindet
mit der Datei in Schritt 4.

---

## 4 · Die Projektanweisung widerspricht sich sonst selbst

`CLAUDE.md` führt unter **„Nicht anfassen"**:

> **Handy-Sperre** `js/mobile-redirect.js` (v970) + MA35. Bewusst aktiv.
> Kein Redirect trotz des Namens — ein Overlay. Regeln: `pointer:coarse` oder
> `hover:none`, dazu `innerWidth ≤ 700` **oder** kurze Kante ≤ 1400 physische
> Pixel. Tablets sind damit frei. Umgehung zum Testen: `?nomobileblock`

Der Eintrag wird **mit derselben Änderung** ersetzt — nicht gelöscht, sondern zu
einem Merkposten umgeschrieben, damit die nächste Sitzung die Geschichte kennt:

> **Handy-Sperre entfernt (v1118).** `js/mobile-redirect.js` (v970) und MA35
> sind weg, die normale Ansicht trägt das Handy allein. `?nomobileblock` gibt es
> nicht mehr — bei 390 px wird jetzt direkt geprüft. Die Vorlage der alten
> Mobile-Fassung liegt als `design/mockups/dp-handy-mockup-ma.html`.

Ebenso: der Eintrag „Media-Queries konsolidieren" im Backlog trägt bereits den
Vermerk, dass dieser Punkt ihn **größer** macht. Das bleibt richtig.

---

## 5 · Der Durchgang danach

Der Punkt verlangt „den vollständigen Durchgang bei 390 px — jeder Bereich, jede
Einstellung". Gemessen wird im **gleich-Origin-iframe**, nicht über die
Fenstergröße (`resize_window` ändert `innerWidth` im Prüf-Chrome nicht).

Was der Durchgang prüft, je Bereich:

| Prüfung | Schwelle | woher |
|---|---|---|
| Querlauf | `scrollWidth == clientWidth`, `body == Viewport` | v1112 |
| Trefferflächen | jeder Knopf **≥ 44 px** | v650/v652 |
| Textfelder | **≥ 16 px** (sonst zoomt iOS beim Tippen) | v650 |
| Kopfleiste | Höhe, `#hdr-badges` (auf 820 px waren es 589/492 px — W43) | Punkt 8 |

**Ausdrücklich mitzuprüfen, weil dort bisher niemand ankam:**
- **Der Marktbericht auf dem Handy** — steht als Nachweis unter „Später" und
  wird mit dieser Freigabe **dringend**: PDF-Knopf, Zwei-Finger-Geste auf der
  Karte, Erzeugen bei 390 px. Eigener Namensraum v1077.
- **Das Partner-Portal** — hatte bis v1112b **keine einzige** Media-Query.
- **Registrierung und Login** auf dem Handy. Der alte v939-Fehler war genau
  hier: „die volle Desktop-App stand auf dem Handy offen — auch direkt nach
  Registrierung/Login."

---

## 6 · Was zu entscheiden ist

| # | Frage | Vorschlag |
|---|---|---|
| **A** | Service Worker: eine Rollout-Runde stehen lassen, oder länger? | **Eine Runde.** Länger schadet nicht, kostet aber eine Datei im Bestand, die niemand mehr liest. |
| **B** | Bekommt die Haupt-App ein eigenes PWA-Manifest? | **Ja, aber als eigener Punkt.** Ohne ihn verliert „App installieren" seine Bedeutung; mit ihm wird aus dem Punkt ein zweites Vorhaben. |
| **C** | `mobile-demo.html` ablegen oder löschen? | **Ablegen** nach `design/mockups/`, wie der Backlog-Punkt vorschlägt. |
| **D** | Fällt `?nomobileblock` ersatzlos? | **Ja.** Ohne Sperre nichts zu umgehen. Vermerk in CLAUDE.md. |

**Nichts davon wird gebaut, bevor A und B beantwortet sind** — B entscheidet, ob
der Landing-CTA auf einen Halbzustand zeigt.

---

## 7 · Der Bauplan in einer Tabelle

| Schritt | Ändert | Rückholbar? |
|---|---|---|
| 1 | `dp-mobile-sw.js` → Selbstabmeldung, `mobile-demo.html` meldet ab | **Nein** — das ist der Grund für die Reihenfolge |
| 2 | `landing/index.html` Z. 1272, 1290–1292 | ja |
| 3 | `js/mobile-redirect.js` weg, `index.html`, `CLAUDE.md` | ja |
| 4 | MA nach `design/mockups/`, vier Dateien gelöscht, `gold-audit.py` | ja (git) |
| 5 | Durchgang bei 390 px, Bereich für Bereich | — |

Rollback läuft über `git checkout --`, nicht über Backups.
