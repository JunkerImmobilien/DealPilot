#!/usr/bin/env python3
# tools/server/betrieb-sammeln.py  ·  v4880 · Betriebsdaten eines Servers sammeln (NUR LESEND)
#
# Läuft auf dem HOST (nicht im Container), per crontab:
#   7 * * * *  /usr/bin/python3 /opt/dealpilot/tools/server/betrieb-sammeln.py --server prod
#   20 5 * * 1 /usr/bin/python3 /opt/dealpilot/tools/server/betrieb-sammeln.py --server prod --audit
# Schreibt EINE Zeile in betrieb_messungen (art 'messung' bzw. 'audit') der Haupt-DB dieses Hosts.
# Ändert am Host nichts: kein apt update, kein Neustart, kein Löschen. Nur Python-Standardbibliothek,
# weil der Prod-Host kein node/jq hat.
#
#   --server prod|staging   Name in der Tabelle
#   --domains a,b           TLS-Prüfung (Vorgabe je Server unten)
#   --audit                 statt der Messung: npm audit im Backend-Container (nur Zusammenfassung)
#   --trocken               JSON nur ausgeben, nicht schreiben
import json, os, re, socket, ssl, subprocess, sys, time, glob, datetime

DOMAINS = {
    'prod': ['app.dealpilot.immo', 'dealpilot.immo', 'app.dealpilot.junker-immobilien.io'],
    'staging': ['app.staging.dealpilot.immo', 'staging.dealpilot.immo'],
}
PORTS_ERWARTET = [22, 80, 443]
SICHERUNG = '/opt/dealpilot/backups'
SICHERUNG_LOG = '/var/log/nachtsicherung.log'
HANDSICHERUNG = '/root/backups'
UPLOADS = '/var/lib/docker/volumes/dealpilot_backend_uploads/_data'


def _jetzt():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def _jetzt_iso():
    return _jetzt().isoformat() + 'Z'


def _iso_ts(t):
    return datetime.datetime.fromtimestamp(t, datetime.timezone.utc).replace(tzinfo=None).isoformat() + 'Z'


def sh(cmd, timeout=120):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except Exception:
        return ''


def platte():
    s = os.statvfs('/')
    gesamt = s.f_blocks * s.f_frsize
    frei = s.f_bavail * s.f_frsize
    belegt = gesamt - s.f_bfree * s.f_frsize
    return {'gesamt': gesamt, 'belegt': belegt, 'frei': frei,
            'pct': round(belegt * 100.0 / (belegt + frei), 1) if (belegt + frei) else None}  # wie df: ohne root-Reserve


def speicher():
    m = {}
    try:
        for z in open('/proc/meminfo'):
            k, v = z.split(':', 1)
            m[k] = int(v.strip().split()[0]) * 1024
    except Exception:
        return {}
    ges = m.get('MemTotal'); verf = m.get('MemAvailable')
    return {'gesamt': ges, 'verfuegbar': verf,
            'pct': round((ges - verf) * 100.0 / ges, 1) if ges and verf is not None else None}


def last():
    try:
        l1, l5, l15 = open('/proc/loadavg').read().split()[:3]
        return {'l1': float(l1), 'l5': float(l5), 'l15': float(l15), 'kerne': os.cpu_count()}
    except Exception:
        return {}


def updates():
    out = sh('apt list --upgradable 2>/dev/null', 120)
    zeilen = [z for z in out.splitlines() if '/' in z and 'upgradable' in z]
    sich = [z.split('/')[0] for z in zeilen if '-security' in z]
    neustart = os.path.exists('/var/run/reboot-required')
    seit = None
    if neustart:
        seit = _iso_ts(os.path.getmtime('/var/run/reboot-required'))
    pkgs = []
    try:
        pkgs = [z.strip() for z in open('/var/run/reboot-required.pkgs') if z.strip()]
    except Exception:
        pass
    ua = sh('systemctl is-active unattended-upgrades') == 'active'
    uptime = None
    try:
        uptime = int(float(open('/proc/uptime').read().split()[0]))
    except Exception:
        pass
    os_name = ''
    try:
        os_name = re.search(r'PRETTY_NAME="([^"]+)"', open('/etc/os-release').read()).group(1)
    except Exception:
        pass
    return {'ausstehend': len(zeilen), 'sicherheit': len(sich), 'sicherheit_pakete': sich[:20],
            'neustart_noetig': neustart, 'neustart_seit': seit, 'neustart_pakete': pkgs[:20],
            'automatisch': ua, 'uptime_s': uptime, 'system': os_name}


def ports():
    out = sh('ss -ltnH')
    offen = set()
    for z in out.splitlines():
        teile = z.split()
        if len(teile) < 4:
            continue
        adr = teile[3]
        if adr.startswith('127.') or adr.startswith('[::1]'):
            continue
        try:
            offen.add(int(adr.rsplit(':', 1)[1]))
        except Exception:
            pass
    offen = sorted(offen)
    return {'offen': offen, 'erwartet': PORTS_ERWARTET,
            'unerwartet': [p for p in offen if p not in PORTS_ERWARTET]}


def tls(domains):
    erg = []
    for d in domains:
        e = {'domain': d}
        try:
            ctx = ssl.create_default_context()
            with socket.create_connection((d, 443), timeout=10) as so:
                with ctx.wrap_socket(so, server_hostname=d) as s2:
                    na = s2.getpeercert()['notAfter']
            ende = datetime.datetime.strptime(na, '%b %d %H:%M:%S %Y %Z')
            e['ablauf'] = ende.isoformat() + 'Z'
            e['tage'] = (ende - _jetzt()).days
        except Exception as ex:
            e['fehler'] = str(ex)[:120]
        erg.append(e)
    return erg


