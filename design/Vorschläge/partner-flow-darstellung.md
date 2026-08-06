# Partner-Whitelabel und Darstellung — Befund und drei Wege

> **Stand 2026-08-06: C und A sind umgesetzt** (`v1111`, siehe BACKLOG).
> **B bleibt offen** und ist von dort aus nachrüstbar, ohne etwas
> umzubauen — A ist genau seine Voreinstellung. Der in Abschnitt 6
> benannte Reset-Fall ist mit erledigt.


*2026-08-06 · Auftrag von Marcel: „Im Partner-Portal kann man ja das
Whitelabel setzen und das wird auch übernommen für die Einstellungen, also
die Menüs etc. Das sollte sich nicht mit unserem unter Profil & Anzeige →
Darstellung ins Gehege kommen. Ziel ist ein sinnvoller Flow für den
Partner-/Reseller-Plan."*

---

## 1 · Befund — gemessen, nicht angenommen

Es gibt heute **drei** Stellen, an denen jemand das Aussehen bestimmt. Sie
wurden nacheinander gebaut und wissen wenig voneinander.

| Ort | Wer bedient ihn | Was er setzt | Wo es landet |
|---|---|---|---|
| **Partner-Portal** → Branding-Editor (`rp-b-disp`) | Partner, für **seine Mandanten** | Akzent, Obsidian, Mail-Farbe, Name, Logo, PDF-hell | Server, je Mandant |
| **Darstellung** → Abschnitt Marke (`ui-varianten.js`, seit v1098) | Partner, **für sich** — oder Mandant für sich | Akzent, Grundfarbe, 6 Bereichsfarben, Logo, Schrift | 14 Einzelschlüssel `dp_*_ui` |
| **Darstellung** → Vorlage/Karten/Fläche/Form | **jeder**, für sich | Vorlage, Kartenmodus, Kartenfläche, Form | ein JSON `dp_user_settings` |

### 1.1 Die Lücke: die neue Darstellung wird nicht durchgereicht

Der Mandanten-Abgleich kennt **14 Schlüssel**, alle aus dem alten Panel:

```
dp_chrome_hell  dp_hdr_compact  dp_hdr_ui   dp_side_ui   dp_text_ui
dp_hero_ui      dp_kpi_ui       dp_obj_ui   dp_objtext_ui
dp_tabtext_ui   dp_card_ui      dp_accent_ui dp_font_ui  dp_zoom_ui
```

Gemessen in `darstellung-reseller.js` und `mandant-branding.js`: **keines
der beiden Module enthält `ui_theme`, `ui_cards`, `ui_surface`, `ui_form`
oder `dp_user_settings`.** Ein Partner kann seinen Mandanten also Farben,
Schrift und Logo vorgeben — aber **nicht** die Vorlage, den Kartenmodus,
die Kartenfläche oder die Form. Genau die vier Dinge, die den optischen
Gesamteindruck am stärksten prägen.

### 1.2 Die Kollision: wer gewinnt, wenn beide etwas sagen

Seit v1102/v1104 gilt gemessen: eine gesetzte **Bereichsfarbe übersteuert
die Vorlage** (`var(--dpuv-side-bg, var(--uv-chrome))`). Das ist so gebaut
und richtig — der Regler soll ja wirken.

Für den Partner-Fall heißt das aber:

* Partner setzt für seine Mandanten eine Marke → Farben kommen an.
* Der Mandant wählt danach „Konsole" → **Flächen und Schrift kippen auf die
  Vorlage**, die Partner-Farben bleiben nur dort, wo der Partner explizit
  eine Bereichsfarbe gesetzt hat.
* Der Mandant wählt „Zurücksetzen" → **die Partner-Marke ist weg**, bis das
  Mandanten-Branding beim nächsten Laden erneut greift.

Es gibt heute keine Ebene, die sagt: *das hier gehört dem Partner und darf
vom Mandanten nicht überschrieben werden.*

### 1.3 Was heute schon richtig funktioniert

