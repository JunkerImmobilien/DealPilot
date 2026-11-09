# Messe-Videos: Aufnahme-Sicherung und Vertonung (v3271)

Ablauf je Video (Studio-Tab offen, `messe-studio.html?modul=<nr>`):

1. `tab-holen.ps1` – schaltet im Chrome-Fenster per Strg+Tab auf den Tab „Messe-Studio“.
2. `..\messe-fenster.ps1 -Was vor` – Fenster auf 0,0, Vollbild (nur wenn noch nicht im Vollbild).
3. `oben.ps1 -Was an` – Fenster bleibt während der Aufnahme über allen anderen (HWND_TOPMOST).
4. `..\messe-aufnahme.ps1 -Name roh-….mp4 -Sekunden <s>` im Hintergrund, 1,5 s später `DPM_STUDIO.los()`.
5. Nach 6 s `stichbild.ps1 -Ziel <png>` ansehen. **Liegt Chrome nicht vorne: ffmpeg beenden, Datei sofort löschen.**
   (09.11.2026: einmal Videokonferenz, einmal Terminal mitgeschnitten - beides gelöscht.)
6. Danach `oben.ps1 -Was aus`, `messe-fenster.ps1 -Was zurueck`.

Schnitt: Kapitelband-Wechsel mit `ffmpeg -vf "crop=1100:70:150:930,select='gt(scene,0.04)',showinfo"` finden;
erster Wechsel = erste Zeile aus `DPM_ZEILEN` (t_ms) → Versatz für die Sprechtexte.

Vertonung: `texte.json` (ab, bis, text) je Video; `tts2.mjs <name>` läuft im Backend-Container
(`/tmp/tts/<name>/texte.json` → `NN.wav`, onyx, Piraten-Ton); `node mischen.cjs <video> <texte.json> <wav-ordner> <ziel>`
legt die Clips an ihre Zeiten (atempo ≤ 1,08, sonst Meldung „ZU LANG“ → Text kürzen), −16 LUFS, Bild unverändert.
