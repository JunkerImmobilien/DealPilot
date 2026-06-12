/**
 * V251-04: Demo-Objekt-Service
 * Legt fuer neue Free-Plan-User ein vorgefuelltes Beispiel-Objekt an,
 * damit sie sofort sehen wie eine komplette Analyse aussieht.
 */
const fs = require('fs');
const path = require('path');
const { query } = require('../db/pool');
const { extractSummary } = require('./objectService'); // v628-demo-kpis

const DEMO_JSON_PATH = path.resolve(__dirname, '../db/demo-object.json');

let _cachedDemo = null;

function _loadDemo() {
  if (_cachedDemo) return _cachedDemo;
  try {
    const raw = fs.readFileSync(DEMO_JSON_PATH, 'utf-8');
    _cachedDemo = JSON.parse(raw);
    return _cachedDemo;
  } catch (e) {
    console.error('[demoObjectService] Demo-JSON kann nicht geladen werden:', e.message);
    return null;
  }
}

/**
 * Legt fuer den User ein Demo-Objekt an. Idempotent — wenn der User schon
 * irgendein Objekt hat, machen wir nichts.
 */
async function assignDemoObject(userId) {
  if (!userId) throw new Error('userId required');

  const demo = _loadDemo();
  if (!demo) {
    console.warn('[demoObjectService] Demo-JSON nicht verfuegbar, skip');
    return null;
  }

  // Idempotenz: nur anlegen wenn der User noch keine Objekte hat
  const existing = await query(
    'SELECT COUNT(*)::int AS n FROM objects WHERE user_id = $1',
    [userId]
  );
  if (existing.rows[0].n > 0) {
    console.log('[demoObjectService] User hat bereits Objekte, skip Demo-Anlage');
    return null;
  }

  // Insert. Schema: id (uuid auto), user_id, name, data (jsonb),
  //                ai_analysis (text), photos (jsonb), created_at, updated_at
  const name = demo.name || 'Demo-Objekt';
  const data = demo.data || {};
  const aiAnalysis = demo.ai_analysis || null;
  const photos = demo.photos || [];

  // v628: Summary-Spalten aus dem Demo-data ableiten, damit die Sidebar-Karte
  // DSCR/CF/BMR/Score sofort zeigt (wie bei echten Objekten via create()).
  const s = extractSummary(data);
  const _num = function (v) { if (v == null) return null; const n = parseFloat(v); return (isNaN(n) || !isFinite(n)) ? null : n; };
  const result = await query(
    `INSERT INTO objects (user_id, name, kuerzel, ort, kaufpreis, bmy, cf_ns, dscr, seq_no, data, ai_analysis, photos, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::jsonb, NOW(), NOW())
     RETURNING id, name`,
    [userId, name, s.kuerzel, s.ort, _num(s.kaufpreis), _num(s.bmy), _num(s.cf_ns), _num(s.dscr),
     s.seq_no, JSON.stringify(data), aiAnalysis, JSON.stringify(photos)]
  );

  console.log('[demoObjectService] Demo-Objekt angelegt fuer User', userId, '→', result.rows[0]);
  return result.rows[0];
}

module.exports = { assignDemoObject };
