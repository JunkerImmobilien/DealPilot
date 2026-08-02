// param-repository.js  (OD-02)
//
// Einzige Schreib- und Leseschnittstelle auf mb.param_werte.
// Wer Parameter braucht, fragt hier — nicht mit eigenem SQL irgendwo im Code.
//
// WICHTIG zur Schnittstelle: q() des mb-Backends liefert res.rows DIREKT
// zurueck, nicht {rows:[...]}. Ein Mock, der {rows:[]} liefert, verdeckt jeden
// .rows-Zugriff — das hat uns schon einmal neun Fehler gekostet. Alle Aufrufe
// hier behandeln das Ergebnis als Array.

import { stufeBegrenzen } from './klassen.js';

/** AGS von fein nach grob: 8 -> 5 -> 3 -> 2 -> 'de' */
export function kaskadeSchluessel(ags) {
  const t = String(ags || '').replace(/\D/g, '');
  const stufen = [];
  if (t.length >= 8) stufen.push(t.slice(0, 8));
  if (t.length >= 5) stufen.push(t.slice(0, 5));
  if (t.length >= 3) stufen.push(t.slice(0, 3));
  if (t.length >= 2) stufen.push(t.slice(0, 2));
  stufen.push('de');
  return [...new Set(stufen)];
}

