# Bayerische Bodenrichtwerte — woher sonst?

Recherche 02.11.2026 auf Marcels Frage: „Können wir die bayerischen
Bodenrichtwerte nicht auch woanders besorgen?" Kein Code, keine Anfrage
verschickt.

---

## 0 · Die Kurzantwort

**Nein, eine andere legale Gratisquelle gibt es nicht.** Die Rechte an den
Werten liegen bei den **96 Gutachterausschüssen**, nicht beim Landesamt, und
der einzige Gesamtdienst sagt in seinen Metadaten selbst: **„kostenfrei für
private Nutzung"**. Für ein kommerzielles Produkt wie DealPilot braucht es also
eine Erlaubnis der Ausschüsse. Kaufen lässt sich das Recht nicht als ein
Produkt beim LDBV, es gibt dafür kein Landesprodukt.

**Zwei Befunde ändern aber das Bild:**

1. **Die Lage ist besser, als der Hinweis im Code sagt.** Eine Stichprobe von
   54 Punkten am 02.11.2026 ergab: **40 Ausschüsse zeigen den Wert offen**,
   13 zeigen „Information gebührenpflichtig". Gesperrt sind fast nur
   München Stadt und Land, Nürnberg, Augsburg, Regensburg und der
   Alpen- und S-Bahn-Gürtel im Süden. Der Satz „für die Einbindung verlangt
   das Landesamt eine Lizenz" ist **so nicht belegt**: Der Vorbehalt kommt aus
   den Metadaten des Dienstes (Rechteinhaber sind die Ausschüsse), nicht von
   einem Lizenzprodukt des LDBV.
2. **Das Einbetten des BayernAtlas als iFrame ist ausdrücklich erlaubt und
   kostenfrei** (Nutzungsbedingungen 09/2026, Nr. 2.1). Der Nutzer sieht den
   Wert dann in DealPilot an der Adresse und trägt ihn selbst ein. Das ist
   heute schon der Weg, nur ohne Karte im Formular.

---

## 1 · Was der Dienst selbst sagt (gemessen 02.11.2026)

`GetCapabilities` von
`https://gdi.bayern.de/services/bodenrichtwerte/2026/vboris` (mit Referer
`atlas.bayern.de`, HTTP 200):

