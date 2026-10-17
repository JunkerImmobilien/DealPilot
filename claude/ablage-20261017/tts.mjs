// Sprecher-Demo Modul 22: je Abschnitt ein Satz, OpenAI TTS (gpt-4o-mini-tts).
// Laeuft im Backend-Container (Schluessel aus der Umgebung), schreibt WAV nach /tmp/tts/.
import fs from 'node:fs';
const STIMME = process.argv[2] || 'onyx';
const TEXTE = JSON.parse(fs.readFileSync('/tmp/tts/texte.json', 'utf8'));
const ANWEISUNG = process.argv[3] === 'pirat'
  ? 'Sprich ausschließlich Hochdeutsch, akzentfrei, wie ein deutscher Muttersprachler. '
    + 'Stimme: tief, rau und kernig, mit herzhafter, kraftvoller Präsenz — der Vibe eines Piratenkapitäns, '
    + 'der seiner Crew von einer Entdeckung erzählt: abenteuerlustig, selbstbewusst, mit einem Augenzwinkern. '
    + 'Aber KEIN Piratendialekt, keine Seemannssprüche, keine englische Färbung — nur der Charakter in der Stimme. '
    + 'Tempo lebendig, aber gut verständlich; kurze Pausen an Gedankenstrichen; Zahlen klar und deutlich.'
  : 'Sprich Deutsch, ruhig und warm, wie ein erfahrener Pilot, der einem Kollegen etwas zeigt. '
    + 'Klar artikuliert, natürliches Tempo, keine Werbestimme, kleine Pausen an Gedankenstrichen.';
const ORDNER = STIMME + (process.argv[3] ? '-' + process.argv[3] : '');
fs.mkdirSync('/tmp/tts/' + ORDNER, { recursive: true });
for (const [i, t] of TEXTE.entries()) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: STIMME, input: t.text, instructions: ANWEISUNG, response_format: 'wav' }),
  });
  if (!r.ok) { console.log('FEHLER', i, r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  fs.writeFileSync('/tmp/tts/' + ORDNER + '/' + String(i).padStart(2, '0') + '.wav', Buffer.from(await r.arrayBuffer()));
  console.log('ok', i, t.text.length);
}