export function machRepository(q) {
  if (typeof q !== 'function') throw new Error('param-repository: q() fehlt');

  return {
    /** Lauf eroeffnen -> id */
    async laufStart(ausloeser, landCodes) {
      const rows = await q(
        `INSERT INTO mb.param_lauf (ausloeser, land_codes) VALUES ($1, $2) RETURNING id`,
        [ausloeser || 'cli', landCodes && landCodes.length ? landCodes : null]
      );
      return rows && rows[0] ? rows[0].id : null;
    },

    async laufEnde(id, zahlen, protokoll) {
      if (!id) return;
      await q(
        `UPDATE mb.param_lauf
            SET beendet_am = now(), gefunden = $2, uebernommen = $3,
                verworfen = $4, fehler = $5, protokoll = $6
          WHERE id = $1`,
        [id, zahlen.gefunden | 0, zahlen.uebernommen | 0, zahlen.verworfen | 0,
         zahlen.fehler | 0, protokoll ? JSON.stringify(protokoll) : null]
      );
    },

    /**
     * Saetze schreiben. Upsert auf den Eindeutigkeits-Index, damit ein
     * Neulauf derselben Quelle nichts verdoppelt.
     * Gibt { uebernommen, verworfen } zurueck.
     */
    async schreibe(saetze, laufId) {
      let uebernommen = 0; let verworfen = 0;
      for (const s of saetze) {
        // Letzte Bremse vor der DB: klassiert kann nie besser als C sein.
        const stufe = stufeBegrenzen(s.stufe, { klassiert: s.klassiert });
        const indikativ = s.klassiert ? true : !!s.indikativ;
        if (!s.quelle_url || !s.kennzahl || !s.ags || !s.land_code) { verworfen++; continue; }
        try {
          await q(
            `INSERT INTO mb.param_werte
               (land_code, ags, ebene, gebiet_name, gaa_name, objektart, kennzahl, einheit,
                wert_num, wert_min, wert_max, klassiert, offen, wert_roh,
                stufe, indikativ, semantik_offen, berichtsjahr, stichtag,
                quelle_url, quelle_parser, lizenz, quellenvermerk, lauf_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
             ON CONFLICT (land_code, ags, ebene, objektart, kennzahl,
                          COALESCE(berichtsjahr, -1), quelle_url)
             DO UPDATE SET
               wert_num = EXCLUDED.wert_num, wert_min = EXCLUDED.wert_min,
               wert_max = EXCLUDED.wert_max, klassiert = EXCLUDED.klassiert,
               offen = EXCLUDED.offen, wert_roh = EXCLUDED.wert_roh,
               stufe = EXCLUDED.stufe, indikativ = EXCLUDED.indikativ,
               semantik_offen = EXCLUDED.semantik_offen,
               gebiet_name = EXCLUDED.gebiet_name, einheit = EXCLUDED.einheit,
               erfasst_am = now(), lauf_id = EXCLUDED.lauf_id`,
            [s.land_code, s.ags, s.ebene, s.gebiet_name || null, s.gaa_name || null,
             s.objektart || 'alle', s.kennzahl, s.einheit || null,
             s.wert_num, s.wert_min, s.wert_max, !!s.klassiert, s.offen || null, s.wert_roh || null,
             stufe, indikativ, !!s.semantik_offen, s.berichtsjahr || null, s.stichtag || null,
             s.quelle_url, s.quelle_parser, s.lizenz || null, s.quellenvermerk || null,
             laufId || null]
          );
          uebernommen++;
        } catch (e) {
          verworfen++;
          if (verworfen <= 3) console.error('  verworfen:', s.kennzahl, s.ags, e.message);
        }
      }
      return { uebernommen, verworfen };
    },

    /**
     * DIE KASKADE. Feinste verfuegbare Ebene gewinnt.
     * Liefert genau einen Treffer oder null — nie eine Liste, aus der sich
     * ein Aufrufer selbst etwas aussucht.
     */
    async hole(kennzahl, ags, objektart) {
      const schluessel = kaskadeSchluessel(ags);
      for (const s of schluessel) {
        const rows = await q(
          `SELECT * FROM mb.param_werte
            WHERE kennzahl = $1 AND ags = $2
              AND ($3::text IS NULL OR objektart = $3 OR objektart = 'alle')
              AND semantik_offen = FALSE
            ORDER BY (objektart = COALESCE($3,'alle')) DESC,
                     stufe ASC, berichtsjahr DESC NULLS LAST
            LIMIT 1`,
          [kennzahl, s, objektart || null]
        );
        if (rows && rows.length) return rows[0];
      }
      return null;
    },

    /** Alles zu einem Gebiet, fuer die Admin-Ansicht. */
    async listeGebiet(ags) {
      return q(
        `SELECT * FROM mb.param_werte
          WHERE ags = ANY($1::text[])
          ORDER BY ebene, kennzahl, objektart`,
        [kaskadeSchluessel(ags)]
      );
    },

    /** Abdeckung je Land, fuer den Admin-Reiter. */
    async abdeckung() {
      return q(
        `SELECT land_code,
                COUNT(*)                                        AS saetze,
                COUNT(*) FILTER (WHERE semantik_offen)          AS offen,
                COUNT(*) FILTER (WHERE klassiert)               AS klassiert,
                COUNT(DISTINCT ags)                             AS gebiete,
                MIN(stufe)                                      AS beste_stufe,
                MAX(erfasst_am)                                 AS zuletzt
           FROM mb.param_werte
          GROUP BY land_code
          ORDER BY land_code`
      );
    },

    /** Probe-Ergebnisse ablegen, damit sie im Admin sichtbar werden. */
    async probeSchreiben(eintraege) {
      let n = 0;
      for (const e of eintraege) {
        await q(
          `INSERT INTO mb.param_probe
             (land_code, schluessel, url, http_status, content_type, bytes, urteil, dauer_ms, fehler)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (land_code, schluessel, url) DO UPDATE SET
             geprueft_am = now(), http_status = EXCLUDED.http_status,
             content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes,
             urteil = EXCLUDED.urteil, dauer_ms = EXCLUDED.dauer_ms, fehler = EXCLUDED.fehler`,
          [e.land_code, e.schluessel, e.url, e.http_status || null, e.content_type || null,
           e.bytes || null, e.urteil || null, e.dauer_ms || null, e.fehler || null]
        );
        n++;
      }
      return n;
    },
  };
}

export default { machRepository, kaskadeSchluessel };
