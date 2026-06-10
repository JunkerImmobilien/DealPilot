// limiter.js — begrenzt gleichzeitig laufende Bericht-Jobs (Warteschlange).
// Schuetzt die externen APIs (GeoMap/OpenAI/Geoapify) vor Rate-Limit-Ueberlauf,
// wenn viele Nutzer zeitgleich Berichte erstellen. Ueberzaehlige Jobs warten kurz,
// statt parallel alle Limits zu sprengen. Kein npm-Paket noetig.
const MAX = Math.max(1, parseInt(process.env.REPORT_CONCURRENCY, 10) || 6);

let active = 0;
const waiting = [];

export function runLimited(fn) {
  return new Promise((resolve, reject) => {
    const task = () => {
      active++;
      Promise.resolve().then(fn).then(resolve, reject).finally(() => {
        active--;
        const next = waiting.shift();
        if (next) next();
      });
    };
    if (active < MAX) task();
    else waiting.push(task);
  });
}

export function limiterStats() {
  return { active, waiting: waiting.length, max: MAX };
}
