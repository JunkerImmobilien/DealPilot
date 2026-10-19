#!/bin/bash
# mische.sh <kurz> <ordner>
FF=/c/Users/ThinkPad/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin
V=/c/Users/ThinkPad/AppData/Local/Temp/claude/E--DealPilot-repo/2dc24aad-b384-439e-84d4-6669875ba597/scratchpad/vt
cd $V
SRC="/e/DealPilot/repo/Dateien/Messe/Videos/Videoreihe/$2"; VID=$(ls "$SRC"/*.mp4); NAME=$(basename "$VID")
OUT="/e/DealPilot/repo/Dateien/Messe/Videos/Videoreihe-Sprecher/$2"; mkdir -p "$OUT"
node -e '
const fs=require("fs");const k=process.argv[1];const T=JSON.parse(fs.readFileSync(k+"/texte.json"));const P=JSON.parse(fs.readFileSync(k+"/tempo.json"));
let inp="",fc="",mx="";
T.forEach((t,i)=>{const ms=Math.round(t.ab*1000);inp+=" -i "+k+"/wav/"+String(i).padStart(2,"0")+".wav";
fc+="["+(i+1)+":a]"+(P[i]>1.001?"atempo="+P[i]+",":"")+"aresample=48000,adelay="+ms+"|"+ms+"[a"+i+"];";mx+="[a"+i+"]";});
fc+=mx+"amix=inputs="+T.length+":normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]";
fs.writeFileSync(k+"/inp.txt",inp.trim());fs.writeFileSync(k+"/fc.txt",fc);' "$1"
$FF/ffmpeg -v error -y -i "$VID" $(cat $1/inp.txt) -/filter_complex $1/fc.txt -map 0:v -map "[out]" -c:v copy -c:a aac -b:a 160k "$OUT/$NAME" && echo GEMISCHT
node -e 'const fs=require("fs");const T=JSON.parse(fs.readFileSync(process.argv[1]+"/texte.json"));fs.writeFileSync(process.argv[2],"[\n"+T.map(t=>"  "+JSON.stringify({ab:t.ab,bis:t.bis,text:t.text})).join(",\n")+"\n]\n")' "$1" "$OUT/texte.json"
$FF/ffprobe -v error -show_entries format=duration:stream=codec_type -of csv=p=0 "$OUT/$NAME" | tr '\n' ' '; echo
