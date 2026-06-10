// stats.js — reine Statistik-Funktionen für die Vergleichsobjekt-Engine.

export function median(arr) {
  return quantile(arr, 0.5);
}

export function quantile(arr, p) {
  const a = arr.filter((x) => typeof x === 'number' && !isNaN(x)).sort((x, y) => x - y);
  if (a.length === 0) return null;
  if (a.length === 1) return a[0];
  const idx = (a.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

export function mean(arr) {
  const a = arr.filter((x) => typeof x === 'number' && !isNaN(x));
  if (!a.length) return null;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

export function stddev(arr) {
  const a = arr.filter((x) => typeof x === 'number' && !isNaN(x));
  if (a.length < 2) return 0;
  const m = mean(a);
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
  return Math.sqrt(v);
}

// Ausreißerfilter via IQR (Tukey-Fences, k=1.5).
// Gibt {kept, removed} zurück, arbeitet auf einem Werte-Selektor.
export function iqrFilter(items, selector, k = 1.5) {
  const vals = items.map(selector).filter((x) => typeof x === 'number' && !isNaN(x));
  if (vals.length < 4) return { kept: items.slice(), removed: [] };
  const q1 = quantile(vals, 0.25);
  const q3 = quantile(vals, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  const kept = [];
  const removed = [];
  for (const it of items) {
    const v = selector(it);
    if (typeof v !== 'number' || isNaN(v)) {
      kept.push(it);
    } else if (v < lo || v > hi) {
      removed.push(it);
    } else {
      kept.push(it);
    }
  }
  return { kept, removed, bounds: { lo, hi, q1, q3, iqr } };
}

// Konfidenz-Score 0..1 aus Stichprobengröße + Streuung (Variationskoeffizient).
// Wenig Objekte oder hohe Streuung => niedrige Konfidenz.
export function confidence(sampleSize, values) {
  if (!sampleSize || sampleSize < 1) return 0;
  // Größenkomponente: sättigt bei ~20 Objekten
  const sizeScore = Math.min(1, sampleSize / 20);
  // Streuungskomponente: niedriger CV => höher
  const m = mean(values);
  const sd = stddev(values);
  const cv = m ? sd / m : 1;
  const spreadScore = Math.max(0, 1 - cv * 2); // CV 0 => 1, CV 0.5 => 0
  const score = 0.6 * sizeScore + 0.4 * spreadScore;
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}

// Haversine-Distanz in Metern.
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function round(x, d = 2) {
  if (typeof x !== 'number' || isNaN(x)) return null;
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}