def images():
    erg = []
    for z in sh("docker ps --format '{{.Names}}\t{{.Image}}'").splitlines():
        if '\t' not in z:
            continue
        name, img = z.split('\t', 1)
        erst = sh("docker image inspect --format '{{.Created}}' " + img)
        tage = None
        try:
            t = datetime.datetime.strptime(erst[:19], '%Y-%m-%dT%H:%M:%S')
            tage = (_jetzt() - t).days
        except Exception:
            pass
        erg.append({'container': name, 'image': img, 'erstellt': erst[:19], 'tage': tage})
    return erg


def docker_df():
    erg = {}
    for z in sh("docker system df --format '{{.Type}}\t{{.Size}}\t{{.Reclaimable}}'").splitlines():
        t = z.split('\t')
        if len(t) == 3:
            erg[t[0]] = {'groesse': t[1], 'frei_machbar': t[2]}
    return erg


def dbs():
    dp = sh("docker exec dealpilot-postgres psql -U dealpilot -d dealpilot_db -tAc \"SELECT pg_database_size('dealpilot_db')\"")
    mb = sh("docker exec dealpilot-mb-db psql -U mb -d marktbericht -tAc \"SELECT pg_database_size('marktbericht')\"")
    def zahl(x):
        try: return int(x)
        except Exception: return None
    return {'haupt': zahl(dp), 'marktbericht': zahl(mb)}


def verz_groesse(pfad):
    out = sh('du -sb ' + pfad + ' 2>/dev/null')
    try: return int(out.split()[0])
    except Exception: return None


def datei_info(muster):
    f = sorted(glob.glob(muster), key=os.path.getmtime, reverse=True)
    erg = []
    for p in f[:2]:
        erg.append({'datei': os.path.basename(p), 'groesse': os.path.getsize(p),
                    'zeit': _iso_ts(os.path.getmtime(p))})
    return erg


def sicherung():
    letzte = ''
    try:
        z = [x for x in open(SICHERUNG_LOG).read().splitlines() if x.strip()]
        letzte = z[-1] if z else ''
    except Exception:
        pass
    hand = glob.glob(HANDSICHERUNG + '/*')
    # Welches Skript ist WIRKLICH installiert? (crontab-Zeile + Inhalt), damit „Betrieb“ nicht gegen ein Repo-Skript prüft
    cron = [z for z in sh('crontab -l').splitlines() if 'nachtsicherung' in z]
    skript = {'cron': cron[:2]}
    try:
        import hashlib
        inhalt = open('/root/nachtsicherung.sh', 'rb').read()
        skript['sha256'] = hashlib.sha256(inhalt).hexdigest()[:16]
        skript['art'] = 'Snapshot (rsync)' if b'rsync' in inhalt else 'Voll (pg_dump + tar)'
        m = re.search(rb'tail -n \+(\d+)', inhalt)
        skript['naechte_dumps'] = int(m.group(1)) - 1 if m else None
    except Exception as ex:
        skript['fehler'] = str(ex)[:120]
    return {
        'haupt': datei_info(SICHERUNG + '/dp_*.dump'),
        'marktbericht': datei_info(SICHERUNG + '/mb_*.dump'),
        'uploads': datei_info(SICHERUNG + '/uploads_*.tar.gz'),
        'log_letzte': letzte[:300],
        'log_ok': (' ok ' in letzte) and ('FEHLER' not in letzte),
        'hand_anzahl': len(hand),
        'hand_groesse': verz_groesse(HANDSICHERUNG),
        'skript': skript,
    }


def messung(server, domains):
    return {
        'version': 'v4880', 'server': server, 'host': socket.gethostname(),
        'zeit': _jetzt_iso(),
        'platte': platte(), 'speicher': speicher(), 'last': last(),
        'updates': updates(), 'ports': ports(), 'tls': tls(domains),
        'images': images(), 'docker': docker_df(), 'db': dbs(),
        'uploads': verz_groesse(UPLOADS),
        'sicherung': sicherung(),
    }


def audit():
    out = sh('docker exec dealpilot-backend npm audit --omit=dev --json', 300)
    try:
        j = json.loads(out)
        v = (j.get('metadata') or {}).get('vulnerabilities') or {}
        namen = sorted(list((j.get('vulnerabilities') or {}).keys()))[:30]
        return {'ok': True, 'schwachstellen': v, 'pakete': namen}
    except Exception:
        return {'ok': False, 'fehler': (out or 'keine Ausgabe')[:300]}


def schreiben(server, art, daten):
    js = json.dumps(daten, ensure_ascii=False)
    if '$bt$' in js:
        raise SystemExit('Marke $bt$ im JSON, Abbruch')
    sql = "INSERT INTO betrieb_messungen (server, art, daten) VALUES ('%s', '%s', $bt$%s$bt$::jsonb);" % (server, art, js)
    r = subprocess.run('docker exec -i dealpilot-postgres psql -U dealpilot -d dealpilot_db -v ON_ERROR_STOP=1 -q',
                       shell=True, input=sql, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise SystemExit('Schreiben fehlgeschlagen: ' + r.stderr[:300])


def main():
    a = sys.argv[1:]
    server = a[a.index('--server') + 1] if '--server' in a else 'prod'
    if server not in ('prod', 'staging'):
        raise SystemExit('--server prod|staging')
    domains = DOMAINS[server]
    if '--domains' in a:
        domains = [d for d in a[a.index('--domains') + 1].split(',') if d]
    if '--audit' in a:
        art, daten = 'audit', audit()
    else:
        art, daten = 'messung', messung(server, domains)
    if '--trocken' in a:
        print(json.dumps(daten, ensure_ascii=False, indent=1))
        return
    schreiben(server, art, daten)


if __name__ == '__main__':
    main()