| Feld | Wortlaut |
|---|---|
| `Abstract` | „Auskünfte über die Bodenrichtwerte sind gebührenpflichtig. Über die Höhe der jeweiligen Gebühren entscheidet der örtlich zuständige Gutachterausschuss. **Einzelne Gutachterausschüsse stellen ihre Bodenrichtwerte kostenfrei zur Einsicht zur Verfügung.** Diese Einsicht ersetzt jedoch nicht die amtliche Bodenrichtwertauskunft." |
| `Fees` | `None` |
| `AccessConstraints` | „**Der Dienst ist kostenfrei für private Nutzung.** Es gelten die allgemeinen Nutzungsbedingungen (http://geoportal.bayern.de/GeoportalBayern/inhalte/nutzungsbedingungen.html)." |
| Kontakt | Geschäftsstelle GDI Bayern, LDBV, Alexandrastraße 4, 80538 München, +49 89 2129-1424, `gdi-by@ldbv.bayern.de` |
| Layer 2026 | „… werden durch die 96 Gutachterausschüsse in Bayern bis Ende Juni 2026 bereitgestellt." |

Der in `AccessConstraints` genannte Link antwortet mit 404. Die gültige
Fassung liegt als PDF beim LDBV:
<https://ldbv.bayern.de/mam/ldbv/dateien/nutzungsbedingungen_geoportal_bayernatlas_bayernatlasplus.pdf>
(Stand 09/2026). Daraus sind vier Nummern entscheidend:

- **2.1** „Der BayernAtlas darf kostenfrei genutzt werden. Erlaubt ist
  insbesondere die Einbindung in eine Internetpräsentation über
  BayernAtlas-iFrame, BayernAtlas-Webkomponente oder Link …"
- **3.1** „Die erlaubte Nutzung einzelner … Datensätze und Geodatendienste
  (Georessourcen) ist abhängig von den Nutzungsbedingungen der jeweiligen
  Daten- und Diensteanbieter."
- **3.2/3.3** PDF-Auszüge und Screenshots dürfen weiterverwendet werden, aber
  **nicht weiterverkauft oder an Dritte unterlizenziert**.
- **4.2** „Die Anbieter besitzen alle Rechte … als Datenbankhersteller …
  Durch die Nutzung … entstehen rechtliche Beziehungen **zum Anbieter** und
  nicht zum Betreiber."

**Daraus folgt:** Das LDBV vermittelt nur. Rechteinhaber und damit
Ansprechpartner für eine kommerzielle Nutzung sind die Gutachterausschüsse.

### Stichprobe: wer zeigt den Wert offen? (54 Punkte, je ein Ortskern)

Gemessen mit einem Wegwerf-Skript (nicht im Repo): ein `GetFeatureInfo`
(`bodenrichtwerte_2026`, EPSG:4326) je Punkt, 400 ms Abstand.

| Ergebnis | Ausschüsse |
|---|---|
| **Wert offen (40)** | Städte Ingolstadt, Würzburg, Fürth, Erlangen, Bamberg, Bayreuth, Landshut, Passau, Kempten, Schweinfurt, Hof, Coburg, Amberg, Weiden, Straubing, Memmingen, Kaufbeuren, Ansbach, Schwabach · Landkreise Neumarkt, Ebersberg, Altötting, Günzburg, Ostallgäu, Starnberg, Freising, Dachau, Erding, Traunstein, Cham, Kelheim, Pfaffenhofen, Dillingen, Kitzingen, Forchheim, Neustadt/Aisch-Bad Windsheim, Lichtenfels, Kronach, Tirschenreuth, Unterallgäu |
| **„Information gebührenpflichtig" (13)** | Städte **München, Nürnberg, Augsburg, Regensburg**, Rosenheim · Landkreise **München**, Miesbach, Fürstenfeldbruck, Garmisch-Partenkirchen, Bad Tölz-Wolfratshausen, Deggendorf, Weilheim-Schongau, Landsberg am Lech |
| kein Treffer (1) | Stadt Aschaffenburg |

Das ist eine Stichprobe, keine Vollerhebung: 53 von 96 Ausschüssen sind
abgedeckt. Gesperrt sind gerade die Märkte mit dem meisten Volumen.

---

## 2 · Rechtsgrundlage der Gebühr, und was frei ist

- **§ 196 Abs. 3 BauGB:** Jedermann kann Auskunft verlangen. Die Vorschrift
  sagt nichts zur Kostenfreiheit.
- **§ 12 BayGaV:** Die Werte sind alle zwei Jahre zu ermitteln, einen Monat
  öffentlich auszulegen und elektronisch über ein GIS bereitzuhalten
  (Abs. 3). Zu Gebühren sagt die Verordnung nichts.
  <https://www.gesetze-bayern.de/Content/Document/BayGutAV-12>
- **Die Gebühr kommt aus dem Kostengesetz und dem Kostenverzeichnis**,
  Tarif-Nr. 2.I.1/1.8 (zitiert vom Landkreis München, 37 € je Grundstück und
  Stichtag):
  <https://www.landkreis-muenchen.de/buergerservice/dienstleistung/bodenrichtwerte/>
  Den Text der Tarifstelle selbst habe ich nicht gefunden.
- **Die Stadt München hält sich für verpflichtet, die Gebühr zu erheben.**
  Antrag der CSU-Stadtratsfraktion vom 12.05.2026: „Die BayGaV enthält keine
  Regelung zur Kostenfrage … die Kostenpflicht ergibt sich aus dem
  Bayerischen Kostenverzeichnis (KVz) … Damit ist die Stadt München und der
  Gutachterausschuss … zur Erhebung von Gebühren … verpflichtet. Alle anderen
  Bundesländer haben diese Gebühr bereits abgeschafft."
  <https://www.muenchen-transparent.de/dokumente/9701089/datei>
  Ob der Antrag Folgen hatte, habe ich nicht gefunden.
- **Warum es so ist:** In Bayern hängen die Ausschüsse an Landkreisen und
  kreisfreien Städten, die auch die Kosten tragen. Eine landesweite
  Kostenfreiheit „dürfte auf erheblichen Widerspruch der Landkreise und
  kreisfreien Städte stoßen" (MdL Zellmeier, 01.02.2019):
  <https://www.abgeordnetenwatch.de/profile/josef-zellmeier/fragen-antworten/302642>
- **„Seit 2024 großteils kostenfrei einsehbar" heißt:** Ausschüsse, die es
  einzeln so entschieden haben, schalten den Wert im BayernAtlas zur
  **Einsicht** frei. Die schriftliche, amtliche Auskunft bleibt
  gebührenpflichtig. Belege:
  - BayernPortal: „Bodenrichtwertauskünfte werden grundsätzlich gegen Gebühr
    erteilt." Die Informationen im VBORIS-Kartensystem sind kostenfrei.
    <https://www.bayernportal.de/dokumente/leistung/71665115334>
  - Stadt Töging (Lkr. Altötting), Juli 2026: „Über das Portal
    www.bodenrichtwerte.bayern.de sind die Daten im BayernAtlas kostenfrei
    und digital für jeden einsehbar … Schriftliche Auskünfte … [sind] auch in
    Zukunft gebührenpflichtig."
    <https://www.toeging.de/upload/mediapool/Online-Formulare/Infomaterial/Bodenrichtwerte_online.pdf>
  - Lkr. Ebersberg stellt die Werte kostenlos in den BayernAtlas, vorher 35 €
    (nur Presse-Sekundärquelle):
    <https://www.it-boltwise.de/stichwort/bodenrichtwerte>
- **Frei heißt hier frei zur Ansicht für Private.** Eine Erlaubnis zur
  kommerziellen Weiterverwendung steht nirgends, auch nicht bei den
  freigeschalteten Ausschüssen. Eine offene Lizenz (dl-de/zero, CC BY) habe
  ich für **keinen** bayerischen Ausschuss gefunden.

---

## 3 · Einzelne Ausschüsse mit eigenem Angebot

| Ausschuss | Weg | Kosten | Kommerzielle Einbindung |
|---|---|---|---|
| **München Stadt** | bodenrichtwerte-muenchen.de (Abrechnung: in medias res GmbH, Freiburg) | Einzelauskunft 30 €; **Dauerauskunft Stichtag 2026: Grundlizenz 1.000 €, jede weitere 350 €**; Kartensatz 650 € | nicht geregelt, Dauerauskunft ist Kartenzugang, keine Schnittstelle. <https://www.bodenrichtwerte-muenchen.de/> · <https://stadt.muenchen.de/service/info/bewertungsamt-geschaftsstelle-des-gutachterausschusses-bodenrichtwertauskunft/1075224/> |
| **Nürnberg** | Stadt, Amt für Geoinformation | 35 € je Grundstück und Stichtag; „unbefristeter Online-Zugang" auf Antrag (Preis nicht genannt); 9 Blätter 350 € | nicht geregelt. <https://www.nuernberg.de/internet/geoinformation_bodenordnung/bodenrichtwert.html> |
| **Augsburg, Lkr. München, Rosenheim, Würzburg u. a.** | **BORIS-Bayern** (43 Städte/Kreise + Oberer GAA; Betrieb vianovis GmbH, Betzigau; Inhalt: Oberer Gutachterausschuss, Landshut, `oga-bayern@landshut.de`) | je Ausschuss; Einzel- und Dauerauskunft | Impressum: „Alle Inhalte … dürfen ohne schriftliche Genehmigung nicht, auch teilweise nicht, verwendet werden." <https://www.boris-bayern.de/> |
| **Regensburg** | nicht gefunden | — | — |
| **Neustadt/Aisch-Bad Windsheim** | Richtwertliste kostenlos zum Download (Stand 2021) | 0 € | Lizenz nicht genannt |

**Gesamtabgaben je Landkreis** (Gebührenliste der Ausschüsse, Stand Oktober
2021, auf geodaten.bayern.de): meist **85–300 €** für die ganze
Richtwertliste. Amberg-Sulzbach bot 2021 den Landkreis als **passwortgeschützten
WMS für 190 €** an, Weilheim-Schongau eine Internet-Dauerauskunft für 600 €,
Würzburg Stadt ab 180 € im Jahr.
<https://www.geodaten.bayern.de/bayernatlas/custom/content/bodenrichtwerte/gebuehrenliste_gaa.pdf>
Diese Preise gelten für den eigenen Gebrauch. Eine Weitergabe an Kunden ist
darin nicht eingeschlossen.

---

## 4 · Weitere Wege

| Weg | Befund |
|---|---|
| **BORIS-D** | deckt Bayern nicht ab (eigene Messung im Code, `registry.js`). |
| **Open Data Bayern / OpenGeodata LDBV** | Die Vermessungsverwaltung gibt seit 2023 viele **Geobasis**daten frei. Bodenrichtwerte sind **Fach**daten der Ausschüsse und dort nicht als Download zu finden. <https://geodaten.bayern.de/opengeodata/> (keine Datensatzliste auf der Seite; ein Bodenrichtwert-Datensatz ist nicht nachgewiesen) |
| **Bodenrichtwerte-Deutschland.de u. ä.** | Zeigen für Bayern **keine Werte**, nur den Verweis auf BayernAtlas und BORIS-Bayern. Bestätigt: Kein Dritter hat eine freie Quelle. <https://www.bodenrichtwerte-deutschland.de/boris/bayern> |
| **Kommerzielle Datenanbieter** (nur intern) | Bewertungsdienstleister und Plattformbetreiber kaufen BRW in Bayern ein. Nach außen bleibt es bei „unabhängige Bewertungspartner". Konditionen habe ich nicht recherchiert, sie sind nicht öffentlich. Ein Bezug wäre ein zweiter Lizenzvertrag mit eigener Weitergabe-Klausel. |
| **Nutzer-Eintrag mit Link (heute)** | legal, kostenfrei, rechtlich sauber. |
| **BayernAtlas-iFrame im Formular** | **Ausdrücklich erlaubt und kostenfrei** (Nr. 2.1 der Nutzungsbedingungen). Ein Link mit Koordinaten und Bodenrichtwert-Ebene zeigt dem Nutzer den Wert direkt an seiner Adresse, wo der Ausschuss ihn freigibt. DealPilot liest den Wert dabei **nicht** aus, der Nutzer trägt ihn ein. Das Laden über die Ebenen-ID im Link ist zu prüfen. |

---

## 5 · Was im Code steht, und was davon nicht stimmt

`marktbericht/backend/src/connectors/boris/registry.js` (Bayern-Adapter,
Z. 311–405):

- **Kopf v1081:** „Freigabe der zuständigen Stelle liegt vor (Aktennotiz
  Junker Solution; Az. bei M. Junker — bei Vorlage wortgleich nachtragen)",
  `license: 'Freigabe (Aktennotiz Junker Solution)'`. **Diese Freigabe ist im
  Repo nicht belegt.** Rechteinhaber sind laut Nutzungsbedingungen die
  96 Ausschüsse. Die „zuständige Stelle" wäre also nicht das LDBV allein.
  **Marcel: Gibt es das Schreiben? Von wem, für welche Nutzung?** Ohne es
  ist die automatische Übernahme der offen gezeigten Werte durch
  `AccessConstraints` („kostenfrei für private Nutzung") **nicht gedeckt**.
- **`note`:** „für die Einbindung in Anwendungen verlangt das Landesamt eine
  Lizenz". Das ist als Behauptung zu stark: Ein Lizenzprodukt des LDBV habe
  ich nicht gefunden. Richtiger wäre: „Die Gutachterausschüsse geben ihre
  Werte nur zur privaten Einsicht frei."

---

## 6 · Empfehlung

| Weg | geht? | Kosten | Aufwand |
|---|---|---|---|
| Andere freie Quelle | **nein** | — | — |
| Offene Werte (40 von 54 in der Stichprobe) automatisch übernehmen | **nur mit Erlaubnis**, heute nicht gedeckt | voraussichtlich 0 € (offen, Anfrage nötig) | gering, Adapter liest die Werte schon |
| Landesweite Erlaubnis über den Oberen GAA / LDBV | **unklar**, kein Produkt bekannt | offen | eine Anfrage, dann abwarten |
| Lizenz je Ausschuss für die 13 gesperrten | ja, einzeln | grob **150–1.000 € je Ausschuss und Stichtag**, für die 13 gesperrten zusammen **ca. 3.000–6.000 € alle zwei Jahre** (Schätzung aus den Preisen oben). Weitergabe an Kunden muss eigens verhandelt werden. | hoch: 13 Verträge |
| BayernAtlas-iFrame + Eintrag | **ja**, ausdrücklich erlaubt | 0 € | klein (ein Frontend-Paket) |
| Nutzer-Eintrag mit Link (heute) | ja | 0 € | erledigt |

**Vorschlag in dieser Reihenfolge:**

1. **Sofort, ohne Anfrage:** den BayernAtlas mit der Bodenrichtwert-Ebene an
   der Objektadresse in das Feld „Bodenrichtwert" einbetten (iFrame oder
   Link, Nr. 2.1). Für 40 von 54 Ausschüssen sieht der Nutzer den Wert dann
   sofort. Im Bericht steht er als „eigene Angabe" mit Ausschuss und Stichtag.
2. **Den Hinweis in `registry.js` berichtigen:** Rechteinhaber sind die
   Ausschüsse, nicht das LDBV. Die „Aktennotiz" belegen oder streichen.
3. **Eine Anfrage an den Oberen Gutachterausschuss Bayern mit Kopie an die
   GDI-Geschäftsstelle des LDBV:** Darf ein gewerblicher Anbieter die im
   BayernAtlas offen gezeigten Werte über den WMS punktweise abrufen und im
   Bericht des Kunden zeigen (mit Quellenvermerk), und gibt es eine
   gebündelte Lizenz für die gebührenpflichtigen Ausschüsse? Entwurf unten.
4. **Erst nach der Antwort** einzelne Lizenzen für München Stadt und Land,
   Nürnberg, Augsburg und Regensburg erwägen. Das kostet Geld und braucht
   Marcels Entscheidung.

---

## 7a · Fassung 02.11.2026 mittags — kurz, mit Bitte um ein Gespräch (Marcels Wunsch, nicht versandt)

**An:** `oga-bayern@landshut.de` (Oberer Gutachterausschuss, Geschäftsstelle Landshut) · **Cc:** `gdi-by@ldbv.bayern.de`
**Betreff:** Bodenrichtwerte Bayern in der Software DealPilot – Bitte um Freigabe und kurzes Gespräch

> Sehr geehrte Damen und Herren,
>
> mein Name ist Marcel Junker. Ich bin DESAG-geprüfter Sachverständiger für Immobilienbewertung und
> betreibe mit Junker Solution die Software DealPilot. Mit DealPilot prüfen Immobilieninvestoren
> Kaufangebote: von der Rendite- und Finanzierungsrechnung bis zu einem Marktbericht mit indikativer
> Wertermittlung nach ImmoWertV (Boden-, Ertrags- und Sachwert). Wir arbeiten dabei streng mit
> amtlichen Daten und nennen im Bericht zu jeder Zahl den Gutachterausschuss, den Stichtag und die
> Quelle.
>
> Den Bodenrichtwert rufen wir in den anderen Bundesländern für die einzelne Objektadresse über die
> offenen BORIS-Dienste ab. Für Bayern suchen wir gerade nach einer sauberen Lösung, das ebenso zu
> automatisieren. Nach den Nutzungsbedingungen liegen die Rechte an den Werten bei den
> Gutachterausschüssen, deshalb möchten wir das nicht ohne Ihr Einverständnis tun.
>
> Daher meine Bitte:
>
> - Wäre eine Freigabe denkbar, dass DealPilot den Bodenrichtwert für die Adresse eines Nutzers
>   automatisch abruft und nur in dessen Bericht mit Quellenvermerk zeigt? Wir speichern keine Zonen
>   flächig und geben keine Daten weiter.
> - Falls dafür eine Lizenz oder die Zustimmung der einzelnen Ausschüsse nötig ist: Wie wäre der
>   richtige Weg, und zu welchen Bedingungen?
>
> Gern würde ich das in einem kurzen Gespräch (Telefon oder Video, 20–30 Minuten) mit Ihnen
> besprechen und DealPilot dabei auch kurz zeigen. Nennen Sie mir einfach einen Termin, der Ihnen passt.
>
> Bis dahin verweisen wir unsere Nutzer auf den BayernAtlas und lassen sie den Wert selbst eintragen.
>
> Mit freundlichen Grüßen
>
> Marcel Junker
> Junker Solution · DealPilot
> [Anschrift] · [Telefon] · [E-Mail] · dealpilot.immo

## 7 · Entwurf der Anfrage (nicht versandt)

**An:** Oberer Gutachterausschuss für Grundstückswerte im Freistaat Bayern,
Geschäftsstelle, Luitpoldstraße 27, 84034 Landshut, `oga-bayern@landshut.de`
**Cc:** Geschäftsstelle GDI Bayern, LDBV, `gdi-by@ldbv.bayern.de`
**Betreff:** Gewerbliche Nutzung der Bodenrichtwerte aus VBORIS Bayern in einer Bewertungssoftware

> Sehr geehrte Damen und Herren,
>
> ich betreibe als Einzelunternehmer (Junker Solution) die Software
> DealPilot, mit der Immobilieninvestoren Objekte prüfen und einen
> Marktbericht mit indikativer Wertermittlung (Ertrags- und Sachwert nach
> ImmoWertV) erstellen. Ich bin DESAG-geprüfter Sachverständiger.
>
> Für die Bodenwertermittlung fragen wir in den übrigen Ländern die
> amtlichen Bodenrichtwerte punktbezogen ab (in der Regel unter
> dl-de/zero-2.0 oder dl-de/by-2.0) und nennen im Bericht Gutachterausschuss,
> Zone, Stichtag und Quelle. Der Dienst
> `gdi.bayern.de/services/bodenrichtwerte/<Jahr>/vboris` führt in seinen
> Metadaten den Vermerk „kostenfrei für private Nutzung", nach den
> Nutzungsbedingungen (Nr. 3.1, 4.2) liegen die Rechte bei den
> Gutachterausschüssen.
>
> Ich bitte um Auskunft:
>
> 1. Dürfen wir die Bodenrichtwerte der Ausschüsse, die sie im BayernAtlas
>    kostenfrei zur Einsicht freigeben, für einzelne Objektadressen unserer
>    Nutzer über den WMS abrufen und im Bericht des Nutzers mit
>    Quellenvermerk zeigen? Wir speichern keine Zonen flächig und geben keine
>    Daten weiter, außer im Bericht zum jeweiligen Objekt.
> 2. Wenn eine Erlaubnis nötig ist: Erteilt sie der Obere Gutachterausschuss
>    gebündelt, oder muss jeder Gutachterausschuss einzeln zustimmen?
> 3. Gibt es für die Ausschüsse mit gebührenpflichtiger Auskunft eine
>    Lizenz für die punktweise Nutzung in einer Software, und zu welchen
>    Bedingungen und Kosten (pauschal, je Abruf, je Ausschuss)?
> 4. Welcher Quellenvermerk ist zu verwenden?
>
> Bis zu einer Antwort verweisen wir unsere Nutzer auf den BayernAtlas und
> lassen sie den Wert selbst eintragen.
>
> Mit freundlichen Grüßen
> Marcel Junker
> Junker Solution · DealPilot
> [Anschrift, Telefon]

---

## Quellen (alle abgerufen am 02.11.2026)

- WMS-Capabilities, eigene Messung: `https://gdi.bayern.de/services/bodenrichtwerte/2026/vboris?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`
- Nutzungsbedingungen Geoportal/BayernAtlas 09/2026: <https://ldbv.bayern.de/mam/ldbv/dateien/nutzungsbedingungen_geoportal_bayernatlas_bayernatlasplus.pdf>
- § 12 BayGaV: <https://www.gesetze-bayern.de/Content/Document/BayGutAV-12>
- BayernPortal, Leistung Bodenrichtwerte: <https://www.bayernportal.de/dokumente/leistung/71665115334>
- CSU-Antrag München 12.05.2026: <https://www.muenchen-transparent.de/dokumente/9701089/datei>
- Zellmeier 2019: <https://www.abgeordnetenwatch.de/profile/josef-zellmeier/fragen-antworten/302642>
- Töging Juli 2026: <https://www.toeging.de/upload/mediapool/Online-Formulare/Infomaterial/Bodenrichtwerte_online.pdf>
- Gebührenliste der Ausschüsse 10/2021: <https://www.geodaten.bayern.de/bayernatlas/custom/content/bodenrichtwerte/gebuehrenliste_gaa.pdf>
- Landkreis München: <https://www.landkreis-muenchen.de/buergerservice/dienstleistung/bodenrichtwerte/>
- München Stadt: <https://www.bodenrichtwerte-muenchen.de/>, <https://stadt.muenchen.de/service/info/bewertungsamt-geschaftsstelle-des-gutachterausschusses-bodenrichtwertauskunft/1075224/>
- Nürnberg: <https://www.nuernberg.de/internet/geoinformation_bodenordnung/bodenrichtwert.html>
- BORIS-Bayern: <https://www.boris-bayern.de/>
- Ebersberg (Sekundärquelle): <https://www.it-boltwise.de/stichwort/bodenrichtwerte>
- Drittportal ohne Werte: <https://www.bodenrichtwerte-deutschland.de/boris/bayern>

**Nicht gefunden:** ein Lizenzprodukt „Bodenrichtwerte Bayern" des LDBV, der
Wortlaut der KVz-Tarifstelle 2.I.1/1.8, eine offene Lizenz für einen
bayerischen Ausschuss, das Angebot des Gutachterausschusses Regensburg, ein
Beschluss zum Münchner Antrag.
