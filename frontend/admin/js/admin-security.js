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
  const STUFE_TEXT  = { hinweis: 'Hinweis', auffaellig: 'Auffällig', ernst: 'Ernst' };

  function zeit(w) {
    if (!w) return '—';
    const d = new Date(w);
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit',
                                       hour: '2-digit', minute: '2-digit' });
  }

  async function hole(pfad) {
    /* Denselben Weg nehmen wie der Rest des Admins - ein eigener fetch
       würde den 401-Handler umgehen. */
    if (window.API && typeof window.API.raw === 'function') return window.API.raw(pfad);
    const t = localStorage.getItem('dp_admin_token') || localStorage.getItem('admin_token') || '';
    const r = await fetch('/api/v1/admin' + pfad, {
      headers: t ? { Authorization: 'Bearer ' + t } : {}
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
      + '<table class="tbl"><thead><tr>'
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
      + '<table class="tbl"><thead><tr>'
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
        ? '<table class="tbl"><thead><tr><th>Zeit</th><th>Art</th><th>Stufe</th>'
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
        + '<p class="sec-fall-fuss">' + esc(a.hinweis || '') + '</p>';
    } catch (e) {
      $('#sec-fall-body').innerHTML = '<p style="color:#B8625C">Konnte nicht geladen werden: '
        + esc(e.message) + '</p>';
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

    if (ev.target.id === 'sec-fall-zurueck') {
      ev.preventDefault();
      document.querySelectorAll('.view').forEach((v) => { v.style.display = 'none'; });
      $('#view-security').style.display = 'block';
      laden();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target && ev.target.id === 'sec-suche') { ev.preventDefault(); laden(); }
  });

  window.AdminSecurity = { laden, fallakte };
})();
