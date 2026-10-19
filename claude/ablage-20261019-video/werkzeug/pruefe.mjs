// node pruefe.mjs <kurz> : Cliplaengen gegen Slot (bis-ab), schreibt <kurz>/tempo.json
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const FF = 'C:/Users/ThinkPad/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffprobe.exe';
const k = process.argv[2]; const T = JSON.parse(fs.readFileSync(k + '/texte.json', 'utf8'));
const tempo = []; const zuLang = [];
T.forEach((t, i) => {
  const f = k + '/wav/' + String(i).padStart(2, '0') + '.wav';
  const d = Number(execFileSync(FF, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
  const slot = t.bis - t.ab - 0.15; let a = 1;
  if (d > slot) { a = d / slot; if (a > 1.08) zuLang.push(i + ' (' + d.toFixed(1) + 's/' + slot.toFixed(1) + 's)'); }
  tempo.push(+Math.min(a, 1.08).toFixed(3));
  t.dauer = +d.toFixed(2);
});
fs.writeFileSync(k + '/tempo.json', JSON.stringify(tempo));
console.log('Dauer/Slot:', T.map((t, i) => i + ':' + t.dauer + '/' + (t.bis - t.ab).toFixed(1)).join(' '));
console.log(zuLang.length ? 'ZU LANG: ' + zuLang.join(', ') : 'alle passen');
