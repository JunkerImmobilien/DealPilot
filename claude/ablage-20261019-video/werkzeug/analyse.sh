#!/bin/bash
# analyse.sh <ordner> <kurz>
FF=/c/Users/ThinkPad/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin
SRC="/e/DealPilot/repo/Dateien/Messe/Videos/Videoreihe/$1"
VID=$(ls "$SRC"/*.mp4)
W=/c/Users/ThinkPad/AppData/Local/Temp/claude/E--DealPilot-repo/2dc24aad-b384-439e-84d4-6669875ba597/scratchpad/vt/$2
mkdir -p "$W"; cd "$W"
DUR=$($FF/ffprobe -v error -show_entries format=duration -of csv=p=0 "$VID")
$FF/ffmpeg -hide_banner -nostats -i "$VID" -vf "crop=1100:100:20:890,select=gt(scene\,0.02),showinfo" -an -f null - 2>&1 | grep -o "pts_time:[0-9.]*" | cut -d: -f2 > raw.txt
# cluster within 1s
awk -v d=$DUR 'BEGIN{last=-10} { if ($1-last>1.0) {print $1}; last=$1 }' raw.txt > ab.txt
echo "DUR $DUR"; echo "N $(wc -l < ab.txt)"; tr '\n' ' ' < ab.txt; echo
rm -f b_*.png
i=0; while read t; do tt=$(awk -v t=$t 'BEGIN{print t+2}'); $FF/ffmpeg -v error -ss $tt -i "$VID" -frames:v 1 -vf "crop=1500:100:20:890" -y $(printf "b_%03d.png" $i); i=$((i+1)); done < ab.txt
# tiles of 10
n=$i; k=0; s=0
while [ $s -lt $n ]; do
 $FF/ffmpeg -v error -start_number $s -i b_%03d.png -frames:v 1 -vf "tile=1x10:padding=4:color=white" -y tile_$k.png
 s=$((s+10)); k=$((k+1)); done
$FF/ffmpeg -v error -ss 6 -i "$VID" -frames:v 1 -vf scale=960:-1 -y intro.png
$FF/ffmpeg -v error -sseof -4 -i "$VID" -frames:v 1 -vf scale=960:-1 -y abspann.png
