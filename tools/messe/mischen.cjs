// node mischen.cjs <video.mp4> <texte.json> <wav-ordner> <ziel.mp4>
// Legt jeden Clip (00.wav, 01.wav …) an seine Startzeit "ab", normalisiert auf -16 LUFS, Bild unverändert.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const FF = 'C:\\Users\\ThinkPad\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe';
const FP = FF.replace('ffmpeg.exe', 'ffprobe.exe');
const [video, texteDatei, ordner, ziel] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(texteDatei, 'utf8'));
const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', video];
const teile = [];
T.forEach((t, i) => {
  const w = path.join(ordner, String(i).padStart(2, '0') + '.wav');
  if (!fs.existsSync(w)) throw new Error('fehlt ' + w);
  const dauer = parseFloat(execFileSync(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', w]).toString());
  const platz = (t.bis || 1e9) - t.ab;
  const tempo = dauer > platz ? Math.min(1.08, dauer / platz) : 1;
  if (dauer / platz > 1.08) console.log('ZU LANG', i, dauer.toFixed(1), 's in', platz.toFixed(1), 's');
  args.push('-i', w);
  const ms = Math.round(t.ab * 1000);
  teile.push('[' + (i + 1) + ':a]' + (tempo > 1 ? 'atempo=' + tempo.toFixed(3) + ',' : '') + 'adelay=' + ms + '|' + ms + '[a' + i + ']');
});
const fc = teile.join(';') + ';' + T.map((_, i) => '[a' + i + ']').join('') + 'amix=inputs=' + T.length + ':normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[aus]';
args.push('-filter_complex', fc, '-map', '0:v', '-map', '[aus]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', ziel);
execFileSync(FF, args, { stdio: 'inherit' });
console.log('fertig', ziel);
