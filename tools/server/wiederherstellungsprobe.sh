#!/bin/bash
# tools/server/wiederherstellungsprobe.sh  ·  v4880 · Wiederherstellungsprobe der Nachtsicherung
#
# Spielt die NEUESTE Nachtsicherung (/opt/dealpilot/backups/dp_*.dump und mb_*.dump) in je einen
# TEMPORÄREN Postgres-Container ein (eigener Name dp-probe-*, --network none, kein Port, kein Zugriff
# auf die App), zählt Tabellen und Zeilen, vergleicht mit der laufenden Datenbank und schreibt das
# Ergebnis als art 'probe' in betrieb_messungen. Danach werden die Probe-Container samt ihren
# anonymen Volumes entfernt (trap, auch bei Fehler). Die Live-Datenbanken werden nur GELESEN.
# Keine Daten verlassen den Host.
#
# crontab (monatlich, 1. des Monats 04:30, nach der Nachtsicherung um 03:00):
#   30 4 1 * * /bin/bash /opt/dealpilot/tools/server/wiederherstellungsprobe.sh prod >> /var/log/wiederherstellungsprobe.log 2>&1
set -u
SERVER="${1:-prod}"
Z=/opt/dealpilot/backups
TS=$(date +%Y%m%d%H%M%S)
P1="dp-probe-haupt-$TS"; P2="dp-probe-mb-$TS"
START=$(date +%s)
aufraeumen() { docker rm -f -v "$P1" "$P2" >/dev/null 2>&1 || true; }
trap aufraeumen EXIT

DP=$(ls -t $Z/dp_*.dump 2>/dev/null | head -1)
MB=$(ls -t $Z/mb_*.dump 2>/dev/null | head -1)

ZAEHL="SELECT table_schema||'.'||table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema','topology','tiger','tiger_data') ORDER BY 1"

warte() { for i in $(seq 1 60); do docker exec "$1" pg_isready -U probe -q && return 0; sleep 2; done; return 1; }

probe() { # $1 Container  $2 Image  $3 Dump  $4 Live-Container  $5 Live-User  $6 Live-DB  $7 Ausgabe-Präfix
  local C=$1 IMG=$2 DUMP=$3
  docker run -d --name "$C" --network none --cpus=1 -e POSTGRES_USER=probe -e POSTGRES_PASSWORD=probe -e POSTGRES_DB=probe "$IMG" >/dev/null || return 1
  warte "$C" || return 1
  sleep 3; warte "$C" || return 1
  docker exec "$C" createdb -U probe ziel || return 1
  local T0=$(date +%s)
  docker exec -i "$C" pg_restore -U probe -d ziel --no-owner --no-privileges < "$DUMP" 2> "/tmp/$7-restore.err"
  echo "$(( $(date +%s) - T0 ))" > "/tmp/$7-dauer"
  docker exec "$C" psql -U probe -d ziel -tA -F '|' -c "$ZAEHL" > "/tmp/$7-probe.txt" 2>/dev/null
  docker exec "$4" psql -U "$5" -d "$6" -tA -F '|' -c "$ZAEHL" > "/tmp/$7-live.txt" 2>/dev/null
  return 0
}

OK1=0; OK2=0
[ -n "$DP" ] && probe "$P1" "$(docker inspect --format '{{.Config.Image}}' dealpilot-postgres)" "$DP" dealpilot-postgres dealpilot dealpilot_db haupt && OK1=1
[ -n "$MB" ] && probe "$P2" "$(docker inspect --format '{{.Config.Image}}' dealpilot-mb-db)" "$MB" dealpilot-mb-db mb marktbericht mb && OK2=1
aufraeumen

python3 - "$SERVER" "$DP" "$MB" "$OK1" "$OK2" "$START" <<'PY'
import json, os, sys, subprocess, time, datetime
server, dp, mb, ok1, ok2, start = sys.argv[1:7]
def lies(p):
    d = {}
    try:
        for z in open(p):
            t = z.strip().split('|')
            if len(t) == 2 and t[1].strip().lstrip('-').isdigit(): d[t[0]] = int(t[1])
    except Exception: pass
    return d
def teil(name, datei, ok):
    pr, li = lies('/tmp/%s-probe.txt' % name), lies('/tmp/%s-live.txt' % name)
    fehler = ''
    try: fehler = open('/tmp/%s-restore.err' % name).read()
    except Exception: pass
    fehlende = sorted([t for t in li if t not in pr])
    leer = sorted([t for t in li if li[t] > 0 and pr.get(t, 0) == 0])
    zl, zp = sum(li.values()), sum(pr.values())
    # Die Sicherung ist von 03:00, die Live-DB von jetzt: kleine Abweichungen sind normal.
    abw = round(abs(zl - zp) * 100.0 / zl, 2) if zl else None
    bestanden = ok == '1' and len(pr) > 0 and not fehlende and not leer and (abw is not None and abw <= 5)
    try: dauer = int(open('/tmp/%s-dauer' % name).read())
    except Exception: dauer = None
    return {'datei': os.path.basename(datei) if datei else None,
            'groesse': os.path.getsize(datei) if datei and os.path.exists(datei) else None,
            'tabellen_probe': len(pr), 'tabellen_live': len(li), 'zeilen_probe': zp, 'zeilen_live': zl,
            'abweichung_pct': abw, 'fehlende_tabellen': fehlende[:20], 'leer_statt_gefuellt': leer[:20],
            'restore_meldungen': len([z for z in fehler.splitlines() if 'error' in z.lower()]),
            'restore_s': dauer, 'bestanden': bool(bestanden)}
erg = {'version': 'v4880', 'server': server, 'zeit': datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).isoformat() + 'Z',
       'haupt': teil('haupt', dp, ok1), 'marktbericht': teil('mb', mb, ok2),
       'dauer_s': int(time.time()) - int(start)}
erg['bestanden'] = erg['haupt']['bestanden'] and erg['marktbericht']['bestanden']
for n in ('haupt', 'mb'):
    for e in ('probe.txt', 'live.txt', 'restore.err', 'dauer'):
        try: os.remove('/tmp/%s-%s' % (n, e))
        except Exception: pass
js = json.dumps(erg, ensure_ascii=False)
sql = "INSERT INTO betrieb_messungen (server, art, daten) VALUES ('%s','probe',$bt$%s$bt$::jsonb);" % (server, js)
subprocess.run('docker exec -i dealpilot-postgres psql -U dealpilot -d dealpilot_db -v ON_ERROR_STOP=1 -q', shell=True, input=sql, text=True)
print(datetime.datetime.now().isoformat(), 'bestanden' if erg['bestanden'] else 'NICHT BESTANDEN', json.dumps({k: (v if not isinstance(v, dict) else {x: v[x] for x in ('tabellen_probe','tabellen_live','zeilen_probe','zeilen_live','abweichung_pct','bestanden')}) for k, v in erg.items()}, ensure_ascii=False))
PY
