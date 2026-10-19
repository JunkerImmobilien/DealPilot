// Videoreihe-Sprecher: node tts2.mjs <modul> [idx,idx,...]  -> /tmp/tts/<modul>/NN.wav
import fs from 'node:fs';
const M = process.argv[2];
const NUR = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const D = '/tmp/tts/' + M;
const TEXTE = JSON.parse(fs.readFileSync(D + '/texte.json', 'utf8'));
const ANWEISUNG = 'Du bist ein deutscher Muttersprachler und sprichst akzentfreies Hochdeutsch, fließend und natürlich — wie ein professioneller deutscher Sprecher für Schulungsvideos. Ton: Investor unter Investoren — kompetent, souverän und ruhig, dabei locker und nahbar, mit einem leichten Lächeln in der Stimme. Kein Werbesprech, keine übertriebene Betonung. Zahlen klar und deutlich, natürliche Pausen an Gedankenstrichen, zügiges, angenehmes Tempo.';
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
