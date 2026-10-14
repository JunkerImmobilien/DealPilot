param([string]$Name, [int]$Sekunden)
# Nimmt den Hauptbildschirm auf (1920x1080), schneidet die Chrome-Hinweisleiste
# oben ab (58 px) und legt das Video in Dateien\Messe\Videos ab.
$ff = "C:\Users\ThinkPad\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
$ziel = "E:\DealPilot\repo\Dateien\Messe\Videos\$Name"
& $ff -hide_banner -loglevel error -y -f gdigrab -framerate 30 -offset_x 0 -offset_y 0 -video_size 1920x1080 -draw_mouse 0 -t $Sekunden -i desktop -vf "crop=1920:1022:0:58" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart $ziel
if (Test-Path $ziel) { "fertig: $ziel  $([math]::Round((Get-Item $ziel).Length/1MB,1)) MB" } else { "FEHLER: keine Datei" }
