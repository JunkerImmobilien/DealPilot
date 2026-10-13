// v2199 · Prueft parseAddr (ImmoMetrica-Adresse -> PLZ/Ort/Strasse/Nr.) gegen echte Rohtexte aus Marcels Favoriten (13.10.2026) und die bekannten Formen. RC=0 ist sauber.
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
process.argv[2] = path.resolve('backend/src/services/immometricaMapping.js');
const { parseAddr } = require(process.argv[2]);
const F = [
 ['32602, Vlotho','32602', {plz:'32602',str:'',hnr:'',ort:'Vlotho'}],
 ['32130 Nordrhein-Westfalen - Enger','32130', {plz:'32130',str:'',ort:'Enger'}],
 ['32049 Herford (Innenstadt)','32049', {plz:'32049',str:'',ort:'Herford'}],
 ['32469 Petershagen (Petershagen)','32469', {plz:'32469',str:'',ort:'Petershagen'}],
 ['32791 Lage','32791', {plz:'32791',str:'',ort:'Lage'}],
 ['Hölderlinstr. 1, 32547 Bad Oeynhausen','32547', {plz:'32547',str:'Hölderlinstr.',hnr:'1',ort:'Bad Oeynhausen'}],
 ['Gohliser Straße 42, 04155 Leipzig','', {plz:'04155',str:'Gohliser Straße',hnr:'42',ort:'Leipzig'}],
 ['Herford, Nordrhein-Westfalen','', {str:'',ort:'Herford'}],
 ['Mitte, Berlin','', {str:'',ort:'Berlin-Mitte'}],
 ['32049 Herford, Nordrhein-Westfalen','', {plz:'32049',str:'',ort:'Herford'}],
 ['32602 Vlotho, Kreis Herford','', {plz:'32602',str:'',ort:'Vlotho'}],
 ['Lange Str. 5, Vlotho','32602', {str:'Lange Str.',hnr:'5',ort:'Vlotho'}],
 ['Musterweg 3 32602 Vlotho','', {plz:'32602',str:'Musterweg',hnr:'3',ort:'Vlotho'}],
];
let f=0; for (const [raw,z,soll] of F){ const a=parseAddr({address_raw:raw,address_zipcode:z}); const bad=Object.keys(soll).filter(k=>(a[k]||'')!==soll[k]); if(bad.length){f++;console.log('FEHLER',raw,JSON.stringify(a));} }
console.log(F.length-f+'/'+F.length); process.exit(f?1:0);
