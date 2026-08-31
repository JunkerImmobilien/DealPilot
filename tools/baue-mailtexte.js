/* Erzeugt den JS-Block aus mailtexte.txt.
   KEIN EINZIGER BACKSLASH IM QUELLTEXT: das Heredoc der Werkzeugkette
   halbiert sie, auch bei gequotetem Delimiter. Gemessen, nachdem zwei
   Versuche mit \u-Sequenzen still verstuemmelt ankamen. */
const fs = require('fs');
const BS = String.fromCharCode(92);
const zeilen = fs.readFileSync('/tmp/mailtexte.txt', 'utf8').split(String.fromCharCode(10));
const t = {}; let k = null;
for (let l of zeilen) {
  l = l.replace(new RegExp(String.fromCharCode(13) + '$'), '');
  const m = l.match(new RegExp('^=(.+)$'));
  if (m && l.charAt(0) === '=') { k = m[1]; t[k] = []; continue; }
  if (k !== null) t[k].push(l === '|' ? '' : l);
}
function esc(s) {
  let out = '';
  for (const c of s) {
    const cp = c.codePointAt(0);
    if (c === BS) out += BS + BS;
    else if (c === "'") out += BS + "'";
    else if (cp > 127) out += BS + 'u' + cp.toString(16).padStart(4, '0');
    else out += c;
  }
  return out;
}
function body(key, einr) {
  const a = t[key].filter((z, i, arr) => !(i === arr.length - 1 && z === ''));
  return a.map((z, i) =>
    einr + "'" + esc(z) + (i === a.length - 1 ? '' : BS + 'n') + "'" + (i === a.length - 1 ? '' : ' +')
  ).join(String.fromCharCode(10));
}
const E = ' '.repeat(8);
const NL = String.fromCharCode(10);
process.stdout.write(
  '    halbzeit: {' + NL +
  "      subject: '" + esc(t['halbzeit.subject'].join('')) + "'," + NL +
  '      body:' + NL + body('halbzeit.body', E) + NL +
  '    },' + NL +
  '    ende: {' + NL +
  "      subject: '" + esc(t['ende.subject'].join('')) + "'," + NL +
  '      body:' + NL + body('ende.body', E) + NL +
  '    }' + NL
);
