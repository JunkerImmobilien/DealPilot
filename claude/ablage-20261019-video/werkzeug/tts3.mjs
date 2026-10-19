// Videoreihe-Sprecher v2395: node tts3.mjs <modul> [idx,idx,...] -> /tmp/tts/<modul>/NN.wav
// Stimme onyx, Hochdeutsch ohne Akzent, Pirate-Vibe (Anweisung wie claude/ablage-20261017/tts.mjs "pirat")
import fs from 'node:fs';
const M = process.argv[2];
const NUR = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const D = '/tmp/tts/' + M;
const TEXTE = JSON.parse(fs.readFileSync(D + '/texte.json', 'utf8'));
const ANWEISUNG = 'Sprich ausschließlich Hochdeutsch, akzentfrei, wie ein deutscher Muttersprachler. '
    + 'Stimme: tief, rau und kernig, mit herzhafter, kraftvoller Präsenz — der Vibe eines Piratenkapitäns, '
    + 'der seiner Crew von einer Entdeckung erzählt: abenteuerlustig, selbstbewusst, mit einem Augenzwinkern. '
    + 'Aber KEIN Piratendialekt, keine Seemannssprüche, keine englische Färbung — nur der Charakter in der Stimme. '
    + 'Tempo lebendig, aber gut verständlich; kurze Pausen an Gedankenstrichen; Zahlen klar und deutlich.';
async function eins(i, t) {
  for (let v = 0; v < 4; v++) {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'onyx', input: t.text, instructions: ANWEISUNG, response_format: 'wav' }),
    });
    if (r.ok) { fs.writeFileSync(D + '/' + String(i).padStart(2, '0') + '.wav', Buffer.from(await r.arrayBuffer())); console.log('ok', i); return; }
    console.log('FEHLER', i, r.status, (await r.text()).slice(0, 160));
    await new Promise(z => setTimeout(z, 3000));
  }
  process.exitCode = 1;
}
const liste = TEXTE.map((t, i) => [i, t]).filter(([i]) => !NUR || NUR.includes(i));
for (let k = 0; k < liste.length; k += 4) await Promise.all(liste.slice(k, k + 4).map(([i, t]) => eins(i, t)));
