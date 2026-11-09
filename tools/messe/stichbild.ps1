param([string]$Ziel)
# Ein Bild vom Bildschirm (wie die Aufnahme, verkleinert) - Sicherung: liegt Chrome wirklich vorne?
$ff = "C:\Users\ThinkPad\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
& $ff -hide_banner -loglevel error -y -f gdigrab -offset_x 0 -offset_y 0 -video_size 1920x1080 -i desktop -frames:v 1 -vf "scale=480:-1" $Ziel
"ok $Ziel"
