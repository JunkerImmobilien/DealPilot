// node tts2.mjs <name>  - liest /tmp/tts/<name>/texte.json, schreibt /tmp/tts/<name>/NN.wav
// Stimme onyx, Pirate-Vibe wie claude/ablage-20261017/tts.mjs (Module 10b, 15, 21, 23, 25). Läuft im Backend-Container.
import fs from 'node:fs';
const NAME = process.argv[2];
const DIR = '/tmp/tts/' + NAME;
const TEXTE = JSON.parse(fs.readFileSync(DIR + '/texte.json', 'utf8'));
const ANWEISUNG = 'Sprich ausschließlich Hochdeutsch, akzentfrei, wie ein deutscher Muttersprachler. '
  + 'Stimme: tief, rau und kernig, mit herzhafter, kraftvoller Präsenz — der Vibe eines Piratenkapitäns, '
  + 'der seiner Crew von einer Entdeckung erzählt: abenteuerlustig, selbstbewusst, mit einem Augenzwinkern. '
  + 'Aber KEIN Piratendialekt, keine Seemannssprüche, keine englische Färbung — nur der Charakter in der Stimme. '
  + 'Tempo lebendig, aber gut verständlich; kurze Pausen an Gedankenstrichen; Zahlen klar und deutlich.';
for (const [i, t] of TEXTE.entries()) {
  const ziel = DIR + '/' + String(i).padStart(2, '0') + '.wav';
  if (fs.existsSync(ziel)) { console.log('da', i); continue; }
  let ok = false;
  for (let v = 0; v < 3 && !ok; v++) {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'onyx', input: t.text, instructions: ANWEISUNG, response_format: 'wav' }),
    });
    if (r.ok) { fs.writeFileSync(ziel, Buffer.from(await r.arrayBuffer())); ok = true; console.log('ok', i, t.text.length); }
    else console.log('FEHLER', i, r.status, (await r.text()).slice(0, 150));
  }
  if (!ok) process.exit(1);
}
