# Mietspiegel-Verzeichnis (Phase 1)

`verzeichnis.json` sagt je Gemeinde, **ob** es einen Mietspiegel gibt, welcher Art er ist, wer ihn
herausgibt, wie lange er gilt und **wo er steht**. Tabellenwerte (Mieten je m²) stehen hier noch nicht —
das ist Phase 2. Das Verzeichnis ist das Gegenstück zur Doktrin „Wo kein Wert vorliegt, bekommt der
Kunde den Weg dorthin“: auch ohne Werte kann der Bericht sagen, welcher Mietspiegel gilt und wo er liegt.

Erzeugt am 09.11.2026. Keine Datenbank. **Seit v3250 gelesen** von `verzeichnis.js` (daneben) → Route
GET `/mietspiegel?ags=` (mb-Backend `routes/api.js`, in der Haupt-App über den Proxy `/marktbericht/mietspiegel`)
→ `frontend/js/potenzial.js` (`_dpMarktdaten.mietspiegel_register`, Kern `mietspiegelAus`/`mietspiegelRegister`).
Jahrespflege: Jahreswerte-Register, Eintrag `mietspiegel_verzeichnis`.

## Rechtsgrundlage (gemessen am Wortlaut, 09.11.2026)

| Norm | Inhalt | Fundstelle |
|---|---|---|
| § 558c Abs. 1 BGB | Mietspiegel = Übersicht über die ortsübliche Vergleichsmiete, erstellt oder anerkannt von der nach Landesrecht zuständigen Behörde oder von Vermieter- und Mieterverbänden gemeinsam | https://www.gesetze-im-internet.de/bgb/__558c.html |
| § 558c Abs. 3 BGB | (einfacher) Mietspiegel **soll** im Abstand von zwei Jahren der Marktentwicklung angepasst werden | ebd. |
| § 558c Abs. 4 Satz 2 BGB | **Pflicht:** Gemeinden mit mehr als 50.000 Einwohnern müssen einen Mietspiegel erstellen; Mietspiegel und Änderungen sind zu veröffentlichen | ebd. |
| § 558d Abs. 2 BGB | qualifizierter Mietspiegel **ist** nach zwei Jahren anzupassen (Stichprobe oder Verbraucherpreisindex), nach **vier** Jahren neu zu erstellen; maßgeblich ist der **Stichtag der Datenerhebung**, für die Veröffentlichung entsprechend | https://www.gesetze-im-internet.de/bgb/__558d.html |
| § 558d Abs. 3 BGB | nur bei eingehaltenem Abs. 2 gilt die Vermutung, dass die Entgelte die ortsübliche Vergleichsmiete wiedergeben | ebd. |
| Art. 229 § 62 EGBGB | Gemeinden, die durch die neue Pflicht erstmals einen Mietspiegel brauchen: bis **01.01.2023** erstellen und veröffentlichen; wird ein **qualifizierter** erstellt: bis **01.01.2024** | https://www.gesetze-im-internet.de/bgbeg/art_229__62.html |
| Mietspiegelreformgesetz (MsRG) | vom 10.08.2021, BGBl. I S. 3515; Pflicht in Kraft seit **01.07.2022** | BGBl. 2021 I Nr. 53 |
| Mietspiegelverordnung (MsV) | vom 28.10.2021, BGBl. I S. 4779 — Inhalt, Verfahren, Dokumentation (§ 4 MsV) | — |

Die Pflicht ist eine „ob“-Pflicht: die Gemeinde wählt, ob einfach oder qualifiziert. Viele Pflichtgemeinden
haben einen **einfachen** Mietspiegel (z. B. Herford, Bad Oeynhausen).

## Aufbau

```
{ titel, stand, rechtsgrundlage, einwohner_quelle, demo_orte: [ags…], saetze: [ … ] }
```

Je Satz (alle Felder immer vorhanden, unbekannt = `null`):

