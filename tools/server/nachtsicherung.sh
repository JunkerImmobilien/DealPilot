#!/bin/bash
# /root/nachtsicherung.sh — Nachtsicherung Prod (crontab: 0 3 * * *)
# v4860 · 25.11.2026: Die Dokumentenablage (Volume dealpilot_backend_uploads, Ordner dateien/, AES-256-GCM
#   verschlüsselt) liegt im Uploads-Volume. Statt eines Voll-tar je Nacht jetzt Schnappschüsse per rsync mit
#   --link-dest: unveränderte Dateien sind Hardlinks und kosten keinen Platz, nur Neues und Geändertes wird kopiert.
#   7 Nächte. Vor dem Kopieren Platzprüfung: frei muss mindestens das Doppelte des Volumes sein, sonst FEHLER im Log
#   und kein Schnappschuss (die Datenbank-Sicherungen laufen trotzdem). Die alten uploads_*.tar.gz laufen aus.
#   Vorgänger: /root/nachtsicherung.sh.pre-v4860 (Stand 12.11.2026, Voll-tar).
Z=${BACKUP_DIR:-/opt/dealpilot/backups}; T=${T_TAG:-$(date +%F)}; LOG=/var/log/nachtsicherung.log
mkdir -p $Z
docker exec dealpilot-postgres pg_dump -U dealpilot -d dealpilot_db -Fc > $Z/dp_$T.dump
docker exec dealpilot-mb-db pg_dump -U mb -d marktbericht -Fc > $Z/mb_$T.dump
for p in dp mb; do
  G=$(stat -c %s $Z/${p}_$T.dump 2>/dev/null || echo 0)
  if [ "$G" -lt 1000000 ]; then echo "$(date -Is) FEHLER ${p}_$T.dump nur $G Byte" >> $LOG; exit 1; fi
  ls -t $Z/${p}_*.dump | tail -n +3 | xargs -r rm -f
done
# Uploads (Objektfotos seit v3310, Dokumentenablage seit v4860) als Schnappschuss
U=${UPLOADS_DIR:-/var/lib/docker/volumes/dealpilot_backend_uploads/_data}
S=$Z/uploads-schnappschuss
mkdir -p $S
GROESSE=$(du -sk $U | cut -f1)
FREI=$(df -k --output=avail $Z | tail -1 | tr -d ' ')
if [ "$FREI" -lt $((GROESSE * 2)) ]; then
  echo "$(date -Is) FEHLER uploads: zu wenig Platz (frei ${FREI} KB, Volume ${GROESSE} KB), kein Schnappschuss" >> $LOG; exit 1
fi
LETZTER=$(ls -1d $S/20* 2>/dev/null | tail -1)
if [ -n "$LETZTER" ] && [ "$LETZTER" != "$S/$T" ]; then
  rsync -a --delete --link-dest="$LETZTER" $U/ $S/$T/ 2>>$LOG
else
  rsync -a --delete $U/ $S/$T/ 2>>$LOG
fi
N=$(find $S/$T -type f | wc -l)
NQ=$(find $U -type f | wc -l)
if [ "$N" != "$NQ" ]; then echo "$(date -Is) FEHLER uploads-Schnappschuss $T: $N statt $NQ Dateien" >> $LOG; exit 1; fi
ls -1d $S/20* | head -n -7 | xargs -r rm -rf
ls -t $Z/uploads_*.tar.gz 2>/dev/null | tail -n +3 | xargs -r rm -f   # alte Voll-tar auslaufen lassen
NEU=$(du -sk $S/$T | cut -f1)
echo "$(date -Is) ok dp=$(stat -c %s $Z/dp_$T.dump) mb=$(stat -c %s $Z/mb_$T.dump) uploads=$N Dateien, Schnappschuss $T (${NEU} KB), Platte frei ${FREI} KB" >> $LOG
