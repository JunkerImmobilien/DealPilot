'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v1368 (B9) · SICHERHEIT / MISSBRAUCHSERKENNUNG — die Ansicht

   Marcels Punkt B9: „Admin-Bereich ‚Sicherheit / Missbrauchserkennung'
   mit Filtern und Fallakte."

   Über allem steht seine Auflage aus dem Lastenheft:

     „Eine technische Auffälligkeit oder ein automatisch erzeugter
      Risikoscore darf NICHT automatisch als rechtlich bewiesener
      Vertragsverstoß behandelt werden."

   DESHALB GIBT ES HIER KEINEN SPERRKNOPF. Nicht, weil er schwer zu bauen
   wäre — sondern weil ein Knopf neben einer Zahl dazu verführt, die Zahl
   für ein Urteil zu halten. Wer sperren will, tut das in der
   Nutzerverwaltung, mit dem Fall vor Augen.

   WARUM EIGENE DATEI: `admin-app.js` hat 1.700 Zeilen und trägt zehn
   Ansichten. Eine elfte hineinzuschreiben macht sie nicht besser. Die
   Datei hängt sich über `data-view="security"` selbst ein, ohne
   admin-app.js zu ändern — so bleibt die Zuständigkeit klar.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* Die Farben folgen der Marke: Statusfarben werden nicht tokenisiert,
     Grün und Rot bedeuten überall dasselbe. Gold ist hier bewusst die
     mittlere Stufe — nicht Rot, denn „auffällig" ist keine Anklage. */
  const STUFE_FARBE = { hinweis: '#7a7468', auffaellig: '#C9A84C', ernst: '#B8625C' };

  /* v1369 (B4): die Risikostufen. Die ersten vier sind Messwerte, die
     letzten drei Entscheidungen - das soll man auch sehen. Deshalb sind
     die berechneten Stufen in Grautönen und Gold, und nur die von einem
     Menschen gesetzten in Rot. Eine Maschine soll nicht rot leuchten. */
  const RISIKO_FARBE = {
    normal:         '#3FA56C',
    auffaellig:     '#C9A84C',
    warnung:        '#b8932f',
    hohes_risiko:   '#a8761f',
    eingeschraenkt: '#B8625C',
    gesperrt:       '#D8564C',
    freigegeben:    '#3FA56C'
  };
  const RISIKO_TEXT = {
    normal: 'Normal', auffaellig: 'Auffällig', warnung: 'Warnung',
    hohes_risiko: 'Hohes Risiko', eingeschraenkt: 'Eingeschränkt',
    gesperrt: 'Gesperrt', freigegeben: 'Manuell freigegeben'
  };

  const STUFE_TEXT  = { hinweis: 'Hinweis', auffaellig: 'Auffällig', ernst: 'Ernst' };

  function zeit(w) {
    if (!w) return '—';
    const d = new Date(w);
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit',
                                       hour: '2-digit', minute: '2-digit' });
  }

  /* v1368b: der Adminbereich schickt seinen Token als `X-Admin-Token`,
     NICHT als `Authorization: Bearer`. Mein erster Anlauf nahm Bearer -
     Ergebnis: HTTP 401, obwohl die Anmeldung stand.

     Gefunden nur, weil Marcel sich angemeldet hat und die Ansicht trotzdem
     leer blieb. Dieselbe Familie wie die Leser, die ins Leere greifen:
     der Code sah richtig aus, der Schlüssel stimmte sogar - nur das
     Türschild war ein anderes.

     Der Schlüsselname `dp_admin_token` und der Header stehen in
     `admin-api.js:8/14`. Hier wird nichts nachgebaut, sondern dasselbe
     gelesen. */
  function adminToken() {
    try { return localStorage.getItem('dp_admin_token') || ''; } catch (e) { return ''; }
  }

  async function hole(pfad) {
    const t = adminToken();
    const r = await fetch('/api/v1/admin' + pfad, {
      headers: t ? { 'X-Admin-Token': t } : {}
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ──────────────────────────────────────────────────────────────────
     Die Liste. Erst die verdichtete Sicht („wer fällt auf"), darunter
     die Chronik — in der Reihenfolge, in der man fragt.
     ────────────────────────────────────────────────────────────────── */
  async function laden() {
    const stufe = $('#sec-stufe') ? $('#sec-stufe').value : '';
    const tage  = $('#sec-tage')  ? $('#sec-tage').value  : '7';
    const suche = $('#sec-suche') ? $('#sec-suche').value.trim() : '';

    $('#sec-body').innerHTML = '<p style="color:#7a7468">Wird geladen …</p>';

    try {
      const q = new URLSearchParams({ tage, limit: '200' });
      if (stufe) q.set('stufe', stufe);
      if (suche) q.set('suche', suche);

      const [liste, konten] = await Promise.all([
        hole('/security/events?' + q.toString()),
        hole('/security/auffaellig?tage=' + encodeURIComponent(tage))
      ]);

      zeichneZahlen(liste.je_stufe || {}, tage);
      zeichneKonten(konten.konten || []);
      zeichneListe(liste.events || []);
    } catch (e) {
      $('#sec-body').innerHTML = '<p style="color:#B8625C">Konnte nicht geladen werden: '
        + esc(e.message) + '</p>';
    }
  }

  function zeichneZahlen(jeStufe, tage) {
    const el = $('#sec-zahlen');
    if (!el) return;
    const summe = (jeStufe.hinweis || 0) + (jeStufe.auffaellig || 0) + (jeStufe.ernst || 0);
    if (!summe) {
      el.innerHTML = '<div class="sec-leer">Keine Ereignisse in den letzten '
        + esc(tage) + ' Tagen. Das ist der Normalfall.</div>';
      return;
    }
    el.innerHTML = ['ernst', 'auffaellig', 'hinweis'].map((s) =>
      '<div class="sec-kachel"><span class="sec-kachel-n" style="color:' + STUFE_FARBE[s] + '">'
      + (jeStufe[s] || 0) + '</span><span class="sec-kachel-l">' + STUFE_TEXT[s] + '</span></div>'
    ).join('');
  }

  function zeichneKonten(konten) {
    const el = $('#sec-konten');
    if (!el) return;
    if (!konten.length) { el.innerHTML = ''; return; }

    el.innerHTML =
      '<h3 class="sec-h3">Wem ist etwas aufgefallen</h3>'
      + '<table class="data-table"><thead><tr>'
      + '<th>Konto</th><th>Ereignisse</th><th>versch. Pfade</th>'
      + '<th>höchste Stufe</th><th>zuletzt</th><th></th>'
      + '</tr></thead><tbody>'
      + konten.map((k) => {
          const wer = k.user_email
            ? esc(k.user_email)
            : '<span style="opacity:.65">anonym · ' + esc(k.ip_key || '?') + '</span>';
          const akte = k.user_id
            ? '<button class="btn btn-sm" data-sec-fall="' + esc(k.user_id) + '">Fallakte</button>'
            : '';
          return '<tr><td>' + wer + '</td>'
            + '<td>' + k.ereignisse + '</td>'
            + '<td>' + k.verschiedene_pfade + '</td>'
            + '<td><span style="color:' + STUFE_FARBE[k.hoechste_stufe] + ';font-weight:600">'
              + STUFE_TEXT[k.hoechste_stufe] + '</span></td>'
            + '<td>' + zeit(k.letztes) + '</td>'
            + '<td>' + akte + '</td></tr>';
        }).join('')
      + '</tbody></table>';
  }

  function zeichneListe(events) {
    const el = $('#sec-body');
    if (!el) return;
    if (!events.length) {
      el.innerHTML = '<p style="color:#7a7468">Keine Ereignisse für diesen Filter.</p>';
      return;
    }
    el.innerHTML =
      '<h3 class="sec-h3">Chronik</h3>'
      + '<table class="data-table"><thead><tr>'
      + '<th>Zeit</th><th>Wer</th><th>Art</th><th>Stufe</th><th>Pfad</th><th>Detail</th>'
      + '</tr></thead><tbody>'
      + events.map((e) => {
          const wer = e.user_email
            ? esc(e.user_email)
            : '<span style="opacity:.65">' + esc(e.ip_key || 'anonym') + '</span>';
          /* Das Detail trägt nur Zahlen - es gibt nichts zu verbergen und
             nichts, was ein Nutzer geschrieben hat. */
          const d = e.detail && typeof e.detail === 'object'
            ? Object.keys(e.detail).map((k) => esc(k) + ': ' + esc(e.detail[k])).join(' · ')
            : '';
          return '<tr><td style="white-space:nowrap">' + zeit(e.created_at) + '</td>'
            + '<td>' + wer + '</td>'
            + '<td>' + esc(e.art) + '</td>'
            + '<td><span style="color:' + STUFE_FARBE[e.stufe] + '">'
              + (STUFE_TEXT[e.stufe] || esc(e.stufe)) + '</span></td>'
            + '<td><code>' + esc(e.methode || '') + ' ' + esc(e.pfad || '') + '</code></td>'
            + '<td style="opacity:.75;font-size:12px">' + d + '</td></tr>';
        }).join('')
      + '</tbody></table>';
  }

  /* ──────────────────────────────────────────────────────────────────
     Die Fallakte (B19). Chronologisch, mit den zwei Kennzahlen und
     ihrem Maßstab — wer hier eine Entscheidung trifft, soll sehen,
     woran er sie misst.
     ────────────────────────────────────────────────────────────────── */
  async function fallakte(userId) {
    document.querySelectorAll('.view').forEach((v) => { v.style.display = 'none'; });
    $('#view-security-fall').style.display = 'block';
    $('#sec-fall-body').innerHTML = '<p style="color:#7a7468">Wird geladen …</p>';

    try {
      const a = await hole('/security/fall/' + encodeURIComponent(userId));
      $('#sec-fall-wer').textContent = a.nutzer ? a.nutzer.email : '';

      const m = a.muster_24h || {};
      const v = m.vergleich || {};
      /* Der Maßstab steht NEBEN der Zahl, nicht in einer Fußnote. Ohne
         ihn liest jemand „5" und weiß nicht, ob das viel ist. */
      const kennzahlen =
        '<div class="sec-mess">'
        + '<div class="sec-mess-box"><div class="sec-mess-n">' + (m.vielfalt != null ? m.vielfalt : '—')
          + '</div><div class="sec-mess-l">verschiedene Endpunktgruppen</div>'
          + '<div class="sec-mess-v">normale Nutzung: ' + (v.normalnutzung_vielfalt || '?') + '</div></div>'
        + '<div class="sec-mess-box"><div class="sec-mess-n">'
          + (m.streuung != null ? String(m.streuung).replace('.', ',') : 'zu wenig Daten')
          + '</div><div class="sec-mess-l">Unregelmäßigkeit der Abstände</div>'
          + '<div class="sec-mess-v">normale Nutzung: '
          + String(v.normalnutzung_streuung || '?').replace('.', ',') + '</div></div>'
        + '<div class="sec-mess-box"><div class="sec-mess-n">' + (m.ereignisse || 0)
          + '</div><div class="sec-mess-l">Ereignisse in 24 h</div>'
          + '<div class="sec-mess-v">&nbsp;</div></div>'
        + '</div>'
        + '<p class="sec-mess-hinweis">' + esc(v.hinweis || '') + '</p>';

      const chronik = (a.chronik || []).length
        ? '<table class="data-table"><thead><tr><th>Zeit</th><th>Art</th><th>Stufe</th>'
          + '<th>Pfad</th><th>Detail</th></tr></thead><tbody>'
          + a.chronik.map((e) => {
              const d = e.detail && typeof e.detail === 'object'
                ? Object.keys(e.detail).map((k) => esc(k) + ': ' + esc(e.detail[k])).join(' · ')
                : '';
              return '<tr><td style="white-space:nowrap">' + zeit(e.created_at) + '</td>'
                + '<td>' + esc(e.art) + '</td>'
                + '<td><span style="color:' + STUFE_FARBE[e.stufe] + '">'
                  + (STUFE_TEXT[e.stufe] || esc(e.stufe)) + '</span></td>'
                + '<td><code>' + esc(e.methode || '') + ' ' + esc(e.pfad || '') + '</code></td>'
                + '<td style="opacity:.75;font-size:12px">' + d + '</td></tr>';
            }).join('')
          + '</tbody></table>'
        : '<p style="color:#7a7468">Keine Ereignisse in den letzten 30 Tagen.</p>';

      $('#sec-fall-body').innerHTML = kennzahlen
        + '<h3 class="sec-h3">Chronik</h3>' + chronik
        + zustandsBlock(a.zustand, a.nutzer)
        + '<p class="sec-fall-fuss">' + esc(a.hinweis || '') + '</p>';

    } catch (e) {
      $('#sec-fall-body').innerHTML = '<p style="color:#B8625C">Konnte nicht geladen werden: '
        + esc(e.message) + '</p>';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     v1369 (B4) · DER ZUSTAND UND DIE ENTSCHEIDUNG
     ══════════════════════════════════════════════════════════════════
     Marcels Entscheidung: das System sperrt nie selbst. Es stuft ein und
     meldet; die Einschränkung setzt ein Mensch.

     Die Knöpfe stehen deshalb HIER, in der Fallakte - nicht in der Liste.
     Wer entscheidet, soll die Chronik über sich haben und die Kennzahlen
     daneben. Ein Knopf in einer Übersichtstabelle lädt dazu ein, nach der
     Zahl zu urteilen statt nach dem Fall.

     Und jede Entscheidung verlangt eine Begründung, bevor sie möglich
     ist - der Knopf bleibt gesperrt, solange das Feld leer ist. Nicht,
     um zu gängeln, sondern weil in der Akte sonst später eine Sperre
     steht, die niemand prüfen kann. */
  function zustandsBlock(z, nutzer) {
    if (!z) return '';
    const geltend = z.geltend || 'normal';
    const farbe = RISIKO_FARBE[geltend] || '#7a7468';
    const b = z.berechnet || {};
    const g = b.grund || {};

    /* Die Begründung der BERECHNUNG - damit sichtbar ist, warum die
       Maschine zu dieser Stufe kommt, und nicht nur, dass sie es tut. */
    let warum = '';
    if (g.ueberschreitungen != null) {
      const teile = [g.ueberschreitungen + ' Limit-Überschreitungen'
                     + (g.schwelle ? ' (Schwelle ' + g.schwelle + ')' : '')];
      if (g.vielfalt != null) {
        teile.push(g.vielfalt + ' Endpunktgruppen'
          + (g.vielfalt_grenze ? ' (Grenze ' + g.vielfalt_grenze + ')' : ''));
      }
      if (g.streuung != null) {
        teile.push('Streuung ' + String(g.streuung).replace('.', ',')
          + (g.streuung_grenze ? ' (Grenze ' + String(g.streuung_grenze).replace('.', ',') + ')' : ''));
      }
      warum = '<div class="sec-zust-warum">' + esc(teile.join(' · '))
            + ' in ' + (g.fenster_minuten || 60) + ' Minuten</div>';
    }

    let herkunft;
    if (z.durch === 'entscheidung') {
      herkunft = '<div class="sec-zust-quelle">Gesetzt von <b>' + esc(z.von || 'unbekannt')
        + '</b> am ' + zeit(z.seit) + '\u2003·\u2003berechnet wäre: <b>'
        + esc(RISIKO_TEXT[b.stufe] || b.stufe || '?') + '</b>'
        + (z.notiz ? '<div class="sec-zust-notiz">„' + esc(z.notiz) + '"</div>' : '')
        + '</div>';
    } else if (z.durch === 'freigabe') {
      herkunft = '<div class="sec-zust-quelle">Manuell freigegeben von <b>'
        + esc(z.freigegeben_von || 'unbekannt') + '</b> am ' + zeit(z.freigegeben_am)
        + (z.notiz ? '<div class="sec-zust-notiz">„' + esc(z.notiz) + '"</div>' : '')
        + '</div>';
    } else {
      herkunft = '<div class="sec-zust-quelle">Berechnet \u2014 niemand hat hier entschieden.</div>';
    }

    const uid = nutzer && nutzer.id ? nutzer.id : '';
    const knoepfe = uid
      ? '<div class="sec-entsch">'
        + '<label class="sec-entsch-l" for="sec-notiz">Begründung '
        + '<span style="opacity:.6">(Pflicht, steht später in der Akte)</span></label>'
        + '<textarea id="sec-notiz" rows="2" placeholder="Warum diese Entscheidung?"></textarea>'
        + '<div class="sec-entsch-btns">'
          + '<button class="btn" data-entsch="eingeschraenkt" data-uid="' + esc(uid)
            + '" disabled>Einschränken</button>'
          + '<button class="btn" data-entsch="gesperrt" data-uid="' + esc(uid)
            + '" disabled>Sperren</button>'
          + '<button class="btn btn-ghost" data-entsch="freigegeben" data-uid="' + esc(uid)
            + '" disabled>Freigeben</button>'
        + '</div>'
        + '<div class="sec-entsch-hinweis">Das System sperrt nie von selbst. '
        + 'Was hier gesetzt wird, gilt bis es jemand aufhebt \u2014 und bleibt '
        + 'als Eintrag in der Chronik stehen.</div>'
        + '</div>'
      : '';

    return '<div class="sec-zustand">'
      + '<div class="sec-zust-kopf">Geltender Zustand'
        + '<span class="sec-zust-wert" style="color:' + farbe + '">'
        + esc(RISIKO_TEXT[geltend] || geltend) + '</span></div>'
      + herkunft + warum + knoepfe
      + '</div>';
  }

  async function entscheiden(art, uid) {
    const feld = document.getElementById('sec-notiz');
    const notiz = feld ? feld.value.trim() : '';
    if (notiz.length < 3) return;

    const t = adminToken();
    try {
      const r = await fetch('/api/v1/admin/security/entscheidung', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
                               t ? { 'X-Admin-Token': t } : {}),
        body: JSON.stringify({ user_id: uid, art, notiz })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
      fallakte(uid);   /* neu zeichnen - der Eintrag steht jetzt in der Chronik */
    } catch (e) {
      alert('Nicht gespeichert: ' + e.message);
    }
  }

  /* ──────────────────────────────────────────────────────────────────
     Einhängen. Über Delegation, damit admin-app.js unverändert bleibt.

     ────────────────────────────────────────────────────────────────── */
  document.addEventListener('click', (ev) => {
    const nav = ev.target.closest && ev.target.closest('[data-view="security"]');
    if (nav) { setTimeout(laden, 0); return; }

    const fall = ev.target.closest && ev.target.closest('[data-sec-fall]');
    if (fall) { ev.preventDefault(); fallakte(fall.getAttribute('data-sec-fall')); return; }

    if (ev.target.id === 'sec-laden') { ev.preventDefault(); laden(); return; }

    const entschBtn = ev.target.closest && ev.target.closest('[data-entsch]');
    if (entschBtn && !entschBtn.disabled) {
      ev.preventDefault();
      entscheiden(entschBtn.getAttribute('data-entsch'), entschBtn.getAttribute('data-uid'));
      return;
    }

    if (ev.target.id === 'sec-fall-zurueck') {

      ev.preventDefault();
      document.querySelectorAll('.view').forEach((v) => { v.style.display = 'none'; });
      $('#view-security').style.display = 'block';
      laden();
    }
  });

  /* Ohne Begründung keine Entscheidung - und das sieht man, statt es
     erst beim Klick zu erfahren. */
  document.addEventListener('input', (ev) => {
    if (!ev.target || ev.target.id !== 'sec-notiz') return;
    const reicht = ev.target.value.trim().length >= 3;
    document.querySelectorAll('[data-entsch]').forEach((b) => { b.disabled = !reicht; });
  });

  document.addEventListener('keydown', (ev) => {

    if (ev.key === 'Enter' && ev.target && ev.target.id === 'sec-suche') { ev.preventDefault(); laden(); }
  });

  window.AdminSecurity = { laden, fallakte };
})();
