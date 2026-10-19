cd /c/Users/ThinkPad/AppData/Local/Temp/claude/E--DealPilot-repo/2dc24aad-b384-439e-84d4-6669875ba597/scratchpad/vt
./analyse.sh "Ueberblick 2 - Vom neuen Objekt zum DealScore und Investment-PDF" u2 > u2.log 2>&1
for d in /e/DealPilot/repo/Dateien/Messe/Videos/Videoreihe/Modul*; do b=$(basename "$d"); k=$(echo "$b" | awk '{print "m"$2}'); [ "$k" = m22 ] && continue; ./analyse.sh "$b" $k > $k.log 2>&1; done
echo FERTIG
