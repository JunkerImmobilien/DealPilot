#!/bin/bash
# ttsrun.sh <kurz> [idx,...]
V=/c/Users/ThinkPad/AppData/Local/Temp/claude/E--DealPilot-repo/2dc24aad-b384-439e-84d4-6669875ba597/scratchpad/vt
cd $V; mkdir -p $1/wav
H=root@116.203.214.11
ssh $H "mkdir -p /tmp/vts/$1" && scp -q tts3.mjs $1/texte.json $H:/tmp/vts/$1/ || exit 1
ssh $H "docker exec dealpilot-backend mkdir -p /tmp/tts/$1 && docker cp /tmp/vts/$1/texte.json dealpilot-backend:/tmp/tts/$1/texte.json && docker cp /tmp/vts/$1/tts3.mjs dealpilot-backend:/tmp/tts/tts3.mjs && docker exec dealpilot-backend node /tmp/tts/tts3.mjs $1 $2 | grep -v "^ok" ; echo TTS-ENDE; rm -rf /tmp/vts/$1/wav; docker cp dealpilot-backend:/tmp/tts/$1 /tmp/vts/$1/wav" || exit 1
scp -q "$H:/tmp/vts/$1/wav/*.wav" $1/wav/ && ls $1/wav | wc -l