Damit das nicht untergeht — der Umschalter „Mich / Meine Mandanten"
(`_dpResBlock`, `_dpResCommit`) ist ein sauberer Mechanismus: Er
fotografiert den persönlichen Stand, lädt den Mandanten-Stand, zeigt ihn
live, und „Für meine Mandanten speichern" macht ihn erst dann gültig.
Zurück auf „Mich" stellt den eigenen Stand wieder her, ohne zu speichern.
**Dieses Muster ist die Grundlage aller drei Vorschläge.**

---

## 2 · Die Leitfrage

> Ist die Darstellung eine **Marke** (dem Partner gehörend, verbindlich)
> oder eine **Bequemlichkeit** (dem Nutzer gehörend, frei)?

Heute ist die Antwort uneinheitlich: Farben und Logo werden wie Marke
behandelt, Vorlage und Kartenmodus wie Bequemlichkeit. Genau daraus
entsteht das Gehege.

Alle drei Wege unten beantworten diese Frage — nur unterschiedlich.

---

## 3 · Weg A — „Marke ist gesetzt, Komfort ist frei"

**Die Trennung wird zur Regel gemacht, sauber und ohne neue Bedienung.**

| Ebene | Wer bestimmt | Inhalt |
|---|---|---|
| **Marke** | der Partner, verbindlich | Akzent, Grundfarbe, die 6 Bereichsfarben, Logo, Schrift |
| **Komfort** | der Mandant, frei | Vorlage, Kartenmodus, Kartenfläche, Form, Textgröße |

Der Mandant sieht den Abschnitt **Marke** weiterhin — aber ausgegraut, mit
dem Hinweis „Von deinem Partner vorgegeben". Genau die Mechanik, die für
Nicht-Partner heute schon steht (`dpuv-lock` + `dpuv-lockbar`).

**Dafür:**
* Kein neues Bedienkonzept, kein neuer Speicherort — nur eine Sperre mehr.
* Die Marke des Partners ist verlässlich. Das ist der Kern seines Produkts.
* Der Mandant behält, was ihm wirklich nützt: wie viel eine Karte zeigt,
  wie groß die Schrift ist, wie dicht die Oberfläche.
* Umsetzbar in einem Paket: `istPartner()` um „ist Mandant eines Partners"
  erweitern (`dp_wl_cache` ist gemessen genau dieses Kennzeichen), Abschnitt
  Marke sperren, fertig.

**Dagegen:**
* Ein Mandant mit dunkler Partner-Marke, der lieber hell arbeitet, kann die
  Flächen nicht mehr aufhellen — er kann nur die Vorlage wechseln, und die
  wird von den Partner-Bereichsfarben teilweise übersteuert.

**Aufwand:** klein. Ein Paket.

---

## 4 · Weg B — „Der Partner entscheidet, was er freigibt"

**Der Partner bekommt drei Schalter, mit denen er selbst bestimmt, wie viel
Freiheit seine Mandanten haben.**

Im Partner-Portal, direkt beim Branding:

```
Was dürfen deine Mandanten selbst ändern?
  ( ) Nichts — meine Marke gilt unverändert
  (•) Vorlage und Karten — Farben und Logo bleiben meine
  ( ) Alles — meine Marke ist nur die Voreinstellung
```

Der Wert wandert als **ein** Feld mit dem Branding an den Mandanten
(z. B. `wl_freiheit: 'keine' | 'komfort' | 'alles'`), und `gateSetzen()`
im Panel liest ihn.

**Dafür:**
* Beantwortet die Leitfrage nicht für alle gleich, sondern lässt sie den
  Partner beantworten — und der kennt seine Mandanten.
* Ein Steuerberater mit Kanzlei-CI wählt „Nichts", ein Vertrieb mit vielen
  Endkunden wählt „Alles".
* Verkaufsargument: sichtbare Kontrolle über die eigene Marke.
* Weg A ist die mittlere Stufe davon — B ist also A plus zwei Optionen.

