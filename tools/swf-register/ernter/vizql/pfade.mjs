// Gemeinsame Pfade der VizQL-Ernter (v2886). Keine Zugangsdaten: Tableau Public ist ohne Anmeldung lesbar.
//
//   REPO      Wurzel des Repos, aus der Lage dieser Datei abgeleitet
//   REGISTER  marktbericht/backend/src/lib/register/
//   AUS       Arbeitsordner fuer Rohernten (JSON je Kalkulator). Gehoert NICHT ins Repo.
//             Vorgabe: <tmp>/dealpilot-ni-ernte, ueberschreibbar mit NI_ERNTE_AUS.
//   GEMEINDEN CSV "ags8;name;einwohner" (Gemeindeliste, z. B. aus mb.makro_werte
//             bevoelkerung_gemeinde exportiert), nur fuer bau-ol.mjs. Pfad per NI_GEMEINDEN.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';

const HIER = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HIER, '..', '..', '..', '..');
export const REGISTER = join(REPO, 'marktbericht', 'backend', 'src', 'lib', 'register') + '/';
export const LIB = join(REPO, 'marktbericht', 'backend', 'src', 'lib') + '/';
export const AUS = (process.env.NI_ERNTE_AUS || join(tmpdir(), 'dealpilot-ni-ernte')) + '/';
export const GEMEINDEN = process.env.NI_GEMEINDEN || join(AUS, 'ew-gemeinde.csv');
for (const d of [AUS, AUS + 'ernte/', AUS + 'ernte-lage/']) mkdirSync(d, { recursive: true });