| Feld | Bedeutung |
|---|---|
| `ags` | 8-stelliger amtlicher Gemeindeschlüssel (aus dem ARS des Destatis-Gemeindeverzeichnisses: Stellen 1–5 + 10–12) |
| `gemeinde`, `land` | Name ohne Zusatz („Stadt“), Länderkürzel |
| `einwohner_ca` | Bevölkerung 31.12.2024 auf Grundlage Zensus 2022 (Destatis GV-ISys) |
| `art` | `qualifiziert` (§ 558d) · `einfach` (§ 558c) · `keiner` (die Gemeinde sagt selbst, dass es keinen gibt, oder verweist nur auf Dritte) · `unklar` (nicht belegbar — immer mit `hinweis`) |
| `stand` | Ausgabe/Stand laut Dokument (JJJJ, JJJJ-MM oder JJJJ-MM-TT) |
| `erhebungsstichtag` | Stichtag der Datenerhebung, wo genannt (das ist der gesetzliche Fristbeginn nach § 558d Abs. 2) |
| `gueltig_ab`, `gueltig_bis` | nur, wenn die Quelle es sagt; „gilt zwei Jahre ab Inkrafttreten“ wird ausgerechnet und im `hinweis` vermerkt |
| `naechste_anpassung` | nur, wenn die Quelle einen Nachfolger ankündigt |
| `vermutung_bis` | **nur bei qualifizierten**: bis wann die Vermutung des § 558d Abs. 3 voraussichtlich trägt |
| `vermutung_bis_herleitung` | `angegeben` (= `gueltig_bis`) · `abgeleitet_gueltig_ab_plus_2` · `abgeleitet_stand_plus_2` — die abgeleiteten Daten sind **keine Quellenangabe**, sondern eine Rechnung |
| `ersteller` | Stadt / Gutachterausschuss / Verbände |
| `url` | amtliche Seite der Stadt oder PDF; Pflicht außer bei `keiner` und `unklar` |
| `zugang` | `frei` · `kostenpflichtig` (dann `preis`) · `online_rechner` (nur als Rechner) · `auf_anfrage` |
| `form` | `tabelle` (Baualter × Größe, ggf. Zu-/Abschläge) · `punkte` · `regression` (Basismiete × Faktoren, wo die Quelle Regression nennt) · `online_rechner` · `unbekannt` |
| `quelle_geprueft_am` | Tag der Prüfung |
| `beleg` | URL + Seite/Abschnitt, wo Art, Stand und Gültigkeit stehen |
| `hinweis` | Besonderheiten (Fortschreibung per Index, gemeinsamer Kreis-Mietspiegel, Widersprüche) |

**Herleitung `vermutung_bis`:** `gueltig_bis` vor `gueltig_ab + 2 Jahre` vor `stand + 2 Jahre`.
Das Gesetz knüpft an den **Erhebungsstichtag** an; der liegt meist 6–9 Monate vor dem Inkrafttreten.
Die abgeleiteten Daten sind deshalb eher zu spät als zu früh — für den Hinweis „Mietspiegel womöglich
nicht mehr qualifiziert“ genügt das, für eine Rechtsaussage nicht. Bei `stand` nur als Jahr wird der
31.12. angesetzt.

## Was der Kunde davon hat (v3250: Zeile im Reiter Investition, Karte „Mieterhöhung und Zielbild“)

- Gemeinde mit Mietspiegel: Name, Art, Gültigkeit, Link — „hier steht die ortsübliche Vergleichsmiete“.
- `vermutung_bis` abgelaufen: Hinweis, dass die Vermutung des § 558d Abs. 3 nicht mehr greifen könnte.
- `unklar` / `keiner`: der Weg (Stadtseite, ggf. Vergleichsgemeinde nach § 558a Abs. 4 BGB).
- **Keine Portal- oder Datenquellennamen nach außen** — nur Städte, Gutachterausschüsse, Verbände.

## Pflegeweg

1. Prüfen: `node tools/mietspiegel-verzeichnis-pruefen.mjs` (RC=0 = Form sauber; zählt und listet
   „veraltet“ und „einfach, Anpassung überfällig“; `--liste` zeigt alle `unklar`; `--heute=` für Stichtage).
2. Veraltete und unklare Sätze nachrecherchieren — **nur amtliche Belege** (Stadtseite, Amtsblatt,
   Mitersteller-Verband, Gutachterausschuss). Portale sind kein Beleg.
3. Satz ändern, `quelle_geprueft_am` auf den Tag setzen, Prüfer laufen lassen, committen.
4. Wenn ein Mietspiegel ausläuft (`gueltig_bis`), im Folgemonat nachsehen — die Nachfolger erscheinen
   oft erst Wochen nach dem Termin.

## Stand 09.11.2026

Die Zahlen schreibt der Prüfer; hier nur die Methode:
- Grundmenge: alle **195** Gemeinden ab 50.000 Einwohnern laut Destatis (31.12.2024, alle haben
  Stadtrecht) plus die drei kleineren Demo-Orte Löhne, Hiddenhausen, Hüllhorst.
- Recherche über die amtlichen Seiten; die Websuche der Sitzung war nach rund 200 Abfragen erschöpft —
  danach nur noch direkter Abruf bekannter Stadtseiten. Sätze mit `beleg: "noch nicht recherchiert"`
  sind aus diesem Grund offen, nicht weil es keinen Mietspiegel gäbe.
- Viele PDFs sind Bild-PDFs ohne Textschicht; dann steht `form: "unbekannt"` und der Hinweis dazu.

## Phase 2 (Werte ins Register)

Kandidaten sind Sätze mit `art` `qualifiziert`/`einfach`, `zugang: "frei"` und `form` `tabelle` oder
`regression` mit einer textlesbaren PDF. Für jede Tabelle gilt dieselbe Herkunftspflicht wie im
Register (Quelle, Stand, Seite, Lizenz) und der Prüfmaßstab ist das **Anwendungsbeispiel** des
Mietspiegels selbst.