**Dagegen:**
* Ein Feld mehr im Branding-Datensatz, also Backend-Migration.
* Der Partner muss eine Entscheidung treffen, die er vielleicht nicht
  treffen will. Braucht eine gute Voreinstellung („Vorlage und Karten").

**Aufwand:** mittel. Ein Feld im Branding, Panel-Sperre, Portal-Bedienung.

---

## 5 · Weg C — „Vorlage wird Teil der Marke"

**Die neue Darstellung wandert vollständig in den Mandanten-Abgleich.**

Die vier fehlenden Schlüssel (`ui_theme`, `ui_cards`, `ui_surface`,
`ui_form`) kommen in die `MAP` von `darstellung-reseller.js` und in
`mandant-branding.js`. Der Partner stellt seine Mandanten-Ansicht damit
komplett ein — Vorlage inklusive.

**Dafür:**
* Der Partner sieht in der Mandanten-Vorschau **genau**, was der Mandant
  sieht. Heute stimmt diese Vorschau bei vier Einstellungen nicht.
* Beseitigt die Lücke aus 1.1 vollständig.
* Technisch die kleinste Änderung an der Mechanik: dieselbe MAP, vier
  Zeilen mehr — der Umschalter „Mich / Meine Mandanten" trägt sie sofort.

**Dagegen:**
* Löst die Kollision aus 1.2 **nicht**. Ohne Weg A oder B kann der Mandant
  weiterhin alles überschreiben, es gibt nur mehr zu überschreiben.
* Allein genommen macht es die Sache eher schlimmer.

**Aufwand:** klein. Aber nur sinnvoll **zusammen mit** A oder B.

---

## 6 · Empfehlung

**C als Fundament, A als Regel, B später wenn es nachgefragt wird.**

Konkret in dieser Reihenfolge:

1. **C zuerst** (klein, keine Produktentscheidung): die vier Schlüssel in
   die MAP. Danach reicht der Partner-Abgleich alles durch, und die
   Mandanten-Vorschau stimmt endlich.
2. **Dann A** (die Produktentscheidung): Marke gesperrt, Komfort frei.
   Der Mandant sieht den Abschnitt Marke ausgegraut mit „Von deinem Partner
   vorgegeben" — dieselbe Optik wie heute für Nicht-Partner.
3. **B nur, wenn ein Partner danach fragt.** Die Voreinstellung von B ist
   ohnehin genau A; die zwei Zusatzoptionen kann man jederzeit nachrüsten,
   ohne etwas umzubauen.

**Warum nicht gleich B:** Es kostet eine Backend-Migration und verlangt vom
Partner eine Entscheidung, für die es noch keine Nachfrage gibt. A ist die
Voreinstellung von B — wer A baut, hat B zu zwei Dritteln gebaut.

### Was dabei auffallen wird

Ein Punkt, der bei der Umsetzung geklärt werden muss und den keiner der
drei Wege von selbst löst: **Was passiert beim „Zurücksetzen" im Panel,
wenn der Nutzer Mandant eines Partners ist?** Heute räumt es alles weg,
auch die Partner-Marke — bis zum nächsten Laden. Richtig wäre: „Zurücksetzen"
stellt beim Mandanten **den Partner-Stand** wieder her, nicht den
DealPilot-Standard. Das ist eine Zeile in der Reset-Behandlung und gehört
in dasselbe Paket wie A.

---

## 7 · Anhang: die Kennzeichen, die es schon gibt

Damit niemand etwas Neues erfindet, was es gibt:

| Frage | Antwort im Code | gemessen |
|---|---|---|
| Bin ich Partner? | `Plan.can('reseller')` — `darstellung-reseller.js:48` | ja, ist das führende Tor seit v1098c |
| Bin ich Mandant eines Partners? | `dp_wl_cache` im localStorage — das Backend liefert es für Owner `null` | ja, so nutzt es die Handy-Sperre bereits |
| Wie reiche ich etwas durch? | `MAP` + `applySet()` + `_dpResCommit()` | 14 Schlüssel, Muster steht |
| Wie sperre ich sichtbar? | `dpuv-lock` + `dpuv-lockbar` in `ui-varianten.js` | Deckkraft 0,42, keine Klicks, Hinweis |
